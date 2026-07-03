/**
 * Pure parsers for the user's OWN local AoE4 log files (A1/D11) —
 * ToS-safe (reading your own files, never game memory). Ported from the prior
 * project's verified C# parsers. Two things:
 *   1. `parseLocalGameStats` — end-of-game economy stats from the
 *      `GameResultNotificationMessage` line in warnings.log.
 *   2. `determineSessionState` — in-match vs menu, from log lifecycle markers.
 * Both are pure so they're fixture-testable without a running game.
 */
import type { LocalGameStats, PerPlayerMatchStats } from './analysis'

export interface ParsedLocalStats extends LocalGameStats {
  profileId: string
}

export interface ParsedGameResult {
  /** Relic session/match id from GameResultNotificationMessage. */
  matchId: string
  /** The profile id the message was emitted for, usually the local player. */
  recipientProfileId: number | null
  players: PerPlayerMatchStats[]
}

// The result message line looks like: `...message=[0,"GameResultNotificationMessage",N,[[ rows ]]]`
const RESULT_RE = /message=(\[0,"GameResultNotificationMessage".*)$/gm

function parseRow(row: unknown[]): ParsedLocalStats | null {
  const stats = row[6]
  if (!Array.isArray(stats)) return null
  const values: Record<string, number> = {}
  for (const pair of stats) {
    if (Array.isArray(pair) && pair.length >= 2 && typeof pair[1] === 'number') {
      values[String(pair[0])] = pair[1]
    }
  }
  return {
    profileId: String(row[0]),
    gameTimeSec: values['gt'],
    villagersProduced: values['vprod'],
    popMax: values['popmax'],
    totalCommands: values['totalcmds'],
  }
}

function countersFromPairs(stats: unknown): Record<string, number> | null {
  if (!Array.isArray(stats)) return null
  const values: Record<string, number> = {}
  for (const pair of stats) {
    if (Array.isArray(pair) && pair.length >= 2 && typeof pair[1] === 'number') {
      values[String(pair[0])] = pair[1]
    }
  }
  return values
}

function resultFromOutcomeSign(v: unknown): 'win' | 'loss' | null {
  if (typeof v !== 'number') return null
  if (v > 0) return 'win'
  if (v < 0) return 'loss'
  return null
}

function apmFromCounters(c: Record<string, number>): number | null {
  const total = c['totalcmds']
  const gt = c['gt']
  if (total == null || gt == null || gt <= 0) return null
  return Math.round((total / (gt / 60)) * 10) / 10
}

function perPlayerFromResultRow(
  row: unknown[],
  outcomeByEntityId: Map<number, 'win' | 'loss' | null>,
): PerPlayerMatchStats | null {
  const profileId = typeof row[0] === 'number' ? row[0] : Number(row[0])
  if (!Number.isFinite(profileId)) return null
  const entityId = typeof row[5] === 'number' ? row[5] : null
  const counters = countersFromPairs(row[6])
  if (!counters) return null
  const kills = counters['ekills'] ?? null
  const deaths = counters['sqlost'] ?? null
  return {
    profileId,
    teamId: typeof row[1] === 'number' ? row[1] : null,
    civ: null,
    result: entityId != null ? (outcomeByEntityId.get(entityId) ?? null) : null,
    unitsProduced: counters['sqprod'] ?? null,
    kills,
    deaths,
    kd:
      kills != null && deaths != null && deaths > 0
        ? Math.round((kills / deaths) * 100) / 100
        : null,
    buildingsProduced: counters['bprod'] ?? null,
    buildingsLost: counters['blost'] ?? null,
    structureDamage: counters['structdmg'] ?? null,
    techsResearched: counters['upg'] ?? null,
    apm: apmFromCounters(counters),
    gameTimeSec: counters['gt'] ?? null,
  }
}

function parseGameResultRoot(root: unknown): ParsedGameResult | null {
  if (!Array.isArray(root) || root.length < 4) return null
  const recipientProfileId = typeof root[2] === 'number' ? root[2] : null
  const payload = root[3]
  if (!Array.isArray(payload) || payload.length < 4) return null
  const playerRows = payload[0]
  if (!Array.isArray(playerRows)) return null

  // Payload[1] contains rows keyed by the entity id that also appears at row[5].
  // In observed custom games, index 4 is the signed result: >0 win, <0 loss.
  const outcomeByEntityId = new Map<number, 'win' | 'loss' | null>()
  const outcomeRows = payload[1]
  if (Array.isArray(outcomeRows)) {
    for (const row of outcomeRows) {
      if (!Array.isArray(row) || typeof row[0] !== 'number') continue
      outcomeByEntityId.set(row[0], resultFromOutcomeSign(row[4]))
    }
  }

  const players = playerRows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => perPlayerFromResultRow(row, outcomeByEntityId))
    .filter((p): p is PerPlayerMatchStats => p != null)
  if (players.length === 0) return null

  const matchId = payload[3]
  if (typeof matchId !== 'number' && typeof matchId !== 'string') return null
  return { matchId: String(matchId), recipientProfileId, players }
}

