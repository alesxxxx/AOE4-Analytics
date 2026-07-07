import { allPlayers, normalizeTeams, type Game } from '@api/types'
import {
  evaluateLiveMatch,
  buildLiveMatchInfo,
  buildLiveMatchup,
  type LiveMatchInfo,
} from '@domain/liveMatch'
import { buildScoutReport, pickPrimaryMode } from '@domain/scouting'
import { sessionSummary, type SessionSummary } from '@domain/session'
import type { RankInfo } from '@domain/types'
import type { GameClock } from '@domain/localStats'
import { getClient, getHistoryStore, getMainWindow, getSettings } from './appContext'
import { analyzeRecentGames, listHistory } from './analysisService'
import { IpcChannels, type PostGameSummary } from '../ipc/contract'
import { getGameClock, getLiveTeamMatchup, getSessionState } from './localDataService'
import { isGameRunning } from './gameProcess'
import type { OverlayController } from './overlayController'
import type { ApmTracker } from './apmService'

const HIDE_AFTER_MS = 20_000
/** Keep the post-game results card up long enough to read (or until the next match). */
const POSTGAME_HIDE_MS = 90_000

/**
 * Builds the post-game results card from the most-recent analyzed match — only if
 * it's the game that just finished (analyzed in the last few minutes). Maps the
 * coaching signals to "did well" (good) vs "improve" (minor/major).
 */
async function buildPostGame(): Promise<{ summary: PostGameSummary; matchId: string } | null> {
  const res = await listHistory(1)
  if (!res.ok) return null
  const m = res.data[0]
  if (!m) return null
  // Recency guard against showing a STALE game: measure from the game's END
  // (start + duration), not its start — guarding on createdAt/start silently
  // dropped the victory card for any game longer than the window.
  const endMs = Date.parse(m.playedAt) + (m.durationSec ?? 0) * 1000
  const sinceEndMs = Date.now() - endMs
  if (!Number.isFinite(sinceEndMs) || sinceEndMs > 10 * 60_000) return null
  const titles = (sevs: string[]): string[] =>
    m.analysis.signals.filter((s) => sevs.includes(s.severity)).map((s) => s.title)
  return {
    matchId: m.id,
    summary: {
      result: m.result,
      civ: m.civ,
      oppCiv: m.oppCiv,
      map: m.map,
      grade: m.analysis.grade,
      apm: m.analysis.apm,
      durationSec: m.durationSec,
      didWell: titles(['good']).slice(0, 3),
      improve: titles(['major', 'minor']).slice(0, 3),
      vsAI: !!m.vsAI,
    },
  }
}

const EMPTY_LIVE: LiveMatchInfo = {
  isLive: false,
  isStale: false,
  source: 'no-game',
  processRunning: null,
  custom: false,
  myCiv: null,
  opponent: null,
  map: null,
  startedAt: null,
}

/**
 * Polls `games/last` and FUSES it with the game-process check and the local
 * session detector to decide whether a match is live RIGHT NOW (A3) — so a
 * stale "last game" is never shown as the current matchup. Drives the
 * overlay and exposes the current `LiveMatchInfo` for the dashboard.
 */
export class PollManager {
  private timer: ReturnType<typeof setTimeout> | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  /** game_id currently shown as live (-1 = a custom/local game without an API id). */
  private shownGameId: number | null = null
  /** opponent profile id currently scouted (so we don't re-scout each tick). */
  private shownOppId: number | null = null
  /** Monotonic counter giving each custom/AI match a stable, unique overlay id. */
  private customMatchSeq = 0
  /** The current custom/AI match id while we resolve its civs from temp.rec. */
  private liveCustomMatchId: string | null = null
  /** Last civ matchup pushed for the custom game ("myCiv|oppCiv") — skip duplicates. */
  private lastCustomCivSig: string | null = null
  /** True once BOTH civs are read from temp.rec, so we stop re-reading mid-game. */
  private customMatchupResolved = false
  private liveInfo: LiveMatchInfo = EMPTY_LIVE
  /**
   * Game-clock pusher: the parsed anchor (sim start + pauses) is re-read once
   * per poll tick (cheap — readLogTail caches by size+mtime) and re-pushed to
   * the overlay every second; the renderer derives elapsed from anchor + its
   * wall clock, so the log is never read between ticks.
   */
  private clockTimer: ReturnType<typeof setInterval> | null = null
  private clockAnchor: GameClock | null = null
  /**
   * Today's session line ("3W–1L +42"), carried on every overlay update.
   * Refreshed at match start and again after the post-game fold so the
   * just-finished game counts; null until the first finished game today.
   */
  private session: SessionSummary | null = null

