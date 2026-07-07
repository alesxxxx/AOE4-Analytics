import type { Leaderboard } from '../api/types'
import type { OverlayPosition } from '../domain/overlayBounds'
import type { Store } from './Store'

export interface OverlaySettings {
  /**
   * Widget-panel background opacity [0.3, 1]. Applied by the overlay renderer as
   * background alpha only (text/icons stay fully opaque) — never win.setOpacity,
   * which would dim the text too.
   */
  opacity: number
  /** Snap position at the top of the screen, or 'custom' (user-dragged). */
  position: OverlayPosition
  /** When locked the overlay is click-through; unlock to drag/resize. */
  locked: boolean
  /**
   * The civ whose build order the overlay defaults to when it can't detect the
   * live civ (custom/AI games, menus) — remembered from your last manual build
   * pick. Null until you choose one (then it defaults to the first bundled build).
   */
  defaultBuildCiv: string | null
  /** Which overlay widgets are shown in-game (each toggleable). */
  widgets: OverlayWidgets
  /**
   * Live on-screen APM counter. Uses a global input hook to count your key
   * presses + mouse clicks (counts only, never which keys) while you're in a
   * match. Opt-out via this toggle.
   */
  apm: boolean
  /** Which screen corner the APM counter sits in. */
  apmCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * Only show the overlay while AoE4 (or this app) is the focused window; hide it
   * when you alt-tab away. Turn OFF if the overlay won't appear over your game
   * (e.g. it shows on the desktop but not in-game) — then it shows whenever a
   * match is live regardless of focus. Windows-only gating.
   */
  gateToGame: boolean
  /**
   * The matchup "what troops to build" cheat-sheet (your build order vs theirs,
   * counters flagged), shown under the matchup bar. 'hidden' turns it off.
   */
  troopsPos: 'bar' | 'hidden'
  /**
   * The age-up pace-target chip (target Feudal/Castle/Imperial times for your
   * rank next to the live game clock). Small, so on by default.
   */
  showAgeTargets: boolean
  /**
   * The bundled build order pinned to the overlay, keyed by its unique `name`
   * (set from Guides → Build Orders → "Show in overlay"). Null = widget hidden.
   */
  buildOrderId: string | null
  /**
   * Overlay widget scale [0.75, 1.5]. Applied per widget as a CSS transform
   * around each widget's anchor corner, so saved positions stay put.
   */
  scale: number
  /** Saved per-widget overlay positions, relative to the transparent overlay canvas. */
  widgetPositions: OverlayWidgetPositions
}

// DORMANT (D55): per-widget toggles from the old overlay design — nothing reads
// this today; kept for the planned overlay micro-coach rebuild.
export interface OverlayWidgets {
  /** The full-width matchup bar at the top (both teams' civ/rank/rating). */
  matchupBar: boolean
  buildOrder: boolean
  scout: boolean
  counters: boolean
  reminders: boolean
  ageTargets: boolean
}

export type OverlayWidgetKey = 'matchup' | 'apm' | 'postGame' | 'buildOrder' | 'ageTargets'

export type OverlayWidgetAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'

export interface OverlayWidgetPosition {
  /** Anchor point on the overlay canvas; dragged widgets are saved as top-left. */
  anchor: OverlayWidgetAnchor
  /** Pixel offset from the anchor (or absolute left when anchor is top-left). */
  x: number
  /** Pixel offset from the anchor (or absolute top when anchor is top-left). */
  y: number
}

export type OverlayWidgetPositions = Record<OverlayWidgetKey, OverlayWidgetPosition>

export const DEFAULT_OVERLAY_WIDGETS: OverlayWidgets = {
  matchupBar: true,
  buildOrder: true,
  scout: true,
  counters: true,
  reminders: true,
  ageTargets: true,
}

export const DEFAULT_OVERLAY_WIDGET_POSITIONS: OverlayWidgetPositions = {
  matchup: { anchor: 'top-center', x: 0, y: 8 },
  apm: { anchor: 'bottom-left', x: 12, y: 12 },
  postGame: { anchor: 'top-center', x: 0, y: 40 },
  buildOrder: { anchor: 'top-left', x: 12, y: 96 },
  ageTargets: { anchor: 'top-right', x: 12, y: 96 },
}

/** Global hotkey bindings, in Electron accelerator format (e.g. "Alt+O"). */
export interface HotkeySettings {
  /** Show / hide the overlay. */
  toggleOverlay: string
  /** Toggle overlay placement (widget-drag) mode. */
  placementMode: string
}

