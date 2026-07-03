import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RelicClient } from '../relicClient'
import { ApiError, USER_AGENT } from '../client'
import { DiskCache } from '../cache'
import { RateLimiter } from '../rateLimiter'
import { loadFixture } from './fixtures'
import type { RelicRecentMatchHistoryResponse } from '../relicTypes'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rtslytics-relic-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} })
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }) as unknown as typeof fetch
  return { fetch: fn, calls }
}

function makeClient(fetchFn: typeof fetch) {
  return new RelicClient({
    cache: new DiskCache({ baseDir: dir }),
    rateLimiter: new RateLimiter({ minIntervalMs: 0 }),
    fetchFn,
  })
}

describe('RelicClient', () => {
  it('builds the recent-match-history URL with the JSON-array profile_ids + honest UA', async () => {
    const fx = loadFixture('relic/recentMatchHistory_23656868.json')
    const fake = fakeFetch(fx)
    const client = makeClient(fake.fetch)
    const res = await client.getRecentMatchHistory(23656868)
    expect(res.matchHistoryStats.length).toBeGreaterThan(0)
    expect(fake.calls[0]!.url).toContain('getRecentMatchHistory')
    expect(fake.calls[0]!.url).toContain('title=age4')
    expect(fake.calls[0]!.url).toContain('profile_ids=%5B23656868%5D')
    expect(fake.calls[0]!.headers['User-Agent']).toBe(USER_AGENT)
  })

  it('caches: a second identical call does not hit fetch again', async () => {
    const fake = fakeFetch(loadFixture('relic/recentMatchHistory_23656868.json'))
    const client = makeClient(fake.fetch)
    await client.getRecentMatchHistory(23656868)
    await client.getRecentMatchHistory(23656868)
    expect(fake.calls.length).toBe(1)
  })

  it('throws ApiError on a non-2xx response', async () => {
    const client = makeClient(fakeFetch({ result: { code: 0, message: '' } }, 500).fetch)
    await expect(client.getRecentMatchHistory(1)).rejects.toBeInstanceOf(ApiError)
  })

  it('treats a non-zero result.code (HTTP 200) as an error, not a cache hit', async () => {
    const fake = fakeFetch({ result: { code: 9, message: 'UNKNOWN_ALIASES' } })
    const client = makeClient(fake.fetch)
    await expect(client.getPersonalStatByAlias(['nope'])).rejects.toBeInstanceOf(ApiError)
    // not cached → a retry hits fetch again
    await expect(client.getPersonalStatByAlias(['nope'])).rejects.toBeInstanceOf(ApiError)
    expect(fake.calls.length).toBe(2)
  })

  it('decodes real map names from the zlib options blob', async () => {
    const fx = loadFixture<RelicRecentMatchHistoryResponse>(
      'relic/recentMatchHistory_23656868.json',
    )
    const client = makeClient(fakeFetch(fx).fetch)
    const mapNames = client.mapNamesFor(fx.matchHistoryStats)
    const first = fx.matchHistoryStats[0]!
    expect(typeof mapNames[first.id]).toBe('string')
    expect(mapNames[first.id]!.length).toBeGreaterThan(0)
  })
})