  constructor(
    private readonly overlay: OverlayController,
    private readonly apm?: ApmTracker,
  ) {}

  getLiveInfo(): LiveMatchInfo {
    return this.liveInfo
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleNext(1000)
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    if (this.hideTimer) clearTimeout(this.hideTimer)
    if (this.clockTimer) clearInterval(this.clockTimer)
    this.clockTimer = null
  }

  private scheduleNext(delay: number): void {
    if (!this.running) return
    this.timer = setTimeout(() => {
      // A throw anywhere in the tick must not become a recurring unhandled
      // rejection (every path inside is individually guarded today, but the
      // loop itself shouldn't depend on that staying true).
      void this.tick()
        .catch((err) => console.error('[poll] tick failed:', err))
        .finally(() => {
          const polling = getSettings().getAll().polling
          // Poll fast whenever the GAME IS OPEN (live, or process up and a match is
          // loading) so the matchup resolves in a few seconds instead of ~20s; fall
          // back to the polite idle cadence only when AoE4 is closed (D9).
          const gameOpen = this.liveInfo.isLive || this.liveInfo.processRunning === true
          const interval = gameOpen ? polling.activeIntervalMs : polling.idleIntervalMs
          this.scheduleNext(interval)
        })
    }, delay)
  }

  private async tick(): Promise<void> {
    const settings = getSettings().getAll()

    // Cheap, FREE signals first (no API): is the game process up, and does the
    // local session log say we're in a match? These gate whether we spend an
    // AoE4World call at all. When the foreground watcher already reports AoE4
    // as the foreground window, the process is necessarily running — skip the
    // tasklist spawn for this tick.
    const processRunning = this.overlay.isGameProcessForeground() ? true : await isGameRunning()

    let localInMatch: boolean | null = null
    // Skip the warnings.log read when the game is known to be closed — the
    // session state would be 'not-running' anyway.
    if (settings.localData.consentGranted && processRunning !== false) {
      const state = getSessionState(processRunning === true)
      localInMatch = state === 'in-match' ? true : state === 'menu' ? false : null
    }
    // Gate the live-APM counter on actually being in a match (≈ while playing).
    this.apm?.setInMatch(localInMatch === true)

    // Only hit AoE4World when we're actually LOADING INTO / IN a game (the local
    // detector flipped to in-match), or we're already tracking a shown match (to
    // catch its end), or we have no local signal to gate on (non-Windows) and the
    // process is up. Sitting in menus or with the game closed costs ZERO API
    // calls — no more 24/7 polling of the public API.
    const alreadyTracking = this.shownGameId != null
    const noLocalSignal = localInMatch === null
    const shouldQuery =
      settings.profileId != null &&
      processRunning !== false &&
      (localInMatch === true || alreadyTracking || noLocalSignal)

    let game: Game | null = null
    if (shouldQuery) {
      game = await getClient()
        .getLastGame(settings.profileId!)
        .catch(() => null)
    }

    const live = evaluateLiveMatch({ game, localInMatch, processRunning, nowMs: Date.now() })
    this.liveInfo = buildLiveMatchInfo(game, live, processRunning, settings.profileId)

    // Game-clock producer: re-anchor from the log each tick while live (picks up
    // pauses) and keep the 1s push loop running; stop + reset when not live.
    if (live.isLive) {
      this.clockAnchor = getGameClock()
      this.startClockPush()
    } else {
      this.stopClockPush()
    }

    if (live.isLive) {
      if (live.source === 'ongoing' && game) {
        // Ranked/QM live game from AoE4World — the opponent is in the game object.
        if (game.game_id !== this.shownGameId) {
          this.shownGameId = game.game_id
          // AoE4World confirmed this is a ranked/QM game — its opponent + civs come
          // from the game object, so stop the temp.rec custom-matchup pusher.
          this.liveCustomMatchId = null
          this.shownOppId =
            allPlayers(game).find((p) => p.profile_id !== settings.profileId)?.profile_id ?? null
          await this.onStarted({
            // game_id is intrinsic to the match, so it stays stable across the
            // post-scout refresh AND a transient ongoing→ended→ongoing flicker.
            matchId: String(game.game_id),
            opponentProfileId: this.shownOppId,
            map: this.liveInfo.map,
            myCiv: this.liveInfo.myCiv,
            oppCiv: this.liveInfo.opponent?.civ ?? null,
            startedAt: this.liveInfo.startedAt,
            custom: false,
            game,
            myProfileId: settings.profileId,
          })
        }
      } else if (this.shownGameId == null) {
        // Custom/private/vs-AI lobby: AoE4World can't see it. But the game records
        // itself live to playback/temp.rec, whose header has every player's civ —
        // so we CAN show the matchup. Open the overlay now (civs unknown for a beat
        // while the .rec header is written); pushCustomMatchup fills them in below.
        this.shownGameId = -1
        this.shownOppId = null
        this.customMatchSeq += 1
        this.liveCustomMatchId = `custom:${this.customMatchSeq}`
        this.lastCustomCivSig = null
        this.customMatchupResolved = false
        await this.onStarted({
          matchId: this.liveCustomMatchId,
          opponentProfileId: null,
          map: null,
          myCiv: null,
          oppCiv: null,
          startedAt: null,
          custom: true,
          game: null,
          myProfileId: settings.profileId,
        })
      }
      // Each tick while a custom/AI game is live, read the roster from warnings.log
      // (the live-readable ToS-safe source for games AoE4World can't see).
      if (this.liveCustomMatchId) {
        this.pushCustomMatchup(this.liveCustomMatchId)
      }
    } else if (this.shownGameId != null) {
      this.shownGameId = null
      this.shownOppId = null
      this.liveCustomMatchId = null
      this.lastCustomCivSig = null
      this.customMatchupResolved = false
      await this.onEnded(game)
    }
  }

