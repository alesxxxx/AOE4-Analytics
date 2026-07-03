import { app } from 'electron'
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { LocalDataStatus } from '@ipc/contract'
import {
  determineSessionState,
  parseGameClock,
  parseLatestGameResult,
  parseLiveMatchupPlayers,
  parseLocalGameStats,
  type GameClock,
  type ParsedGameResult,
  type ParsedLocalStats,
  type SessionState,
} from '@domain/localStats'
import { parseMatchHistory, type LocalMatch } from '@domain/localMatch'
import {
  parseReplayHeader,
  replayMatchup,
  resolveReplayCiv,
  type ReplayInfo,
  type ReplayMatchup,
  type ReplayPlayer,
} from '@domain/replay'
import { buildLocalLiveMatchup, type LiveMatchup } from '@domain/liveMatch'
import { parseStatsSummary, type MatchSummary } from '@domain/statsSummary'
import { getSettings } from './appContext'

/**
 * Consent-gated access to the user's OWN local AoE4 log files (A1/D11). NOTHING
 * is read from disk unless `settings.localData.consentGranted` is true. ToS-safe
 * (own files, never game memory). The AoE4World API remains the fallback.
 */
const AOE4_DIRNAME = 'Age of Empires IV'

interface GameSummaryMemoEntry {
  mtimeMs: number
  size: number
  summary: MatchSummary | null
}

const gameSummaryMemo = new Map<string, GameSummaryMemoEntry>()

function gameDir(): string {
  const def = join(app.getPath('documents'), 'My Games', AOE4_DIRNAME)
  const override = getSettings().getAll().localData.gameDir
  if (!override) return def
  // Defense-in-depth: the override is renderer-settable, so only honour it when its
  // leaf folder name is the AoE4 directory name — a poisoned setting then can't
  // redirect our reads to an arbitrary directory (e.g. another user's profile). A
  // relocated install is supported as long as it keeps the "Age of Empires IV" folder
  // name. There is no relocation UI today (the override is always null); if one is
  // added, validate by probing for marker subdirs (matchhistory/replays) instead.
  const resolved = resolve(override)
  if (basename(resolved).toLowerCase() === AOE4_DIRNAME.toLowerCase()) return resolved
  return def
}

function warningLogPath(): string {
  return join(gameDir(), 'warnings.log')
}

/** Reads only the tail of a potentially multi-MB log to keep ticks cheap. */
function readLogTail(path: string, maxBytes = 1_000_000): string | null {
  try {
    if (!existsSync(path)) return null
    const size = statSync(path).size
    const start = Math.max(0, size - maxBytes)
    const length = size - start
    const fd = openSync(path, 'r')
    try {
      const buf = Buffer.alloc(length)
      readSync(fd, buf, 0, length, start)
      return buf.toString('utf8')
    } finally {
      closeSync(fd)
    }
  } catch {
    return null
  }
}

export function getLocalDataStatus(): LocalDataStatus {
  const consent = getSettings().getAll().localData.consentGranted
  const dir = gameDir()
  // Honour the consent gate: don't touch the filesystem until the user accepts.
  const logExists = consent ? existsSync(warningLogPath()) : false
  return {
    platform: process.platform,
    consentGranted: consent,
    available: consent && process.platform === 'win32' && logExists,
    gameDir: dir,
    logExists,
  }
}

/**
 * The full stat SUMMARY (build order + economy/score timelines) for a game, from
 * its local `stats.rgs` (custom games write it; ranked games don't — those come
 * from the backend, same parser). `matchId` is the matchhistory folder id; only a
 * numeric id is accepted (defense-in-depth against path traversal from the
 * renderer). Null without consent / when the file is absent or unparseable.
 */
export function readGameSummary(matchId: string): MatchSummary | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  if (!/^\d+$/.test(matchId)) return null
  const path = join(gameDir(), 'matchhistory', matchId, 'stats.rgs')
  try {
    if (!existsSync(path)) return null
    const stat = statSync(path)
    if (!stat.isFile()) return null
    const memo = gameSummaryMemo.get(path)
    if (memo && memo.mtimeMs === stat.mtimeMs && memo.size === stat.size) return memo.summary
    const summary = parseStatsSummary(new Uint8Array(readFileSync(path)))
    gameSummaryMemo.set(path, { mtimeMs: stat.mtimeMs, size: stat.size, summary })
    return summary
  } catch {
    gameSummaryMemo.delete(path)
    return null
  }
}

