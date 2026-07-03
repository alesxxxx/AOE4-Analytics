import { describe, it, expect } from 'vitest'
import { buildLeaderboardRows } from '../leaderboard'
import type { LeaderboardResponse } from '../../api/types'

const resp: LeaderboardResponse = {
  total_count: 100,
  page: 1,
  per_page: 50,
  count: 2,
  players: [
    {
      name: 'May de',
      profile_id: 10307814,
      country: 'cn',
      rating: 1800,
      rank: 1,
      rank_level: 'conqueror_3',
      streak: 5,
      games_count: 200,
      wins_count: 130,
      losses_count: 70,
      win_rate: 65,
      twitch_is_live: true,
    },
    {
      name: 'You',
      profile_id: 22223074,
      rating: 1000,
      rank: 2,
      // optional fields omitted to test defaults
    },
  ],
}

describe('buildLeaderboardRows', () => {
  it('flattens fields and carries the live flag', () => {
    const rows = buildLeaderboardRows(resp)
    expect(rows[0]).toMatchObject({
      rank: 1,
      name: 'May de',
      country: 'cn',
      rating: 1800,
      winRate: 65,
      games: 200,
      streak: 5,
      live: true,
      isYou: false,
    })
  })

  it('marks the current user and defaults missing optionals', () => {
    const rows = buildLeaderboardRows(resp, 22223074)
    expect(rows[1]!.isYou).toBe(true)
    expect(rows[0]!.isYou).toBe(false)
    expect(rows[1]).toMatchObject({
      country: null,
      winRate: null,
      games: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      rankLevel: null,
      live: false,
    })
  })
})
