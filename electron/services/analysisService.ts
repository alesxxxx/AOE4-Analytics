import type { AnalyzeResult, IpcResult } from '@ipc/contract'
import type { Game, MatchupStatsResponse } from '@api/types'
import type { RelicRecentMatchHistoryResponse } from '@api/relicTypes'
import type { StoredMatch } from '@store/historyStore'
import type {
  AnalyzedGame,
  LocalGameStats,
  PerPlayerMatchStats,
  ResourceTotals,
} from '@domain/analysis'
import {
  analyzeMatch,
  extractAnalyzedGame,
  opponentName,
  resultFromPerPlayer,
} from '@domain/analysis'
import { bracketFromRankLevel, getBenchmarks } from '@domain/benchmarks'
import { checkGoals, generateGoals } from '@domain/goals'
import { pickPrimaryMode } from '@domain/scouting'
import { buildLocalAnalyzedGame } from '@domain/localGame'
import { teamFormat } from '@domain/gameFormat'
import { normalizePublicMatchIdentifiers } from '@domain/dataStudio'
import { replayMatchup, type ReplayInfo, type ReplayMatchup } from '@domain/replay'
import { perPlayerStatsFromMatch } from '@domain/relic'
import { getClient, getHistory, getHistoryStore, getRelicClient, getSettings } from './appContext'
import {
  getLatestLocalGameResult,
  getLatestLocalStats,
  getLiveTeamMatchup,
  getTempReplay,
  listLocalGames,
  readGameSummary,
} from './localDataService'
import { fetchRankedSummary, getSteamAuthStatus } from './relicAuthService'
import { hasCachedSummary, hasUnavailableSummary, readCachedParsedSummary } from './summaryCache'
import {
  landmarksBuilt,
  tallyLandmarkRecord,
  type LandmarkBuilt,
  type LandmarkRecordRow,
} from '@domain/landmarkRecord'
import { summaryPlayerForMe } from '@domain/summaryCoaching'
import {
  civFromToken,
  type MatchSummary,
  type PlayerSummary,
  type ResourceAmounts,
} from '@domain/statsSummary'
import { getSteamAccounts } from './steamService'
import { err, errFrom, ok } from './result'
import type { CreatedHistoryStore } from '@store/historyStoreFactory'

/**
 * A stored team-format game (2v2+) that predates team-roster capture — it has a
 * team `format` but no `oppTeam`, so a Sync should re-fold it to backfill the
 * full lineup (extractAnalyzedGame now populates myTeam/oppTeam). 1v1 games and
 * already-backfilled games are left alone.
 */
function needsRosterBackfill(m: StoredMatch): boolean {
  const isTeamFormat = m.format != null && m.format !== '1v1' && /\dv\d|FFA/.test(m.format)
  return isTeamFormat && (m.oppTeam?.length ?? 0) === 0
}

type PublicGameMetadata = Pick<StoredMatch, 'patch' | 'season'>

/** Keeps upstream identifiers verbatim enough to filter while rejecting empty/invalid values. */
function publicGameMetadata(game: Game): Partial<PublicGameMetadata> {
  return normalizePublicMatchIdentifiers(game)
}

function mergePublicGameMetadata(match: StoredMatch, game: Game): StoredMatch {
  const metadata = publicGameMetadata(game)
  if (metadata.patch === undefined && metadata.season === undefined) return match
  if (
    (metadata.patch === undefined || metadata.patch === match.patch) &&
    (metadata.season === undefined || metadata.season === match.season)
  ) {
    return match
  }
  return { ...match, ...metadata }
}

/**
 * Fetches the user's recent Relic matches and indexes their per-player counters
 * stats (production/kills/deaths/tech/APM — the numbers behind AoE4World's
 * post-game Comparison table) by game id. Relic's match `id` equals AoE4World's
 * `game_id`, so this keys straight onto the games we fold. Best-effort: any Relic
 * error yields an empty map (games still store, just without `perPlayer`).
 */
async function getRecentRelicMatchHistory(
  profileId: number,
): Promise<RelicRecentMatchHistoryResponse | null> {
  try {
    return await getRelicClient().getRecentMatchHistory(profileId)
  } catch {
    return null
  }
}

