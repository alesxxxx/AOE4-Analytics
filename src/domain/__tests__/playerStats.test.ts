import { describe, it, expect } from 'vitest'
import { computePlayerStats, winRate, partOfDay, type StatGame } from '../playerStats'

const g = (over: Partial<StatGame>): StatGame => ({
  result: 'win',
  civ: 'french',
  oppCiv: 'english',
  map: 'Dry Arabia',
  durationSec: 900,
  ratingDiff: 10,
  format: '1v1',
  playedAt: '2026-06-01T12:00:00Z',
  ...over,
})

describe('winRate', () => {
  it('rounds and guards empty', () => {
    expect(winRate(3, 4)).toBe(75)
    expect(winRate(0, 0)).toBeNull()
  })
})

describe('partOfDay', () => {
  it('buckets the clock', () => {
    expect(partOfDay(7).key).toBe('morning')
    expect(partOfDay(13).key).toBe('afternoon')
    expect(partOfDay(20).key).toBe('evening')
    expect(partOfDay(23).key).toBe('night')
    expect(partOfDay(2).key).toBe('night')
  })
})

describe('computePlayerStats', () => {
  it('aggregates totals, win rate and per-civ breakdown', () => {
    const games: StatGame[] = [
      g({ result: 'win', civ: 'french' }),
      g({ result: 'loss', civ: 'french' }),
      g({ result: 'win', civ: 'mongols' }),
      g({ result: null, civ: 'rus' }), // undecided — counted in games, not WR
    ]
    const s = computePlayerStats(games)
    expect(s.totalGames).toBe(4)
    expect(s.decided).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.winRate).toBe(67) // 2/3
    const french = s.byCiv.find((b) => b.key === 'french')!
    expect(french.games).toBe(2)
    expect(french.winRate).toBe(50)
    // most-played civ comes first
    expect(s.byCiv[0]!.key).toBe('french')
  })

  it('computes longest win and loss streaks across full history (newest-first input)', () => {
    // chronological: W W W L L  → walked oldest→newest from reversed input
    const games: StatGame[] = [
      g({ result: 'loss' }), // newest
      g({ result: 'loss' }),
      g({ result: 'win' }),
      g({ result: 'win' }),
      g({ result: 'win' }), // oldest
    ]
    const s = computePlayerStats(games)
    expect(s.longestWinStreak).toBe(3)
    expect(s.longestLossStreak).toBe(2)
  })

  it('breaks down by opponent civ, map, format and game length', () => {
    const games: StatGame[] = [
      g({ result: 'win', oppCiv: 'english', map: 'Dry Arabia', format: '1v1', durationSec: 300 }),
      g({ result: 'loss', oppCiv: 'english', map: 'Lipany', format: '2v2', durationSec: 1500 }),
      g({ result: 'win', oppCiv: 'rus', map: 'Dry Arabia', format: '1v1', durationSec: 2700 }),
    ]
    const s = computePlayerStats(games)
    expect(s.byOppCiv.find((b) => b.key === 'english')!.games).toBe(2)
    expect(s.byMap.find((b) => b.key === 'Dry Arabia')!.games).toBe(2)
    expect(s.byFormat.find((b) => b.key === '1v1')!.winRate).toBe(100)
    // length buckets: 5min, 25min, 45min
    expect(s.byGameLength.map((b) => b.key)).toEqual(['len0', 'len20', 'len40'])
  })

  it('rolls up the recent window using injected now', () => {
    const now = Date.parse('2026-06-29T00:00:00Z')
    const games: StatGame[] = [
      g({ result: 'win', playedAt: '2026-06-28T12:00:00Z', durationSec: 3600 }), // in window
      g({ result: 'loss', playedAt: '2026-06-20T12:00:00Z', durationSec: 1800 }), // in window
      g({ result: 'win', playedAt: '2026-05-01T12:00:00Z', durationSec: 3600 }), // outside
    ]
    const s = computePlayerStats(games, { now, recentDays: 14 })
    expect(s.recent2w.games).toBe(2)
    expect(s.recent2w.wins).toBe(1)
    expect(s.recent2w.losses).toBe(1)
    expect(s.recent2w.hours).toBe(1.5) // 1h + 0.5h
  })

  it('handles empty history', () => {
    const s = computePlayerStats([])
    expect(s.totalGames).toBe(0)
    expect(s.winRate).toBeNull()
    expect(s.longestWinStreak).toBe(0)
    expect(s.byCiv).toEqual([])
    expect(s.recent2w.games).toBe(0)
  })
})
