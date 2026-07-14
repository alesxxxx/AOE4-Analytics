import { resourcesPerMinute, resultFromPerPlayer, villagersPerMinute } from './analysis'
import type { StoredMatch } from '../store/historyStore'

/** URL-safe sentinel values for fields that are absent for different reasons. */
export const DATA_STUDIO_UNKNOWN = '__unknown__'
export const DATA_STUDIO_LEGACY_UNKNOWN = '__legacy__'
export const DATA_STUDIO_LOCAL_UNKNOWN = '__local__'

export type DataStudioResultFilter = '' | 'win' | 'loss' | 'unknown'
export type DataStudioDurationFilter = '' | 'under-15' | '15-25' | '25-40' | '40-plus' | 'unknown'
export type DataStudioWindow = '7d' | '30d' | '90d' | '180d' | '365d' | 'all'

export interface DataStudioFilters {
  civilization: string
  opponentCivilization: string
  map: string
  format: string
  patch: string
  season: string
  result: DataStudioResultFilter
  duration: DataStudioDurationFilter
  window: DataStudioWindow
}

export const DEFAULT_DATA_STUDIO_FILTERS: DataStudioFilters = {
  civilization: '',
  opponentCivilization: '',
  map: '',
  format: '',
  patch: '',
  season: '',
  result: '',
  duration: '',
  window: '90d',
}

export const DATA_STUDIO_SEARCH_PARAMS = {
  civilization: 'civ',
  opponentCivilization: 'opponent',
  map: 'map',
  format: 'format',
  patch: 'patch',
  season: 'season',
  result: 'result',
  duration: 'duration',
  window: 'window',
} as const satisfies Record<keyof DataStudioFilters, string>

export interface SearchParamReader {
  get(name: string): string | null
}

export interface DataStudioGame {
  id: string
  playedAt: string
  result: 'win' | 'loss' | null
  civilization: string
  opponentCivilizations: string[]
  map: string
  format: string | null
  patch: string | null
  season: number | null
  custom: boolean
  durationSec: number | null
  ratingDiff: number | null
  apm: number | null
  resourcesPerMinute: number | null
  villagersPerMinute: number | null
}

export interface DataStudioMetric {
  value: number | null
  sampleSize: number
}

export interface DataStudioAggregate {
  games: number
  wins: number
  losses: number
  unknownResults: number
  winRate: DataStudioMetric
  averageDurationSec: DataStudioMetric
  averageRatingChange: DataStudioMetric
  totalRatingChange: DataStudioMetric
  averageApm: DataStudioMetric
  averageResourcesPerMinute: DataStudioMetric
  averageVillagersPerMinute: DataStudioMetric
}

export interface CountedOption {
  value: string
  games: number
}

export interface DataStudioFilterOptions {
  civilizations: CountedOption[]
  opponentCivilizations: CountedOption[]
  maps: CountedOption[]
  formats: CountedOption[]
  patches: CountedOption[]
  seasons: CountedOption[]
}

export interface DataStudioCoverage {
  publicGames: number
  publicPatchKnown: number
  publicSeasonKnown: number
  legacyPatchUnknown: number
  legacySeasonUnknown: number
  localGames: number
}

export interface PublicMatchIdentifiers {
  patch?: number | string | null
  season?: number | null
}

export interface StoredPublicMatchIdentifiers {
  patch?: string
  season?: number
}

const RESULT_FILTERS = new Set<DataStudioResultFilter>(['', 'win', 'loss', 'unknown'])
const DURATION_FILTERS = new Set<DataStudioDurationFilter>([
  '',
  'under-15',
  '15-25',
  '25-40',
  '40-plus',
  'unknown',
])
const WINDOWS = new Set<DataStudioWindow>(['7d', '30d', '90d', '180d', '365d', 'all'])
const WINDOW_DAYS: Record<Exclude<DataStudioWindow, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
}

/** Normalizes identifiers that were actually supplied by a public game record. */
export function normalizePublicMatchIdentifiers(
  source: PublicMatchIdentifiers,
): StoredPublicMatchIdentifiers {
  const rawPatch = source.patch
  const patch =
    typeof rawPatch === 'number'
      ? Number.isFinite(rawPatch)
        ? String(rawPatch)
        : null
      : typeof rawPatch === 'string' && rawPatch.trim()
        ? rawPatch.trim()
        : null
  const season =
    typeof source.season === 'number' && Number.isInteger(source.season) && source.season >= 0
      ? source.season
      : null
  return {
    ...(patch != null ? { patch } : {}),
    ...(season != null ? { season } : {}),
  }
}