function relicPerPlayerStatsByGameId(
  recent: RelicRecentMatchHistoryResponse | null,
): Map<string, PerPlayerMatchStats[]> {
  const map = new Map<string, PerPlayerMatchStats[]>()
  if (!recent) return map
  for (const m of recent.matchHistoryStats) {
    const stats = perPlayerStatsFromMatch(m)
    if (stats.length > 0) map.set(String(m.id), stats)
  }
  return map
}

function matchupLookup(stats: MatchupStatsResponse | null) {
  const map = new Map<string, number>()
  if (stats) {
    for (const m of stats.data) map.set(`${m.civilization}|${m.other_civilization}`, m.win_rate)
  }
  return (civ: string, other: string | null): number | null =>
    other ? (map.get(`${civ}|${other}`) ?? null) : null
}

function resourceTotal(r: ResourceAmounts): number {
  return r.food + r.wood + r.gold + r.stone
}

function roundResources(r: ResourceAmounts): ResourceTotals {
  return {
    food: Math.round(r.food),
    wood: Math.round(r.wood),
    gold: Math.round(r.gold),
    stone: Math.round(r.stone),
  }
}

function summaryPlayerFor(
  summary: MatchSummary,
  profileId: number | null,
  civ: string | null,
): PlayerSummary | null {
  if (profileId != null) {
    // Exact match on the Relic profile id from the STPD header (works even in
    // mirror matchups — same civ on both sides).
    const byProfile = summary.players.find((p) => p.profileId === profileId)
    if (byProfile) return byProfile
  }
  if (civ) {
    const byCiv = summary.players.filter((p) => civFromToken(p.civToken) === civ)
    if (byCiv.length === 1) return byCiv[0]!
  }
  return summary.players.length === 1 ? summary.players[0]! : null
}

function localStatsFromSummary(
  summary: MatchSummary | null,
  profileId: number | null,
  civ: string | null,
  durationSec: number | null,
): LocalGameStats | null {
  if (!summary) return null
  const player = summaryPlayerFor(summary, profileId, civ)
  if (!player) return null
  // Authoritative end-of-game totals from the STPD header (the game's own
  // numbers); the last timeline sample is only a fallback — it undercounts
  // (sampling stops before game end and misses passive income like relic/shrine
  // gold or trade).
  const gathered =
    player.totals && resourceTotal(player.totals.resourcesGathered) > 0
      ? player.totals.resourcesGathered
      : ([...player.resources].reverse().find((p) => resourceTotal(p.gathered) > 0)?.gathered ??
        null)
  const villagersProduced = player.buildOrder.filter((e) =>
    e.blueprint.startsWith('unit_villager'),
  ).length
  if (!gathered && villagersProduced === 0) return null
  const gameTimeSec =
    summary.gameLengthSec ?? [...player.resources].pop()?.timeSec ?? durationSec ?? undefined
  return {
    gameTimeSec,
    ...(gathered ? { resourcesGathered: roundResources(gathered) } : {}),
    ...(villagersProduced > 0 ? { villagersProduced } : {}),
  }
}

function mergeLocalStats(
  base: LocalGameStats | undefined,
  fromSummary: LocalGameStats | null,
): LocalGameStats | undefined {
  if (!base && !fromSummary) return undefined
  return {
    ...fromSummary,
    ...base,
    gameTimeSec: base?.gameTimeSec ?? fromSummary?.gameTimeSec,
    // The summary header totals are authoritative — stored values can be the old
    // timeline-derived undercount, so the fresh summary read wins here.
    resourcesGathered: fromSummary?.resourcesGathered ?? base?.resourcesGathered,
    // warnings.log `vprod` wins when it's a real count (0 = parse miss, D52).
    villagersProduced:
      base?.villagersProduced != null && base.villagersProduced > 0
        ? base.villagersProduced
        : (fromSummary?.villagersProduced ?? base?.villagersProduced),
  }
}

