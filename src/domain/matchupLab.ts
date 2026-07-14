import type { MatchupStatsResponse } from '../api/types'
import type { StoredMatch } from '../store/historyStore'
import { CIV_PROFILES } from '../data/civProfiles'

export interface GlobalMatchupSummary {
  civilization: string
  opponentCivilization: string
  /** Directional win rate from `civilization`'s perspective. */
  winRate: number | null
  wins: number | null
  games: number
  durationMedianSec: number | null
  durationAverageSec: number | null
  source: {
    leaderboard: string
    rankLevel: string | null
    rating: string | null
    patch: string | null
  }
}

export interface PersonalMatchupGame {
  id: string
  playedAt: string
  result: 'win' | 'loss' | null
  map: string
  format: string | null
  durationSec: number | null
}

export interface PersonalMatchupQuery {
  civilization: string
  opponentCivilization: string
  map?: string
  format?: string
}

export interface PersonalMatchupSummary {
  sampleSize: number
  decidedGames: number
  wins: number
  losses: number
  winRate: number | null
  availableMaps: string[]
  availableFormats: string[]
  matches: PersonalMatchupGame[]
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nonNegativeInt(value: unknown): number {
  const n = finite(value)
  return n != null && n >= 0 ? Math.floor(n) : 0
}

export function isMatchupCivilization(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Object.hasOwn(CIV_PROFILES, value)
}

/** Selects one directional civilization pairing while preserving API source metadata. */
export function buildGlobalMatchup(
  response: MatchupStatsResponse,
  civilization: string,
  opponentCivilization: string,
): GlobalMatchupSummary | null {
  const direct = response.data.find(
    (row) => row.civilization === civilization && row.other_civilization === opponentCivilization,
  )
  const reverse = direct
    ? null
    : response.data.find(
        (row) =>
          row.civilization === opponentCivilization && row.other_civilization === civilization,
      )
  const row = direct ?? reverse
  if (!row) return null

  const rawWinRate = finite(row.win_rate)
  const directWinRate =
    rawWinRate != null && rawWinRate >= 0 && rawWinRate <= 100 ? rawWinRate : null
  const games = nonNegativeInt(row.games_count)
  const rawWins = finite(row.win_count)
  const rowWins = rawWins != null && rawWins >= 0 ? Math.min(games, Math.floor(rawWins)) : null
  const shouldReverse = !direct && civilization !== opponentCivilization
  const durationMedian = finite(row.duration_median)
  const durationAverage = finite(row.duration_average)

  return {
    civilization,
    opponentCivilization,
    winRate: directWinRate == null ? null : shouldReverse ? 100 - directWinRate : directWinRate,
    wins: rowWins == null ? null : shouldReverse ? games - rowWins : rowWins,
    games,
    durationMedianSec: durationMedian != null && durationMedian >= 0 ? durationMedian : null,
    durationAverageSec: durationAverage != null && durationAverage >= 0 ? durationAverage : null,
    source: {
      leaderboard: response.leaderboard,
      rankLevel: response.rank_level,
      rating: response.rating,
      patch: response.patch,
    },
  }
}

/** Normalizes display names and API slugs to the same comparison key. */
function civKey(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function hasPair(match: StoredMatch, civilization: string, opponentCivilization: string): boolean {
  if (civKey(match.civ) !== civKey(civilization)) return false
  const opponents = [match.oppCiv, ...(match.oppTeam?.map((player) => player.civ) ?? [])]
  return opponents.some((opponent) => civKey(opponent) === civKey(opponentCivilization))
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => !!value?.trim()))].sort((a, b) =>
    a.localeCompare(b),
  )
}

/** Aggregates the user's stored results for the exact selected civilization pairing. */
export function buildPersonalMatchup(
  history: StoredMatch[],
  query: PersonalMatchupQuery,
): PersonalMatchupSummary {
  const pairMatches = history.filter((match) =>
    hasPair(match, query.civilization, query.opponentCivilization),
  )
  const availableMaps = uniqueSorted(pairMatches.map((match) => match.map))
  const availableFormats = uniqueSorted(pairMatches.map((match) => match.format))
  const filtered = pairMatches
    .filter((match) => !query.map || match.map === query.map)
    .filter((match) => !query.format || match.format === query.format)
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))

  const wins = filtered.filter((match) => match.result === 'win').length
  const losses = filtered.filter((match) => match.result === 'loss').length
  const decidedGames = wins + losses

  return {
    sampleSize: filtered.length,
    decidedGames,
    wins,
    losses,
    winRate: decidedGames > 0 ? (wins / decidedGames) * 100 : null,
    availableMaps,
    availableFormats,
    matches: filtered.map((match) => ({
      id: match.id,
      playedAt: match.playedAt,
      result: match.result,
      map: match.map,
      format: match.format ?? null,
      durationSec: match.durationSec,
    })),
  }
}