  /**
   * Recomputes today's session summary from stored history — a raw store read
   * (listMatches), NOT listHistory, so a poll tick never triggers the summary
   * enrichment that listHistory performs as a side effect.
   */
  private async refreshSession(): Promise<void> {
    try {
      const store = await getHistoryStore()
      const s = sessionSummary(store.listMatches(60), Date.now(), {
        excludeAi: getSettings().getAll().localData.excludeAiFromStats,
      })
      this.session = s.games > 0 ? s : null
    } catch {
      this.session = null
    }
  }

  private async onStarted(ctx: {
    matchId: string
    opponentProfileId: number | null
    map: string | null
    myCiv: string | null
    oppCiv: string | null
    startedAt: string | null
    custom: boolean
    game?: Game | null
    myProfileId: number | null
  }): Promise<void> {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
    await this.refreshSession()
    const kind = ctx.game ? kindLabel(ctx.game) : null
    this.overlay.sendUpdate({
      matchState: 'ongoing',
      scout: null,
      myCiv: ctx.myCiv,
      map: ctx.map,
      startedAt: ctx.startedAt,
      custom: ctx.custom,
      matchId: ctx.matchId,
      oppCiv: ctx.oppCiv,
      oppName: null,
      oppIsAI: false,
      matchup: null,
      kind,
      session: this.session,
    })
    this.overlay.show()

    // Custom/AI games have no live game object → no matchup bar / scout.
    if (!ctx.game || ctx.custom) return
    try {
      const client = getClient()
      // One batch: every participant's profile (for ranks + the opponent scout).
      const ids = allPlayers(ctx.game).map((p) => p.profile_id)
      const players = await Promise.all(ids.map((id) => client.getPlayer(id).catch(() => null)))
      const rankByProfileId = new Map<number, RankInfo | null>(
        ids.map((id, i) => [id, players[i] ? pickPrimaryMode(players[i]!.modes) : null]),
      )
      const matchup = buildLiveMatchup(ctx.game, ctx.myProfileId, rankByProfileId)

      let scout = null
      if (ctx.opponentProfileId != null) {
        const oppPlayer = players[ids.indexOf(ctx.opponentProfileId)] ?? null
        const gamesRes = await client
          .getPlayerGames(ctx.opponentProfileId, { limit: 20 })
          .catch(() => null)
        if (oppPlayer && gamesRes)
          scout = buildScoutReport({ player: oppPlayer, games: gamesRes.games })
      }

      this.overlay.sendUpdate({
        matchState: 'ongoing',
        scout,
        myCiv: ctx.myCiv,
        map: ctx.map,
        startedAt: ctx.startedAt,
        custom: ctx.custom,
        matchId: ctx.matchId,
        oppCiv: ctx.oppCiv,
        oppName: null, // ranked uses scout.name
        oppIsAI: false,
        matchup,
        kind,
        session: this.session,
      })
    } catch {
      // private profile / network — keep the "scouting…" state
    }
  }

  /** Starts the 1s game-clock push loop (idempotent) and pushes immediately. */
  private startClockPush(): void {
    if (this.clockTimer) return
    this.overlay.sendGameClock(this.clockAnchor)
    this.clockTimer = setInterval(() => this.overlay.sendGameClock(this.clockAnchor), 1000)
  }