function sameResources(a: ResourceTotals | undefined, b: ResourceTotals | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.food === b.food && a.wood === b.wood && a.gold === b.gold && a.stone === b.stone
}

function sameLocalStats(a: LocalGameStats | undefined, b: LocalGameStats | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.villagersProduced === b.villagersProduced &&
    a.popMax === b.popMax &&
    a.totalCommands === b.totalCommands &&
    a.gameTimeSec === b.gameTimeSec &&
    sameResources(a.resourcesGathered, b.resourcesGathered)
  )
}

function enrichStoredMatchWithSummary(match: StoredMatch, profileId: number | null): StoredMatch {
  const local = mergeLocalStats(
    match.local,
    localStatsFromSummary(readGameSummary(match.id), profileId, match.civ, match.durationSec),
  )
  return sameLocalStats(match.local, local) ? match : { ...match, local }
}

/** Rebuilds the analyzer input from a stored match, for economy backfill re-analysis. */
function storedMatchToAnalyzedGame(m: StoredMatch): AnalyzedGame {
  return {
    result: m.result,
    civ: m.civ,
    oppCiv: m.oppCiv,
    map: m.map,
    durationSec: m.durationSec,
    ratingDiff: m.ratingDiff,
    myRating: m.rating,
    oppRating: null,
    myTeam: m.myTeam,
    oppTeam: m.oppTeam,
  }
}

function replayMatchupForUser(
  info: ReplayInfo,
  steamIds: string[],
  playerName: string | null,
): ReplayMatchup {
  if (playerName) {
    const meIdx = info.players.findIndex((p) => p.name.toLowerCase() === playerName.toLowerCase())
    if (meIdx >= 0) {
      return {
        mapId: info.mapId,
        mapName: info.mapName,
        me: info.players[meIdx]!,
        opponents: info.players.filter((_, i) => i !== meIdx),
      }
    }
  }
  return replayMatchup(info, steamIds)
}

function formatFromReplayMatchup(matchup: ReplayMatchup): string {
  const all = [matchup.me, ...matchup.opponents].filter(Boolean)
  if (all.length === 0) return ''
  if (all.every((p) => p && !p.ai)) return teamFormat(all.map(() => 1))
  return teamFormat([all.filter((p) => p && !p.ai).length, all.filter((p) => p && p.ai).length])
}

/** Network budget for ranked-summary downloads within one sync (cache hits are free). */
interface SummaryBudget {
  remaining: number
  recentHistory?: RelicRecentMatchHistoryResponse | null
}

/**
 * The stat summary for a game during a sync: local `stats.rgs` first, then the
 * Relic blob (disk-cache-first inside fetchRankedSummary; an actual download
 * spends the sync's network budget). Best-effort — null on any failure.
 */
async function loadSummaryForSync(
  matchId: string,
  profileId: number,
  budget: SummaryBudget,
): Promise<MatchSummary | null> {
  const local = readGameSummary(matchId)
  if (local) return local
  const isCached = hasCachedSummary(matchId)
  if (
    !isCached &&
    (hasUnavailableSummary(matchId) || !getSteamAuthStatus().connected || budget.remaining <= 0)
  )
    return null
  try {
    const summary = await fetchRankedSummary(matchId, profileId, budget.recentHistory)
    if (!isCached) budget.remaining--
    return summary
  } catch {
    return null
  }
}

/**
 * Everything a sync needs that is scoped to the active account. Capture it
 * before the first await: users can switch accounts while a network-backed sync
 * is still running, and a later settings read must not redirect account A's
 * results into account B's history store.
 */
interface SyncContext {
  profileId: number | null
  playerName: string | null
  localDataConsentGranted: boolean
  history: Promise<CreatedHistoryStore> | null
}

/** In-flight syncs are isolated per account, not globally shared across accounts. */
const syncInFlightByProfile = new Map<number, Promise<IpcResult<AnalyzeResult>>>()

/**
 * The one coordinator for a full sync: ranked/QM games via AoE4World + Relic,
 * then local (custom / vs-AI) games. Local folding runs even when the ranked
 * FETCH fails (offline / API down) — it still needs a profile set, since the
 * local pipeline keys its store and stats enrichment off the active profile.
 * analyzeLocalGames is module-private so nothing can double-fold after this.
 * Concurrent calls (poll tick + Sync button) share one in-flight run — two
 * interleaved syncs would double-download summary blobs and race goal chaining.
 */