export const DEFAULT_HOTKEYS: HotkeySettings = {
  toggleOverlay: 'Alt+O',
  placementMode: 'Control+Alt+O',
}

export interface PollingSettings {
  /** Poll cadence while no game is detected. */
  idleIntervalMs: number
  /** Poll cadence while a game is ongoing. */
  activeIntervalMs: number
}

export interface LocalDataSettings {
  /**
   * Always true. Reading the user's OWN local AoE4 log/replay files is a
   * first-class, always-on data source (the disclaimer lives in the README) —
   * no in-app consent gate. Kept as a field so the services that branch on it
   * stay unchanged. (Supersedes the A1 one-time-consent UX.)
   */
  consentGranted: boolean
  /** Override path to the AoE4 user-data directory (auto-detected if null). */
  gameDir: string | null
  /**
   * Exclude custom / vs-AI games from your win-rate + stats aggregates and the
   * history list (they still get a post-game overlay card). For focusing on ranked.
   */
  excludeAiFromStats: boolean
}

/** A linked AoE4World account (the user may have several). */
export interface Account {
  profileId: number
  name: string
}

export interface AppSettings {
  /**
   * The user's custom accent (action) colour as a `#rrggbb` hex, applied over
   * the default electric-blue. Null = use the default. Drives buttons, active
   * nav, links, focus rings, and the title bar across both windows.
   */
  accentColor: string | null
  /** The ACTIVE account's profile id (drives every read). */
  profileId: number | null
  /** The active account's display name. */
  playerName: string | null
  /**
   * The user's SteamID64, pinned from Settings. Identifies which player is YOU in
   * local replays — so the overlay shows the right side even in a 2-human custom
   * lobby. Null = auto (match the replay's Steam id against this PC's signed-in
   * Steam accounts, falling back to the sole human in vs-AI games).
   */
  steamId: string | null
  /** All linked accounts, for the switcher (includes the active one). */
  accounts: Account[]
  /**
   * Which account owns the legacy (pre-multi-account) `history.db`/`history.json`
   * files, so they aren't orphaned when other accounts get their own per-profile
   * history files. Set once, the first time history is opened.
   */
  historyOwnerProfileId: number | null
  leaderboard: Leaderboard
  recentGamesCount: number
  /**
   * After a match ends (win OR loss), bring the app to the front on that game's
   * full post-game summary — the desktop equivalent of the score screen.
   */
  openSummaryOnGameEnd: boolean
  /**
   * Civilization themes: while a match is live, the app + overlay re-accent to
   * the brand colour of the civ you're playing, reverting when the game ends.
   */
  civTheme: boolean
  overlay: OverlaySettings
  hotkeys: HotkeySettings
  polling: PollingSettings
  localData: LocalDataSettings
}

export type AppSettingsPatch = Partial<
  Omit<AppSettings, 'overlay' | 'hotkeys' | 'polling' | 'localData'>
> & {
  overlay?: Partial<OverlaySettings>
  hotkeys?: Partial<HotkeySettings>
  polling?: Partial<PollingSettings>
  localData?: Partial<LocalDataSettings>
}

export const DEFAULT_SETTINGS: AppSettings = {
  accentColor: null,
  profileId: null,
  playerName: null,
  steamId: null,
  accounts: [],
  historyOwnerProfileId: null,
  leaderboard: 'rm_solo',
  recentGamesCount: 10,
  openSummaryOnGameEnd: true,
  civTheme: true,
  overlay: {
    opacity: 0.92,
    position: 'top-center',
    locked: true,
    defaultBuildCiv: null,
    widgets: DEFAULT_OVERLAY_WIDGETS,
    apm: true,
    apmCorner: 'bottom-left',
    gateToGame: true,
    troopsPos: 'bar',
    showAgeTargets: true,
    buildOrderId: null,
    scale: 1,
    widgetPositions: DEFAULT_OVERLAY_WIDGET_POSITIONS,
  },
  hotkeys: DEFAULT_HOTKEYS,
  polling: { idleIntervalMs: 15_000, activeIntervalMs: 8_000 },
  localData: { consentGranted: true, gameDir: null, excludeAiFromStats: false },
}

const KEY = 'settings'

// --- renderer-patch sanitization -------------------------------------------
// Patches arrive over IPC from the renderer, so nothing about their shape can
// be trusted: coerce/clamp every known field and drop everything else before
// persisting.

