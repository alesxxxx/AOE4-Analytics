import { type DiskCache } from './cache'
import { type RateLimiter } from './rateLimiter'
import { fetchWithTimeout } from './fetchWithTimeout'
import type { AgeupStatsResponse } from '@domain/landmarkStats'
import type {
  SearchResponse,
  Player,
  GamesResponse,
  Game,
  LeaderboardResponse,
  CivStatsResponse,
  MatchupStatsResponse,
  MapStatsResponse,
  Leaderboard,
  StatsLeaderboard,
  RankLevel,
} from './types'

/** Honest, non-spoofed User-Agent (D9 / A2). Single source of truth. */
export const USER_AGENT = 'RTSLytics/0.1 (+contact: tarantinocoop@gmail.com)'
export const API_BASE = 'https://aoe4world.com/api/v0'

/** Abort a request after this long so one hung fetch can't deadlock the queue. */
export const REQUEST_TIMEOUT_MS = 15_000

/** Per-endpoint cache TTLs in milliseconds (D9). */
export const TTL = {
  profile: 5 * 60_000,
  games: 5 * 60_000,
  lastGame: 12_000,
  game: 60 * 60_000,
  leaderboard: 10 * 60_000,
  stats: 6 * 60 * 60_000,
  /** The ageup-analytics dataset updates ~per patch; AoE4World flags the
   *  endpoint as internal, so we cache a full day to keep our touch light. */
  analytics: 24 * 60 * 60_000,
} as const

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `AoE4World API error ${status} for ${url}`)
    this.name = 'ApiError'
  }
}

export interface ClientOptions {
  cache: DiskCache
  rateLimiter: RateLimiter
  /** Injectable fetch (defaults to global fetch). */
  fetchFn?: typeof fetch
  baseUrl?: string
}

export interface GamesQuery {
  leaderboard?: Leaderboard
  limit?: number
  page?: number
  /** Incremental sync cursor (filters by `started_at`). */
  since?: string
  /** Bypass the cache — for folding results, which change after a game ends. */
  fresh?: boolean
}

export interface StatsQuery {
  leaderboard?: StatsLeaderboard
  rankLevel?: RankLevel
  patch?: string
}

/**
 * The single typed AoE4World client. Every request flows through the rate
 * limiter and the disk cache; non-2xx responses become `ApiError`. Lives in the
 * main process — the renderer never calls it directly (D4).
 */
export class Aoe4WorldClient {
  private readonly cache: DiskCache
  private readonly rateLimiter: RateLimiter
  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string

  constructor(options: ClientOptions) {
    this.cache = options.cache
    this.rateLimiter = options.rateLimiter
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.baseUrl = options.baseUrl ?? API_BASE
  }

  private async getJson<T>(path: string, ttlMs: number): Promise<T> {
    const url = this.baseUrl + path
    const cached = this.cache.get<T>(url, ttlMs)
    if (cached !== null) return cached

    const res = await this.rateLimiter.schedule(() =>
      fetchWithTimeout(
        this.fetchFn,
        url,
        { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
        REQUEST_TIMEOUT_MS,
      ),
    )
    if (!res.ok) throw new ApiError(res.status, url)

    const body = (await res.json()) as T
    this.cache.set(url, body)
    return body
  }

  searchPlayers(query: string): Promise<SearchResponse> {
    return this.getJson(`/players/search?query=${encodeURIComponent(query)}`, TTL.profile)
  }

  getPlayer(profileId: number): Promise<Player> {
    return this.getJson(`/players/${profileId}`, TTL.profile)
  }

  getPlayerGames(profileId: number, query: GamesQuery = {}): Promise<GamesResponse> {
    const params = new URLSearchParams({ limit: String(query.limit ?? 10) })
    // Omit the leaderboard param entirely to get ALL recent games (ranked +
    // Quick Match, 1v1 and team) — the API only returns rm_solo when filtered,
    // which silently hid every QM game from History.
    if (query.leaderboard) params.set('leaderboard', query.leaderboard)
    if (query.page) params.set('page', String(query.page))
    if (query.since) params.set('since', query.since)
    // ttl 0 = always a cache miss → fresh fetch (results change after a game ends).
    return this.getJson(`/players/${profileId}/games?${params.toString()}`, query.fresh ? 0 : TTL.games)
  }

  getLastGame(profileId: number): Promise<Game> {
    return this.getJson(`/players/${profileId}/games/last`, TTL.lastGame)
  }

  getGame(profileId: number, gameId: number): Promise<Game> {
    return this.getJson(`/players/${profileId}/games/${gameId}`, TTL.game)
  }

  getLeaderboard(
    leaderboard: Leaderboard,
    query: { page?: number; country?: string } = {},
  ): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({ page: String(query.page ?? 1) })
    if (query.country) params.set('country', query.country)
    return this.getJson(`/leaderboards/${leaderboard}?${params.toString()}`, TTL.leaderboard)
  }

  getCivStats(query: StatsQuery = {}): Promise<CivStatsResponse> {
    const lb = query.leaderboard ?? 'rm_solo'
    const params = new URLSearchParams()
    if (query.rankLevel) params.set('rank_level', query.rankLevel)
    if (query.patch) params.set('patch', query.patch)
    const qs = params.toString()
    return this.getJson(`/stats/${lb}/civilizations${qs ? `?${qs}` : ''}`, TTL.stats)
  }

  /**
   * Per-landmark ("ageup") analytics for one civ: path subsets with games/wins/
   * win-rate and age-up completion times. INTERNAL AoE4World endpoint (their
   * notice says subject to change) — callers must treat failures as "no data".
   */
  getAgeupStats(civilization: string, kind = 'rm_solo'): Promise<AgeupStatsResponse> {
    const params = new URLSearchParams({ kind, civilization })
    return this.getJson(`/stats/analytics/ageups?${params.toString()}`, TTL.analytics)
  }

  getMatchupStats(query: StatsQuery = {}): Promise<MatchupStatsResponse> {
    const lb = query.leaderboard ?? 'rm_solo'
    const params = new URLSearchParams()
    if (query.rankLevel) params.set('rank_level', query.rankLevel)
    if (query.patch) params.set('patch', query.patch)
    const qs = params.toString()
    return this.getJson(`/stats/${lb}/matchups${qs ? `?${qs}` : ''}`, TTL.stats)
  }

  getMapStats(query: StatsQuery = {}): Promise<MapStatsResponse> {
    const lb = query.leaderboard ?? 'rm_solo'
    const params = new URLSearchParams()
    if (query.rankLevel) params.set('rank_level', query.rankLevel)
    if (query.patch) params.set('patch', query.patch)
    const qs = params.toString()
    return this.getJson(`/stats/${lb}/maps${qs ? `?${qs}` : ''}`, TTL.stats)
  }
}
