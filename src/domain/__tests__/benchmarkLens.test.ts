import { describe, expect, it } from 'vitest'
import {
  MIN_BENCHMARK_SAMPLES,
  benchmarkOptions,
  computeBenchmarkLens,
  type BenchmarkGame,
} from '../benchmarkLens'

function game(index: number, over: Partial<BenchmarkGame> = {}): BenchmarkGame {
  return {
    playedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    result: 'win',
    civ: 'english',
    map: 'Dry Arabia',
    format: '1v1',
    apm: 100,
    resourcesPerMinute: 700,
    villagersPerMinute: 3,
    ...over,
  }
}

function metric(result: ReturnType<typeof computeBenchmarkLens>, key: string) {
  return result.metrics.find((item) => item.key === key)!
}

describe('benchmarkOptions', () => {
  it('counts known values and sorts them by sample size without inventing unknown labels', () => {
    const games = [
      game(0, { civ: 'french', map: 'Lipany', format: '2v2' }),
      game(1, { civ: 'english', map: 'Dry Arabia', format: '1v1' }),
      game(2, { civ: 'french', map: 'Lipany', format: '2v2' }),
      game(3, { civ: null, map: ' ', format: null }),
    ]

    expect(benchmarkOptions(games)).toEqual({
      civ: [
        { value: 'french', games: 2 },
        { value: 'english', games: 1 },
      ],
      map: [
        { value: 'Lipany', games: 2 },
        { value: 'Dry Arabia', games: 1 },
      ],
      format: [
        { value: '2v2', games: 2 },
        { value: '1v1', games: 1 },
      ],
    })
  })
})

describe('computeBenchmarkLens', () => {
  it('compares the newest 20 games with the 20 immediately before them', () => {
    const games = Array.from({ length: 40 }, (_, index) =>
      game(index, {
        result: index >= 20 ? 'win' : 'loss',
        apm: index >= 20 ? 120 : 80,
        resourcesPerMinute: index >= 20 ? 800 : 600,
        villagersPerMinute: index >= 20 ? 3.2 : 2.6,
      }),
    )
    const originalOrder = games.map((item) => item.playedAt)
    const result = computeBenchmarkLens(games, { kind: 'recent' })

    expect(result).toMatchObject({
      title: 'Recent form',
      leftLabel: 'Recent 20',
      rightLabel: 'Previous 20',
      leftGames: 20,
      rightGames: 20,
    })
    expect(metric(result, 'winRate')).toMatchObject({
      left: { value: 100, samples: 20 },
      right: { value: 0, samples: 20 },
      delta: 100,
      comparable: true,
    })
    expect(metric(result, 'apm')).toMatchObject({
      left: { value: 120, samples: 20 },
      right: { value: 80, samples: 20 },
      delta: 40,
    })
    expect(games.map((item) => item.playedAt)).toEqual(originalOrder)
  })

  it('compares a selected segment only with games carrying another known value', () => {
    const games = [
      ...Array.from({ length: 3 }, (_, index) =>
        game(index, { civ: 'french', result: 'win', apm: 110 }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        game(index + 3, { civ: 'english', result: 'loss', apm: 90 }),
      ),
      game(8, { civ: null, result: 'loss', apm: 1 }),
    ]
    const result = computeBenchmarkLens(games, {
      kind: 'civ',
      value: 'french',
      label: 'French',
    })

    expect(result).toMatchObject({
      title: 'Civilization comparison',
      leftLabel: 'French',
      rightLabel: 'Other civs',
      leftGames: 3,
      rightGames: 4,
    })
    expect(metric(result, 'winRate')).toMatchObject({
      left: { value: 100, samples: 3 },
      right: { value: 0, samples: 4 },
      comparable: true,
    })
    expect(metric(result, 'apm').right.value).toBe(90)
  })

  it('uses per-metric sample sizes and marks thin or missing data as not comparable', () => {
    const games = [
      game(0, { result: 'win', apm: 100, resourcesPerMinute: null }),
      game(1, { result: null, apm: 0, resourcesPerMinute: null }),
      game(2, { result: 'loss', apm: null, resourcesPerMinute: null }),
      game(3, { result: 'win', apm: 80, resourcesPerMinute: 500 }),
      game(4, { result: 'loss', apm: Number.NaN, resourcesPerMinute: 700 }),
      game(5, { result: 'loss', apm: 70, resourcesPerMinute: 0 }),
    ]
    const result = computeBenchmarkLens(games, { kind: 'recent' })

    expect(MIN_BENCHMARK_SAMPLES).toBe(3)
    expect(metric(result, 'winRate')).toMatchObject({
      left: { value: 40, samples: 5 },
      right: { value: null, samples: 0 },
      comparable: false,
    })
    expect(metric(result, 'apm')).toMatchObject({
      left: { value: expect.any(Number), samples: 3 },
      right: { value: null, samples: 0 },
      comparable: false,
    })
    expect(metric(result, 'resourcesPerMinute')).toMatchObject({
      left: { value: 600, samples: 2 },
      comparable: false,
    })
  })

  it('shows actual cohort sizes when fewer than two full recent windows exist', () => {
    const result = computeBenchmarkLens(
      Array.from({ length: 23 }, (_, index) => game(index)),
      { kind: 'recent' },
    )

    expect(result).toMatchObject({
      leftLabel: 'Recent 20',
      rightLabel: 'Previous 3',
      leftGames: 20,
      rightGames: 3,
    })
    expect(result.metrics.every((item) => item.comparable)).toBe(true)
  })
})
