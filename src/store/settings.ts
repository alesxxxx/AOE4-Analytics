import type { Leaderboard } from '../api/types'
import type { OverlayPosition } from '../domain/overlayBounds'
import type { Store } from './Store'

export interface OverlaySettings {
  opacity: number
  x: number | null
  y: number | null
  width: number
  height: number
  /** Snap position at the top of the screen, or 'custom' (user-dragged x/y). */
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

export type OverlayWidgetKey = 'matchup' | 'apm' | 'postGame'

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
  /** Optional AoE4World API key for private match history. */
  apiKey: string | null
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
  polling: PollingSettings
  localData: LocalDataSettings
}

export type AppSettingsPatch = Partial<
  Omit<AppSettings, 'overlay' | 'polling' | 'localData'>
> & {
  overlay?: Partial<OverlaySettings>
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
  apiKey: null,
  openSummaryOnGameEnd: true,
  civTheme: true,
  overlay: {
    opacity: 0.92,
    x: null,
    y: null,
    width: 1200,
    height: 250,
    position: 'top-center',
    locked: true,
    defaultBuildCiv: null,
    widgets: DEFAULT_OVERLAY_WIDGETS,
    apm: true,
    apmCorner: 'bottom-left',
    gateToGame: true,
    troopsPos: 'bar',
    widgetPositions: DEFAULT_OVERLAY_WIDGET_POSITIONS,
  },
  polling: { idleIntervalMs: 15_000, activeIntervalMs: 8_000 },
  localData: { consentGranted: true, gameDir: null, excludeAiFromStats: false },
}

const KEY = 'settings'

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
    // Migrate any pre-full-width-bar overlay (the original 350x290 corner card OR
    // the interim 1200x132 horizontal bar) to the new full-width top matchup bar.
    // Clearing x/y makes the window span the work-area width on next launch.
    if (
      (merged.overlay.width === 350 && merged.overlay.height === 290) ||
      (merged.overlay.width === 1200 && merged.overlay.height === 132)
    ) {
      merged.overlay = {
        ...merged.overlay,
        width: 1200,
        height: 250,
        position: 'top-center',
        x: null,
        y: null,
      }
    }
    return merged
  }

  update(patch: AppSettingsPatch): AppSettings {
    const current = this.getAll()
    // Deep-merge the known nested objects so a partial nested patch (e.g.
    // `{ overlay: { locked: true } }` arriving over IPC) can't silently wipe its
    // sibling fields (opacity / x / y / width / widgets).
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
