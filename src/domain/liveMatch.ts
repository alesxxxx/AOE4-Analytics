/**
 * Live-match evaluation (pure). AoE4World has no "in-game" endpoint — `games/last`
 * always returns the most recent game whether or not it's live, and the `ongoing`
 * flag lags the real game by up to a couple of minutes. So we FUSE three signals
 * to decide whether the displayed game is the one being played RIGHT NOW:
 *
 *   1. process running — is `RelicCardinal.exe` up? (cheap, no consent needed)
 *   2. AoE4World `ongoing` — definitive when present, but latent
 *   3. local session detector — real-time in-match from warnings.log (consent)
 *
 * `isLive` = process-not-closed AND (`ongoing` OR local-in-match). A game from
 * two nights ago is neither ongoing nor local-in-match → never treated as live.
 */
import { normalizeTeams, type Game } from '../api/types'
import type { RankInfo } from './types'
import { pickPrimaryMode } from './scouting'
import type { LiveMatchupPlayer } from './localStats'
import { resolveReplayCiv } from './replay'

export type LiveSource =
  'ongoing' | 'local' | 'just_finished' | 'recent' | 'stale' | 'no-game' | 'process-closed'

export interface LiveEvalInput {
  /** The `games/last` result, or null if none. */
  game: Game | null
  /** Local session detector: true=in match, false=in menu, null=unknown (no consent / non-Windows). */
  localInMatch: boolean | null
  /** Is the game process running? true/false, or null if undetectable (non-Windows). */
  processRunning: boolean | null
  nowMs: number
  /** A finished game newer than this is "recent" (last game), else "stale". */
  recentMs?: number
}

export interface LiveEval {
  /** The displayed game is the one being played right now. */
  isLive: boolean
  /** A non-live game that's an old finished result (don't present as current). */
  isStale: boolean
  source: LiveSource
}

export function evaluateLiveMatch(input: LiveEvalInput): LiveEval {
  const { game, localInMatch, processRunning, nowMs } = input

  // Game process is closed → we are definitely not in a match.
  if (processRunning === false) {
    return { isLive: false, isStale: !!game, source: 'process-closed' }
  }
  // AoE4World confirms the game is ongoing — BUT the local log is real-time and
  // AoE4World's `ongoing` flag lags by minutes AFTER a game ends, so a definitive
  // local 'menu' (localInMatch === false) overrides a stale `ongoing` (otherwise
  // the overlay stays "in game" for minutes after you've already won/lost).
  if (game?.ongoing && localInMatch !== false) {
    return { isLive: true, isStale: false, source: 'ongoing' }
  }
  // Local logs confirm we're in a match (beats AoE4World latency).
  if (localInMatch === true) return { isLive: true, isStale: false, source: 'local' }

  if (!game) return { isLive: false, isStale: false, source: 'no-game' }
  if (game.just_finished) return { isLive: false, isStale: false, source: 'just_finished' }

  const ageMs = nowMs - Date.parse(game.started_at)
  const recent = Number.isFinite(ageMs) && ageMs <= (input.recentMs ?? 15 * 60_000)
  return { isLive: false, isStale: !recent, source: recent ? 'recent' : 'stale' }
}

export interface LiveOpponent {
  profileId: number
  name: string
  civ: string
  rankLevel: string | null
  rating: number | null
}

/** A public live-game roster row. No per-player requests are needed to build it. */
export interface LiveTeamRosterPlayer {
  profileId: number
  name: string
  civ: string | null
  isMe: boolean
}

/** One player in the full-matchup bar (both teams, all players). */
export interface MatchupPlayer {
  profileId: number
  name: string
  civ: string | null
  rating: number | null
  rank: number | null
  rankLevel: string | null
  isMe: boolean
  isAI: boolean
}

/** The live matchup for the overlay bar. `teams[0]` is always MY team. */
export interface LiveMatchup {
  teams: MatchupPlayer[][]
}

/**
 * Builds the full matchup (every player on both teams) for the overlay bar.
 * Civ + rating come straight from the ongoing game; rank/rankLevel come from a
 * per-player profile lookup (null when a profile is private/missing). My team is
 * reordered to `teams[0]` so the bar puts me on the left.
 */
export function buildLiveMatchup(
  game: Game,
  myProfileId: number | null,
  rankByProfileId: Map<number, RankInfo | null>,
): LiveMatchup {
  const teams = normalizeTeams(game).map((team) =>
    team.map((p): MatchupPlayer => {
      const ri = rankByProfileId.get(p.profile_id) ?? null
      return {
        profileId: p.profile_id,
        name: p.name,
        civ: p.civilization,
        rating: p.rating ?? p.mmr ?? null,
        rank: ri?.rank ?? null,
        rankLevel: ri?.rankLevel ?? null,
        isMe: myProfileId != null && p.profile_id === myProfileId,
        isAI: false,
      }
    }),
  )
  const mineIdx = teams.findIndex((t) => t.some((p) => p.isMe))
  if (mineIdx > 0) {
    const [mine] = teams.splice(mineIdx, 1)
    if (mine) teams.unshift(mine)
  }
  return { teams }
}

/**
 * Builds a full matchup from the live `warnings.log` roster. This is the custom /
 * AI path: the log gives us every player's team number and civ token, but no
 * ladder rank/rating. Team containing the local user is moved to `teams[0]`.
 */
