import { app } from 'electron'
import { join } from 'node:path'
import { Aoe4WorldClient } from '@api/client'
import { RelicClient } from '@api/relicClient'
import { DiskCache } from '@api/cache'
import { RateLimiter } from '@api/rateLimiter'
import { JsonStore } from '@store/jsonStore'
import { SettingsService } from '@store/settings'
import { createHistoryStore, type CreatedHistoryStore } from '@store/historyStoreFactory'
import type { HistoryStore } from '@store/historyStore'
import type { BrowserWindow } from 'electron'
import type { OverlayController } from './overlayController'
import type { PollManager } from './pollService'
import type { ApmTracker } from './apmService'

let client: Aoe4WorldClient | null = null
let relicClient: RelicClient | null = null
let settings: SettingsService | null = null
/** One history store per account (keyed by active profile id; 0 = no profile). */
const historyStores = new Map<number, Promise<CreatedHistoryStore>>()
/** Resolved stores, tracked synchronously so they can be closed on quit. */
const openStores = new Set<CreatedHistoryStore>()
let overlayController: OverlayController | null = null
let pollManager: PollManager | null = null
let mainWindow: BrowserWindow | null = null

/** The shared, rate-limited, disk-cached AoE4World client (one per process). */
export function getClient(): Aoe4WorldClient {
  if (!client) {
    client = new Aoe4WorldClient({
      cache: new DiskCache({ baseDir: join(app.getPath('userData'), 'cache') }),
      // ~4 requests/sec ceiling; the poll service additionally spaces last-game
      // checks to 15s (D9).
      rateLimiter: new RateLimiter({ minIntervalMs: 250 }),
    })
  }
  return client
}

/**
 * Relic's official community API client (player stats AoE4World hides — APM,
 * rating deltas, custom/AI). Shares the disk cache dir (keyed on full URL) with
 * its own rate limiter since it's a different host.
 */
export function getRelicClient(): RelicClient {
  if (!relicClient) {
    relicClient = new RelicClient({
      cache: new DiskCache({ baseDir: join(app.getPath('userData'), 'cache') }),
      rateLimiter: new RateLimiter({ minIntervalMs: 250 }),
    })
  }
  return relicClient
}

/** The typed settings service backed by a JSON file under userData. */
export function getSettings(): SettingsService {
  if (!settings) {
    settings = new SettingsService(new JsonStore(join(app.getPath('userData'), 'settings.json')))
  }
  return settings
}

/**
 * The analyzed-match history store for the ACTIVE account (SQLite, falling back
 * to JSON — D5). History is namespaced per account so switching accounts doesn't
 * blend their games. The legacy `history.db`/`history.json` stay mapped to the
 * first account (`historyOwnerProfileId`, claimed once here) so existing games
 * are never orphaned; additional accounts get `history-<profileId>.db`.
 */
export function getHistory(): Promise<CreatedHistoryStore> {
  const s = getSettings()
  const active = s.getAll().profileId ?? 0
  // Claim the legacy files for the first account the very first time.
  if (s.getAll().historyOwnerProfileId == null && s.getAll().profileId != null) {
    s.update({ historyOwnerProfileId: s.getAll().profileId })
  }
  let promise = historyStores.get(active)
  if (!promise) {
    const dir = app.getPath('userData')
    const owner = s.getAll().historyOwnerProfileId
    const legacy = owner == null || owner === active || active === 0
    const suffix = legacy ? '' : `-${active}`
    promise = createHistoryStore({
      sqlitePath: join(dir, `history${suffix}.db`),
      jsonPath: join(dir, `history${suffix}.json`),
    })
    historyStores.set(active, promise)
    void promise.then((created) => openStores.add(created)).catch(() => {})
  }
  return promise
}

export async function getHistoryStore(): Promise<HistoryStore> {
  return (await getHistory()).store
}

/**
 * Close every open history store. better-sqlite3's `close()` is synchronous and
 * checkpoints the WAL, so calling this on `will-quit` avoids leaving `-wal`/`-shm`
 * sidecar files and a small data-loss window on an unclean exit.
 */
export function closeAllHistorySync(): void {
  for (const created of openStores) {
    try {
      created.store.close()
    } catch {
      // best-effort: a close failure must never block quit
    }
  }
  openStores.clear()
  historyStores.clear()
}

export function setOverlayController(controller: OverlayController): void {
  overlayController = controller
}

export function getOverlayController(): OverlayController | null {
  return overlayController
}

export function setPollManager(manager: PollManager): void {
  pollManager = manager
}

export function getPollManager(): PollManager | null {
  return pollManager
}

let apmTracker: ApmTracker | null = null

export function setApmTracker(tracker: ApmTracker): void {
  apmTracker = tracker
}

export function getApmTracker(): ApmTracker | null {
  return apmTracker
}

/** The dashboard window, for main-process pushes (e.g. post-game auto-open). */
export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}
