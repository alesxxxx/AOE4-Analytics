import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { isDev } from '../env'
import { hardenWindow } from '../security'
import { IpcChannels } from '../ipc/contract'

/**
 * Creates the main dashboard window. It is FRAMELESS — the renderer draws its
 * own title bar (logo + min/max/close), driven via the `window:*` IPC handlers,
 * so the OS chrome never clashes with the app's look.
 */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#0a0b10',
    title: 'RTSLytics',
    // In the packaged app the .exe carries the icon (electron-builder); set it
    // here too so the dev window + taskbar show it before packaging.
    ...(isDev ? { icon: join(__dirname, '../../build/icon.png') } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Keep the renderer's title-bar maximize/restore icon in sync with the window.
  win.on('maximize', () => win.webContents.send(IpcChannels.windowMaximizedChanged, true))
  win.on('unmaximize', () => win.webContents.send(IpcChannels.windowMaximizedChanged, false))

  // Open external links in the browser; block in-app navigation/other schemes.
  hardenWindow(win)

  if (isDev) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