const HEX_COLOR = /^#[0-9a-f]{6}$/i

const LEADERBOARDS: readonly Leaderboard[] = [
  'rm_solo', 'rm_team', 'rm_1v1', 'rm_2v2', 'rm_3v3', 'rm_4v4',
  'qm_1v1', 'qm_2v2', 'qm_3v3', 'qm_4v4',
]
const OVERLAY_POSITIONS = ['top-left', 'top-center', 'top-right', 'custom'] as const
const APM_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
const TROOPS_POS = ['bar', 'hidden'] as const
const WIDGET_ANCHORS: readonly OverlayWidgetAnchor[] = [
  'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right', 'center',
]

function finite(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function clamped(v: unknown, min: number, max: number): number | undefined {
  const n = finite(v)
  return n == null ? undefined : Math.min(max, Math.max(min, n))
}

/** undefined = invalid (drop the key); null is a legitimate stored value. */
function finiteOrNull(v: unknown): number | null | undefined {
  return v === null ? null : finite(v)
}

function stringOrNull(v: unknown): string | null | undefined {
  return v === null || typeof v === 'string' ? (v as string | null) : undefined
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T | undefined {
  return typeof v === 'string' && (values as readonly string[]).includes(v)
    ? (v as T)
    : undefined
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null && !Array.isArray(v)
}

function sanitizeAccounts(v: unknown): Account[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Account[] = []
  for (const a of v) {
    if (!isObject(a)) continue
    const profileId = finite(a.profileId)
    if (profileId != null && typeof a.name === 'string') out.push({ profileId, name: a.name })
  }
  return out
}

function sanitizeWidgets(v: unknown): Partial<OverlayWidgets> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<OverlayWidgets> = {}
  for (const key of Object.keys(DEFAULT_OVERLAY_WIDGETS) as (keyof OverlayWidgets)[]) {
    if (key in v) out[key] = Boolean(v[key])
  }
  return out
}

function sanitizeWidgetPositions(v: unknown): Partial<OverlayWidgetPositions> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<OverlayWidgetPositions> = {}
  for (const key of Object.keys(DEFAULT_OVERLAY_WIDGET_POSITIONS) as OverlayWidgetKey[]) {
    const pos = v[key]
    if (!isObject(pos)) continue
    const anchor = oneOf(pos.anchor, WIDGET_ANCHORS)
    const x = finite(pos.x)
    const y = finite(pos.y)
    if (anchor && x != null && y != null) out[key] = { anchor, x, y }
  }
  return out
}

function sanitizeOverlay(v: unknown): Partial<OverlaySettings> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<OverlaySettings> = {}
  if ('opacity' in v) {
    const n = clamped(v.opacity, 0.3, 1)
    if (n != null) out.opacity = n
  }
  if ('position' in v) {
    const s = oneOf(v.position, OVERLAY_POSITIONS)
    if (s) out.position = s
  }
  if ('locked' in v) out.locked = Boolean(v.locked)
  if ('defaultBuildCiv' in v) {
    const s = stringOrNull(v.defaultBuildCiv)
    if (s !== undefined) out.defaultBuildCiv = s
  }
  if ('widgets' in v) {
    const w = sanitizeWidgets(v.widgets)
    // Partial is fine at runtime — update() spreads it over the current widgets.
    if (w) out.widgets = w as OverlayWidgets
  }
  if ('apm' in v) out.apm = Boolean(v.apm)
  if ('apmCorner' in v) {
    const s = oneOf(v.apmCorner, APM_CORNERS)
    if (s) out.apmCorner = s
  }
  if ('gateToGame' in v) out.gateToGame = Boolean(v.gateToGame)
  if ('troopsPos' in v) {
    const s = oneOf(v.troopsPos, TROOPS_POS)
    if (s) out.troopsPos = s
  }
  if ('showAgeTargets' in v) out.showAgeTargets = Boolean(v.showAgeTargets)
  if ('buildOrderId' in v) {
    const s = stringOrNull(v.buildOrderId)
    if (s !== undefined) out.buildOrderId = s
  }
  if ('scale' in v) {
    const n = clamped(v.scale, 0.75, 1.5)
    if (n != null) out.scale = n
  }
  if ('widgetPositions' in v) {
    const wp = sanitizeWidgetPositions(v.widgetPositions)
    if (wp) out.widgetPositions = wp as OverlayWidgetPositions
  }
  return out
}