export function analyzeRecentGames(count = 15): Promise<IpcResult<AnalyzeResult>> {
  const settings = getSettings().getAll()
  const profileId = settings.profileId
  // 0 is only the no-profile key; real AoE4 profile ids are positive.
  const key = profileId ?? 0
  const inFlight = syncInFlightByProfile.get(key)
  if (inFlight) return inFlight

  const context: SyncContext = {
    profileId,
    playerName: settings.playerName,
    localDataConsentGranted: settings.localData.consentGranted,
    // Resolve the active account's history promise now, while the account is
    // still known. getHistory() chooses its database synchronously.
    history: profileId == null ? null : getHistory(),
  }
  const sync = runSync(count, context).finally(() => {
    syncInFlightByProfile.delete(key)
  })
  syncInFlightByProfile.set(key, sync)
  return sync
}

async function runSync(count: number, context: SyncContext): Promise<IpcResult<AnalyzeResult>> {
  const ranked = await analyzeRankedGames(count, context)
  let localAnalyzed = 0
  try {
    localAnalyzed = await analyzeLocalGames(context)
  } catch {
    // best-effort — a bad replay/log never blocks the ranked sync result
  }
  if (!ranked.ok) return ranked
  // analyzeLocalGames only ever ADDS matches to the same store, so the new
  // total is derivable — no second full listMatches() scan.
  return ok({
    ...ranked.data,
    analyzed: ranked.data.analyzed + localAnalyzed,
    total: ranked.data.total + localAnalyzed,
  })
}

/**
 * Fetches the user's recent finished games, analyzes any not seen before
 * (Tier-1 + matchup enrichment; local stats arrive in Phase 4.5), chains goals
 * across games, and persists. Idempotent — already-stored games are skipped.
 */