/** Latest local end-of-game economy stats for the user — only with consent. */
export function getLatestLocalStats(profileId?: number): ParsedLocalStats | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  const log = readLogTail(warningLogPath())
  if (!log) return null
  return parseLocalGameStats(log, profileId != null ? String(profileId) : undefined)
}

/** Latest full result/counters payload from warnings.log, when the game logged one. */
export function getLatestLocalGameResult(): ParsedGameResult | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  const log = readLogTail(warningLogPath(), 6_000_000)
  if (!log) return null
  return parseLatestGameResult(log)
}

/**
 * Parses the most recent local `match_history.jsn` (custom games included — only
 * with consent). This is how we can identify a private-lobby opponent that
 * AoE4World never sees (A4). Returns null without consent / when unavailable.
 */
export function getLatestLocalMatch(): LocalMatch | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  try {
    const dir = join(gameDir(), 'matchhistory')
    if (!existsSync(dir)) return null
    const folders = readdirSync(dir)
      .filter((f) => /^\d+$/.test(f))
      .sort() // folder ids are monotonically increasing → last is newest
    const latest = folders[folders.length - 1]
    if (!latest) return null
    const file = join(dir, latest, 'match_history.jsn')
    if (!existsSync(file)) return null
    return parseMatchHistory(readFileSync(file, 'utf8'), {
      myProfileId: getSettings().getAll().profileId ?? undefined,
    })
  } catch {
    return null
  }
}

/**
 * Reads the first `maxBytes` of a file (the .rec header lives in the first KBs).
 *
 * Reads straight into a fixed buffer and trusts the bytes-read COUNT — it must NOT
 * size the read from `statSync().size`. While the game holds the live `temp.rec`
 * open for writing, Windows reports a STALE directory size (typically 0) for the
 * path even though the header is fully readable through an open handle; sizing the
 * read from that yields a 0-byte read and the matchup never resolves.
 */
function readHead(path: string, maxBytes = 65536): Uint8Array | null {
  let fd: number | null = null
  try {
    fd = openSync(path, 'r')
    const buf = Buffer.alloc(maxBytes)
    const n = readSync(fd, buf, 0, maxBytes, 0)
    return new Uint8Array(buf.subarray(0, n))
  } catch {
    return null
  } finally {
    if (fd != null) closeSync(fd)
  }
}

/** All saved `.rec` files (named playback replays + per-match copies); skips temp scratch. */
function findReplayFiles(): string[] {
  const dir = gameDir()
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.rec') && !/^temp/i.test(e.name))
        out.push(p)
    }
  }
  try {
    const pb = join(dir, 'playback')
    if (existsSync(pb)) walk(pb)
  } catch {
    // ignore unreadable playback dir
  }
  try {
    const mh = join(dir, 'matchhistory')
    if (existsSync(mh)) {
      for (const f of readdirSync(mh)) {
        const p = join(mh, f, 'replay.rec')
        if (existsSync(p)) out.push(p)
      }
    }
  } catch {
    // ignore unreadable matchhistory dir
  }
  return out
}

export interface LatestReplayResult {
  info: ReplayInfo
  path: string
  recordedAtMs: number
}

/**
 * Parses the header of the most-recent `.rec` replay — the ToS-safe source for
 * custom/AI games AoE4World can't see (map + players + civs + Steam ids). Only
 * with consent. Header only; the command/economy stream is not read.
 */
export function getLatestReplay(): LatestReplayResult | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  try {
    let best: { path: string; mtimeMs: number } | null = null
    for (const p of findReplayFiles()) {
      try {
        const m = statSync(p).mtimeMs
        if (!best || m > best.mtimeMs) best = { path: p, mtimeMs: m }
      } catch {
        // skip unreadable file
      }
    }
    if (!best) return null
    const bytes = readHead(best.path)
    if (!bytes) return null
    const info = parseReplayHeader(bytes)
    if (!info) return null
    return { info, path: best.path, recordedAtMs: best.mtimeMs }
  } catch {
    return null
  }
}

/**
 * Parses the finalized `playback/temp.rec` header. Some human custom games can
 * fail to materialize a `matchhistory` folder when the game is offline at result
 * time, but the temp replay plus warnings.log result still exist.
 */
export function getTempReplay(): LatestReplayResult | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  try {
    const path = join(gameDir(), 'playback', 'temp.rec')
    if (!existsSync(path)) return null
    const bytes = readHead(path)
    if (!bytes) return null
    const info = parseReplayHeader(bytes)
    if (!info || info.players.length === 0) return null
    return { info, path, recordedAtMs: statSync(path).mtimeMs }
  } catch {
    return null
  }
}

