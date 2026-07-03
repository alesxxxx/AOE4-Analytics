/**
 * Pure decoders + adapters that turn Relic community-API responses into the
 * app's OWN domain types (ScoutReport/RankInfo/RecentForm/…), so services can
 * swap data source (Relic preferred, AoE4World fallback) without the renderer
 * noticing. No Node/Electron here — the zlib `options`/`slotinfo` inflate is done
 * in the main-process client and the decoded map name is passed in.
 */
import type {
  RelicCounters,
  RelicLeaderboardStat,
  RelicMatch,
  RelicMatchMember,
  RelicPersonalStatResponse,
} from '../api/relicTypes'
import type { PerPlayerMatchStats } from './analysis'
import type { CivUsage, MapUsage, RankInfo, RecentForm, ScoutReport } from './types'
import { civDisplayName } from './civ'
import { round1 } from './form'
import { buildCounterNote } from './scouting'
import {
  isCompetitiveLeaderboard,
  leaderboardLabel,
  PREFERRED_LEADERBOARD_ORDER,
  raceIdToCiv,
  relicRankLevelToSlug,
} from './relicIds'

/** outcome 1 = win, 0 = loss (verified vs rating delta; works for unrated too). */
export function decodeOutcome(outcome: number): 'win' | 'loss' {
  return outcome === 1 ? 'win' : 'loss'
}

/** Relic mapname slug → display label (the real map lives in `options`, but this
 *  is the fallback when the blob can't be decoded). `generated_map` → Random Map. */