async function analyzeRankedGames(
  count: number,
  context: SyncContext,
): Promise<IpcResult<AnalyzeResult>> {
  const profileId = context.profileId
  const historyPromise = context.history
  if (profileId == null || !historyPromise) return err('not_found', 'No profile set.')

  try {
    const client = getClient()
    const [player, gamesRes] = await Promise.all([
      client.getPlayer(profileId),
      // No leaderboard filter → ALL recent games (ranked + Quick Match, 1v1 +
      // team), so History matches what AoE4World shows, not just ranked 1v1.
      // fresh: results change after a game ends — never fold a stale cached list.
      client.getPlayerGames(profileId, { limit: count, fresh: true }),
    ])
    const bracket = bracketFromRankLevel(pickPrimaryMode(player.modes)?.rankLevel)
    const bench = getBenchmarks(bracket)

    let matchups: MatchupStatsResponse | null = null
    try {
      matchups = await client.getMatchupStats({ leaderboard: 'rm_solo', rankLevel: bracket })
    } catch {
      matchups = null // matchup enrichment is best-effort
    }
    const lookupMatchup = matchupLookup(matchups)

    // Consent-gated local economy stats for the most-recent local game (A1).
    // Attached only to the API game whose duration matches (same game guard).
    const localStats = getLatestLocalStats(profileId)

    // Per-player counters (production/kills/deaths/tech/APM) from Relic, keyed by
    // game id — the real numbers behind AoE4World's Comparison table, for every game.
    const relicRecent = await getRecentRelicMatchHistory(profileId)
    const perPlayerByGame = relicPerPlayerStatsByGameId(relicRecent)

    const history = await historyPromise
    const { store } = history
    const oldestFirst = [...gamesRes.games].filter((g) => !g.ongoing).reverse()
    let analyzed = 0
    // At most this many ranked-summary DOWNLOADS per sync (disk-cached blobs and
    // local stats.rgs reads are free) — keeps a sync snappy on a fresh install.
    const summaryBudget: SummaryBudget = { remaining: 8, recentHistory: relicRecent }

    for (const game of oldestFirst) {
      const id = String(game.game_id)
      // Skip games already stored WITH a final result. A game folded the instant it
      // ended (onEnded) can be saved before AoE4World finalizes it — result/duration
      // null. Re-fold those on a later Sync so the win/loss + duration fill in.
      // EXCEPTION: re-fold a team-format game stored before team rosters were captured
      // (myTeam/oppTeam absent) so the full 2v2+ lineup backfills. Per-player counters
      // are backfilled non-destructively AFTER the loop (re-folding would recompute the
      // analysis and drop local-stats APM/grade on old games).
      const existing = store.getMatch(id)
      if (existing?.hidden) continue // user removed it — never resurrect
      if (existing?.result != null && !needsRosterBackfill(existing)) {
        const enriched = mergePublicGameMetadata(existing, game)
        if (enriched !== existing) store.saveMatch(enriched)
        continue
      }
      const ag = extractAnalyzedGame(game, profileId)
      if (!ag) continue
      const perPlayer = perPlayerByGame.get(id)
      const result = ag.result ?? resultFromPerPlayer(perPlayer, profileId)
      const analyzedGame = { ...ag, result }

      const warningStats =
        localStats &&
        game.duration != null &&
        localStats.gameTimeSec != null &&
        Math.abs(localStats.gameTimeSec - game.duration) <= 60
          ? localStats
          : undefined
      // Economy from the game's own stat summary (exact end-game totals) — the
      // data behind the playstyle economy axis, res/min badges, and the grade.
      const summary = await loadSummaryForSync(id, profileId, summaryBudget)
      const local = mergeLocalStats(
        warningStats,
        localStatsFromSummary(summary, profileId, analyzedGame.civ, game.duration),
      )

      const analysis = analyzeMatch({
        game: analyzedGame,
        bracket,
        matchupWinRate: lookupMatchup(analyzedGame.civ, analyzedGame.oppCiv ?? null),
        local,
      })
      const prev = store.listMatches(1)[0]
      const priorGoalChecks = prev ? checkGoals(prev.goals, { result }) : []
      const goals = generateGoals(analysis, bench, { nowIso: game.started_at, matchId: id })

      store.saveMatch({
        id,
        playedAt: game.started_at,
        result,
        civ: analyzedGame.civ,
        oppCiv: analyzedGame.oppCiv ?? null,
        oppName: opponentName(game, profileId),
        map: analyzedGame.map,
        durationSec: analyzedGame.durationSec,
        rating: analyzedGame.myRating ?? null,
        ratingDiff: analyzedGame.ratingDiff ?? null,
        analysis,
        goals,
        priorGoalChecks,
        local,
        createdAt: game.started_at,
        format: teamFormat(game.teams.map((t) => t.length)),
        ...publicGameMetadata(game),
        myTeam: analyzedGame.myTeam,
        oppTeam: analyzedGame.oppTeam,
        perPlayer,
      })
      analyzed++
    }

    // Non-destructive per-player backfill: attach the Relic counters to ANY stored
    // game they cover (Relic returns ~50, far more than the getPlayerGames window),
    // so older history rows also get the Comparison + APM — without re-folding, which
    // would recompute the analysis and wipe local-stats APM/grade.
    for (const [gid, stats] of perPlayerByGame) {
      const existing = store.getMatch(gid)
      if (existing && !existing.hidden) {
        const result = existing.result ?? resultFromPerPlayer(stats, profileId)
        const needsStats = (existing.perPlayer?.length ?? 0) === 0
        const needsResult = existing.result == null && result != null
        if (needsStats || needsResult) store.saveMatch({ ...existing, result, perPlayer: stats })
      }
    }

    // Economy backfill: stored games that predate summary enrichment (or were
    // folded before the user connected Steam) get their exact economy now, so
    // playstyle/history economy fills in for past ranked games too — not just
    // newly synced ones. Uses the same download budget; a game outside Relic's
    // recent window simply stays without economy.
    for (const m of store.listMatches(30)) {
      if (m.hidden || m.local?.resourcesGathered) continue
      const summary = await loadSummaryForSync(m.id, profileId, summaryBudget)
      const fromSummary = localStatsFromSummary(summary, profileId, m.civ, m.durationSec)
      if (!fromSummary) continue
      const local = mergeLocalStats(m.local, fromSummary)
      if (sameLocalStats(m.local, local)) continue
      // Recompute the analysis so the grade/economy signals reflect the new data.
      const analysis = analyzeMatch({
        game: storedMatchToAnalyzedGame(m),
        bracket,
        matchupWinRate: lookupMatchup(m.civ, m.oppCiv ?? null),
        local,
      })
      store.saveMatch({ ...m, local, analysis })
    }

    return ok({
      analyzed,
      total: store.listMatches().length,
      backend: history.backend,
    })
  } catch (e) {
    return errFrom(e)
  }
}

