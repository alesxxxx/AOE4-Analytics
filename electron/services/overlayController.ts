import { basename } from 'node:path'
import { screen, type BrowserWindow } from 'electron'
import {
  IpcChannels,
  type OverlayControlAction,
  type OverlayMatchState,
  type OverlayUpdatePayload,
} from '@ipc/contract'
import { isFriendlyForeground, shouldShowOverlay } from '@domain/overlayVisibility'
import { createOverlayWindow } from '../windows/overlayWindow'
import { ForegroundWatcher } from './foregroundWatcher'
import { getMainWindow, getSettings } from './appContext'

/**
 * Owns the transparent overlay canvas: applies opacity/bounds, toggles the
 * click-through lock, exposes Ctrl+I placement mode, and forwards match data +
 * control events to the overlay renderer.
 */
export class OverlayController {
  private win: BrowserWindow | null = null
  private locked = true
  private placementMode = false
  private lastMatchState: OverlayMatchState = 'idle'
  /** Set once the renderer has produced its first frame (ready-to-show). */
  private painted = false
  /** The overlay is wanted on screen (a match is live, user toggled it, or placement is active). */
  private desiredVisible = false
  /** The game (or our own app) is the foreground window. */
  private gameForeground = true
  /** Foreground gating only applies on Windows (where the watcher works). */
  private gatingEnabled = false
  private readonly watcher = new ForegroundWatcher()
  private friendlyNames: string[] = []
  /** Bound `screen` display-change listener, removed on dispose. */
  private onDisplayChange: (() => void) | null = null

  init(): void {
    const overlay = getSettings().getAll().overlay
    this.win = createOverlayWindow()
    this.win.setOpacity(overlay.opacity)
    this.win.once('ready-to-show', () => {
      this.painted = true
      this.reconcile()
    })
    this.locked = true
    if (!overlay.locked) {
      getSettings().update({ overlay: { ...overlay, locked: true } })
    }
    this.applyLock()

    this.friendlyNames = ['RelicCardinal', basename(process.execPath).replace(/\.exe$/i, '')]
    this.refreshGating()

    this.win.on('closed', () => {
      this.win = null
    })

    this.onDisplayChange = () => this.applyPosition()
    screen.on('display-removed', this.onDisplayChange)
    screen.on('display-added', this.onDisplayChange)
    screen.on('display-metrics-changed', this.onDisplayChange)

    this.applyPosition()
  }

  /** Snap the overlay canvas to the current display's full work area. */
  applyPosition(): void {
    if (!this.alive()) return
    const b = this.win!.getBounds()
    const { workArea } = screen.getDisplayNearestPoint({
      x: b.x + Math.round(b.width / 2),
      y: b.y + Math.round(b.height / 2),
    })
    this.win!.setBounds(workArea)
    getSettings().update({
      overlay: {
        ...getSettings().getAll().overlay,
        x: workArea.x,
        y: workArea.y,
        width: workArea.width,
        height: workArea.height,
      },
    })
  }

  get window(): BrowserWindow | null {
    return this.win
  }

  private alive(): boolean {
    return !!this.win && !this.win.isDestroyed()
  }

  show(): void {
    this.desiredVisible = true
    this.reconcile()
  }

  hide(): void {
    this.desiredVisible = false
    this.reconcile()
  }

  toggle(): void {
    this.desiredVisible = !this.desiredVisible
    this.reconcile()
  }

  isVisible(): boolean {
    return this.alive() && this.win!.isVisible()
  }

  private reconcile(): void {
    if (!this.alive()) return
    const want = shouldShowOverlay({
      desiredVisible: this.desiredVisible || this.placementMode,
      gameForeground: this.gameForeground,
      gatingEnabled: this.gatingEnabled,
    })
    if (want) {
      if (this.painted && !this.win!.isVisible()) this.win!.showInactive()
    } else if (this.win!.isVisible()) {
      this.win!.hide()
    }
  }

  /** A foreground-window change: is the game (or our app) focused? */
  private onForeground(name: string): void {
    // An empty name = the foreground process is unreadable (e.g. the game runs
    // elevated, or a secure desktop) — fail OPEN (keep showing) rather than
    // assume it's an unrelated app, so the overlay doesn't vanish over the very
    // game it's meant for. Logged so we can learn a game's real process name.
    if (name) console.log('[overlay] foreground:', name)
    this.gameForeground = name === '' ? true : isFriendlyForeground(name, this.friendlyNames)
    this.reconcile()
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
      this.watcher.start((name) => this.onForeground(name)) // idempotent
    } else {
      this.watcher.stop()
      this.gameForeground = true
    }
    this.reconcile()
  }

  dispose(): void {
    this.watcher.stop()
    if (this.onDisplayChange) {
      screen.removeListener('display-removed', this.onDisplayChange)
      screen.removeListener('display-added', this.onDisplayChange)
      screen.removeListener('display-metrics-changed', this.onDisplayChange)
      this.onDisplayChange = null
    }
  }

  private applyLock(): void {
    if (!this.alive()) return
    if (this.locked && !this.placementMode) {
      this.win!.setIgnoreMouseEvents(true, { forward: true })
      this.win!.setFocusable(false)
    } else {
      this.win!.setIgnoreMouseEvents(false)
      this.win!.setFocusable(true)
      this.win!.focus()
    }
    this.win!.webContents.send(IpcChannels.overlayLock, this.locked)
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

  setOpacity(opacity: number): void {
    if (this.alive()) this.win!.setOpacity(opacity)
  }

  private lastThemeCiv: string | null = null

  sendUpdate(payload: OverlayUpdatePayload): void {
    this.lastMatchState = payload.matchState
    if (this.alive()) this.win!.webContents.send(IpcChannels.overlayUpdate, payload)
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
