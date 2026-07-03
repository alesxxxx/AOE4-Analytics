import { describe, it, expect } from 'vitest'
import { buildCivDetailStats } from '../civDetailStats'
import type { CivStatsResponse, MapStatsResponse, MatchupStatsResponse } from '../../api/types'

const civStats: CivStatsResponse = {
  leaderboard: 'rm_solo',
  rank_level: null,
  rating: null,
  patch: null,
  data: [
    {
      civilization: 'french',
      win_rate: 53.2,
      pick_rate: 12.1,
      win_count: 5320,
      games_count: 10000,
      player_games_count: 0,
      duration_median: 900,
      duration_average: 950,
    },
  ],
}

const matchups: MatchupStatsResponse = {
  leaderboard: 'rm_solo',
  rank_level: null,
  rating: null,
  patch: null,
  data: [
    mu('french', 'french', 50, 1000),
    mu('french', 'english', 58, 800),
    mu('french', 'mongols', 44, 700),
    mu('french', 'rus', 47, 600),
    mu('french', 'hre', 61, 20), // below min games — dropped
  ],
}

function mu(civ: string, other: string, wr: number, games: number) {
  return {
    civilization: civ,
    other_civilization: other,
    win_rate: wr,
    win_count: Math.round((wr / 100) * games),
    games_count: games,
    player_games_count: 0,
    duration_median: 900,
    duration_average: 950,
  }
}

const maps: MapStatsResponse = {
  leaderboard: 'rm_solo',
  rank_level: null,
  rating: null,
  patch: null,
  data: [
    {
      map_id: 1,
      map: 'Dry Arabia',
      games_count: 5000,
      duration_median: 900,
      duration_average: 950,
      highest_win_rate_civilization: 'french',
    },
    {
      map_id: 2,
      map: 'Lipany',
      games_count: 4000,
      duration_median: 1100,
      duration_average: 1150,
      highest_win_rate_civilization: 'mongols',
    },
  ],
}

describe('buildCivDetailStats', () => {
  it('pulls the civ row, tier, best/worst matchups (excluding mirror + low sample), and strong maps', () => {
    const s = buildCivDetailStats('french', civStats, matchups, maps)
    expect(s.winRate).toBe(53.2)
    expect(s.pickRate).toBe(12.1)
    expect(s.games).toBe(10000)
    expect(s.tier).toBe('S') // 53.2 ≥ 52.5
    // mirror (french v french) and low-sample (hre, 20 games) excluded
    expect(s.best[0]).toMatchObject({ civ: 'english', winRate: 58 })
    expect(s.worst[0]).toMatchObject({ civ: 'mongols', winRate: 44 })
    expect(s.best.some((m) => m.civ === 'french')).toBe(false)
    expect(s.best.some((m) => m.civ === 'hre')).toBe(false)
    expect(s.strongMaps).toEqual(['Dry Arabia'])
  })

  it('returns nulls when the civ is absent from the dataset', () => {
    const s = buildCivDetailStats('byzantines', civStats, matchups, maps)
    expect(s.winRate).toBeNull()
    expect(s.tier).toBeNull()
    expect(s.games).toBe(0)
    expect(s.best).toEqual([])
    expect(s.strongMaps).toEqual([])
  })
})
