import { describe, expect, it } from 'vitest'
import type { MatchupStatsResponse } from '../../api/types'
import type { StoredMatch } from '../../store/historyStore'
import { buildGlobalMatchup, buildPersonalMatchup, isMatchupCivilization } from '../matchupLab'

const response: MatchupStatsResponse = {
  leaderboard: 'rm_solo',
  rank_level: 'gold',
  rating: null,
  patch: '12.1,12.2',
  data: [
    {
      civilization: 'english',
      other_civilization: 'french',
      win_rate: 43.25,
      win_count: 173,
      games_count: 400,
      player_games_count: 400,
      duration_median: 1_420,
      duration_average: 1_511.5,
    },
  ],
}

function stored(overrides: Partial<StoredMatch>): StoredMatch {
  return {
    id: 'game-1',
    playedAt: '2026-07-10T12:00:00.000Z',
    result: 'win',
    civ: 'english',
    oppCiv: 'french',
    oppName: 'Opponent',
    map: 'Dry Arabia',
    durationSec: 1_200,
    rating: 1_100,
    ratingDiff: 12,
    analysis: {
      result: 'win',
      signals: [],
      apm: null,
      grade: null,
      summary: 'Game',
      hasLocalStats: false,
    },
    goals: [],
    priorGoalChecks: [],
    createdAt: '2026-07-10T12:30:00.000Z',
    format: '1v1',
    ...overrides,
  }
}

describe('isMatchupCivilization', () => {
  it('accepts bundled civilization keys and rejects inherited object properties', () => {
    expect(isMatchupCivilization('english')).toBe(true)
    expect(isMatchupCivilization('constructor')).toBe(false)
    expect(isMatchupCivilization('toString')).toBe(false)
    expect(isMatchupCivilization('x'.repeat(65))).toBe(false)
  })
})

describe('buildGlobalMatchup', () => {
  it('keeps the selected direction and source metadata', () => {
    expect(buildGlobalMatchup(response, 'english', 'french')).toEqual({
      civilization: 'english',
      opponentCivilization: 'french',
      winRate: 43.25,
      wins: 173,
      games: 400,
      durationMedianSec: 1_420,
      durationAverageSec: 1_511.5,
      source: {
        leaderboard: 'rm_solo',
        rankLevel: 'gold',
        rating: null,
        patch: '12.1,12.2',
      },
    })
  })

  it('can derive the opposite direction when the API only returns one row', () => {
    expect(buildGlobalMatchup(response, 'french', 'english')).toMatchObject({
      winRate: 56.75,
      wins: 227,
      games: 400,
    })
  })

  it('returns null when the selected pair is absent', () => {
    expect(buildGlobalMatchup(response, 'mongols', 'french')).toBeNull()
  })
})

describe('buildPersonalMatchup', () => {
  const history = [
    stored({ id: 'new-win', playedAt: '2026-07-12T12:00:00.000Z' }),
    stored({ id: 'old-loss', result: 'loss', map: 'Lipany', playedAt: '2026-07-11T12:00:00.000Z' }),
    stored({
      id: 'team-loss',
      result: 'loss',
      oppCiv: 'mongols',
      oppTeam: [
        { civ: 'mongols', name: 'One' },
        { civ: 'french', name: 'Two' },
      ],
      format: '2v2',
    }),
    stored({ id: 'wrong-civ', civ: 'mongols' }),
  ]

  it('aggregates exact pair results and exposes available local filters', () => {
    const result = buildPersonalMatchup(history, {
      civilization: 'English',
      opponentCivilization: 'French',
    })

    expect(result).toMatchObject({
      sampleSize: 3,
      decidedGames: 3,
      wins: 1,
      losses: 2,
      availableMaps: ['Dry Arabia', 'Lipany'],
      availableFormats: ['1v1', '2v2'],
    })
    expect(result.winRate).toBeCloseTo(100 / 3)
    expect(result.matches.map((match) => match.id)).toEqual(['new-win', 'old-loss', 'team-loss'])
  })

  it('applies map and format only to personal history', () => {
    const result = buildPersonalMatchup(history, {
      civilization: 'english',
      opponentCivilization: 'french',
      map: 'Dry Arabia',
      format: '2v2',
    })

    expect(result.sampleSize).toBe(1)
    expect(result.matches[0]?.id).toBe('team-loss')
    expect(result.availableMaps).toEqual(['Dry Arabia', 'Lipany'])
  })

  it('keeps undecided games in the sample without inventing a win rate', () => {
    const result = buildPersonalMatchup([stored({ result: null })], {
      civilization: 'english',
      opponentCivilization: 'french',
    })

    expect(result).toMatchObject({ sampleSize: 1, decidedGames: 0, winRate: null })
  })
})
