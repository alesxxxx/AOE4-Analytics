import type { MapStatsResponse } from '../api/types'
import { civDisplayName } from './civ'
import { round1 } from './form'

/** One map's popularity + pace, derived from the AoE4World map-stats response. */
export interface MapStat {
  mapId: number
  map: string
  games: number
  /** Share of all games on this leaderboard (%). */
  pickRate: number
  durationAverageSec: number
  durationMedianSec: number
  /** The civ with the highest win rate on this map (the API exposes only one). */
  bestCiv: string | null
  bestCivName: string | null
}

/** Builds sorted (most-played first) map stats from the API response. */
export function buildMapStats(resp: MapStatsResponse): MapStat[] {
  const total = resp.data.reduce((s, d) => s + d.games_count, 0)
  return resp.data
    .map((d) => ({
      mapId: d.map_id,
      map: d.map,
      games: d.games_count,
      pickRate: total > 0 ? round1((d.games_count / total) * 100) : 0,
      durationAverageSec: d.duration_average,
      durationMedianSec: d.duration_median,
      bestCiv: d.highest_win_rate_civilization ?? null,
      bestCivName: d.highest_win_rate_civilization
        ? civDisplayName(d.highest_win_rate_civilization)
        : null,
    }))
    .sort((a, b) => b.games - a.games || a.map.localeCompare(b.map))
}
