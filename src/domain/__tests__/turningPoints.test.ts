import { describe, expect, it } from 'vitest'
import { deriveTurningPoints } from '../turningPoints'
import type {
  BuildEvent,
  MatchSummary,
  PlayerSummary,
  PlayerTotals,
  ResourceAmounts,
  ResourcePoint,
  ScorePoint,
} from '../statsSummary'

const ME = 111

function amounts(total: number): ResourceAmounts {
  return { food: total, wood: 0, gold: 0, stone: 0 }
}

function totals(overrides: Partial<PlayerTotals> = {}): PlayerTotals {
  return {
    resourcesGathered: amounts(10_000),
    resourcesSpent: amounts(8_000),
    unitsProduced: 50,
    unitsLost: 20,
    unitsKilled: 20,
    buildingsLost: 0,
    buildingsRazed: 0,
    techResearched: 10,
    largestArmy: 30,
    sacredCaptured: 0,
    sacredLost: 0,
    sacredNeutralized: 0,
    relicsCaptured: 0,
    villagerHigh: 50,
    age2Sec: 300,
    age3Sec: null,
    age4Sec: null,
    ...overrides,
  }
}

function resource(timeSec: number, gathered: number, bank = 300): ResourcePoint {
  return {
    timeSec,
    bank: amounts(bank),
    gathered: amounts(gathered),
    spent: amounts(Math.max(0, gathered - bank)),
    perMinute: null,
  }
}

function score(
  timeSec: number,
  total: number,
  lanes: Partial<Omit<ScorePoint, 'timeSec' | 'total'>> = {},
): ScorePoint {
  return {
    timeSec,
    total,
    economy: lanes.economy ?? total / 2,
    military: lanes.military ?? total / 4,
    society: lanes.society ?? total / 8,
    technology: lanes.technology ?? total / 8,
  }
}

function event(
  timeSec: number,
  playerId: number,
  name: string,
  category: BuildEvent['category'] = 'unit',
): BuildEvent {
  return {
    timeSec,
    playerId,
    category,
    blueprint: name === 'Villager' ? 'unit_villager_1_eng' : `unit_${name.toLowerCase()}`,
    name,
  }
}

function player(
  playerId: number,
  profileId: number | null,
  overrides: Partial<PlayerSummary> = {},
): PlayerSummary {
  return {
    playerId,
    profileId,
    name: `P${playerId}`,
    civToken: 'english',
    totals: totals(),
    villagersLost: null,
    buildOrder: [],
    resources: [],
    scores: [],
    ...overrides,
  }
}

function richOneVsOne(): MatchSummary {
  const meId = 1
  const opponentId = 2
  return {
    gameLengthSec: 1_200,
    players: [
      player(meId, ME, {
        totals: totals({ age2Sec: 330 }),
        buildOrder: [
          event(30, meId, 'Villager'),
          event(55, meId, 'Villager'),
          event(150, meId, 'Villager'),
          event(175, meId, 'Villager'),
          event(360, meId, 'Longbowman'),
        ],
        resources: [resource(300, 1_000), resource(360, 1_900), resource(420, 2_100)],
        scores: [score(300, 1_000), score(360, 1_800), score(420, 2_000)],
      }),
      player(opponentId, 222, {
        totals: totals({ age2Sec: 285 }),
        resources: [resource(300, 1_100), resource(360, 1_300), resource(420, 2_000)],
        scores: [score(300, 1_100), score(360, 1_200), score(420, 1_900)],
      }),
    ],
  }
}

