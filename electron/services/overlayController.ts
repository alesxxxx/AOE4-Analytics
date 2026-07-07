import { basename } from 'node:path'
import { screen, type BrowserWindow } from 'electron'
import {
  IpcChannels,
  type OverlayControlAction,
  type OverlayMatchState,
  type OverlayUpdatePayload,
} from '@ipc/contract'
import { isFriendlyForeground, shouldShowOverlay } from '@domain/overlayVisibility'
import type { GameClock } from '@domain/localStats'
import { createOverlayWindow } from '../windows/overlayWindow'
import { ForegroundWatcher, type ForegroundRect } from './foregroundWatcher'
import { getMainWindow, getSettings } from './appContext'

/** AoE4's process name (no .exe) — the window whose display the canvas follows. */
const GAME_PROCESS = 'RelicCardinal'
/** Hide only after the foreground has been off-game this long (alt-tab flicker guard). */
const OFF_GAME_DEBOUNCE_MS = 700

/**
 * Owns the transparent overlay canvas: applies bounds, toggles the
 * click-through lock, exposes placement mode (Ctrl+Alt+O by default), and
 * forwards match data + control events to the overlay renderer.
 */
export class OverlayController {
  private win: BrowserWindow | null = null
  private locked = true
  private placementMode = false
  private lastMatchState: OverlayMatchState = 'idle'
  /** The last full update payload, re-sent after a renderer crash/reload. */
  private lastUpdatePayload: OverlayUpdatePayload | null = null
  /** Set once the renderer has produced its first frame (ready-to-show). */
  private painted = false
  /** Set on a crash/hang reload so did-finish-load knows to restore state. */
  private restoreAfterReload = false
  /** The overlay is wanted on screen (a match is live, user toggled it, or placement is active). */
  private desiredVisible = false
  /** The game (or our own app) is the foreground window. */
  private gameForeground = true
  /** Pending debounced "foreground left the game" transition. */
  private offGameTimer: ReturnType<typeof setTimeout> | null = null
  /** The process name of the last foreground reading from the watcher. */
  private lastForegroundName = ''
  /** Foreground gating only applies on Windows (where the watcher works). */
  private gatingEnabled = false
  private readonly watcher = new ForegroundWatcher()
  private friendlyNames: string[] = []
  /** Bound `screen` display-change listener, removed on dispose. */
  private onDisplayChange: (() => void) | null = null

  init(): void {
    const overlay = getSettings().getAll().overlay
    this.win = createOverlayWindow()
    this.win.once('ready-to-show', () => {
      this.painted = true
      this.reconcile()
    })
    this.locked = true
    if (!overlay.locked) {
      getSettings().update({ overlay: { ...overlay, locked: true } })
    }
    this.applyLock()

    this.friendlyNames = [GAME_PROCESS, basename(process.execPath).replace(/\.exe$/i, '')]
    this.refreshGating()

    this.win.on('closed', () => {
      this.win = null
    })

    // Crash recovery: if the overlay renderer dies (GPU crash, OOM) or hangs,
    // reload it; did-finish-load below re-sends the cached state.
    this.win.webContents.on('render-process-gone', (_e, details) => {
      console.warn('[overlay] renderer gone:', details.reason)
      this.recoverRenderer()
    })
    this.win.on('unresponsive', () => {
      console.warn('[overlay] renderer unresponsive — reloading')
      this.recoverRenderer()
    })
    this.win.webContents.on('did-finish-load', () => {
      if (!this.restoreAfterReload || !this.alive()) return
      this.restoreAfterReload = false
      this.sendSettings()
      this.win!.webContents.send(IpcChannels.overlayLock, this.locked)
      if (this.lastUpdatePayload) {
        this.win!.webContents.send(IpcChannels.overlayUpdate, this.lastUpdatePayload)
      }
      this.painted = true
      this.reconcile()
    })

    this.onDisplayChange = () => this.applyPosition()
    screen.on('display-removed', this.onDisplayChange)
    screen.on('display-added', this.onDisplayChange)
    screen.on('display-metrics-changed', this.onDisplayChange)

    this.applyPosition()
  }

