import type { CivDetailStats } from '@domain/civDetailStats'
import type { IpcResult } from '@ipc/contract'
import { buildCivDetailStats } from '@domain/civDetailStats'
import { aggregateLandmarkStats, type LandmarkStatRow } from '@domain/landmarkStats'
import { getClient } from './appContext'
import { errFrom, ok } from './result'

/**
 * Per-civ meta stats for the civ detail page: global win/pick rate + tier, best
 * and worst civ matchups, and the maps where the civ is strongest. All from
 * ranked-1v1 all-ranks aggregates (the largest, most stable sample).
 */
export async function getCivDetailStats(civ: string): Promise<IpcResult<CivDetailStats>> {
  try {
    const [civStats, matchups, maps] = await Promise.all([
      getClient().getCivStats({ leaderboard: 'rm_solo' }),
      getClient().getMatchupStats({ leaderboard: 'rm_solo' }),
      getClient().getMapStats({ leaderboard: 'rm_solo' }),
    ])
    return ok(buildCivDetailStats(civ, civStats, matchups, maps))
  } catch (e) {
    return errFrom(e)
  }
}

/**
 * Global per-landmark pick & win rates for a civ, from AoE4World's ageup
 * analytics (a sampled, per-patch dataset). Best-effort: the endpoint is
 * internal on their side, so any failure returns an empty list (UI hides).
 */
export async function getLandmarkStats(civ: string): Promise<IpcResult<LandmarkStatRow[]>> {
  try {
    const resp = await getClient().getAgeupStats(civ)
    return ok(aggregateLandmarkStats(resp))
  } catch {
    return ok([])
  }
}
