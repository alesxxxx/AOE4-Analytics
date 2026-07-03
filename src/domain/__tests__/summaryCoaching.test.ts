import { describe, it, expect } from 'vitest'
import { summarySignals, villagerGaps } from '../summaryCoaching'
import type { MatchSummary, PlayerSummary, PlayerTotals } from '../statsSummary'

function totals(over: Partial<PlayerTotals>): PlayerTotals {
  return {
    resourcesGathered: { food: 5000, wood: 4000, gold: 3000, stone: 500 },
    resourcesSpent: { food: 4000, wood: 3500, gold: 2500, stone: 400 },
    unitsProduced: 50,
    unitsLost: 10,
    unitsKilled: 10,
    buildingsLost: 0,
    buildingsRazed: 0,
    techResearched: 12,
    largestArmy: 40,
    sacredCaptured: 0,
    sacredLost: 0,
    sacredNeutralized: 0,
    relicsCaptured: 0,
    villagerHigh: 50,
    age2Sec: 400,
    age3Sec: null,
    age4Sec: null,
    ...over,
  }
}

function player(
  playerId: number,
  profileId: number | null,
  t: Partial<PlayerTotals>,
  villagerTimes: number[] = [],
): PlayerSummary {
  return {
    playerId,
    name: `P${playerId}`,
    profileId,
    civToken: 'english',
    totals: totals(t),
    villagersLost: null,
    buildOrder: villagerTimes.map((timeSec) => ({
      timeSec,
      playerId,
      category: 'unit' as const,
      blueprint: 'unit_villager_1_eng',
      name: 'Villager',
    })),
    resources: [],
    scores: [],
  }
}

function game(me: PlayerSummary, enemy: PlayerSummary, gameLengthSec = 1200): MatchSummary {
  return { gameLengthSec, players: [me, enemy] }
}

const ME = 111

describe('summarySignals', () => {
  it('flags being out-gathered and praises an economy lead', () => {
    const behind = summarySignals({
      summary: game(
        player(1000, ME, { resourcesGathered: { food: 3000, wood: 2000, gold: 1500, stone: 200 } }),
        player(1001, 222, { resourcesGathered: { food: 6000, wood: 5000, gold: 4000, stone: 800 } }),
      ),
      myProfileId: ME,
      myCiv: 'english',
    })
    expect(behind.some((s) => s.id === 'sum-eco-behind' && s.severity === 'major')).toBe(true)

    const ahead = summarySignals({
      summary: game(
        player(1000, ME, { resourcesGathered: { food: 8000, wood: 6000, gold: 5000, stone: 900 } }),
        player(1001, 222, { resourcesGathered: { food: 4000, wood: 3000, gold: 2500, stone: 400 } }),
      ),
      myProfileId: ME,
      myCiv: 'english',
    })
    expect(ahead.some((s) => s.id === 'sum-eco-ahead' && s.severity === 'good')).toBe(true)
  })

  it('reads TC idle gaps from the villager build log', () => {
    // Steady production, then three big gaps (95s, 130s, 155s → ~11 lost vills).
    const times = [30, 55, 80, 175, 305, 460, 485, 510]
    const gaps = villagerGaps(player(1000, ME, {}, times))
    expect(gaps).not.toBeNull()
    expect(gaps!.villagersMade).toBe(times.length)
    expect(gaps!.count).toBe(3)
    expect(gaps!.idleWindows).toBe(3)
    expect(gaps!.longestSec).toBe(155)
    expect(gaps!.longestGapSec).toBe(155)

    const signals = summarySignals({
      summary: game(player(1000, ME, {}, times), player(1001, 222, {})),
      myProfileId: ME,
      myCiv: 'english',
    })
    expect(signals.some((s) => s.id === 'sum-tc-idle')).toBe(true)
  })

  it('uses the shared 35s threshold for TC idle windows', () => {
    const gaps = villagerGaps(player(1000, ME, {}, [30, 64, 100]))
    expect(gaps).not.toBeNull()
    expect(gaps!.idleWindows).toBe(1)
  })

  it('compares the age-up against the build target and the enemy', () => {
    const signals = summarySignals({
      summary: game(
        player(1000, ME, { age2Sec: 444 }),
        player(1001, 222, { age2Sec: 330 }),
      ),
      myProfileId: ME,
      myCiv: 'english',
      feudalTargetSec: 375,
    })
    expect(signals.some((s) => s.id === 'sum-age2-late')).toBe(true)
    expect(signals.some((s) => s.id === 'sum-age2-behind')).toBe(true)
  })

  it('flags villager deficit, army peak deficit, and conceded relics', () => {
    const signals = summarySignals({
      summary: game(
        player(1000, ME, { villagerHigh: 40, largestArmy: 60, relicsCaptured: 0 }),
        player(1001, 222, { villagerHigh: 66, largestArmy: 120, relicsCaptured: 3 }),
      ),
      myProfileId: ME,
      myCiv: 'english',
    })
    expect(signals.some((s) => s.id === 'sum-vills-behind')).toBe(true)
    expect(signals.some((s) => s.id === 'sum-army-peak')).toBe(true)
    expect(signals.some((s) => s.id === 'sum-relics')).toBe(true)
  })

  it('returns nothing when the user is not identifiable', () => {
    const signals = summarySignals({
      summary: game(player(1000, 999, {}), player(1001, 222, {})),
      myProfileId: ME,
      myCiv: null,
    })
    expect(signals).toEqual([])
  })
})