  /**
   * Snap the overlay canvas to its current display's FULL bounds — not the work
   * area: borderless-fullscreen games cover the taskbar, so widget coordinates
   * must be display-relative or everything misaligns by the taskbar height.
   * Safe because the window is click-through and non-focusable.
   */
  applyPosition(): void {
    if (!this.alive()) return
    const b = this.win!.getBounds()
    const { bounds } = screen.getDisplayNearestPoint({
      x: b.x + Math.round(b.width / 2),
      y: b.y + Math.round(b.height / 2),
    })
    this.win!.setBounds(bounds)
  }

  /** Move the canvas to the display that contains the game window (multi-monitor). */
  private followGameDisplay(rect: ForegroundRect): void {
    // Never yank the canvas around while the user is placing widgets on it.
    if (!this.alive() || this.placementMode) return
    const target = screen.getDisplayNearestPoint({
      x: rect.x + Math.round(rect.width / 2),
      y: rect.y + Math.round(rect.height / 2),
    })
    const b = this.win!.getBounds()
    const current = screen.getDisplayNearestPoint({
      x: b.x + Math.round(b.width / 2),
      y: b.y + Math.round(b.height / 2),
    })
    if (target.id !== current.id) this.win!.setBounds(target.bounds)
  }

  get window(): BrowserWindow | null {
    return this.win
  }

  private alive(): boolean {
    return !!this.win && !this.win.isDestroyed()
  }

  show(): void {
    this.desiredVisible = true
    // Re-assert topmost on every show (match start): other screen-saver-level
    // windows (Game Bar, Discord) may have stacked above us since last time.
    this.assertAlwaysOnTop()
    this.reconcile()
  }

  hide(): void {
    this.desiredVisible = false
    this.reconcile()
  }

  toggle(): void {
    this.manualToggleSeq += 1
    this.desiredVisible = !this.desiredVisible
    this.reconcile()
  }

  /** Bumped on every explicit user toggle (hotkey / Settings button). */
  private manualToggleSeq = 0

  /**
   * A counter of explicit user show/hide toggles. Timed auto-hides capture it
   * when scheduled and skip hiding if it changed — so an Alt+O AFTER the match
   * ended isn't clobbered by the post-game hide timer.
   */
  getManualToggleSeq(): number {
    return this.manualToggleSeq
  }

  isVisible(): boolean {
    return this.alive() && this.win!.isVisible()
  }

  private assertAlwaysOnTop(): void {
    if (this.alive()) this.win!.setAlwaysOnTop(true, 'screen-saver')
  }

  private reconcile(): void {
    if (!this.alive()) return
    // Fail OPEN while the watcher is down (crashed / respawning): with no live
    // foreground readings the overlay must not stay stuck hidden over the game.
    const gameForeground = this.watcher.isRunning() ? this.gameForeground : true
    const want = shouldShowOverlay({
      desiredVisible: this.desiredVisible || this.placementMode,
      gameForeground,
      gatingEnabled: this.gatingEnabled,
    })
    if (want) {
      if (this.painted && !this.win!.isVisible()) this.win!.showInactive()
    } else if (this.win!.isVisible()) {
      this.win!.hide()
    }
  }

  private recoverRenderer(): void {
    if (!this.alive()) return
    this.painted = false
    this.restoreAfterReload = true
    // The fresh renderer will re-report hover; don't leave clicks captured.
    this.interactiveHover = false
    this.applyMouseState()
    if (this.win!.isVisible()) this.win!.hide()
    this.win!.webContents.reload()
  }

