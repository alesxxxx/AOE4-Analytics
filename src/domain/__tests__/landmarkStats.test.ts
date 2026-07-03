import { describe, it, expect } from 'vitest'
import { aggregateLandmarkStats, type AgeupStatsResponse } from '../landmarkStats'

// Mirrors the real response shape: games are split into PATH subsets by the
// deepest age reached, so a landmark's totals must sum across all of them.
const RESP: AgeupStatsResponse = {
  data: {
    total: { civilization: null, player_games_count: 1000, win_count: null, win_rate: null },
    age1: { civilization: 'french', player_games_count: 100, win_count: 40, win_rate: 40 },
    'age1-2': [
      // Games that ENDED in Feudal.
      {
        civilization: 'french',
        player_games_count: 100,
        win_count: 40,
        win_rate: 40,
        age2_pbgid: 1,
        age2_name: 'School of Cavalry',
        age2_finished_at_average: 300,
      },
      {
        civilization: 'french',
        player_games_count: 50,
        win_count: 30,
        win_rate: 60,
        age2_pbgid: 2,
        age2_name: 'Chamber of Commerce',
        age2_finished_at_average: 330,
      },
    ],
    'age1-3': [
      // Games that reached Castle — these ALSO built a Feudal landmark.
      {
        civilization: 'french',
        player_games_count: 200,
        win_count: 90,
        win_rate: 45,
        age2_pbgid: 1,
        age2_name: 'School of Cavalry',
        age2_finished_at_average: 290,
        age3_pbgid: 3,
        age3_name: 'Guild Hall',
        age3_finished_at_average: 900,
      },
      {
        civilization: 'french',
        player_games_count: 100,
        win_count: 60,
        win_rate: 60,
        age2_pbgid: 2,
        age2_name: 'Chamber of Commerce',
        age2_finished_at_average: 320,
        age3_pbgid: 4,
        age3_name: 'Royal Institute',
        age3_finished_at_average: 950,
      },
    ],
  },
  ageups_metadata: [
    { id: 'soc', pbgid: 1, civs: ['french'], min_age: 1, new_age: 2, name: 'School of Cavalry', icon: 'soc.png' },
  ],
}

describe('aggregateLandmarkStats', () => {
  it('sums a landmark across every path subset (not just games ending in its age)', () => {
    const rows = aggregateLandmarkStats(RESP)
    const soc = rows.find((r) => r.name === 'School of Cavalry')!
    // 100 (ended Feudal) + 200 (reached Castle) games, 40 + 90 wins.
    expect(soc.games).toBe(300)
    expect(soc.wins).toBe(130)
    expect(soc.winRate).toBeCloseTo(43.3, 1)
    expect(soc.icon).toBe('soc.png')
    // Weighted age-up time: (300*100 + 290*200) / 300.
    expect(soc.avgAgeUpSec).toBeCloseTo(293.33, 1)
  })

  it('computes pick rate among games that picked any landmark of that age', () => {
    const rows = aggregateLandmarkStats(RESP)
    const soc = rows.find((r) => r.name === 'School of Cavalry')!
    const coc = rows.find((r) => r.name === 'Chamber of Commerce')!
    // Age-2 pool = 300 + 150 = 450 games.
    expect(soc.pickRate).toBeCloseTo(66.7, 1)
    expect(coc.pickRate).toBeCloseTo(33.3, 1)

    const guild = rows.find((r) => r.name === 'Guild Hall')!
    expect(guild.age).toBe(3)
    expect(guild.pickRate).toBeCloseTo(66.7, 1) // 200 of 300 age-3 games
  })

  it('orders by age then popularity and survives an empty response', () => {
    const rows = aggregateLandmarkStats(RESP)
    expect(rows.map((r) => `${r.age}:${r.name}`)).toEqual([
      '2:School of Cavalry',
      '2:Chamber of Commerce',
      '3:Guild Hall',
      '3:Royal Institute',
    ])
    expect(aggregateLandmarkStats({ data: {} })).toEqual([])
  })
})
