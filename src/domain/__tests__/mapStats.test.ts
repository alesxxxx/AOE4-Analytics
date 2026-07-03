import { describe, it, expect } from 'vitest'
import { buildMapStats } from '../mapStats'
import type { MapStatsResponse } from '../../api/types'

const resp: MapStatsResponse = {
  leaderboard: 'rm_solo',
  rank_level: null,
  rating: null,
  patch: null,
  data: [
    {
      map_id: 1,
      map: 'Dry Arabia',
      games_count: 6000,
      duration_median: 900,
      duration_average: 960,
      highest_win_rate_civilization: 'mongols',
    },
    {
      map_id: 2,
      map: 'Lipany',
      games_count: 4000,
      duration_median: 1200,
      duration_average: 1250,
      highest_win_rate_civilization: null,
    },
  ],
}

describe('buildMapStats', () => {
  it('sorts by games desc and computes pick rate', () => {
    const stats = buildMapStats(resp)
    expect(stats.map((m) => m.map)).toEqual(['Dry Arabia', 'Lipany'])
    expect(stats[0]!.pickRate).toBe(60) // 6000 / 10000
    expect(stats[1]!.pickRate).toBe(40)
  })

  it('resolves the best civ display name and keeps nulls', () => {
    const stats = buildMapStats(resp)
    expect(stats[0]!.bestCivName).toBe('Mongols')
    expect(stats[1]!.bestCiv).toBeNull()
    expect(stats[1]!.bestCivName).toBeNull()
  })

  it('handles an empty dataset without dividing by zero', () => {
    const stats = buildMapStats({ ...resp, data: [] })
    expect(stats).toEqual([])
  })
})
