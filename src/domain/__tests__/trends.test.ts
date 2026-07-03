import { describe, it, expect } from 'vitest'
import { computeTrends, type TrendGame } from '../trends'

const g = (
  result: 'win' | 'loss' | null,
  rating: number | null,
  ratingDiff: number | null,
  durationSec: number | null,
): TrendGame => ({ result, rating, ratingDiff, durationSec })

describe('computeTrends', () => {
  it('computes win rate, streak, averages and a chronological rating series', () => {
    // newest-first
    const matches: TrendGame[] = [
      g('win', 1050, 15, 600), // newest
      g('win', 1035, 14, 540),
      g('loss', 1021, -16, 1200),
      g('win', 1037, 12, 480),
    ]
    const t = computeTrends(matches)
    expect(t.games).toBe(4)
    expect(t.wins).toBe(3)
    expect(t.losses).toBe(1)
    expect(t.winRate).toBe(75)
    expect(t.streak).toBe(2) // two newest are wins
    // series is oldest→newest
    expect(t.rating.series).toEqual([1037, 1021, 1035, 1050])
    expect(t.rating.current).toBe(1050)
    expect(t.rating.delta).toBe(1050 - 1037)
    expect(t.avgGameMin).toBe(11.8) // mean of [8,20,9,10] min = 11.75 → 11.8
  })

  it('counts a loss streak as negative', () => {
    expect(
      computeTrends([g('loss', null, -10, 300), g('loss', null, -12, 300), g('win', null, 8, 300)])
        .streak,
    ).toBe(-2)
  })

  it('handles no decided games / empty', () => {
    expect(computeTrends([]).winRate).toBeNull()
    expect(computeTrends([]).rating.current).toBeNull()
    const none = computeTrends([g(null, null, null, null)])
    expect(none.winRate).toBeNull()
    expect(none.streak).toBe(0)
  })

  it('honors the window', () => {
    const many = Array.from({ length: 30 }, () => g('win', 1000, 5, 600))
    expect(computeTrends(many, 10).games).toBe(10)
  })
})