/** Electron accelerator modifier tokens (the key part is not strictly validated). */
const ACCEL_MODIFIER =
  /^(commandorcontrol|cmdorctrl|command|cmd|control|ctrl|alt|option|altgr|shift|super|meta)$/i

/**
 * Validates a hotkey as "Modifier+...+Key": at least one modifier (so a global
 * shortcut can't hijack a bare letter system-wide) and a non-modifier final key.
 * Whitespace around `+` is tolerated and normalized away. undefined = invalid.
 */
function sanitizeHotkey(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const parts = v.split('+').map((p) => p.trim())
  if (parts.length < 2 || parts.some((p) => p === '')) return undefined
  const key = parts[parts.length - 1]!
  if (ACCEL_MODIFIER.test(key)) return undefined
  if (!parts.slice(0, -1).every((m) => ACCEL_MODIFIER.test(m))) return undefined
  return parts.join('+')
}

function sanitizeHotkeys(v: unknown): Partial<HotkeySettings> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<HotkeySettings> = {}
  if ('toggleOverlay' in v) {
    const s = sanitizeHotkey(v.toggleOverlay)
    if (s) out.toggleOverlay = s
  }
  if ('placementMode' in v) {
    const s = sanitizeHotkey(v.placementMode)
    if (s) out.placementMode = s
  }
  return out
}

function sanitizePolling(v: unknown): Partial<PollingSettings> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<PollingSettings> = {}
  if ('idleIntervalMs' in v) {
    const n = finite(v.idleIntervalMs)
    if (n != null) out.idleIntervalMs = Math.max(8000, n)
  }
  if ('activeIntervalMs' in v) {
    const n = finite(v.activeIntervalMs)
    if (n != null) out.activeIntervalMs = Math.max(4000, n)
  }
  return out
}

function sanitizeLocalData(v: unknown): Partial<LocalDataSettings> | undefined {
  if (!isObject(v)) return undefined
  const out: Partial<LocalDataSettings> = {}
  if ('consentGranted' in v) out.consentGranted = Boolean(v.consentGranted)
  if ('gameDir' in v) {
    const s = stringOrNull(v.gameDir)
    if (s !== undefined) out.gameDir = s
  }
  if ('excludeAiFromStats' in v) out.excludeAiFromStats = Boolean(v.excludeAiFromStats)
  return out
}

/**
 * Coerces/clamps a renderer-supplied settings patch: numbers via Number() with
 * per-field bounds, booleans via Boolean(), enum/string fields type-checked,
 * invalid values and unknown keys dropped. Pure so it's directly testable.
 */
export function sanitizePatch(patch: AppSettingsPatch): AppSettingsPatch {
  const p = patch as Record<string, unknown>
  const out: AppSettingsPatch = {}
  if ('accentColor' in p) {
    if (p.accentColor === null) out.accentColor = null
    else if (typeof p.accentColor === 'string' && HEX_COLOR.test(p.accentColor))
      out.accentColor = p.accentColor
  }
  if ('profileId' in p) {
    const n = finiteOrNull(p.profileId)
    if (n !== undefined) out.profileId = n
  }
  if ('playerName' in p) {
    const s = stringOrNull(p.playerName)
    if (s !== undefined) out.playerName = s
  }
  if ('steamId' in p) {
    const s = stringOrNull(p.steamId)
    if (s !== undefined) out.steamId = s
  }
  if ('accounts' in p) {
    const a = sanitizeAccounts(p.accounts)
    if (a) out.accounts = a
  }
  if ('historyOwnerProfileId' in p) {
    const n = finiteOrNull(p.historyOwnerProfileId)
    if (n !== undefined) out.historyOwnerProfileId = n
  }
  if ('leaderboard' in p) {
    const s = oneOf(p.leaderboard, LEADERBOARDS)
    if (s) out.leaderboard = s
  }
  if ('recentGamesCount' in p) {
    const n = finite(p.recentGamesCount)
    if (n != null) out.recentGamesCount = Math.max(1, Math.round(n))
  }
  if ('openSummaryOnGameEnd' in p) out.openSummaryOnGameEnd = Boolean(p.openSummaryOnGameEnd)
  if ('civTheme' in p) out.civTheme = Boolean(p.civTheme)
  if ('overlay' in p) {
    const o = sanitizeOverlay(p.overlay)
    if (o) out.overlay = o
  }
  if ('hotkeys' in p) {
    const h = sanitizeHotkeys(p.hotkeys)
    if (h) out.hotkeys = h
  }
  if ('polling' in p) {
    const o = sanitizePolling(p.polling)
    if (o) out.polling = o
  }
  if ('localData' in p) {
    const o = sanitizeLocalData(p.localData)
    if (o) out.localData = o
  }
  return out
}