/**
 * Folds CUSTOM / vs-AI games (which AoE4World never sees) into History from local
 * files: the `.rec` replay gives civs + opponent, `match_history.jsn` gives the
 * win/loss result + timing. Local matchhistory folders cover custom / vs-AI
 * games; automatch games come from AoE4World and dedupe by the same id if they
 * are already stored. Consent-gated, idempotent. Returns how many new games
 * were added.
 */
async function analyzeLocalGames(context: SyncContext): Promise<number> {
  const profileId = context.profileId
  const historyPromise = context.history
  if (!context.localDataConsentGranted || profileId == null || !historyPromise) return 0
  try {
    const games = listLocalGames(25, profileId)

    const { store } = await historyPromise
    const accounts = await getSteamAccounts()
    const steamIds = accounts.map((a) => a.steamId)
    const bracket = bracketFromRankLevel(null) // heuristic benchmarks; no rank for customs
    const bench = getBenchmarks(bracket)
    const localStats = getLatestLocalStats(profileId)
    // Relic keeps counters for custom/AI games too (folder id == Relic match id).
    const perPlayerByGame = relicPerPlayerStatsByGameId(await getRecentRelicMatchHistory(profileId))

    // Oldest first so goals chain correctly; skip already-stored folders. The
    // warnings.log economy stats (gt, totalCommands, …) describe only the LATEST
    // game, so they pair with the newest folder.
    const newestId = games[0]?.id
    let added = 0
    for (const g of [...games].reverse()) {
      if (store.hasMatch(g.id)) continue
      const matchup = g.replayInfo ? replayMatchup(g.replayInfo, steamIds) : null
      const built = buildLocalAnalyzedGame(g.match, matchup)
      if (!built) continue
      // Skip games whose win/loss we can't determine (avoid polluting win-rate/goals).
      if (built.game.result === null) continue

      // Pair the warnings.log stats with the NEWEST game, and use its game-TIME (gt)
      // as the duration. match_history.jsn only records wall-clock start/end, which
      // badly over-counts a paused game (e.g. 36:50 wall-clock for an 11:13 game) and
      // would otherwise discard the economy stats via a duration-mismatch check.
      const warningStats =
        g.id === newestId && localStats?.gameTimeSec != null ? localStats : undefined
      const summaryStats = localStatsFromSummary(
        readGameSummary(g.id),
        profileId,
        built.game.civ,
        built.game.durationSec,
      )
      const local = mergeLocalStats(warningStats, summaryStats)
      const durationSec = local?.gameTimeSec ?? built.game.durationSec
      const game = { ...built.game, durationSec }

      const analysis = analyzeMatch({ game, bracket, matchupWinRate: null, local })
      const playedAt = g.match.completedAtMs
        ? new Date(g.match.completedAtMs).toISOString()
        : new Date(g.mtimeMs).toISOString()
      const prev = store.listMatches(1)[0]
      const priorGoalChecks = prev ? checkGoals(prev.goals, { result: built.game.result }) : []
      const goals = generateGoals(analysis, bench, { nowIso: playedAt, matchId: g.id })

      store.saveMatch({
        id: g.id,
        playedAt,
        result: built.game.result,
        civ: built.game.civ,
        oppCiv: built.game.oppCiv ?? null,
        oppName: built.oppName,
        map: built.game.map,
        durationSec,
        rating: null,
        ratingDiff: null,
        analysis,
        goals,
        priorGoalChecks,
        local,
        createdAt: playedAt,
        custom: true,
        vsAI: built.isVsAI,
        format: built.format,
        myTeam: built.game.myTeam,
        oppTeam: built.game.oppTeam,
        perPlayer: perPlayerByGame.get(g.id),
      })
      added++
    }

    // Human custom games can leave only playback/temp.rec + a warnings.log
    // GameResultNotificationMessage when the game is offline/disconnected at
    // result time. Fold that pair too, as long as a nearby matchhistory folder
    // did not already cover the same finished game.
    const tempReplay = getTempReplay()
    const tempResult = getLatestLocalGameResult()
    const hasNearbyMatchhistory =
      tempReplay != null &&
      games.some((g) => Math.abs(g.mtimeMs - tempReplay.recordedAtMs) <= 5 * 60_000)
    const existingTemp = tempResult ? store.getMatch(tempResult.matchId) : null
    if (
      tempReplay &&
      tempResult &&
      !hasNearbyMatchhistory &&
      (!existingTemp || (existingTemp.custom && !existingTemp.hidden))
    ) {
      const matchup = replayMatchupForUser(tempReplay.info, steamIds, context.playerName)
      const me = matchup.me
      if (me?.civSlug) {
        const live = getLiveTeamMatchup(profileId)
        const livePlayers = live?.teams.flat() ?? []
        const civByProfile = new Map(livePlayers.map((p) => [p.profileId, p.civ]))
        const perPlayer = tempResult.players.map((p) => ({
          ...p,
          civ: p.civ ?? civByProfile.get(p.profileId) ?? null,
        }))
        const result = resultFromPerPlayer(perPlayer, profileId)
        const mine = perPlayer.find((p) => p.profileId === profileId)
        const enemies = live
          ? live.teams
              .filter((t) => !t.some((p) => p.profileId === profileId))
              .flat()
              .map((p) => ({ civ: p.civ ?? 'unknown', name: p.name }))
          : matchup.opponents.map((p) => ({ civ: p.civSlug ?? p.civName, name: p.name || null }))
        const teammates = live
          ? (live.teams
              .find((t) => t.some((p) => p.profileId === profileId))
              ?.filter((p) => p.profileId !== profileId)
              .map((p) => ({ civ: p.civ ?? 'unknown', name: p.name })) ?? [])
          : []
        const local = mergeLocalStats(localStats ?? undefined, null)
        const durationSec = local?.gameTimeSec ?? mine?.gameTimeSec ?? null
        const game: AnalyzedGame = {
          result,
          civ: me.civSlug,
          oppCiv: enemies[0]?.civ ?? null,
          map: tempReplay.info.mapName ?? tempReplay.info.mapId ?? 'Unknown',
          durationSec,
          myTeam: teammates.length > 0 ? teammates : undefined,
          oppTeam: enemies.length > 1 ? enemies : undefined,
        }
        const analysis = analyzeMatch({ game, bracket, matchupWinRate: null, local })
        const playedAt = new Date(tempReplay.recordedAtMs).toISOString()
        const prev = store.listMatches(1)[0]
        const priorGoalChecks = prev ? checkGoals(prev.goals, { result }) : []
        const goals = generateGoals(analysis, bench, {
          nowIso: playedAt,
          matchId: tempResult.matchId,
        })
        store.saveMatch({
          id: tempResult.matchId,
          playedAt,
          result,
          civ: game.civ,
          oppCiv: game.oppCiv ?? null,
          oppName: enemies[0]?.name ?? matchup.opponents[0]?.name ?? null,
          map: game.map,
          durationSec,
          rating: null,
          ratingDiff: null,
          analysis,
          goals,
          priorGoalChecks,
          local,
          createdAt: playedAt,
          custom: true,
          vsAI: matchup.opponents.some((p) => p.ai),
          format: live
            ? teamFormat(live.teams.map((t) => t.length))
            : formatFromReplayMatchup(matchup),
          myTeam: game.myTeam,
          oppTeam: game.oppTeam,
          perPlayer,
        })
        added++
      }
    }
    return added
  } catch (e) {
    console.warn('[analysis] local fold failed', e)
    return 0
  }
}

