/**
 * AoE4World API (v0) response types — derived from real responses captured into
 * `src/api/__fixtures__/` on 2026-06-26 (sample player Beastyqt, 10240693).
 *
 * Notable real-world quirks baked into these types (verified, not assumed):
 *  - The profile endpoint nests per-mode stats under `modes`; `players/search`
 *    uses `leaderboards` with the same value shape (`ModeStats`).
 *  - A game's participants are `teams: TeamSlot[][]` (array of teams, each an
 *    array of slots). The TWO game endpoints disagree on the slot shape:
 *      • `/players/{id}/games`     → slot is `{ player: GamePlayer }` (wrapped)
 *      • `/players/{id}/games/last`→ slot is a `GamePlayer` directly, ALSO
 *        carrying the embedded full profile (`modes`, `avatars`, …).
 *    Use `normalizeTeams()` to flatten both into `GamePlayer[][]`.
 *  - `rating` is often `null` for 1v1 (the ladder uses `rm_solo` but the number
 *    lives in `mmr`); fall back to `mmr` when `rating` is null.
 *  - `ongoing === false` means finished (there is no `finished_at`).
 */

export type Leaderboard =
  | 'rm_solo'
  | 'rm_team'
  | 'rm_1v1'
  | 'rm_2v2'
  | 'rm_3v3'
  | 'rm_4v4'
  | 'qm_1v1'
  | 'qm_2v2'
  | 'qm_3v3'
  | 'qm_4v4'

export type StatsLeaderboard = 'rm_solo' | 'qm_1v1' | 'rm_2v2' | 'rm_3v3' | 'rm_4v4'

export type GameResult = 'win' | 'loss' | null

export type RankLevel =
  | 'unranked'
  | `bronze_${1 | 2 | 3}`
  | `silver_${1 | 2 | 3}`
  | `gold_${1 | 2 | 3}`
  | `platinum_${1 | 2 | 3}`
  | `diamond_${1 | 2 | 3}`
  | `conqueror_${1 | 2 | 3 | 4}`
  | (string & {})

export interface Avatars {
  small?: string
  medium?: string
  full?: string
}

export interface ModeCivStat {
  civilization: string
  games_count?: number
  wins_count?: number
  win_rate?: number | null
  pick_rate?: number | null
}

/** Per-mode stats. Fields vary by mode/state, so most are optional. */
export interface ModeStats {
  rank_level?: RankLevel | null
  rating?: number | null
  max_rating?: number | null
  max_rating_7d?: number | null
  max_rating_1m?: number | null
  rank?: number | null
  streak?: number | null
  games_count?: number
  wins_count?: number
  losses_count?: number
  disputes_count?: number
  drops_count?: number
  last_game_at?: string | null
  win_rate?: number | null
  season?: number | null
  civilizations?: ModeCivStat[]
  rating_history?: Record<string, unknown> | unknown[]
}

export type Modes = Partial<Record<string, ModeStats>>

export interface Social {
  twitch?: string | null
  twitter?: string | null
  youtube?: string | null
  instagram?: string | null
  liquipedia?: string | null
}

/** A player as returned by `GET /players/{profile_id}`. */
export interface Player {
  name: string
  profile_id: number
  steam_id?: string | null
  site_url?: string
  country?: string | null
  avatars?: Avatars
  social?: Social
  modes: Modes
}

/** A player as returned inside `players[]` of `GET /players/search`. */
export interface SearchPlayer {
  name: string
  profile_id: number
  steam_id?: string | null
  country?: string | null
  avatars?: Avatars
  social?: Social
  last_game_at?: string | null
  /** Search uses the key `leaderboards` (same value shape as `modes`). */
  leaderboards: Modes
}

export interface Paginated {
  total_count: number
  page?: number
  per_page?: number
  count: number
  offset?: number
  filters?: unknown
}

export interface SearchResponse extends Paginated {
  players: SearchPlayer[]
}

/** A participant in a game. On `games/last` it also carries the embedded profile. */
export interface GamePlayer {
  profile_id: number
  name: string
  result: GameResult
  civilization: string
  civilization_randomized?: boolean
  rating: number | null
  rating_diff: number | null
  mmr: number | null
  mmr_diff?: number | null
  input_type?: string
  country?: string | null
  // Present only when the endpoint embeds the full profile (games/last, single game):
  steam_id?: string
  site_url?: string
  avatars?: Avatars
  social?: Social
  modes?: Modes
}

/** A team slot is either wrapped (`games` list) or the player directly (`games/last`). */
export type TeamSlot = GamePlayer | { player: GamePlayer }

export interface Game {
  game_id: number
  started_at: string
  updated_at?: string
  duration: number | null
  map: string
  kind: string
  leaderboard: string
  mmr_leaderboard?: string
  season?: number | null
  server?: string | null
  patch?: number | string | null
  average_rating?: number | null
  average_mmr?: number | null
  ongoing: boolean
  just_finished: boolean
  teams: TeamSlot[][]
}

export interface GamesResponse extends Paginated {
  games: Game[]
}

export interface LeaderboardPlayer {
  name: string
  profile_id: number
  country?: string | null
  avatars?: Avatars
  rating: number
  max_rating?: number
  rank: number
  rank_level?: RankLevel | null
  streak?: number
  games_count?: number
  wins_count?: number
  losses_count?: number
  win_rate?: number | null
  last_game_at?: string | null
  twitch_is_live?: boolean
}

export interface LeaderboardResponse extends Paginated {
  key?: string
  name?: string
  short_name?: string
  season?: number
  players: LeaderboardPlayer[]
}

export interface CivStatEntry {
  civilization: string
  win_rate: number
  pick_rate: number
  win_count: number
  games_count: number
  player_games_count: number
  duration_median: number
  duration_average: number
}

export interface CivStatsResponse {
  leaderboard: string
  rank_level: RankLevel | null
  rating: string | null
  patch: string | null
  data: CivStatEntry[]
}

export interface MapStatEntry {
  map_id: number
  map: string
  games_count: number
  duration_median: number
  duration_average: number
  /** The single civ with the highest win rate on this map (API gives only one). */
  highest_win_rate_civilization?: string | null
}

export interface MapStatsResponse {
  leaderboard: string
  rank_level: RankLevel | null
  rating: string | null
  patch: string | null
  data: MapStatEntry[]
}

export interface MatchupEntry {
  civilization: string
  other_civilization: string
  win_rate: number
  win_count: number
  games_count: number
  player_games_count: number
  duration_median: number
  duration_average: number
}

export interface MatchupStatsResponse {
  leaderboard: string
  rank_level: RankLevel | null
  rating: string | null
  patch: string | null
  data: MatchupEntry[]
}

/**
 * Normalizes a game's `teams` (which differ between the list and last-game
 * endpoints) into a uniform `GamePlayer[][]`.
 */
export function normalizeTeams(game: Pick<Game, 'teams'>): GamePlayer[][] {
  return (game.teams ?? []).map((team) =>
    team.map((slot) => ('player' in slot ? slot.player : slot)),
  )
}

/** Flattens all participants of a game into a single `GamePlayer[]`. */
export function allPlayers(game: Pick<Game, 'teams'>): GamePlayer[] {
  return normalizeTeams(game).flat()
}