export function prettyMapName(mapname: string): string {
  if (!mapname) return 'Unknown Map'
  if (mapname === 'generated_map') return 'Random Map'
  const cleaned = mapname
    .replace(/\.rms2?$/i, '')
    .replace(/^(land_|water_|map_)/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ratingDelta(member: Pick<RelicMatchMember, 'oldrating' | 'newrating'>): number {
  return member.newrating - member.oldrating
}

export function matchDurationSec(
  match: Pick<RelicMatch, 'startgametime' | 'completiontime'>,
): number | null {
  const d = match.completiontime - match.startgametime
  return Number.isFinite(d) && d > 0 ? d : null
}

/** Single JSON.parse of the counters string → flat dict (null if malformed). */
export function parseCounters(counters: string | undefined): RelicCounters | null {
  if (!counters) return null
  try {
    return JSON.parse(counters) as RelicCounters
  } catch {
    return null
  }
}

/** APM = totalcmds / (gt minutes); null without usable data. */
export function computeApm(c: RelicCounters | null): number | null {
  if (!c || c.totalcmds == null || c.gt == null || c.gt <= 0) return null
  return round1(c.totalcmds / (c.gt / 60))
}

/**
 * Per-player end-of-game stats for a match, decoded from each report row's
 * `counters` blob. The real numbers behind AoE4World's comparison table — for
 * every game type, no auth. Empty array if the match has no report rows.
 */
export function perPlayerStatsFromMatch(match: RelicMatch): PerPlayerMatchStats[] {
  return (match.matchhistoryreportresults ?? []).map((r): PerPlayerMatchStats => {
    const c = parseCounters(r.counters)
    const kills = c?.ekills ?? null
    const deaths = c?.sqlost ?? null
    return {
      profileId: r.profile_id,
      teamId: r.teamid ?? null,
      civ: raceIdToCiv(r.civilization_id),
      result: r.resulttype === 1 ? 'win' : r.resulttype === 0 ? 'loss' : null,
      unitsProduced: c?.sqprod ?? null,
      kills,
      deaths,
      kd: kills != null && deaths != null && deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : null,
      buildingsProduced: c?.bprod ?? null,
      buildingsLost: c?.blost ?? null,
      structureDamage: c?.structdmg ?? null,
      techsResearched: c?.upg ?? null,
      apm: computeApm(c),
      gameTimeSec: c?.gt ?? null,
    }
  })
}

/** Map a player's leaderboard row to the app's RankInfo. */
export function relicLeaderboardStatToRankInfo(stat: RelicLeaderboardStat): RankInfo {
  const games = stat.wins + stat.losses
  return {
    leaderboard: leaderboardLabel(stat.leaderboard_id),
    rankLevel: relicRankLevelToSlug(stat.ranklevel),
    rating: stat.rating ?? null,
    maxRating: stat.highestrating ?? null,
    rank: stat.rank === -1 ? null : stat.rank,
    winRate: games > 0 ? round1((stat.wins / games) * 100) : null,
    gamesCount: games,
  }
}

/** This player's member entry in a match (null if they didn't play in it). */
function myMember(match: RelicMatch, profileId: number): RelicMatchMember | null {
  return match.matchhistorymember.find((m) => m.profile_id === profileId) ?? null
}

interface DecidedGame {
  result: 'win' | 'loss'
  civ: string | null
  map: string
  durationSec: number | null
  completiontime: number
}

function decidedGames(
  matches: RelicMatch[],
  profileId: number,
  mapNames: Record<number, string>,
): DecidedGame[] {
  return matches
    .map((m): DecidedGame | null => {
      const member = myMember(m, profileId)
      if (!member) return null
      return {
        result: decodeOutcome(member.outcome),
        civ: raceIdToCiv(member.civilization_id),
        map: mapNames[m.id] ?? 'Unknown Map',
        durationSec: matchDurationSec(m),
        completiontime: m.completiontime,
      }
    })
    .filter((g): g is DecidedGame => g !== null)
    .sort((a, b) => b.completiontime - a.completiontime) // most-recent first
}

function recentFormFrom(games: DecidedGame[]): RecentForm {
  const wins = games.filter((g) => g.result === 'win').length
  const losses = games.length - wins
  let streak = 0
  for (const g of games) {
    if (streak === 0) streak = g.result === 'win' ? 1 : -1
    else if (g.result === 'win' && streak > 0) streak++
    else if (g.result === 'loss' && streak < 0) streak--
    else break
  }
  const durations = games.map((g) => g.durationSec).filter((d): d is number => d != null)
  return {
    games: games.length,
    wins,
    losses,
    winRate: games.length > 0 ? round1((wins / games.length) * 100) : null,
    streak,
    lastResults: games.map((g) => (g.result === 'win' ? 'W' : 'L')),
    avgDurationSec: durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null,
  }
}

function tallyUsage<T extends CivUsage | MapUsage>(
  games: DecidedGame[],
  keyOf: (g: DecidedGame) => string | null,
  make: (key: string, games: number, wins: number, winRate: number | null) => T,
): T[] {
  const acc = new Map<string, { games: number; wins: number }>()
  for (const g of games) {
    const key = keyOf(g)
    if (!key) continue
    const a = acc.get(key) ?? { games: 0, wins: 0 }
    a.games++
    if (g.result === 'win') a.wins++
    acc.set(key, a)
  }
  return [...acc.entries()]
    .map(([key, a]) =>
      make(key, a.games, a.wins, a.games > 0 ? round1((a.wins / a.games) * 100) : null),
    )
    .sort((x, y) => y.games - x.games)
}

export interface RelicScoutInput {
  personalStat: RelicPersonalStatResponse
  matches: RelicMatch[]
  profileId: number
  /** matchId → decoded map name (the client inflates `options`). */
  mapNames: Record<number, string>
}

/** Assembles a ScoutReport from Relic data, identical in shape to the AoE4World one. */
export function buildScoutReportFromRelic({
  personalStat,
  matches,
  profileId,
  mapNames,
}: RelicScoutInput): ScoutReport {
  const member = personalStat.statGroups
    .flatMap((g) => g.members)
    .find((m) => m.profile_id === profileId)
  const statgroupId = member?.personal_statgroup_id

  const modes = personalStat.leaderboardStats
    .filter((s) => s.statgroup_id === statgroupId && isCompetitiveLeaderboard(s.leaderboard_id))
    .map(relicLeaderboardStatToRankInfo)
    .filter((r) => r.gamesCount > 0)
    .sort((a, b) => b.gamesCount - a.gamesCount)

  const primary = pickPrimaryRelicMode(personalStat.leaderboardStats, statgroupId)

  const games = decidedGames(matches, profileId, mapNames)
  const recentForm = recentFormFrom(games)
  const topCivs = tallyUsage<CivUsage>(
    games,
    (g) => g.civ,
    (civ, n, wins, winRate) => ({ civ, civName: civDisplayName(civ), games: n, wins, winRate }),
  ).slice(0, 4)
  const topMaps = tallyUsage<MapUsage>(
    games,
    (g) => g.map,
    (map, n, wins, winRate) => ({ map, games: n, wins, winRate }),
  ).slice(0, 4)

  return {
    profileId,
    name: member?.alias ?? String(profileId),
    country: member?.country ?? null,
    primary,
    modes,
    recentForm,
    topCivs,
    topMaps,
    note: buildCounterNote(topCivs, recentForm),
    hasData: recentForm.games > 0 || modes.length > 0,
  }
}

function pickPrimaryRelicMode(
  stats: RelicLeaderboardStat[],
  statgroupId: number | undefined,
): RankInfo | null {
  const mine = stats.filter((s) => s.statgroup_id === statgroupId)
  const byGames = (a: RelicLeaderboardStat, b: RelicLeaderboardStat) =>
    b.wins + b.losses - (a.wins + a.losses)

  // Prefer a competitive ladder (1v1 first, per PREFERRED_LEADERBOARD_ORDER).
  const rated = mine.filter((s) => isCompetitiveLeaderboard(s.leaderboard_id) && s.wins + s.losses > 0)
  for (const id of PREFERRED_LEADERBOARD_ORDER) {
    const found = rated.find((s) => s.leaderboard_id === id)
    if (found) return relicLeaderboardStatToRankInfo(found)
  }
  const mostPlayedRated = [...rated].sort(byGames)[0]
  if (mostPlayedRated) return relicLeaderboardStatToRankInfo(mostPlayedRated)

  // No competitive ladder with games — fall back to the most-played leaderboard
  // overall (e.g. Custom / Skirmish) so a QM/custom-only player isn't shown
  // "Unranked" despite having real games. leaderboardLabel keeps it honest ("Custom").
  const mostPlayed = [...mine].filter((s) => s.wins + s.losses > 0).sort(byGames)[0]
  return mostPlayed ? relicLeaderboardStatToRankInfo(mostPlayed) : null
}
