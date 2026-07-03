import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { isDev } from '../env'
import { hardenWindow } from '../security'

/**
 * Creates the transparent, frameless, always-on-top overlay canvas. It spans the
 * current display's work area so individual overlay widgets can be positioned
 * independently. It is hidden by default and click-through when locked. Windows
 * caveat: exclusive-fullscreen games defeat any overlay, so users should run
 * Borderless/Windowed Fullscreen.
 */
export interface OverlayBounds {
  x: number
  y: number
  width: number
  height: number
}

export function createOverlayWindow(bounds?: OverlayBounds): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    width: bounds?.width ?? workArea.width,
    height: bounds?.height ?? workArea.height,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
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
  // Click-through by default; `forward: true` still delivers mousemove so the
  // renderer can detect hover over interactive regions (Windows-specific).
  win.setIgnoreMouseEvents(true, { forward: true })

  if (!bounds) win.setPosition(workArea.x, workArea.y)

  if (isDev) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  return win
}