  /** Stops the game-clock loop and resets the overlay's clock (idempotent). */
  private stopClockPush(): void {
    if (!this.clockTimer) return
    clearInterval(this.clockTimer)
    this.clockTimer = null
    this.clockAnchor = null
    this.overlay.sendGameClock(null)
  }

  /**
   * Reads the live matchup from warnings.log and pushes it to the overlay the
   * moment it resolves (a beat into the game, once the roster lines are written).
   * The roster can't change mid-game, so once BOTH civs are known we stop reading.
   */
  private pushCustomMatchup(matchId: string): void {
    if (this.customMatchupResolved) return
    const matchup = getLiveTeamMatchup(getSettings().getAll().profileId)
    const myTeam = matchup?.teams[0] ?? []
    const enemyTeam = matchup?.teams[1] ?? []
    const me = myTeam.find((p) => p.isMe) ?? myTeam[0] ?? null
    const opp = enemyTeam[0] ?? null
    const myCiv = me?.civ ?? null
    const oppCiv = opp?.civ ?? null
    if (!matchup) return
    if (myCiv == null && oppCiv == null) return
    if (matchup.teams.length >= 2 && matchup.teams.flat().every((p) => p.civ != null)) {
      this.customMatchupResolved = true
    }
    const sig = matchup.teams
      .map((team) => team.map((p) => p.civ ?? '?').join(','))
      .join('|')
    if (sig === this.lastCustomCivSig) return
    this.lastCustomCivSig = sig
    this.overlay.sendUpdate({
      matchState: 'ongoing',
      scout: null,
      myCiv,
      map: null,
      startedAt: null,
      custom: true,
      matchId,
      oppCiv,
      oppName: enemyTeam.length > 1 ? 'Enemy Team' : (opp?.name ?? null),
      oppIsAI: enemyTeam.length > 0 && enemyTeam.every((p) => p.isAI),
      matchup,
      kind: 'Custom / AI',
      session: this.session,
    })
  }

  private async onEnded(game: Game | null): Promise<void> {
    const base = {
      matchState: 'ended' as const,
      scout: null,
      myCiv: null,
      map: game?.map ?? null,
      startedAt: game?.started_at ?? null,
      custom: false,
      matchId: null,
      oppCiv: null,
      oppName: null,
      oppIsAI: false,
      matchup: null,
      kind: null,
    }
    // Show "analyzing…" immediately, keep the overlay up, then push the results
    // card once the just-finished game has been analyzed + folded into history.
    this.overlay.sendUpdate({ ...base, postGame: null, session: this.session })
    this.overlay.show()
    let postGame: { summary: PostGameSummary; matchId: string } | null = null
    try {
      await analyzeRecentGames(10) // also folds a just-finished custom/AI game
      postGame = await buildPostGame()
    } catch {
      // best-effort
    }
    // The just-finished game is folded now — today's line includes it.
    await this.refreshSession()
    if (postGame) {
      this.overlay.sendUpdate({ ...base, postGame: postGame.summary, session: this.session })
      // The user's requested flow: after a win/loss the APP comes to the front
      // on that game's full summary (the desktop score screen). Toggleable.
      if (getSettings().getAll().openSummaryOnGameEnd) this.openAppOnSummary(postGame.matchId)
    }
    if (this.hideTimer) clearTimeout(this.hideTimer)
    // Respect an explicit user toggle during the post-game window: if the user
    // Alt+O'd (or Settings-toggled) the overlay after the match ended, the
    // timed auto-hide backs off instead of clobbering their choice.
    const toggleSeqAtEnd = this.overlay.getManualToggleSeq()
    this.hideTimer = setTimeout(() => {
      if (this.overlay.getManualToggleSeq() === toggleSeqAtEnd) this.overlay.hide()
    }, postGame ? POSTGAME_HIDE_MS : HIDE_AFTER_MS)
  }

  /** Bring the dashboard to the front, opened on the finished game's summary. */
  private openAppOnSummary(matchId: string): void {
    const win = getMainWindow()
    if (!win) return
    win.webContents.send(IpcChannels.appOpenGame, matchId)
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

/** A center-label for the matchup bar, e.g. "Ranked 1v1" / "Quick Match 2v2". */
function kindLabel(game: Game): string {
  const sizes = normalizeTeams(game)
    .map((t) => t.length)
    .join('v')
  const k = game.kind || game.leaderboard || ''
  const prefix = k.startsWith('rm') ? 'Ranked' : k.startsWith('qm') ? 'Quick Match' : ''
  return prefix ? `${prefix} ${sizes}` : sizes
}
