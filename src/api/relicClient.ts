import { inflateSync } from 'node:zlib'
import { type DiskCache } from './cache'
import { type RateLimiter } from './rateLimiter'
import { fetchWithTimeout } from './fetchWithTimeout'
import { ApiError, REQUEST_TIMEOUT_MS, USER_AGENT } from './client'
import { prettyMapName } from '@domain/relic'
import type {
  RelicMatch,
  RelicPersonalStatResponse,
  RelicRecentMatchHistoryResponse,
} from './relicTypes'

/**
 * Relic's official AoE4 community API. The same backend the in-game ladder uses,
 * exposing per-match data AoE4World's public API hides (command counts → APM,
 * rating deltas, custom/AI games). Mirrors `Aoe4WorldClient`'s discipline: every
 * request flows through the shared rate limiter + disk cache and sends the honest
 * User-Agent. `reliclink.com` fails TLS cert validation, so we pin the
 * `worldsedgelink.com` mirror (same API, valid cert).
 */
export const RELIC_BASE = 'https://aoe-api.worldsedgelink.com'
const TITLE = 'age4'

const TTL = {
  matches: 5 * 60_000,
  profile: 5 * 60_000,
} as const

export interface RelicClientOptions {
  cache: DiskCache
  rateLimiter: RateLimiter
  fetchFn?: typeof fetch
  baseUrl?: string
}

export class RelicClient {
  private readonly cache: DiskCache
  private readonly rateLimiter: RateLimiter
  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  /** One network/parse pipeline per URL so concurrent cache misses share work. */
  private readonly inFlight = new Map<string, Promise<unknown>>()

  constructor(options: RelicClientOptions) {
    this.cache = options.cache
    this.rateLimiter = options.rateLimiter
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.baseUrl = options.baseUrl ?? RELIC_BASE
  }

  private async getJson<T extends { result: { code: number; message: string } }>(
    path: string,
    ttlMs: number,
  ): Promise<T> {
    const url = this.baseUrl + path
    const cached = this.cache.get<T>(url, ttlMs)
    if (cached !== null) return cached

    const existing = this.inFlight.get(url)
    if (existing) return (await existing) as T

    const request = (async (): Promise<T> => {
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
      // Relic returns HTTP 200 even for logical errors (code 2, 9, …) — treat a
      // non-zero result code as a failure so it isn't cached as success.
      if (!body.result || body.result.code !== 0) {
        throw new ApiError(body.result?.code ?? -1, url, `Relic error: ${body.result?.message}`)
      }
      this.cache.set(url, body)
      return body
    })()
    this.inFlight.set(url, request)
    try {
      return await request
    } finally {
      if (this.inFlight.get(url) === request) this.inFlight.delete(url)
    }
  }

  getRecentMatchHistory(profileId: number): Promise<RelicRecentMatchHistoryResponse> {
    const ids = encodeURIComponent(`[${profileId}]`)
    return this.getJson(
      `/community/leaderboard/getRecentMatchHistory?title=${TITLE}&profile_ids=${ids}`,
      TTL.matches,
    )
  }

  getPersonalStat(profileIds: number[]): Promise<RelicPersonalStatResponse> {
    const ids = encodeURIComponent(JSON.stringify(profileIds))
    return this.getJson(
      `/community/leaderboard/getPersonalStat?title=${TITLE}&profile_ids=${ids}`,
      TTL.profile,
    )
  }

  getPersonalStatByAlias(aliases: string[]): Promise<RelicPersonalStatResponse> {
    const a = encodeURIComponent(JSON.stringify(aliases))
    return this.getJson(
      `/community/leaderboard/getPersonalStat?title=${TITLE}&aliases=${a}`,
      TTL.profile,
    )
  }

  /**
   * Resolves each match's real map name (the top-level `mapname` is usually the
   * useless `generated_map`; the real one is in the zlib-compressed `options`).
   * Node-only (zlib) — kept here so the pure domain layer stays renderer-safe.
   */
  mapNamesFor(matches: RelicMatch[]): Record<number, string> {
    const out: Record<number, string> = {}
    for (const m of matches) {
      out[m.id] = this.decodeMapName(m)
    }
    return out
  }

  private decodeMapName(match: RelicMatch): string {
    const opts = decodeBlob(match.options)
    if (opts && typeof opts === 'object') {
      const o = opts as { localizedMapName?: unknown; mapName?: unknown }
      if (typeof o.localizedMapName === 'string' && o.localizedMapName) return o.localizedMapName
      if (typeof o.mapName === 'string' && o.mapName) return prettyMapName(o.mapName)
    }
    return prettyMapName(match.mapname)
  }
}

/** base64 → zlib(inflate) → JSON. Relic pads with a trailing NUL; strip it. */
function decodeBlob(b64: string): unknown {
  if (!b64) return null
  try {
    const text = inflateSync(Buffer.from(b64, 'base64')).toString('utf8').replace(/\0+$/, '').trim()
    return JSON.parse(text)
  } catch {
    return null
  }
}