function categoryValue(params: SearchParamReader, name: string): string {
  const value = params.get(name)?.trim() ?? ''
  // Search params are renderer-controlled filters, but still bound arbitrary input.
  return value.length <= 120 ? value : ''
}

/** Parses and sanitizes a bookmarkable Data Studio view from search params. */
export function parseDataStudioFilters(params: SearchParamReader): DataStudioFilters {
  const result = categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.result)
  const duration = categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.duration)
  const window = categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.window)

  return {
    civilization: categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.civilization),
    opponentCivilization: categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.opponentCivilization),
    map: categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.map),
    format: categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.format),
    patch: categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.patch),
    season: categoryValue(params, DATA_STUDIO_SEARCH_PARAMS.season),
    result: RESULT_FILTERS.has(result as DataStudioResultFilter)
      ? (result as DataStudioResultFilter)
      : '',
    duration: DURATION_FILTERS.has(duration as DataStudioDurationFilter)
      ? (duration as DataStudioDurationFilter)
      : '',
    window: WINDOWS.has(window as DataStudioWindow)
      ? (window as DataStudioWindow)
      : DEFAULT_DATA_STUDIO_FILTERS.window,
  }
}

/** Projects persisted history into the explicit, browser-safe shape used by Data Studio. */
export function dataStudioGameFromStored(
  match: StoredMatch,
  profileId: number | null,
): DataStudioGame {
  const mine =
    profileId == null
      ? undefined
      : match.perPlayer?.find((player) => player.profileId === profileId)
  return {
    id: match.id,
    playedAt: match.playedAt,
    result: match.result ?? resultFromPerPlayer(match.perPlayer, profileId),
    civilization: match.civ,
    opponentCivilizations: uniqueOpponentCivilizations(match),
    map: match.map,
    format: match.format ?? null,
    patch: match.patch ?? null,
    season: match.season ?? null,
    custom: match.custom === true,
    durationSec: finiteOrNull(match.durationSec),
    ratingDiff: finiteOrNull(match.ratingDiff),
    apm: finiteOrNull(mine?.apm ?? match.analysis.apm),
    resourcesPerMinute: finiteOrNull(resourcesPerMinute(match.local)),
    villagersPerMinute: finiteOrNull(villagersPerMinute(match.local)),
  }
}

function uniqueOpponentCivilizations(match: StoredMatch): string[] {
  const byKey = new Map<string, string>()
  for (const value of [match.oppCiv, ...(match.oppTeam?.map((player) => player.civ) ?? [])]) {
    const civilization = value?.trim()
    if (!civilization) continue
    const key = civilization.toLocaleLowerCase()
    if (!byKey.has(key)) byKey.set(key, civilization)
  }
  return [...byKey.values()]
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null
}

function categoryMatches(actual: string | null, selected: string): boolean {
  if (!selected) return true
  if (selected === DATA_STUDIO_UNKNOWN) return actual == null || actual === ''
  return actual === selected
}

function opponentCategoryMatches(actual: readonly string[], selected: string): boolean {
  if (!selected) return true
  if (selected === DATA_STUDIO_UNKNOWN) return actual.length === 0
  return actual.includes(selected)
}

function sourceIdentifierMatches(
  actual: string | number | null,
  selected: string,
  custom: boolean,
): boolean {
  if (!selected) return true
  if (selected === DATA_STUDIO_LEGACY_UNKNOWN) return actual == null && !custom
  if (selected === DATA_STUDIO_LOCAL_UNKNOWN) return actual == null && custom
  return actual != null && String(actual) === selected
}

function durationMatches(durationSec: number | null, selected: DataStudioDurationFilter): boolean {
  if (!selected) return true
  if (selected === 'unknown') return durationSec == null
  if (durationSec == null) return false
  switch (selected) {
    case 'under-15':
      return durationSec < 15 * 60
    case '15-25':
      return durationSec >= 15 * 60 && durationSec < 25 * 60
    case '25-40':
      return durationSec >= 25 * 60 && durationSec < 40 * 60
    case '40-plus':
      return durationSec >= 40 * 60
  }
}

function resultMatches(
  result: DataStudioGame['result'],
  selected: DataStudioResultFilter,
): boolean {
  if (!selected) return true
  if (selected === 'unknown') return result == null
  return result === selected
}

function windowMatches(playedAt: string, selected: DataStudioWindow, nowMs: number): boolean {
  if (selected === 'all') return true
  const playedAtMs = Date.parse(playedAt)
  if (!Number.isFinite(playedAtMs) || !Number.isFinite(nowMs)) return false
  const earliest = nowMs - WINDOW_DAYS[selected] * 24 * 60 * 60 * 1_000
  return playedAtMs >= earliest && playedAtMs <= nowMs
}

