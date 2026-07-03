import { describe, it, expect } from 'vitest'
import { computePlaystyle, type PlaystyleGame } from '../playstyle'

const g = (over: Partial<PlaystyleGame>): PlaystyleGame => ({
  result: 'win',
  civ: 'french',
  durationSec: 900,
  apm: null,
  grade: null,
  ...over,
})

function dim(p: ReturnType<typeof computePlaystyle>, key: string) {
  return p.dimensions.find((d) => d.key === key)!
}

describe('computePlaystyle', () => {
  it('derives combat tags from per-game counters', () => {
    const trader = computePlaystyle([
      g({ kd: 1.6, durationSec: 1200 }),
      g({ kd: 1.4, durationSec: 1300 }),
      g({ kd: 1.5, durationSec: 1250 }),
    ])
    expect(trader.tags.some((t) => t.label === 'Wins the fights')).toBe(true)

    const feeder = computePlaystyle([g({ kd: 0.4 }), g({ kd: 0.6 }), g({ kd: 0.5 })])
    expect(feeder.tags.some((t) => t.label === 'Donates armies')).toBe(true)

    // Villager pace: 12 villagers in 20 min = 0.6/min → Villagerphobia.
    const noVills = computePlaystyle(
      Array.from({ length: 3 }, () =>
        g({ local: { villagersProduced: 12, gameTimeSec: 1200 }, durationSec: 1200 }),
      ),
    )
    expect(noVills.tags.some((t) => t.label === 'Villagerphobia')).toBe(true)

    const boomer = computePlaystyle(
      Array.from({ length: 3 }, () =>
        g({ local: { villagersProduced: 60, gameTimeSec: 1500 }, durationSec: 1500 }),
      ),
    )
    expect(boomer.tags.some((t) => t.label === 'Boom economy')).toBe(true)

    const noUpgrades = computePlaystyle(
      Array.from({ length: 3 }, () => g({ techsResearched: 4, durationSec: 1500 })),
    )
    expect(noUpgrades.tags.some((t) => t.label === 'Skips upgrades')).toBe(true)
  })

  it('rates short games as aggressive and long games as macro', () => {
    const fast = computePlaystyle(Array.from({ length: 5 }, () => g({ durationSec: 600 })))
    const slow = computePlaystyle(Array.from({ length: 5 }, () => g({ durationSec: 2400 })))
    expect(dim(fast, 'aggression').value).toBeGreaterThan(dim(slow, 'aggression').value)
    expect(fast.tags.some((t) => t.label === 'Aggressive')).toBe(true)
    expect(slow.tags.some((t) => t.label === 'Macro / boom')).toBe(true)
  })

  it('marks economy/multitasking as no-data without local stats, and computes them with', () => {
    const noLocal = computePlaystyle([g({}), g({}), g({})])
    expect(dim(noLocal, 'economy').hasData).toBe(false)
    expect(dim(noLocal, 'multitask').hasData).toBe(false)

    const withLocal = computePlaystyle([
      g({ grade: 'A', apm: 120 }),
      g({ grade: 'B', apm: 90 }),
      g({ grade: 'A', apm: 110 }),
    ])
    expect(dim(withLocal, 'economy').hasData).toBe(true)
    expect(dim(withLocal, 'economy').value).toBeGreaterThan(70)
    expect(dim(withLocal, 'multitask').hasData).toBe(true)
    expect(withLocal.tags.some((t) => t.label === 'High APM')).toBe(true)
    expect(withLocal.tags.some((t) => t.label === 'Strong macro')).toBe(true)
  })

  it('fills economy from resource summaries when grade is unavailable', () => {
    const p = computePlaystyle([
      g({
        grade: null,
        local: {
          gameTimeSec: 1200,
          resourcesGathered: { food: 6000, wood: 3500, gold: 2500, stone: 1000 },
        },
      }),
      g({
        grade: null,
        local: {
          gameTimeSec: 1500,
          resourcesGathered: { food: 7000, wood: 4500, gold: 3000, stone: 1000 },
        },
      }),
      g({
        grade: null,
        local: {
          gameTimeSec: 900,
          resourcesGathered: { food: 4000, wood: 2200, gold: 1600, stone: 600 },
        },
      }),
    ])

    expect(dim(p, 'economy').hasData).toBe(true)
    expect(dim(p, 'economy').value).toBeGreaterThan(50)
  })

  it('flags a one-trick and rates consistency from win/loss swings', () => {
    // 6 french games, all wins → one-trick + consistent
    const otp = computePlaystyle(
      Array.from({ length: 6 }, () => g({ civ: 'french', result: 'win' })),
    )
    expect(otp.tags.some((t) => t.label.startsWith('One-trick'))).toBe(true)
    expect(dim(otp, 'consistency').value).toBe(100)

    // alternating W/L → streaky/low consistency
    const flip = computePlaystyle(
      Array.from({ length: 6 }, (_, i) => g({ result: i % 2 === 0 ? 'win' : 'loss' })),
    )
    expect(dim(flip, 'consistency').value).toBeLessThan(20)
  })

  it('rewards civ variety', () => {
    const civs = ['french', 'english', 'mongols', 'rus', 'hre', 'abbasid']
    const varied = computePlaystyle(civs.map((c) => g({ civ: c })))
    expect(varied.tags.some((t) => t.label === 'Versatile')).toBe(true)
    expect(dim(varied, 'versatility').value).toBeGreaterThan(60)
  })

  it('handles empty input without throwing', () => {
    const p = computePlaystyle([])
    expect(p.sampleSize).toBe(0)
    expect(p.dimensions).toHaveLength(5)
    expect(p.tags).toEqual([])
  })
})