/**
 * The historical win rate of `civ` vs `oppCiv` (your civ's perspective) from
 * AoE4World's ranked-1v1 matchup stats — e.g. "French vs French ≈ 50%". All-rank
 * average; cached ~6h. Null when the matchup (or a variant civ) isn't in the data.
 */
export async function getMatchupWinRate(civ: string, oppCiv: string): Promise<number | null> {
  try {
    const stats = await getClient().getMatchupStats({ leaderboard: 'rm_solo' })
    const m = stats.data.find((x) => x.civilization === civ && x.other_civilization === oppCiv)
    return m ? m.win_rate : null
  } catch {
    return null
  }
}

/**
 * The full stat summary (build order + economy/score) for a game. Tries the local
 * `stats.rgs` first (custom games); for ranked games (no local file) it falls back
 * to the Steam-authenticated Relic backend, which fetches the same-format blob.
 * Same parser either way. Null when no summary is available.
 */
export async function getGameSummary(matchId: string): Promise<IpcResult<MatchSummary | null>> {
  try {
    const local = readGameSummary(matchId)
    if (local) return ok(local)
    // Ranked fallback. fetchRankedSummary is disk-cache-first, so previously
    // fetched games load even offline / with Steam disconnected.
    const profileId = getSettings().getAll().profileId
    if (profileId != null) {
      return ok(await fetchRankedSummary(matchId, profileId))
    }
    return ok(null)
  } catch (e) {
    return errFrom(e)
  }
}

