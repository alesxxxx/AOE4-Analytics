import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Aoe4WorldClient, ApiError, USER_AGENT } from '../client'
import { DiskCache } from '../cache'
import { RateLimiter } from '../rateLimiter'
import { loadFixture } from './fixtures'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rtslytics-client-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

interface FakeFetch {
  fetch: typeof fetch
  calls: { url: string; headers: Record<string, string> }[]
}

/** A fake fetch that serves a body (or a status) and records calls. */
function fakeFetch(body: unknown, status = 200): FakeFetch {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }) as unknown as typeof fetch
  return { fetch: fn, calls }
}

function makeClient(fetchFn: typeof fetch) {
  return new Aoe4WorldClient({
    cache: new DiskCache({ baseDir: dir }),
    rateLimiter: new RateLimiter({ minIntervalMs: 0 }),
    fetchFn,
    baseUrl: 'https://aoe4world.com/api/v0',
  })
}

describe('Aoe4WorldClient', () => {
  it('parses a search response', async () => {
    const fx = loadFixture('search-beasty.json')
    const client = makeClient(fakeFetch(fx).fetch)
    const res = await client.searchPlayers('beasty')
    expect(res.players.length).toBeGreaterThan(0)
  })

  it('sends the honest User-Agent header', async () => {
    const fake = fakeFetch(loadFixture('player-10240693.json'))
    const client = makeClient(fake.fetch)
    await client.getPlayer(10240693)
    expect(fake.calls[0]!.headers['User-Agent']).toBe(USER_AGENT)
  })

  it('caches: a second identical call does not hit fetch again', async () => {
    const fake = fakeFetch(loadFixture('player-10240693.json'))
    const client = makeClient(fake.fetch)
    await client.getPlayer(10240693)
    await client.getPlayer(10240693)
    expect(fake.calls.length).toBe(1)
  })

  it('parses games/last into a Game with ongoing=false', async () => {
    const client = makeClient(fakeFetch(loadFixture('games-last-10240693.json')).fetch)
    const game = await client.getLastGame(10240693)
    expect(game.ongoing).toBe(false)
    expect(game.teams.length).toBe(2)
  })

  it('throws ApiError on a non-2xx response', async () => {
    const client = makeClient(fakeFetch({ error: 'not found' }, 404).fetch)
    await expect(client.getPlayer(123)).rejects.toBeInstanceOf(ApiError)
    await expect(client.getPlayer(123)).rejects.toMatchObject({ status: 404 })
  })

  it('builds the games query with leaderboard + limit + since', async () => {
    const fake = fakeFetch(loadFixture('games-10240693-rmsolo.json'))
    const client = makeClient(fake.fetch)
    await client.getPlayerGames(10240693, {
      leaderboard: 'rm_solo',
      limit: 12,
      since: '2024-01-01',
    })
    const url = fake.calls[0]!.url
    expect(url).toContain('leaderboard=rm_solo')
    expect(url).toContain('limit=12')
    expect(url).toContain('since=2024-01-01')
  })
})
