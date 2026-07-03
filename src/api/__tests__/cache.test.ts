import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskCache } from '../cache'

let dir: string
let clock: { t: number }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rtslytics-cache-'))
  clock = { t: 1000 }
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeCache() {
  return new DiskCache({ baseDir: dir, now: () => clock.t })
}

describe('DiskCache', () => {
  it('returns null on a miss', () => {
    const cache = makeCache()
    expect(cache.get('nope', 1000)).toBeNull()
  })

  it('set then get returns the body within TTL', () => {
    const cache = makeCache()
    cache.set('key1', { hello: 'world' })
    expect(cache.get<{ hello: string }>('key1', 5000)).toEqual({ hello: 'world' })
  })

  it('returns null once the entry is older than the TTL', () => {
    const cache = makeCache()
    cache.set('key1', { n: 1 })
    clock.t += 6000
    expect(cache.get('key1', 5000)).toBeNull()
  })

  it('ignores a corrupt cache file (returns null, no throw)', () => {
    const cache = makeCache()
    cache.set('key1', { n: 1 })
    writeFileSync(cache.pathFor('key1'), '{ this is not json', 'utf8')
    expect(cache.get('key1', 5000)).toBeNull()
  })

  it('different keys do not collide', () => {
    const cache = makeCache()
    cache.set('a', { v: 'a' })
    cache.set('b', { v: 'b' })
    expect(cache.get<{ v: string }>('a', 5000)).toEqual({ v: 'a' })
    expect(cache.get<{ v: string }>('b', 5000)).toEqual({ v: 'b' })
  })
})
