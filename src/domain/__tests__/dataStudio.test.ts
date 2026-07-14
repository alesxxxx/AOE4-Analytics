import { describe, expect, it } from 'vitest'
import type { StoredMatch } from '../../store/historyStore'
import {
  aggregateDataStudioGames,
  DATA_STUDIO_LEGACY_UNKNOWN,
  DATA_STUDIO_LOCAL_UNKNOWN,
  DATA_STUDIO_UNKNOWN,
  dataStudioCoverage,
  dataStudioFilterOptions,
  dataStudioGameFromStored,
  DEFAULT_DATA_STUDIO_FILTERS,
  filterDataStudioGames,
  normalizePublicMatchIdentifiers,
  parseDataStudioFilters,
  type DataStudioFilters,
  type DataStudioGame,
} from '../dataStudio'

const NOW = Date.parse('2026-07-14T12:00:00.000Z')

function game(overrides: Partial<DataStudioGame> = {}): DataStudioGame {
  return {
    id: 'game-1',
    playedAt: '2026-07-10T12:00:00.000Z',
    result: 'win',
    civilization: 'english',
    opponentCivilizations: ['french'],
    map: 'Dry Arabia',
    format: '1v1',
    patch: '15.3.8338',
    season: 12,
    custom: false,
    durationSec: 1_200,
    ratingDiff: 18,
    apm: 120,
    resourcesPerMinute: 900,
    villagersPerMinute: 2.8,
    ...overrides,
  }
}

function filters(overrides: Partial<DataStudioFilters> = {}): DataStudioFilters {
  return { ...DEFAULT_DATA_STUDIO_FILTERS, window: 'all', ...overrides }
}

describe('parseDataStudioFilters', () => {
  it('reads valid bookmark filters and rejects unbounded or invalid enum values', () => {
    const params = new URLSearchParams({
      civ: 'english',
      opponent: 'french',
      map: 'Dry Arabia',
      format: '1v1',
      patch: '15.3.8338',
      season: '12',
      result: 'win',
      duration: '15-25',
      window: '30d',
    })
    expect(parseDataStudioFilters(params)).toEqual({
      civilization: 'english',
      opponentCivilization: 'french',
      map: 'Dry Arabia',
      format: '1v1',
      patch: '15.3.8338',
      season: '12',
      result: 'win',
      duration: '15-25',
      window: '30d',
    })

    expect(
      parseDataStudioFilters(
        new URLSearchParams({
          civ: 'x'.repeat(121),
          result: 'victory',
          duration: 'long',
          window: 'forever',
        }),
      ),
    ).toEqual(DEFAULT_DATA_STUDIO_FILTERS)
  })
})

describe('normalizePublicMatchIdentifiers', () => {
  it('keeps supplied numeric/string identifiers in a stable persisted shape', () => {
    expect(normalizePublicMatchIdentifiers({ patch: 218, season: 12 })).toEqual({
      patch: '218',
      season: 12,
    })
    expect(normalizePublicMatchIdentifiers({ patch: ' 15.3.8338 ', season: 0 })).toEqual({
      patch: '15.3.8338',
      season: 0,
    })
  })

  it('omits unknown or invalid source values for legacy/local compatibility', () => {
    expect(normalizePublicMatchIdentifiers({ patch: null, season: null })).toEqual({})
    expect(normalizePublicMatchIdentifiers({ patch: ' ', season: -1 })).toEqual({})
    expect(normalizePublicMatchIdentifiers({ patch: Number.NaN, season: 1.5 })).toEqual({})
  })
})