  /** A foreground-window change: is the game (or our app) focused, and where? */
  private onForeground(name: string, rect: ForegroundRect | null): void {
    // An empty name = the foreground process is unreadable (e.g. the game runs
    // elevated, or a secure desktop) — fail OPEN (keep showing) rather than
    // assume it's an unrelated app, so the overlay doesn't vanish over the very
    // game it's meant for. Logged so we can learn a game's real process name.
    if (name) console.log('[overlay] foreground:', name)
    this.lastForegroundName = name
    const friendly = name === '' ? true : isFriendlyForeground(name, this.friendlyNames)
    if (friendly) {
      if (this.offGameTimer) {
        clearTimeout(this.offGameTimer)
        this.offGameTimer = null
      }
      const regained = !this.gameForeground
      this.gameForeground = true
      // The game window's display is authoritative for where the canvas lives.
      if (rect && isFriendlyForeground(name, [GAME_PROCESS])) this.followGameDisplay(rect)
      if (regained) this.assertAlwaysOnTop()
      this.reconcile()
    } else if (this.gameForeground && !this.offGameTimer) {
      // Show immediately, hide only after a SUSTAINED off-game foreground —
      // transient popups / alt-tab flicker shouldn't flash the overlay off.
      this.offGameTimer = setTimeout(() => {
        this.offGameTimer = null
        this.gameForeground = false
        this.reconcile()
      }, OFF_GAME_DEBOUNCE_MS)
    }
  }

  /**
   * True when the foreground watcher is live and currently reports AoE4 itself
   * as the foreground window — a free "the game process is running" signal that
   * lets the poll loop skip its tasklist spawn for that tick.
   */
  isGameProcessForeground(): boolean {
    return this.watcher.isRunning() && isFriendlyForeground(this.lastForegroundName, [GAME_PROCESS])
  }

  /**
   * Whether input should count as GAME input right now — the APM counter's
   * gate, sharing the overlay's own visibility semantics: fail OPEN when
   * gating is off or the watcher is down (never zero a live counter on a
   * watcher hiccup), otherwise the debounced "game/own-app is foreground"
   * state (so alt-tabbed typing doesn't inflate APM).
   */
  isGameFocusedForInput(): boolean {
    if (!this.gatingEnabled || !this.watcher.isRunning()) return true
    return this.gameForeground
  }

  /**
   * (Re)apply the focus-gating setting: when `overlay.gateToGame` is on (and on
   * Windows, outside diagnostics) watch the foreground window and hide the overlay
   * off-game; when off, stop watching and always allow the overlay while wanted.
   */
  refreshGating(): void {
    const diag = process.env['RTSLYTICS_SMOKE'] === '1' || !!process.env['RTSLYTICS_VERIFY']
    this.gatingEnabled =
      process.platform === 'win32' && getSettings().getAll().overlay.gateToGame && !diag
    if (this.gatingEnabled) {
      this.watcher.start(
        (name, rect) => this.onForeground(name, rect),
        () => this.reconcile(), // watcher died → reconcile now so we fail OPEN
      ) // idempotent
    } else {
      this.watcher.stop()
      if (this.offGameTimer) {
        clearTimeout(this.offGameTimer)
        this.offGameTimer = null
      }
      this.gameForeground = true
    }
    this.reconcile()
  }

  dispose(): void {
    this.watcher.stop()
    if (this.offGameTimer) {
      clearTimeout(this.offGameTimer)
      this.offGameTimer = null
    }
    if (this.onDisplayChange) {
      screen.removeListener('display-removed', this.onDisplayChange)
      screen.removeListener('display-added', this.onDisplayChange)
      screen.removeListener('display-metrics-changed', this.onDisplayChange)
      this.onDisplayChange = null
    }
  }

  /**
   * True while the post-game card is on screen: the renderer needs forwarded
   * mouse moves to hit-test its ✕ button. Off in-game, where forwarding would
   * cost an IPC message per mouse move for nothing.
   */
  private mouseForwarding = false
  /** The cursor is over the card's ✕ (reported by the renderer): accept clicks. */
  private interactiveHover = false

  /**
   * The locked overlay is click-through — EXCEPT while the post-game card is up:
   * mouse moves are then forwarded so the renderer can hit-test its ✕ button,
   * and while the cursor is over it the window takes real clicks (still
   * non-focusable, so the game never loses focus).
   */
  private applyMouseState(): void {
    if (!this.alive()) return
    if (this.locked && !this.placementMode) {
      if (this.mouseForwarding && this.interactiveHover) {
        this.win!.setIgnoreMouseEvents(false)
      } else if (this.mouseForwarding) {
        this.win!.setIgnoreMouseEvents(true, { forward: true })
      } else {
        this.win!.setIgnoreMouseEvents(true)
      }
      this.win!.setFocusable(false)
    } else {
      this.win!.setIgnoreMouseEvents(false)
      this.win!.setFocusable(true)
      this.win!.focus()
    }
  }

