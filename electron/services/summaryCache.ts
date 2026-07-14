/**
 * Disk cache for ranked stat-summary blobs (the Relic datatype-1 file behind the
 * post-game economy/build-order view). Relic only serves summaries for RECENT
 * matches — once a game ages out of that window the blob is gone forever — so we
 * persist every fetched blob under userData/summaries/<gameId>.rgs.gz. Reads are
 * cache-first and work offline. Local custom games don't need this (their
 * stats.rgs already lives in the game's matchhistory folder).
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { parseStatsSummary, type MatchSummary } from '@domain/statsSummary'

function cacheDir(): string {
  return join(app.getPath('userData'), 'summaries')
}

interface CachedSummaryEntry {
  mtimeMs: number
  size: number
  /** Dropped once `parsed` exists — retaining every inflated blob leaks MBs. */
  bytes?: Uint8Array
  parsed?: MatchSummary | null
}

const MEMO_CAP = 24

/** Insertion-order LRU over the disk cache (the disk keeps every blob forever). */
const cachedSummaries = new Map<string, CachedSummaryEntry>()

function memoize(file: string, entry: CachedSummaryEntry): CachedSummaryEntry {
  cachedSummaries.delete(file) // re-insert so iteration order tracks recency
  cachedSummaries.set(file, entry)
  while (cachedSummaries.size > MEMO_CAP) {
    const oldest = cachedSummaries.keys().next()
    if (oldest.done) break
    cachedSummaries.delete(oldest.value)
  }
  return entry
}

/** Game ids are Relic match ids. Anything else is refused (no path tricks). */
function safeGameId(gameId: string): string | null {
  if (!/^[\w-]{1,64}$/.test(gameId)) return null
  return gameId
}

function fileFor(gameId: string): string | null {
  const safe = safeGameId(gameId)
  return safe ? join(cacheDir(), `${safe}.rgs.gz`) : null
}

function unavailableFileFor(gameId: string): string | null {
  const safe = safeGameId(gameId)
  return safe ? join(cacheDir(), `${safe}.unavailable`) : null
}

function readCachedEntry(gameId: string): CachedSummaryEntry | null {
  const file = fileFor(gameId)
  if (!file) return null
  if (!existsSync(file)) return null

  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(file)
  } catch {
    cachedSummaries.delete(file)
    return null
  }
  if (!stat.isFile()) return null
  const memo = cachedSummaries.get(file)
  if (memo && memo.mtimeMs === stat.mtimeMs && memo.size === stat.size) return memoize(file, memo)

  let compressed: Buffer
  try {
    compressed = readFileSync(file)
  } catch {
    cachedSummaries.delete(file)
    return null
  }

  try {
    return memoize(file, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      bytes: new Uint8Array(gunzipSync(compressed)),
    })
  } catch {
    cachedSummaries.delete(file)
    // A confirmed corrupt/truncated gzip must not permanently block a network
    // re-fetch. Transient stat/read failures above deliberately keep the file.
    try {
      rmSync(file, { force: true })
    } catch {
      /* ignore */
    }
    return null
  }
}

/** The cached summary blob (inflated), or null when absent/unreadable. */
export function readCachedSummary(gameId: string): Uint8Array | null {
  const entry = readCachedEntry(gameId)
  if (!entry) return null
  if (entry.bytes) return entry.bytes
  // Bytes are dropped once parsed — re-inflate for this (rare) raw read without
  // pinning them back into the memo.
  const file = fileFor(gameId)
  if (!file) return null
  try {
    return new Uint8Array(gunzipSync(readFileSync(file)))
  } catch {
    return null
  }
}

/** The cached summary parsed once per process, or null when absent/unreadable. */
export function readCachedParsedSummary(gameId: string): MatchSummary | null {
  const entry = readCachedEntry(gameId)
  if (!entry) return null
  if (!('parsed' in entry)) {
    entry.parsed = entry.bytes ? parseStatsSummary(entry.bytes) : null
    delete entry.bytes
  }
  return entry.parsed ?? null
}

export function hasCachedSummary(gameId: string): boolean {
  const file = fileFor(gameId)
  if (!file) return false
  return existsSync(file)
}

/**
 * A tombstone for ranked games whose summary has already aged out of Relic's
 * recent-match window (or never had a datatype-1 blob). This prevents every sync
 * from spending the limited download budget on the same impossible games.
 */
export function hasUnavailableSummary(gameId: string): boolean {
  if (hasCachedSummary(gameId)) return false
  const file = unavailableFileFor(gameId)
  return file != null && existsSync(file)
}

export function markSummaryUnavailable(gameId: string): void {
  if (hasCachedSummary(gameId)) return
  const file = unavailableFileFor(gameId)
  if (!file) return
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(file, 'unavailable', 'utf8')
  } catch {
    /* tombstones are an optimization, never an error */
  }
}

export function clearSummaryUnavailable(gameId: string): void {
  const file = unavailableFileFor(gameId)
  if (!file) return
  try {
    rmSync(file, { force: true })
  } catch {
    /* ignore */
  }
}

/** Best-effort persist; a full disk or bad id never breaks the caller. */
export function writeCachedSummary(gameId: string, bytes: Uint8Array): void {
  const file = fileFor(gameId)
  if (!file) return
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(file, gzipSync(Buffer.from(bytes)))
    const stat = statSync(file)
    memoize(file, { mtimeMs: stat.mtimeMs, size: stat.size, bytes })
    clearSummaryUnavailable(gameId)
  } catch {
    /* cache is an optimization, never an error */
  }
}
