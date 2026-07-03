import { app, BrowserWindow, session } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { registerIpcHandlers } from './ipc/handlers'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { applySecurityPolicy } from './security'
import { join } from 'node:path'
import {
  closeAllHistorySync,
  getHistory,
  getSettings,
  setApmTracker,
  setMainWindow,
  setOverlayController,
  setPollManager,
} from './services/appContext'
import { getLocalDataStatus } from './services/localDataService'
import { isGameRunning } from './services/gameProcess'
import { getSteamAccounts } from './services/steamService'
import { analyzeRecentGames, listHistory } from './services/analysisService'
import { restoreSteamSession } from './services/relicAuthService'
import { OverlayController } from './services/overlayController'
import { PollManager } from './services/pollService'
import { ApmTracker } from './services/apmService'

// Diagnostic: isolate data to a temp dir when running a live verify/smoke.
if (process.env['RTSLYTICS_VERIFY'] || process.env['RTSLYTICS_SMOKE'] === '1') {
  app.setPath('userData', join(app.getPath('temp'), 'rtslytics-diag'))
}

let mainWindow: BrowserWindow | null = null
let overlay: OverlayController | null = null
let poll: PollManager | null = null
let apmTracker: ApmTracker | null = null

function bootstrap(): void {
  applySecurityPolicy(session.defaultSession)
  registerIpcHandlers()

  mainWindow = createMainWindow()
  setMainWindow(mainWindow)
  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
    // The overlay is a second window, so `window-all-closed` won't fire while it
    // exists. Quit the whole app when the dashboard closes so the overlay (and
    // the polling loop) never linger on their own.
    app.quit()
  })

  overlay = new OverlayController()
  overlay.init()
  setOverlayController(overlay)

  registerHotkeys(overlay)

  apmTracker = new ApmTracker(overlay)
  setApmTracker(apmTracker)

  poll = new PollManager(overlay, apmTracker)
  setPollManager(poll)
  const isSmoke = process.env['RTSLYTICS_SMOKE'] === '1'
  if (!isSmoke) {
    poll.start() // don't make live API calls during the automated smoke
    // Start the live-APM global input hook if the user enabled it (Settings).
    apmTracker.setEnabled(getSettings().getAll().overlay.apm)
  }

  // Silently restore a saved Steam session (ranked economy), best-effort.
  if (!isSmoke) void restoreSteamSession()

  console.log('[rtslytics] booted: main + overlay windows created')

  // Live diagnostic: run the real post-game pipeline against the AoE4World API
  // for a given profile id (RTSLYTICS_VERIFY=<id>), then quit. Used to verify
  // the full main-process flow on real data without driving the UI.
  if (process.env['RTSLYTICS_VERIFY']) {
    const pid = Number(process.env['RTSLYTICS_VERIFY'])
    setTimeout(() => {
      void (async () => {
        try {
          getSettings().setProfile(pid, 'verify')
          const res = await analyzeRecentGames(8)
          console.log('[verify] analyzeRecentGames →', JSON.stringify(res))
          const hist = await listHistory(5)
          if (hist.ok) {
            console.log('[verify] history entries:', hist.data.length)
            const m = hist.data[0]
            if (m) {
              console.log(
                `[verify] latest: ${m.civ} vs ${m.oppCiv} on ${m.map} | ${m.analysis.summary} | goals=${m.goals.length} priorChecks=${m.priorGoalChecks.length}`,
              )
            }
          } else {
            console.log('[verify] history error:', JSON.stringify(hist.error))
          }
        } catch (e) {
          console.log('[verify] error:', e)
        } finally {
          app.quit()
        }
      })()
    }, 1500)
    return
  }

  if (isSmoke) {
    // Smoke-test mode: confirm a clean boot (incl. history-store init), then
    // exit so CI/headless runs don't hang on the GUI event loop.
    setTimeout(() => {
      const local = getLocalDataStatus()
      console.log(
        `[rtslytics] localData: consent=${local.consentGranted} available=${local.available} (gate ${local.consentGranted ? 'open' : 'closed'})`,
      )
      void isGameRunning().then((r) =>
        console.log(`[rtslytics] gameRunning(RelicCardinal.exe): ${r}`),
      )
      void getSteamAccounts().then((a) =>
        console.log(`[rtslytics] steamAccounts: ${a.length} (recent: ${a[0]?.personaName ?? '—'})`),
      )
      getHistory()
        .then(({ backend }) => console.log(`[rtslytics] history backend: ${backend}`))
        .catch((e) => console.log('[rtslytics] history init error:', e))
        .finally(() => {
          // Exercise the paint-gated overlay show path (Alt+O) and confirm it
          // reveals at its persisted bounds without throwing.
          overlay?.show()
          console.log(
            `[rtslytics] overlay shown: ${overlay?.isVisible()} bounds: ${JSON.stringify(
              overlay?.window?.getBounds(),
            )}`,
          )
          // Exercise the real close→quit path: closing the dashboard must quit
          // the app (and take the overlay with it). If it didn't, this would
          // hang on the still-open overlay window instead of exiting.
          console.log('[rtslytics] smoke OK — closing main window (should quit app + overlay)')
          mainWindow?.close()
        })
    }, 2500)
  }
}

// Single-instance lock: a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    bootstrap()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) bootstrap()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    poll?.stop()
    apmTracker?.stop()
    overlay?.dispose()
    unregisterHotkeys()
    closeAllHistorySync()
  })
}