  /** Renderer report: the cursor entered/left a clickable overlay control. */
  setInteractiveHover(hover: boolean): void {
    if (this.interactiveHover === hover) return
    this.interactiveHover = hover
    this.applyMouseState()
  }

  /** User pressed the post-game card's ✕: clear the card and hide the overlay. */
  dismissPostGame(): void {
    if (this.lastUpdatePayload?.matchState === 'ended') {
      // Back to idle (not just postGame:null) so the renderer's "analyzing your
      // game..." pill doesn't replace the dismissed card. Also turns forwarding off.
      this.sendUpdate({ ...this.lastUpdatePayload, matchState: 'idle', postGame: null })
    }
    this.hide()
  }

  private applyLock(): void {
    this.applyMouseState()
    if (this.alive()) this.win!.webContents.send(IpcChannels.overlayLock, this.locked)
  }

  toggleLock(): void {
    this.locked = !this.locked
    const current = getSettings().getAll().overlay
    getSettings().update({ overlay: { ...current, locked: this.locked } })
    this.desiredVisible = true
    this.applyLock()
    this.reconcile()
  }

  togglePlacementMode(): void {
    this.placementMode = !this.placementMode
    this.locked = !this.placementMode
    const current = getSettings().getAll().overlay
    getSettings().update({ overlay: { ...current, locked: this.locked } })
    if (this.placementMode) {
      this.desiredVisible = true
      this.sendSettings()
    } else if (this.lastMatchState === 'idle') {
      this.desiredVisible = false
    }
    this.applyLock()
    this.reconcile()
  }

  private lastThemeCiv: string | null = null

  sendUpdate(payload: OverlayUpdatePayload): void {
    this.lastMatchState = payload.matchState
    this.lastUpdatePayload = payload
    if (this.alive()) this.win!.webContents.send(IpcChannels.overlayUpdate, payload)
    // Forward mouse moves only while the post-game card (with its ✕) is up.
    const wantForward = payload.matchState === 'ended' && payload.postGame != null
    if (wantForward !== this.mouseForwarding) {
      this.mouseForwarding = wantForward
      if (!wantForward) this.interactiveHover = false
      this.applyMouseState()
    }
    // Civilization themes: mirror the live civ to the dashboard window so the
    // whole app re-accents while a match is ongoing (renderer maps slug→colour
    // and respects the civTheme setting; we only broadcast the state change).
    const themeCiv = payload.matchState === 'ongoing' ? payload.myCiv : null
    if (themeCiv !== this.lastThemeCiv) {
      this.lastThemeCiv = themeCiv
      getMainWindow()?.webContents.send(IpcChannels.appCivTheme, themeCiv)
    }
  }

  sendApm(apm: number | null): void {
    if (this.alive()) this.win!.webContents.send(IpcChannels.overlayApm, apm)
  }

  /**
   * The accurate game-clock anchor (sim start + pauses), pushed by the poll
   * loop's 1s ticker while a match is live; null resets it on match end. The
   * overlay renderer derives elapsed seconds from the anchor + its wall clock.
   */
  sendGameClock(clock: GameClock | null): void {
    if (this.alive()) this.win!.webContents.send(IpcChannels.overlayGameClock, clock)
  }

  // DORMANT (D55): no caller/consumer today; kept for the overlay micro-coach.
  sendControl(action: OverlayControlAction): void {
    if (this.alive()) this.win!.webContents.send(IpcChannels.overlayControl, action)
  }

  sendSettings(): void {
    if (this.alive()) {
      const all = getSettings().getAll()
      this.win!.webContents.send(IpcChannels.overlaySettings, {
        ...all.overlay,
        accentColor: all.accentColor,
        civTheme: all.civTheme,
      })
    }
  }
}
