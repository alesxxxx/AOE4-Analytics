import type { LeaderboardResponse } from '../api/types'

/** One ladder row, flattened from the AoE4World leaderboard response. */
export interface LeaderboardRow {
  rank: number
  profileId: number
  name: string
  country: string | null
  rating: number
  winRate: number | null
  games: number
  wins: number
  losses: number
  streak: number
  rankLevel: string | null
  /** Player is currently live on Twitch (per AoE4World). */
  live: boolean
  /** This row is the current user. */
  isYou: boolean
}

/** Flattens leaderboard players into rows, marking the current user. */
export function buildLeaderboardRows(
  resp: LeaderboardResponse,
  youProfileId?: number | null,
): LeaderboardRow[] {
  return resp.players.map((p) => ({
    rank: p.rank,
    profileId: p.profile_id,
    name: p.name,
    country: p.country ?? null,
    rating: p.rating,
    winRate: p.win_rate ?? null,
    games: p.games_count ?? 0,
    wins: p.wins_count ?? 0,
    losses: p.losses_count ?? 0,
    streak: p.streak ?? 0,
    rankLevel: p.rank_level ?? null,
    live: p.twitch_is_live ?? false,
    isYou: youProfileId != null && p.profile_id === youProfileId,
  }))
}
