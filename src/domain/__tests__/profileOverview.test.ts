import { describe, it, expect } from 'vitest'
import type { PerPlayerMatchStats } from '../analysis'
import { computeProfileOverview, type ProfileGame } from '../profileOverview'

const ME = 111
const OPP = 222

function pp(
  profileId: number,
  over: Partial<PerPlayerMatchStats> = {},
): PerPlayerMatchStats {
  return {
    profileId,
    teamId: 0,
    civ: null,
    result: null,
    unitsProduced: null,
    kills: null,
    deaths: null,
    kd: null,
    buildingsProduced: null,
    techsResearched: null,
    apm: null,
    gameTimeSec: null,
    ...over,
  }
}

function g(over: Partial<ProfileGame> & { civ: string }): ProfileGame {
  return { result: 'win', ratingDiff: 10, durationSec: 1200, ...over }
}

describe('computeProfileOverview', () => {
  const games: ProfileGame[] = [
    g({
      civ: 'mongols',
      result: 'win',
      ratingDiff: 12,
      local: { villagersProduced: 60, gameTimeSec: 1200 },
      perPlayer: [
        pp(ME, {
          apm: 100,
          kd: 2,
          unitsProduced: 150,
          kills: 40,
          deaths: 20,
          buildingsProduced: 65,
          techsResearched: 25,
          structureDamage: 5000,
        }),
        pp(OPP, { apm: 300, kd: 0.5, kills: 300 }),
      ],
    }),
    g({
      civ: 'mongols',
      result: 'loss',
      ratingDiff: -8,
      local: { villagersProduced: 50, gameTimeSec: 1800 },
      perPlayer: [
        pp(ME, {
          apm: 80,
          kd: 1,
          unitsProduced: 50,
          kills: 20,
          deaths: 20,
          buildingsProduced: 45,
          techsResearched: 15,
          structureDamage: 1500,
        }),
      ],
    }),
    g({ civ: 'mongols', result: 'win', ratingDiff: 10 }), // no counters for this one
    g({ civ: 'french', result: 'loss', ratingDiff: null, durationSec: 600 }), // custom: no rating
  ]

  it('groups per-civ rows sorted by games, win rate over decided games', () => {
    const { civs } = computeProfileOverview(games, ME)
    expect(civs.map((c) => c.civ)).toEqual(['mongols', 'french'])
    expect(civs[0]).toMatchObject({ games: 3, wins: 2, losses: 1, winRate: 67 })
    expect(civs[1]).toMatchObject({ games: 1, wins: 0, losses: 1, winRate: 0 })
  })

  it('sums rating delta per civ, null when the civ has no rated games', () => {
    const { civs } = computeProfileOverview(games, ME)
    expect(civs[0]!.ratingDelta).toBe(14) // 12 - 8 + 10
    expect(civs[1]!.ratingDelta).toBeNull() // custom only
  })

  it('averages APM/KD from MY per-player rows only, ignoring the opponent', () => {
    const { civs } = computeProfileOverview(games, ME)
    expect(civs[0]!.avgApm).toBe(90) // (100 + 80) / 2 — the 300 APM opponent row is not mine
    expect(civs[0]!.avgKd).toBe(1.5)
    expect(civs[1]!.avgApm).toBeNull()
  })

  it('summarizes deeper per-civ playstyle tendencies from real counters', () => {
    const { civs } = computeProfileOverview(games, ME)
    expect(civs[0]).toMatchObject({
      avgUnitsProduced: 100,
      avgKills: 30,
      avgDeaths: 20,
      avgBuildingsProduced: 55,
      avgTechsResearched: 20,
      avgStructureDamage: 3250,
      avgVillagersProduced: 55,
      avgVillagersPerMinute: 2.4,
      lateGameShare: 100,
      localStatsGames: 2,
      counterGames: 2,
      style: { label: 'Late scaler' },
      strengths: ['winning', 'economy', 'fights'],
    })
  })

  it('uses stat-summary resources for economy when villager counters are unavailable', () => {
    const { civs, tiles } = computeProfileOverview(
      [
        g({
          civ: 'ottomans',
          local: {
            gameTimeSec: 1200,
            resourcesGathered: { food: 6000, wood: 3500, gold: 2500, stone: 1000 },
          },
        }),
      ],
      ME,
    )

    expect(civs[0]).toMatchObject({
      avgResourcesGathered: 13000,
      avgResourcesPerMinute: 650,
      localStatsGames: 1,
    })
    expect(civs[0]!.avgEconomyScore).toBeGreaterThan(60)
    expect(tiles.avgResourcesPerMinute).toBe(650)
  })

  it('builds honest overall tiles (null when a stat has no data)', () => {
    const { tiles } = computeProfileOverview(games, ME)
    expect(tiles.games).toBe(4)
    expect(tiles.avgApm).toBe(90)
    expect(tiles.avgKd).toBe(1.5)
    expect(tiles.avgUnitsProduced).toBe(100) // (150 + 50) / 2
    expect(tiles.avgKills).toBe(30)
    expect(tiles.avgVillagersPerMinute).toBe(2.4)
    expect(tiles.avgDurationSec).toBe(1050) // (1200*3 + 600) / 4
    expect(tiles.ratingDelta).toBe(14)
  })

  it('returns null for counter-derived stats when profileId is unknown', () => {
    const { civs, tiles } = computeProfileOverview(games, null)
    expect(civs[0]!.avgApm).toBeNull()
    expect(tiles.avgKd).toBeNull()
    expect(tiles.ratingDelta).toBe(14) // rating comes from the game rows, not counters
  })

  it('handles an empty window', () => {
    const { civs, tiles } = computeProfileOverview([], ME)
    expect(civs).toEqual([])
    expect(tiles).toMatchObject({
      games: 0,
      avgApm: null,
      avgKd: null,
      avgUnitsProduced: null,
      avgDurationSec: null,
      ratingDelta: null,
    })
  })
})