/**
 * Extracts the latest finished-game economy stats from a warnings.log string,
 * preferring the row for `preferredProfileId` (the user). Returns null if no
 * result message is present or the payload is malformed.
 */
export function parseLocalGameStats(
  log: string,
  preferredProfileId?: string,
): ParsedLocalStats | null {
  const matches = [...log.matchAll(RESULT_RE)]
  const last = matches[matches.length - 1]
  if (!last) return null

  let root: unknown
  try {
    root = JSON.parse(last[1]!)
  } catch {
    return null
  }
  if (!Array.isArray(root) || root.length < 4) return null
  const payload = root[3]
  if (!Array.isArray(payload) || payload.length === 0) return null
  const playerRows = payload[0]
  if (!Array.isArray(playerRows)) return null

  let selected: unknown[] | null = null
  for (const row of playerRows) {
    if (!Array.isArray(row) || row.length < 7) continue
    if (!preferredProfileId || String(row[0]) === preferredProfileId) {
      selected = row
      break
    }
  }
  if (!selected) {
    selected = playerRows.find((r): r is unknown[] => Array.isArray(r) && r.length >= 7) ?? null
  }
  return selected ? parseRow(selected) : null
}

/**
 * Extracts the latest full result/counters payload from warnings.log. This is a
 * fallback for player-vs-player custom games that write `playback/temp.rec` and
 * a result websocket message but fail to materialize a `matchhistory` folder.
 */
export function parseLatestGameResult(log: string): ParsedGameResult | null {
  const matches = [...log.matchAll(RESULT_RE)]
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const parsed = parseGameResultRoot(JSON.parse(matches[i]![1]!))
      if (parsed) return parsed
    } catch {
      // keep scanning older result lines
    }
  }
  return null
}

// --- Session state from log lifecycle markers ---

export type SessionState = 'not-running' | 'in-match' | 'menu'

const START_MARKERS = [
  'GAME -- Starting mission',
  'Starting mission:',
  'MatchSetup::StartMatch',
  'MatchStartMessage',
  'GameApp::RequestGameBegin',
  'GameWorld::AssignPlayers',
]
const END_MARKERS = [
  'GameResultNotificationMessage',
  'RequestLeaveGameMatch',
  'Destroyed Matchinfo',
  'GameObj::ShutdownGameObj',
  'GameApp::UpdateStateTransitionUnloadingGame',
  'Application closed',
  // The result stinger + post-game score screen appear the MOMENT a match ends
  // (win/loss, including surrender) — before you leave the lobby. The markers above
  // only fire on unload, so without these the overlay stays "in match" (and APM
  // keeps counting) the whole time you sit on the Defeat/Victory screen.
  'PostGameResultsPage',
  'VictoryStingerControl',
  'DefeatStingerControl',
]

function lastIndexOfAny(text: string, needles: string[]): number {
  let max = -1
  for (const n of needles) {
    const i = text.lastIndexOf(n)
    if (i > max) max = i
  }
  return max
}

/**
 * Decides match state from warnings.log markers. End markers are authoritative
 * (the result message posts while the score screen is still up). Falls back to
 * rich-presence strings when no lifecycle markers are in view.
 */
export function determineSessionState(processRunning: boolean, warningLog: string): SessionState {
  if (!processRunning) return 'not-running'

  const lastStart = lastIndexOfAny(warningLog, START_MARKERS)
  const lastEnd = lastIndexOfAny(warningLog, END_MARKERS)
  if (lastEnd > lastStart) return 'menu'
  if (lastStart >= 0) return 'in-match'

  const inGame = warningLog.lastIndexOf('"In Game"')
  const notInGame = lastIndexOfAny(warningLog, [
    '"In Lobby"',
    '"In Menus"',
    '"In Queue"',
    '"Browsing Custom"',
  ])
  return inGame >= 0 && inGame > notInGame ? 'in-match' : 'menu'
}

// --- Live matchup roster from the log (who's playing, and as which civ) ---

export interface LiveMatchupPlayer {
  slot: number
  name: string
  /** Relic/profile id from the log line; -1 for AI. NOT a Steam id. */
  id: number
  team: number
  /** Raw civ token, e.g. `english`, `templar`, `french_ha_01` (same tokens as the .rec). */
  civToken: string
  ai: boolean
}

const LIVE_PLAYER_RE = /GAME -- (Human|AI) Player:\s+(\d+)\s+(.+?)\s+(-?\d+)\s+(\d+)\s+(\S+)\s*$/

