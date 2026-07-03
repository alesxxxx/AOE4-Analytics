import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

/** Sweep cache files older than this on construction so the dir can't grow forever. */
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60_000

export interface DiskCacheOptions {
  /** Directory where cache entries are written (created if missing). */
  baseDir: string
  /** Injectable clock (defaults to Date.now). */
  now?: () => number
  /** Files older than this (by mtime) are deleted on construction. */
  maxAgeMs?: number
}

interface CacheEnvelope {
  fetchedAt: number
  body: unknown
}

/**
 * A tiny synchronous disk cache keyed by URL (D9). Each entry is a
 * JSON file `{ fetchedAt, body }`; `get` honours a per-call TTL. Corrupt or
 * missing files are treated as a miss (never throw) so a bad cache file can't
 * break a request. Synchronous on purpose — it runs in the main process.
 */
export class DiskCache {
  private readonly baseDir: string
  private readonly now: () => number

  constructor(options: DiskCacheOptions) {
    this.baseDir = options.baseDir
    this.now = options.now ?? Date.now
    mkdirSync(this.baseDir, { recursive: true })
    this.sweep(options.maxAgeMs ?? DEFAULT_MAX_AGE_MS)
  }

  /** Absolute path of the cache file for a key (stable hash). */
  pathFor(key: string): string {
    const hash = createHash('sha1').update(key).digest('hex')
    return join(this.baseDir, `${hash}.json`)
  }

  get<T>(key: string, ttlMs: number): T | null {
    const file = this.pathFor(key)
    if (!existsSync(file)) return null
    try {
      const envelope = JSON.parse(readFileSync(file, 'utf8')) as CacheEnvelope
      if (typeof envelope?.fetchedAt !== 'number') return this.evict(file)
      if (this.now() - envelope.fetchedAt >= ttlMs) return this.evict(file)
      return envelope.body as T
    } catch {
      return this.evict(file)
    }
  }

  set(key: string, body: unknown): void {
    // Don't cache an absent/empty success body: `get` returns null for a miss,
    // so a stored null would be indistinguishable from a miss and re-fetch forever.
    if (body == null) return
    const envelope: CacheEnvelope = { fetchedAt: this.now(), body }
    try {
      writeFileSync(this.pathFor(key), JSON.stringify(envelope), 'utf8')
    } catch {
      // A cache write failure must never break the actual request.
    }
  }

  /** Delete a stale/corrupt file (best-effort) and report it as a miss. */
  private evict(file: string): null {
    try {
      unlinkSync(file)
    } catch {
      // best-effort
    }
    return null
  }

  /** Best-effort one-shot prune of cache files older than maxAgeMs (by mtime). */
  private sweep(maxAgeMs: number): void {
    const cutoff = this.now() - maxAgeMs
    try {
      for (const name of readdirSync(this.baseDir)) {
        if (!name.endsWith('.json')) continue
        const file = join(this.baseDir, name)
        try {
          if (statSync(file).mtimeMs < cutoff) unlinkSync(file)
        } catch {
          // ignore a single unreadable file
        }
      }
    } catch {
      // sweep is best-effort; never block construction
    }
  }
}