describe('deriveTurningPoints', () => {
  it('creates a deterministic five-card story from a rich 1v1 summary', () => {
    const input = { summary: richOneVsOne(), myProfileId: ME, myCiv: 'english' }
    const first = deriveTurningPoints(input)
    const second = deriveTurningPoints(input)

    expect(first).toEqual(second)
    expect(first).toHaveLength(5)
    expect(first.map((point) => point.kind).sort()).toEqual(
      ['age-up', 'resource-swing', 'score-swing', 'unit-milestone', 'villager-gap'].sort(),
    )
    expect(first.map((point) => point.timeSec)).toEqual(
      [...first].map((point) => point.timeSec).sort((a, b) => a - b),
    )
    expect(first.every((point) => point.observed.length > 0 && point.coaching.length > 0)).toBe(
      true,
    )
    expect(first.find((point) => point.kind === 'score-swing')?.coaching).toContain(
      'does not identify',
    )
  })

  it('selects the strongest aligned score and resource gap changes', () => {
    const points = deriveTurningPoints({
      summary: richOneVsOne(),
      myProfileId: ME,
      myCiv: 'english',
    })

    const scoreShift = points.find((point) => point.kind === 'score-swing')
    const resourceShift = points.find((point) => point.kind === 'resource-swing')
    expect(scoreShift).toMatchObject({ startTimeSec: 300, timeSec: 360, tone: 'positive' })
    expect(scoreShift?.observed).toContain('700 in your favor')
    expect(resourceShift).toMatchObject({ startTimeSec: 300, timeSec: 360, tone: 'positive' })
    expect(resourceShift?.observed).toContain('700 in your favor')
  })

  it('uses the largest gap change when sample intervals have different lengths', () => {
    const summary: MatchSummary = {
      gameLengthSec: 600,
      players: [
        player(1, ME, {
          resources: [resource(0, 0), resource(10, 100), resource(110, 500)],
          scores: [score(0, 0), score(10, 100), score(110, 500)],
        }),
        player(2, 222, {
          resources: [resource(0, 0), resource(10, 0), resource(110, 0)],
          scores: [score(0, 0), score(10, 0), score(110, 0)],
        }),
      ],
    }

    const points = deriveTurningPoints({ summary, myProfileId: ME, myCiv: 'english' })
    const scoreShift = points.find((point) => point.kind === 'score-swing')
    const resourceShift = points.find((point) => point.kind === 'resource-swing')

    expect(scoreShift).toMatchObject({ startTimeSec: 10, timeSec: 110 })
    expect(scoreShift?.observed).toContain('400 in your favor')
    expect(resourceShift).toMatchObject({ startTimeSec: 10, timeSec: 110 })
    expect(resourceShift?.observed).toContain('400 in your favor')
  })

  it('uses only the identified player for team summaries', () => {
    const meId = 1
    const summary: MatchSummary = {
      gameLengthSec: 900,
      players: [
        player(meId, ME, {
          buildOrder: [
            event(30, meId, 'Villager'),
            event(100, meId, 'Villager'),
            event(240, meId, 'Archer'),
          ],
          resources: [resource(120, 500, 250), resource(240, 1_300, 1_100)],
          scores: [
            score(120, 500, { economy: 200, military: 100 }),
            score(240, 1_300, { economy: 300, military: 700 }),
          ],
        }),
        player(2, 222, { totals: totals({ age2Sec: 200 }) }),
        player(3, 333, { totals: totals({ age2Sec: 600 }) }),
        player(4, 444, { totals: totals({ age2Sec: 700 }) }),
      ],
    }

    const points = deriveTurningPoints({ summary, myProfileId: ME, myCiv: 'english' })
    expect(points).toHaveLength(5)
    expect(points.some((point) => point.kind === 'score-lane')).toBe(true)
    expect(points.some((point) => point.kind === 'resource-bank')).toBe(true)
    expect(points.some((point) => point.kind === 'score-swing')).toBe(false)
    expect(points.some((point) => point.kind === 'resource-swing')).toBe(false)
    expect(points.find((point) => point.kind === 'age-up')?.observed).toBe(
      'You reached Feudal Age at 5:00.',
    )
  })

  it('returns only evidence-backed cards when timelines are sparse', () => {
    const summary: MatchSummary = {
      gameLengthSec: null,
      players: [player(1, ME, { totals: totals({ age2Sec: 315 }) })],
    }

    const points = deriveTurningPoints({ summary, myProfileId: ME, myCiv: 'english' })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ kind: 'age-up', timeSec: 315 })
  })

  it('does not guess the user row when identity is unavailable', () => {
    const summary: MatchSummary = {
      gameLengthSec: 600,
      players: [player(1, 222), player(2, 333)],
    }

    expect(deriveTurningPoints({ summary, myProfileId: ME, myCiv: null })).toEqual([])
  })
})
