import { describe, it, expect } from 'vitest'
import { loadFixture } from '../../api/__tests__/fixtures'
import type { CivStatsResponse, Game } from '../../api/types'
import { normalizeTeams, allPlayers } from '../../api/types'
import { analyzeMatch, extractAnalyzedGame } from '../analysis'
import { buildTierList } from '../tierList'

describe('team normalization edge cases', () => {
  it('handles a game with no teams', () => {
    const empty = { teams: [] } as Pick<Game, 'teams'>
    expect(normalizeTeams(empty)).toEqual([])
    expect(allPlayers(empty)).toEqual([])
  })
})

describe('analyzeMatch edge cases', () => {
  it('produces no duration signal when duration is null', () => {
    const a = analyzeMatch({
      game: { result: 'win', civ: 'english', map: 'Dry Arabia', durationSec: null },
      bracket: 'gold',
    })
    expect(a.signals.some((s) => s.id === 'short-game' || s.id === 'long-game')).toBe(false)
    expect(a.summary).toContain('English')
  })

  it('omits the matchup signal when there is no opponent civ', () => {
    const a = analyzeMatch({
      game: { result: 'loss', civ: 'english', oppCiv: null, map: 'Altai', durationSec: 900 },
      bracket: 'gold',
      matchupWinRate: 40,
    })
    expect(a.signals.some((s) => s.id.includes('matchup'))).toBe(false)
  })
})

describe('extractAnalyzedGame', () => {
  it('returns null when the profile is not in the game', () => {
    const game = loadFixture<Game>('games-last-10240693.json')
    expect(extractAnalyzedGame(game, 1)).toBeNull()
  })

  it('extracts the user + opponent from a real game', () => {
    const game = loadFixture<Game>('games-last-10240693.json')
    const ag = extractAnalyzedGame(game, 10240693)
    expect(ag?.civ).toBe('abbasid_dynasty')
    expect(ag?.oppCiv).toBeTypeOf('string')
  })
})

describe('buildTierList edge cases', () => {
  it('handles empty stats data without throwing', () => {
    const empty: CivStatsResponse = {
      leaderboard: 'rm_solo',
      rank_level: null,
      rating: null,
      patch: null,
      data: [],
    }
    const result = buildTierList(empty)
    expect(result.civs).toEqual([])
    expect(result.totalGames).toBe(0)
    expect(Object.values(result.byTier).every((arr) => arr.length === 0)).toBe(true)
  })
})
