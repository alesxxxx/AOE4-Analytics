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
  bytes: Uint8Array
  parsed?: MatchSummary | null
}

const cachedSummaries = new Map<string, CachedSummaryEntry>()

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
  try {
    if (!existsSync(file)) return null
    const stat = statSync(file)
    if (!stat.isFile()) return null
    const memo = cachedSummaries.get(file)
    if (memo && memo.mtimeMs === stat.mtimeMs && memo.size === stat.size) return memo
    const entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      bytes: new Uint8Array(gunzipSync(readFileSync(file))),
    }
    cachedSummaries.set(file, entry)
    return entry
  } catch {
    cachedSummaries.delete(file)
    return null
  }
}

/** The cached summary blob (inflated), or null when absent/unreadable. */
export function readCachedSummary(gameId: string): Uint8Array | null {
  return readCachedEntry(gameId)?.bytes ?? null
}

/** The cached summary parsed once per process, or null when absent/unreadable. */
export function readCachedParsedSummary(gameId: string): MatchSummary | null {
  const entry = readCachedEntry(gameId)
  if (!entry) return null
  if (!('parsed' in entry)) entry.parsed = parseStatsSummary(entry.bytes)
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
    cachedSummaries.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, bytes })
    clearSummaryUnavailable(gameId)
  } catch {
    /* cache is an optimization, never an error */
  }
}