/**
 * Removes one match from history — for desynced games the game itself never
 * recorded. The row stays as a hidden TOMBSTONE (not a hard delete): a hard
 * delete would just get re-folded by the next Sync, since AoE4World still
 * lists the game.
 */
export async function deleteMatch(matchId: string): Promise<IpcResult<null>> {
  try {
    const store = await getHistoryStore()
    const existing = store.getMatch(matchId)
    if (existing) store.saveMatch({ ...existing, hidden: true })
    return ok(null)
  } catch (e) {
    return errFrom(e)
  }
}

/**
 * The user's personal per-landmark W/L for one civ, from stored games whose
 * summaries are available locally (stats.rgs or the disk-cached ranked blob) —
 * deliberately NO network so the civ page stays instant.
 */
export async function getLandmarkRecord(civ: string): Promise<IpcResult<LandmarkRecordRow[]>> {
  try {
    const store = await getHistoryStore()
    const profileId = getSettings().getAll().profileId
    const games: { result: 'win' | 'loss'; built: LandmarkBuilt[] }[] = []
    for (const m of store.listMatches()) {
      if (m.hidden || m.civ !== civ) continue
      const result = m.result ?? resultFromPerPlayer(m.perPlayer, profileId)
      if (result == null) continue
      const summary = readGameSummary(m.id) ?? readCachedParsedSummary(m.id)
      if (!summary) continue
      const me = summaryPlayerForMe(summary, profileId, m.civ)
      if (!me) continue
      const built = landmarksBuilt(me, m.civ)
      if (built.length > 0) games.push({ result, built })
    }
    return ok(tallyLandmarkRecord(games))
  } catch (e) {
    return errFrom(e)
  }
}

/** Lists stored analyzed matches, newest first. An omitted limit requests all visible rows. */
export async function listHistory(limit?: number): Promise<IpcResult<StoredMatch[]>> {
  if (limit != null && (!Number.isSafeInteger(limit) || limit <= 0 || limit > 5_000)) {
    return err('validation', 'History limit must be a positive integer up to 5000.')
  }
  try {
    const store = await getHistoryStore()
    const profileId = getSettings().getAll().profileId
    const matches = store.listVisibleMatches(limit).map((match) => {
      const enriched = enrichStoredMatchWithSummary(match, profileId)
      if (enriched !== match) store.saveMatch(enriched)
      return enriched
    })
    return ok(matches)
  } catch (e) {
    return errFrom(e)
  }
}