describe('filterDataStudioGames', () => {
  const base = game()

  it.each([
    ['civilization', { civilization: 'english' }],
    ['opponent civilization', { opponentCivilization: 'french' }],
    ['map', { map: 'Dry Arabia' }],
    ['format', { format: '1v1' }],
    ['patch', { patch: '15.3.8338' }],
    ['season', { season: '12' }],
    ['result', { result: 'win' as const }],
    ['duration', { duration: '15-25' as const }],
  ])('matches the selected %s', (_label, selected) => {
    expect(filterDataStudioGames([base], filters(selected), NOW)).toEqual([base])
  })

  it.each([
    ['civilization', { civilization: 'french' }],
    ['opponent civilization', { opponentCivilization: 'english' }],
    ['map', { map: 'Lipany' }],
    ['format', { format: '2v2' }],
    ['patch', { patch: '15.2' }],
    ['season', { season: '11' }],
    ['result', { result: 'loss' as const }],
    ['duration', { duration: '40-plus' as const }],
  ])('rejects a different %s', (_label, selected) => {
    expect(filterDataStudioGames([base], filters(selected), NOW)).toEqual([])
  })

  it('handles duration boundaries, missing values, and the inclusive recent window', () => {
    const games = [
      game({ id: 'under', durationSec: 899 }),
      game({ id: '15', durationSec: 900 }),
      game({ id: '25', durationSec: 1_500 }),
      game({ id: '40', durationSec: 2_400 }),
      game({ id: 'unknown', durationSec: null }),
    ]
    expect(filterDataStudioGames(games, filters({ duration: 'under-15' }), NOW)).toHaveLength(1)
    expect(filterDataStudioGames(games, filters({ duration: '15-25' }), NOW)[0]?.id).toBe('15')
    expect(filterDataStudioGames(games, filters({ duration: '25-40' }), NOW)[0]?.id).toBe('25')
    expect(filterDataStudioGames(games, filters({ duration: '40-plus' }), NOW)[0]?.id).toBe('40')
    expect(filterDataStudioGames(games, filters({ duration: 'unknown' }), NOW)[0]?.id).toBe(
      'unknown',
    )

    const windowed = [
      game({ id: 'boundary', playedAt: '2026-07-07T12:00:00.000Z' }),
      game({ id: 'too-old', playedAt: '2026-07-07T11:59:59.999Z' }),
      game({ id: 'future', playedAt: '2026-07-14T12:00:00.001Z' }),
      game({ id: 'invalid', playedAt: 'not-a-date' }),
    ]
    expect(
      filterDataStudioGames(windowed, filters({ window: '7d' }), NOW).map(({ id }) => id),
    ).toEqual(['boundary'])
  })

  it('separates legacy public, local, and generally unknown filter states', () => {
    const publicLegacy = game({ id: 'legacy', patch: null, season: null })
    const local = game({ id: 'local', patch: null, season: null, custom: true })
    const unknownOpponent = game({ id: 'unknown-opponent', opponentCivilizations: [] })
    const games = [publicLegacy, local, unknownOpponent]

    expect(
      filterDataStudioGames(games, filters({ patch: DATA_STUDIO_LEGACY_UNKNOWN }), NOW).map(
        ({ id }) => id,
      ),
    ).toEqual(['legacy'])
    expect(
      filterDataStudioGames(games, filters({ season: DATA_STUDIO_LOCAL_UNKNOWN }), NOW).map(
        ({ id }) => id,
      ),
    ).toEqual(['local'])
    expect(
      filterDataStudioGames(games, filters({ opponentCivilization: DATA_STUDIO_UNKNOWN }), NOW).map(
        ({ id }) => id,
      ),
    ).toEqual(['unknown-opponent'])
  })

  it('matches every known enemy civilization in team games', () => {
    const teamGame = game({ opponentCivilizations: ['french', 'mongols'], format: '2v2' })

    expect(
      filterDataStudioGames([teamGame], filters({ opponentCivilization: 'mongols' }), NOW),
    ).toEqual([teamGame])
  })
})

