import type { CivMetaQuery, CivMetaResult, IpcResult } from '@ipc/contract'
import { buildTierList } from '@domain/tierList'
import { buildMapStats, type MapStat } from '@domain/mapStats'
import { getClient } from './appContext'
import { errFrom, ok } from './result'

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