export function buildLocalLiveMatchup(
  players: LiveMatchupPlayer[],
  myProfileId: number | null,
): LiveMatchup | null {
  if (players.length === 0) return null
  const mapped = players.map((p): MatchupPlayer & { team: number; slot: number } => {
    const civ = resolveReplayCiv(p.civToken)
    return {
      team: p.team,
      slot: p.slot,
      profileId: p.id,
      name: p.name,
      civ: civ.slug,
      rating: null,
      rank: null,
      rankLevel: null,
      isMe: myProfileId != null && p.id === myProfileId,
      isAI: p.ai,
    }
  })

  if (!mapped.some((p) => p.isMe)) {
    const humans = mapped.filter((p) => !p.isAI)
    if (humans.length === 1) humans[0]!.isMe = true
  }

  const teamKeys = new Set(mapped.map((p) => p.team))
  const oneHumanVsAi =
    teamKeys.size === 1 &&
    mapped.length >= 2 &&
    mapped.filter((p) => !p.isAI).length === 1 &&
    mapped.some((p) => p.isAI)

  const byTeam = new Map<number, (MatchupPlayer & { team: number; slot: number })[]>()
  for (const p of mapped) {
    const teamKey = oneHumanVsAi ? (p.isAI ? 1 : 0) : p.team
    const team = byTeam.get(teamKey) ?? []
    team.push(p)
    byTeam.set(teamKey, team)
  }

  const teams = [...byTeam.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, team]) =>
      team.sort((a, b) => a.slot - b.slot).map(({ team: _team, slot: _slot, ...player }) => player),
    )

  const mineIdx = teams.findIndex((t) => t.some((p) => p.isMe))
  if (mineIdx > 0) {
    const [mine] = teams.splice(mineIdx, 1)
    if (mine) teams.unshift(mine)
  }

  return { teams }
}

/** The current live-match state, fused from process + AoE4World + local logs. */
export interface LiveMatchInfo {
  isLive: boolean
  isStale: boolean
  source: string
  processRunning: boolean | null
  /**
   * True when the live game is a custom/private/vs-AI lobby that AoE4World can't
   * see. There is no live opponent scout for these, and `games/last` would be a
   * different (previous) game — so opponent/civ/map/startedAt are all left null.
   */
  custom: boolean
  myCiv: string | null
  opponent: LiveOpponent | null
  /**
   * Full public-game roster, with the user's side at index 0. Null for custom
   * matches or when the current user cannot be located in the upstream roster.
   */
  teams?: LiveTeamRosterPlayer[][] | null
  map: string | null
  startedAt: string | null
}

/**
 * Builds the live-match representation shown by the dashboard + overlay.
 *
 * THE RULE: only an AoE4World `ongoing` game is the real current match. When the
 * match was detected by the local session logs (`source: 'local'`, a custom/AI
 * game), `games/last` is the *previous* ranked game — using its opponent, civs,
 * map or start time would show the wrong matchup and a nonsense timer. So for any
 * non-`ongoing` live source we deliberately keep all of that null and flag it
 * `custom`, letting the UI say "custom/AI game" honestly.
 */
export function buildLiveMatchInfo(
  game: Game | null,
  live: LiveEval,
  processRunning: boolean | null,
  myId: number | null,
): LiveMatchInfo {
  const base: LiveMatchInfo = {
    isLive: live.isLive,
    isStale: live.isStale,
    source: live.source,
    processRunning,
    custom: live.isLive && live.source !== 'ongoing',
    myCiv: null,
    opponent: null,
    teams: null,
    map: null,
    startedAt: null,
  }
  if (!live.isLive || live.source !== 'ongoing' || !game) return base

  const normalized = normalizeTeams(game)
  const myTeamIdx =
    myId == null ? -1 : normalized.findIndex((team) => team.some((p) => p.profile_id === myId))
  const hasCompleteRoster =
    myTeamIdx >= 0 && normalized.length >= 2 && normalized.every((team) => team.length > 0)
  const teams = hasCompleteRoster
    ? normalized.map((team) =>
        team.map((player): LiveTeamRosterPlayer => ({
          profileId: player.profile_id,
          name: player.name,
          civ: player.civilization || null,
          isMe: player.profile_id === myId,
        })),
      )
    : null
  if (teams && myTeamIdx > 0) {
    const [mine] = teams.splice(myTeamIdx, 1)
    if (mine) teams.unshift(mine)
  }

  const players = normalized.flat()
  const me = myId != null ? players.find((p) => p.profile_id === myId) : undefined
  // In team formats, the first non-self player may be an ally. Prefer the first
  // player outside the user's team, then retain the old 1v1/malformed fallback.
  const enemyProfileId = teams?.slice(1).flat()[0]?.profileId ?? null
  const opp =
    (enemyProfileId != null
      ? players.find((player) => player.profile_id === enemyProfileId)
      : undefined) ??
    (myId != null ? players.find((p) => p.profile_id !== myId) : players[1]) ??
    null
  const primary = opp?.modes ? pickPrimaryMode(opp.modes) : null
  return {
    ...base,
    myCiv: me?.civilization ?? null,
    teams,
    map: game.map,
    startedAt: game.started_at,
    opponent: opp
      ? {
          profileId: opp.profile_id,
          name: opp.name,
          civ: opp.civilization,
          rankLevel: primary?.rankLevel ?? null,
          rating: primary?.rating ?? opp.rating ?? opp.mmr ?? null,
        }
      : null,
  }
}
