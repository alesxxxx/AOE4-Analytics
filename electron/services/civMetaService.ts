import type { CivMetaQuery, CivMetaResult, IpcResult, MatchupLabQuery } from '@ipc/contract'
import type { GlobalMatchupSummary } from '@domain/matchupLab'
import { buildGlobalMatchup, isMatchupCivilization } from '@domain/matchupLab'
import { buildTierList } from '@domain/tierList'
import { buildMapStats, type MapStat } from '@domain/mapStats'
import type { RankLevel, StatsLeaderboard } from '@api/types'
import { getClient } from './appContext'
import { err, errFrom, ok } from './result'

const LEADERBOARDS = new Set<StatsLeaderboard>(['rm_solo', 'qm_1v1', 'rm_2v2', 'rm_3v3', 'rm_4v4'])
const RANKS = new Set<RankLevel>(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'conqueror'])

function rankFilterable(leaderboard: StatsLeaderboard): boolean {
  return leaderboard === 'rm_solo' || leaderboard === 'qm_1v1'
}

function parseMatchupLabQuery(input: unknown): MatchupLabQuery | null {
  if (!input || typeof input !== 'object') return null
  const query = input as Record<string, unknown>
  const civilization = query['civilization']
  const opponentCivilization = query['opponentCivilization']
  const leaderboard = query['leaderboard'] ?? 'rm_solo'
  const rankLevel = query['rankLevel']
  if (
    !isMatchupCivilization(civilization) ||
    !isMatchupCivilization(opponentCivilization) ||
    typeof leaderboard !== 'string' ||
    !LEADERBOARDS.has(leaderboard as StatsLeaderboard) ||
    (rankLevel != null && (typeof rankLevel !== 'string' || !RANKS.has(rankLevel as RankLevel)))
  ) {
    return null
  }
  return {
    civilization,
    opponentCivilization,
    leaderboard: leaderboard as StatsLeaderboard,
    rankLevel: rankLevel as RankLevel | undefined,
  }
}

/**
 * Civ meta explorer: global civ win/pick rates (as tiered, sortable rows) plus
 * map popularity/pace for the selected ladder + rank band. Maps are best-effort
 * — a ladder without a maps endpoint still returns the civ table.
 */
export async function getCivMeta(query: CivMetaQuery): Promise<IpcResult<CivMetaResult>> {
  try {
    const civStats = await getClient().getCivStats({
      leaderboard: query.leaderboard,
      rankLevel: query.rankLevel,
    })
    const tier = buildTierList(civStats)

    let maps: MapStat[] = []
    try {
      const mapStats = await getClient().getMapStats({
        leaderboard: query.leaderboard,
        rankLevel: query.rankLevel,
      })
      maps = buildMapStats(mapStats)
    } catch {
      maps = []
    }

    return ok({
      civs: tier.civs,
      maps,
      leaderboard: tier.leaderboard,
      rankLevel: tier.rankLevel,
      totalCivGames: tier.totalGames,
    })
  } catch (e) {
    return errFrom(e)
  }
}

/** Filter-aware global matchup slice, sourced only from AoE4World's stats endpoint. */
export async function getMatchupLab(
  input: unknown,
): Promise<IpcResult<GlobalMatchupSummary | null>> {
  const query = parseMatchupLabQuery(input)
  if (!query) {
    return err('validation', 'Choose valid civilizations, leaderboard, and rank filters.')
  }

  const leaderboard = query.leaderboard ?? 'rm_solo'
  try {
    const response = await getClient().getMatchupStats({
      leaderboard,
      rankLevel: rankFilterable(leaderboard) ? query.rankLevel : undefined,
    })
    return ok(buildGlobalMatchup(response, query.civilization, query.opponentCivilization))
  } catch (error) {
    return errFrom(error)
  }
}
