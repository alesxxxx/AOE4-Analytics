import { type Game, type GamePlayer, normalizeTeams } from '../api/types'
import type { RecentForm } from './types'

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Finds a player's slot within a game (handles both team-slot shapes). */
export function playerInGame(game: Game, profileId: number): GamePlayer | undefined {
  for (const team of normalizeTeams(game)) {
    const found = team.find((p) => p.profile_id === profileId)
    if (found) return found
  }
  return undefined
}

/** Streak from results ordered most-recent-first: +N win streak, -N loss streak. */
export function computeStreak(lastResults: ('W' | 'L')[]): number {
  if (lastResults.length === 0) return 0
  const head = lastResults[0]!
  let count = 0
  for (const r of lastResults) {
    if (r !== head) break
    count++
  }
  return head === 'W' ? count : -count
}

/**
 * Summarizes a player's recent form from a games list ordered most-recent-first
 * (as the API returns it). Ongoing and result-less games are skipped.
 */
export function summarizeRecentForm(games: Game[], profileId: number): RecentForm {
  let wins = 0
  let losses = 0
  const lastResults: ('W' | 'L')[] = []
  const durations: number[] = []

  for (const game of games) {
    if (game.ongoing) continue
    const me = playerInGame(game, profileId)
    if (!me) continue
    if (me.result === 'win') {
      wins++
      lastResults.push('W')
    } else if (me.result === 'loss') {
      losses++
      lastResults.push('L')
    } else {
      continue
    }
    if (typeof game.duration === 'number') durations.push(game.duration)
  }

  const total = wins + losses
  return {
    games: total,
    wins,
    losses,
    winRate: total ? round1((wins / total) * 100) : null,
    streak: computeStreak(lastResults),
    lastResults,
    avgDurationSec: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null,
  }
}
