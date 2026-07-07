import { describe, expect, it } from 'vitest'
import { sessionSummary, type SessionMatch } from '../session'

const NOW = new Date('2026-07-07T18:30:00')

function match(over: Partial<SessionMatch>): SessionMatch {
  return {
    playedAt: '2026-07-07T12:00:00',
    result: 'win',
    ratingDiff: null,
    ...over,
  }
}

describe('sessionSummary', () => {
  it('counts only games played on the same local day', () => {
    const s = sessionSummary(
      [
        match({ result: 'win', ratingDiff: 12 }),
        match({ result: 'loss', ratingDiff: -9 }),
        match({ playedAt: '2026-07-06T23:50:00', result: 'win', ratingDiff: 15 }),
      ],
      NOW,
    )
    expect(s).toEqual({ games: 2, wins: 1, losses: 1, ratingDelta: 3 })
  })

  it('returns a null ratingDelta when no game carried a rating change', () => {
    const s = sessionSummary([match({}), match({ result: 'loss' })], NOW)
    expect(s.games).toBe(2)
    expect(s.ratingDelta).toBeNull()
  })

  it('sums ratingDiff only from games that have one', () => {
    const s = sessionSummary(
      [match({ ratingDiff: 10 }), match({ result: 'loss' }), match({ ratingDiff: -4 })],
      NOW,
    )
    expect(s.ratingDelta).toBe(6)
    expect(s.games).toBe(3)
  })

  it('skips hidden games and games without a result', () => {
    const s = sessionSummary(
      [match({ hidden: true, ratingDiff: 50 }), match({ result: null }), match({})],
      NOW,
    )
    expect(s).toEqual({ games: 1, wins: 1, losses: 0, ratingDelta: null })
  })

  it('skips custom/vs-AI games when excludeAi is set', () => {
    const games = [match({ vsAI: true, custom: true }), match({ custom: true }), match({})]
    expect(sessionSummary(games, NOW, { excludeAi: true }).games).toBe(1)
    expect(sessionSummary(games, NOW).games).toBe(3)
  })

  it('treats a local-midnight boundary correctly', () => {
    // 00:05 today counts; 23:55 yesterday does not, even though they are
    // 10 minutes apart.
    const s = sessionSummary(
      [
        match({ playedAt: '2026-07-07T00:05:00' }),
        match({ playedAt: '2026-07-06T23:55:00', result: 'loss' }),
      ],
      NOW,
    )
    expect(s).toEqual({ games: 1, wins: 1, losses: 0, ratingDelta: null })
  })

  it('ignores unparsable timestamps', () => {
    expect(sessionSummary([match({ playedAt: 'not-a-date' })], NOW).games).toBe(0)
  })

  it('returns an empty summary for no games', () => {
    expect(sessionSummary([], NOW)).toEqual({ games: 0, wins: 0, losses: 0, ratingDelta: null })
  })
})