/**
 * The matchup of the game being played RIGHT NOW, parsed from `warnings.log` — the
 * `GAME -- Human Player:` / `GAME -- AI Player:` lines the game writes at match
 * start (each `<slot> <name> <id> <team> <civToken>`). This is the LIVE-readable
 * matchup source — unlike `playback/temp.rec`, which Windows reports as 0 bytes
 * while the game holds it open and only finalizes at game END. ToS-safe (our own
 * log, no game memory). Works for CUSTOM / vs-AI games AoE4World never indexes.
 *
 * `me` is identified by the `Human` tag (the sole human in a vs-AI game) or, when
 * `mySteamIds` resolves a player, that one. Returns null without consent or before
 * the roster lines are in the log (briefly, during early load).
 */
export function getLiveMatchup(mySteamIds: string[] = []): ReplayMatchup | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  const log = readLogTail(warningLogPath(), 600_000)
  if (!log) return null
  const roster = parseLiveMatchupPlayers(log)
  if (roster.length === 0) return null
  const players: ReplayPlayer[] = roster.map((p) => {
    const civ = resolveReplayCiv(p.civToken)
    return {
      name: p.name,
      civToken: p.civToken,
      civSlug: civ.slug,
      civName: civ.name,
      steamId: null,
      ai: p.ai,
    }
  })
  return replayMatchup({ mapId: null, mapName: null, players }, mySteamIds)
}

/**
 * Team-preserving live matchup from warnings.log. Unlike `getLiveMatchup()`,
 * this keeps team ids so 2v2/custom games can render as teams instead of a
 * flattened "me vs everyone else" list.
 */
export function getLiveTeamMatchup(myProfileId: number | null): LiveMatchup | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  const log = readLogTail(warningLogPath(), 600_000)
  if (!log) return null
  return buildLocalLiveMatchup(parseLiveMatchupPlayers(log), myProfileId)
}

export interface LocalGameFiles {
  /** matchhistory folder id (stable, unique per game). */
  id: string
  match: LocalMatch
  replayInfo: ReplayInfo | null
  mtimeMs: number
}

/**
 * Lists recent local games from the `matchhistory` folders — each has a
 * `match_history.jsn` (result/timing) and usually a `replay.rec` (civs/opponent),
 * the basis for folding CUSTOM/AI games into History. Newest first; consent-gated.
 */
export function listLocalGames(limit = 25): LocalGameFiles[] {
  if (!getSettings().getAll().localData.consentGranted) return []
  try {
    const dir = join(gameDir(), 'matchhistory')
    if (!existsSync(dir)) return []
    const myProfileId = getSettings().getAll().profileId ?? undefined
    const folders = readdirSync(dir)
      .filter((f) => /^\d+$/.test(f))
      .sort()
      .reverse()
      .slice(0, limit)
    const out: LocalGameFiles[] = []
    for (const f of folders) {
      const mhPath = join(dir, f, 'match_history.jsn')
      if (!existsSync(mhPath)) continue
      const match = parseMatchHistory(readFileSync(mhPath, 'utf8'), { myProfileId })
      if (!match) continue
      const recPath = join(dir, f, 'replay.rec')
      const head = existsSync(recPath) ? readHead(recPath) : null
      out.push({
        id: f,
        match,
        replayInfo: head ? parseReplayHeader(head) : null,
        mtimeMs: statSync(mhPath).mtimeMs,
      })
    }
    return out
  } catch {
    return []
  }
}

/** Focus-independent match state from the local log — only with consent. */
export function getSessionState(processRunning: boolean): SessionState {
  if (!getSettings().getAll().localData.consentGranted) return 'not-running'
  const log = readLogTail(warningLogPath(), 600_000)
  if (!log) return 'not-running'
  return determineSessionState(processRunning, log)
}

/**
 * The accurate game clock (sim start + pauses) from the live warnings.log — the
 * basis for the overlay's build/age timing. Reads a generous tail so the
 * `Starting mission` anchor survives a long game. Null without consent/data.
 */
export function getGameClock(): GameClock | null {
  if (!getSettings().getAll().localData.consentGranted) return null
  const log = readLogTail(warningLogPath(), 6_000_000)
  if (!log) return null
  return parseGameClock(log)
}
