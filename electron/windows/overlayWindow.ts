import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { isDev } from '../env'
import { hardenWindow } from '../security'

/**
 * Creates the transparent, frameless, always-on-top overlay canvas. It spans the
 * primary display's FULL bounds (not the work area — borderless-fullscreen games
 * cover the taskbar, so the canvas must too or widgets misalign by the taskbar
 * height; safe because the window is click-through and non-focusable). The
 * controller re-snaps it to whichever display the game is on. It is hidden by
 * default and click-through when locked. Windows caveat: exclusive-fullscreen
 * games defeat any overlay, so users should run Borderless/Windowed Fullscreen.
 */
export function createOverlayWindow(): BrowserWindow {
  const { bounds } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  hardenWindow(win)

  // Float above borderless-fullscreen games and on every virtual desktop.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Click-through by default. No `forward: true`: nothing in the overlay
  // renderer listens for mousemove while locked, and forwarding costs an IPC
  // message per mouse move during gameplay.
  win.setIgnoreMouseEvents(true)

  win.setPosition(bounds.x, bounds.y)

  if (isDev) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  return win
}
