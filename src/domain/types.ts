/**
 * Domain models — the app's own vocabulary, decoupled from raw API shapes.
 * Pure types; no Node/Electron. Built by the `src/domain/*` functions.
 */

export interface RecentForm {
  /** Finished games counted (with a win/loss result). */
  games: number
  wins: number
  losses: number
  /** Win percentage (0–100), or null when no finished games. */
  winRate: number | null
  /** Current streak: positive = win streak, negative = loss streak. */
  streak: number
  /** Results most-recent-first, e.g. ['L','L','W', …]. */
  lastResults: ('W' | 'L')[]
  avgDurationSec: number | null
}

export interface CivUsage {
  civ: string
  civName: string
  games: number
  wins: number
  winRate: number | null
}

export interface MapUsage {
  map: string
  games: number
  wins: number
  winRate: number | null
}

export interface RankInfo {
  leaderboard: string
  rankLevel: string | null
  rating: number | null
  maxRating: number | null
  rank: number | null
  winRate: number | null
  gamesCount: number
}

export interface ScoutReport {
  profileId: number
  name: string
  country: string | null
  /** Best/most-relevant rated mode (rm_solo preferred), or null if unranked. */
  primary: RankInfo | null
  /** All rated modes with games, most-played first. */
  modes: RankInfo[]
  recentForm: RecentForm
  topCivs: CivUsage[]
  topMaps: MapUsage[]
  /** Plain-English "what to expect / how to counter" (enriched in Phase 2). */
  note: string
  /** False when the player has no public match history / no rated games. */
  hasData: boolean
}