/** Typed settings over a Store, merging persisted values onto defaults. */
export class SettingsService {
  constructor(private readonly store: Store) {}

  getAll(): AppSettings {
    const stored = this.store.get<Partial<AppSettings>>(KEY) ?? {}
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      overlay: {
        ...DEFAULT_SETTINGS.overlay,
        ...(stored.overlay ?? {}),
        widgets: { ...DEFAULT_OVERLAY_WIDGETS, ...(stored.overlay?.widgets ?? {}) },
        widgetPositions: {
          ...DEFAULT_OVERLAY_WIDGET_POSITIONS,
          ...(stored.overlay?.widgetPositions ?? {}),
        },
      },
      hotkeys: { ...DEFAULT_HOTKEYS, ...(stored.hotkeys ?? {}) },
      polling: { ...DEFAULT_SETTINGS.polling, ...(stored.polling ?? {}) },
      // Local data is always on now — force it true even for installs that
      // persisted the old opt-out value.
      localData: {
        ...DEFAULT_SETTINGS.localData,
        ...(stored.localData ?? {}),
        consentGranted: true,
      },
      accounts: stored.accounts ?? [],
    }
    // Migrate a pre-multi-account install (single profileId) into accounts[].
    if (merged.accounts.length === 0 && merged.profileId != null) {
      merged.accounts = [{ profileId: merged.profileId, name: merged.playerName ?? 'Player' }]
    }
    return merged
  }

  update(rawPatch: AppSettingsPatch): AppSettings {
    const patch = sanitizePatch(rawPatch)
    const current = this.getAll()
    // Deep-merge the known nested objects so a partial nested patch (e.g.
    // `{ overlay: { locked: true } }` arriving over IPC) can't silently wipe its
    // sibling fields (opacity / widgets / widgetPositions).
    const next: AppSettings = {
      ...current,
      ...patch,
      overlay: patch.overlay
        ? {
            ...current.overlay,
            ...patch.overlay,
            widgets: { ...current.overlay.widgets, ...(patch.overlay.widgets ?? {}) },
            widgetPositions: {
              ...current.overlay.widgetPositions,
              ...(patch.overlay.widgetPositions ?? {}),
            },
          }
        : current.overlay,
      hotkeys: patch.hotkeys ? { ...current.hotkeys, ...patch.hotkeys } : current.hotkeys,
      polling: patch.polling ? { ...current.polling, ...patch.polling } : current.polling,
      localData: patch.localData
        ? { ...current.localData, ...patch.localData }
        : current.localData,
    }
    this.store.set(KEY, next)
    return next
  }

  /** Adds the account if new, then makes it the active one. */
  setProfile(profileId: number, playerName: string): AppSettings {
    const current = this.getAll()
    const accounts = upsertAccount(current.accounts, { profileId, name: playerName })
    return this.update({ profileId, playerName, accounts })
  }

  /** Switches the active account to an already-linked one (no-op if unknown). */
  setActiveProfile(profileId: number): AppSettings {
    const current = this.getAll()
    const acc = current.accounts.find((a) => a.profileId === profileId)
    if (!acc) return current
    return this.update({ profileId: acc.profileId, playerName: acc.name })
  }

  /** Unlinks an account; if it was active, falls back to the first remaining one. */
  removeAccount(profileId: number): AppSettings {
    const current = this.getAll()
    const accounts = current.accounts.filter((a) => a.profileId !== profileId)
    if (current.profileId !== profileId) return this.update({ accounts })
    const next = accounts[0] ?? null
    return this.update({
      accounts,
      profileId: next?.profileId ?? null,
      playerName: next?.name ?? null,
    })
  }

  hasProfile(): boolean {
    return this.getAll().profileId != null
  }
}

/** Adds or updates an account in the list (dedup by profileId), keeping order. */
function upsertAccount(accounts: Account[], account: Account): Account[] {
  const existing = accounts.findIndex((a) => a.profileId === account.profileId)
  if (existing === -1) return [...accounts, account]
  const next = [...accounts]
  next[existing] = account
  return next
}