/** Applies every Data Studio filter without mutating the source history. */
export function filterDataStudioGames(
  games: readonly DataStudioGame[],
  filters: DataStudioFilters,
  nowMs: number,
): DataStudioGame[] {
  return games.filter(
    (game) =>
      categoryMatches(game.civilization, filters.civilization) &&
      opponentCategoryMatches(game.opponentCivilizations, filters.opponentCivilization) &&
      categoryMatches(game.map, filters.map) &&
      categoryMatches(game.format, filters.format) &&
      sourceIdentifierMatches(game.patch, filters.patch, game.custom) &&
      sourceIdentifierMatches(game.season, filters.season, game.custom) &&
      resultMatches(game.result, filters.result) &&
      durationMatches(game.durationSec, filters.duration) &&
      windowMatches(game.playedAt, filters.window, nowMs),
  )
}

function metric(values: readonly (number | null)[], decimals: number): DataStudioMetric {
  const observed = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  )
  if (observed.length === 0) return { value: null, sampleSize: 0 }
  const factor = 10 ** decimals
  const average = observed.reduce((sum, value) => sum + value, 0) / observed.length
  return { value: Math.round(average * factor) / factor, sampleSize: observed.length }
}

/** Computes honest personal aggregates; each metric carries its own observed sample size. */
export function aggregateDataStudioGames(games: readonly DataStudioGame[]): DataStudioAggregate {
  const wins = games.filter((game) => game.result === 'win').length
  const losses = games.filter((game) => game.result === 'loss').length
  const decided = wins + losses
  const ratingChanges = games
    .map((game) => game.ratingDiff)
    .filter((value): value is number => value != null && Number.isFinite(value))

  return {
    games: games.length,
    wins,
    losses,
    unknownResults: games.length - decided,
    winRate: {
      value: decided > 0 ? Math.round((wins / decided) * 1_000) / 10 : null,
      sampleSize: decided,
    },
    averageDurationSec: metric(
      games.map((game) => game.durationSec),
      0,
    ),
    averageRatingChange: metric(ratingChanges, 1),
    totalRatingChange: {
      value:
        ratingChanges.length > 0
          ? Math.round(ratingChanges.reduce((sum, value) => sum + value, 0) * 10) / 10
          : null,
      sampleSize: ratingChanges.length,
    },
    averageApm: metric(
      games.map((game) => game.apm),
      1,
    ),
    averageResourcesPerMinute: metric(
      games.map((game) => game.resourcesPerMinute),
      0,
    ),
    averageVillagersPerMinute: metric(
      games.map((game) => game.villagersPerMinute),
      1,
    ),
  }
}

function countOptions(values: readonly string[]): CountedOption[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts]
    .map(([value, games]) => ({ value, games }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }))
}

function optionalCategory(value: string | null): string {
  return value ? value : DATA_STUDIO_UNKNOWN
}

function sourceIdentifier(value: string | number | null, custom: boolean): string {
  if (value != null) return String(value)
  return custom ? DATA_STUDIO_LOCAL_UNKNOWN : DATA_STUDIO_LEGACY_UNKNOWN
}

/** Available category values and their unfiltered personal sample counts. */
export function dataStudioFilterOptions(games: readonly DataStudioGame[]): DataStudioFilterOptions {
  return {
    civilizations: countOptions(games.map((game) => optionalCategory(game.civilization))),
    opponentCivilizations: countOptions(
      games.flatMap((game) =>
        game.opponentCivilizations.length > 0
          ? [...new Set(game.opponentCivilizations)]
          : [DATA_STUDIO_UNKNOWN],
      ),
    ),
    maps: countOptions(games.map((game) => optionalCategory(game.map))),
    formats: countOptions(games.map((game) => optionalCategory(game.format))),
    patches: countOptions(games.map((game) => sourceIdentifier(game.patch, game.custom))),
    seasons: countOptions(games.map((game) => sourceIdentifier(game.season, game.custom))),
  }
}

/** Describes why patch/season values may be missing instead of silently grouping them. */
export function dataStudioCoverage(games: readonly DataStudioGame[]): DataStudioCoverage {
  const publicGames = games.filter((game) => !game.custom)
  return {
    publicGames: publicGames.length,
    publicPatchKnown: publicGames.filter((game) => game.patch != null).length,
    publicSeasonKnown: publicGames.filter((game) => game.season != null).length,
    legacyPatchUnknown: publicGames.filter((game) => game.patch == null).length,
    legacySeasonUnknown: publicGames.filter((game) => game.season == null).length,
    localGames: games.length - publicGames.length,
  }
}