describe('aggregateDataStudioGames', () => {
  it('uses a separate observed sample for every metric', () => {
    const aggregate = aggregateDataStudioGames([
      game(),
      game({
        id: 'game-2',
        result: 'loss',
        durationSec: 1_800,
        ratingDiff: -8,
        apm: null,
        resourcesPerMinute: 700,
        villagersPerMinute: null,
      }),
      game({
        id: 'game-3',
        result: null,
        durationSec: null,
        ratingDiff: null,
        apm: 80,
        resourcesPerMinute: null,
        villagersPerMinute: 2.2,
      }),
    ])

    expect(aggregate).toEqual({
      games: 3,
      wins: 1,
      losses: 1,
      unknownResults: 1,
      winRate: { value: 50, sampleSize: 2 },
      averageDurationSec: { value: 1_500, sampleSize: 2 },
      averageRatingChange: { value: 5, sampleSize: 2 },
      totalRatingChange: { value: 10, sampleSize: 2 },
      averageApm: { value: 100, sampleSize: 2 },
      averageResourcesPerMinute: { value: 800, sampleSize: 2 },
      averageVillagersPerMinute: { value: 2.5, sampleSize: 2 },
    })
  })

  it('returns null metrics instead of inventing values for an empty sample', () => {
    const aggregate = aggregateDataStudioGames([])
    expect(aggregate.games).toBe(0)
    expect(aggregate.winRate).toEqual({ value: null, sampleSize: 0 })
    expect(aggregate.averageApm).toEqual({ value: null, sampleSize: 0 })
    expect(aggregate.totalRatingChange).toEqual({ value: null, sampleSize: 0 })
  })
})

describe('stored history projection and options', () => {
  it('prefers the identified Relic APM and derives only observed economy rates', () => {
    const stored = {
      id: 'stored',
      playedAt: '2026-07-10T12:00:00.000Z',
      result: null,
      civ: 'english',
      oppCiv: 'french',
      oppName: null,
      map: 'Dry Arabia',
      durationSec: 600,
      rating: 1_200,
      ratingDiff: 12,
      patch: '15.3',
      season: 12,
      analysis: {
        result: null,
        signals: [],
        apm: 70,
        grade: null,
        summary: '',
        hasLocalStats: true,
      },
      goals: [],
      priorGoalChecks: [],
      local: {
        villagersProduced: 30,
        gameTimeSec: 600,
        resourcesGathered: { food: 2_000, wood: 1_000, gold: 800, stone: 200 },
      },
      createdAt: '2026-07-10T12:00:00.000Z',
      format: '1v1',
      oppTeam: [
        { name: 'Enemy A', civ: 'french' },
        { name: 'Enemy B', civ: 'mongols' },
      ],
      perPlayer: [
        {
          profileId: 42,
          teamId: 1,
          civ: 'english',
          result: 'win',
          unitsProduced: 20,
          kills: 10,
          deaths: 5,
          kd: 2,
          buildingsProduced: 5,
          techsResearched: 3,
          apm: 110,
          gameTimeSec: 600,
        },
      ],
    } satisfies StoredMatch

    expect(dataStudioGameFromStored(stored, 42)).toMatchObject({
      result: 'win',
      apm: 110,
      resourcesPerMinute: 400,
      villagersPerMinute: 3,
      patch: '15.3',
      season: 12,
      opponentCivilizations: ['french', 'mongols'],
    })
  })

  it('counts filter options and reports honest public/local metadata coverage', () => {
    const games = [
      game(),
      game({ id: 'legacy', patch: null, season: null, format: null }),
      game({
        id: 'local',
        patch: null,
        season: null,
        custom: true,
        opponentCivilizations: [],
      }),
      game({ id: 'team', opponentCivilizations: ['french', 'mongols'], format: '2v2' }),
    ]
    const options = dataStudioFilterOptions(games)
    expect(options.patches).toContainEqual({ value: '15.3.8338', games: 2 })
    expect(options.patches).toContainEqual({ value: DATA_STUDIO_LEGACY_UNKNOWN, games: 1 })
    expect(options.patches).toContainEqual({ value: DATA_STUDIO_LOCAL_UNKNOWN, games: 1 })
    expect(options.formats).toContainEqual({ value: DATA_STUDIO_UNKNOWN, games: 1 })
    expect(options.opponentCivilizations).toContainEqual({
      value: DATA_STUDIO_UNKNOWN,
      games: 1,
    })
    expect(options.opponentCivilizations).toContainEqual({ value: 'mongols', games: 1 })
    expect(dataStudioCoverage(games)).toEqual({
      publicGames: 3,
      publicPatchKnown: 2,
      publicSeasonKnown: 2,
      legacyPatchUnknown: 1,
      legacySeasonUnknown: 1,
      localGames: 1,
    })
  })
})