/**
 * Parses the CURRENT match's roster from warnings.log. At match start the game
 * writes one line per player, BEFORE `Starting mission`:
 *   `GAME -- Human Player: <slot> <name> <id> <team> <civToken>`
 *   `GAME -- AI Player:    <slot> <name> -1  <team> <civToken>`
 * The `Human`/`AI` prefix tells us who the human (you) is; the civ token matches
 * the .rec tokens (resolve via `resolveReplayCiv`). This is the LIVE-readable
 * matchup source — the .rec file stays empty until the game ends. Pure. We scope
 * to the latest match (after the last `StartMatch()`) and return one entry per
 * slot (latest wins), slot-ordered. Names may contain spaces (`2 A.I. Intermediate`).
 */
export function parseLiveMatchupPlayers(log: string): LiveMatchupPlayer[] {
  const anchor = log.lastIndexOf('MatchSetup::StartMatch()')
  const region = anchor >= 0 ? log.slice(anchor) : log
  const bySlot = new Map<number, LiveMatchupPlayer>()
  for (const line of region.split('\n')) {
    const m = LIVE_PLAYER_RE.exec(line)
    if (!m) continue
    bySlot.set(Number(m[2]), {
      ai: m[1] === 'AI',
      slot: Number(m[2]),
      name: m[3]!.trim(),
      id: Number(m[4]),
      team: Number(m[5]),
      civToken: m[6]!,
    })
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot)
}

// --- Accurate game clock from the log (game-start + pauses) ---

/**
 * The real game clock derived from warnings.log: the sim start and every pause.
 * Times are LOCAL time-of-day in ms (the format the log uses), so this stays a
 * pure parser; the caller turns it into elapsed seconds with `gameElapsedSec`.
 * This is how we keep the overlay glued to the in-game timer through loading and
 * pauses — without manual input or any game telemetry (it's our own log file).
 */
export interface GameClock {
  /** Time-of-day (ms since local midnight) of `GAME -- Starting mission`. */
  startTodMs: number
  /** Total completed paused time (ms) since the mission started. */
  pausedMs: number
  /** True if the sim is currently paused. */
  paused: boolean
  /** Time-of-day (ms) the current pause began, when `paused`. */
  pauseStartTodMs: number | null
}

const TS_RE = /\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/
// `GAME -- SimulationController::Pause 1` (pause) / `Pause 0` (resume).
const PAUSE_RE = /SimulationController::Pause\s+([01])/
const DAY_MS = 86_400_000

/** Local time-of-day (ms) from a log line's `[HH:MM:SS.mmm]` stamp, or null. */
function lineTodMs(line: string): number | null {
  const m = TS_RE.exec(line)
  if (!m) return null
  return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1000 + Number(m[4])
}

/**
 * Parses the current game's clock from a warnings.log string: the latest
 * `Starting mission` and the pause toggles after it. Pure — returns time-of-day
 * anchors; pair with `gameElapsedSec`. Null when no mission start is in view.
 */
export function parseGameClock(log: string): GameClock | null {
  const lines = log.split('\n')
  let startIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.includes('GAME -- Starting mission')) {
      startIdx = i
      break
    }
  }
  if (startIdx < 0) return null
  const startTodMs = lineTodMs(lines[startIdx]!)
  if (startTodMs == null) return null

  let pausedMs = 0
  let pauseStart: number | null = null
  for (let i = startIdx + 1; i < lines.length; i++) {
    const pm = PAUSE_RE.exec(lines[i]!)
    if (!pm) continue
    const t = lineTodMs(lines[i]!)
    if (t == null) continue
    if (pm[1] === '1') {
      if (pauseStart == null) pauseStart = t // a pause begins (ignore repeats)
    } else if (pauseStart != null) {
      let d = t - pauseStart
      if (d < 0) d += DAY_MS // pause spanned midnight
      pausedMs += d
      pauseStart = null
    }
  }
  return { startTodMs, pausedMs, paused: pauseStart != null, pauseStartTodMs: pauseStart }
}

/**
 * Elapsed game-clock seconds for a `GameClock`, given the current local
 * time-of-day in ms. Freezes while paused. Pure (timezone handled by the caller
 * when it derives `nowTodMs` from the wall clock).
 */
export function gameElapsedSec(clock: GameClock, nowTodMs: number): number {
  const end = clock.paused && clock.pauseStartTodMs != null ? clock.pauseStartTodMs : nowTodMs
  let raw = end - clock.startTodMs - clock.pausedMs
  if (raw < 0) raw += DAY_MS // wrapped past midnight
  return Math.max(0, Math.round(raw / 1000))
}

/** Local time-of-day in ms from an epoch timestamp (the caller's wall clock). */
export function todMsFromEpoch(epochMs: number): number {
  const d = new Date(epochMs)
  return (
    d.getHours() * 3_600_000 + d.getMinutes() * 60_000 + d.getSeconds() * 1000 + d.getMilliseconds()
  )
}
