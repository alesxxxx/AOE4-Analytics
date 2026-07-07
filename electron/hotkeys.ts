import { globalShortcut } from 'electron'
import { DEFAULT_HOTKEYS } from '@store/settings'
import type { OverlayController } from './services/overlayController'
import { getSettings } from './services/appContext'

/** Registers one shortcut, falling back to its default binding on failure. */
function reg(accelerator: string, fallback: string, handler: () => void): void {
  let ok: boolean
  try {
    ok = globalShortcut.register(accelerator, handler)
  } catch {
    ok = false // malformed accelerator string
  }
  if (ok) return
  console.warn(`[hotkeys] Failed to register ${accelerator} (already in use by another app?)`)
  if (accelerator === fallback) return
  try {
    if (globalShortcut.register(fallback, handler)) {
      console.warn(`[hotkeys] Fell back to the default ${fallback}`)
      return
    }
  } catch {
    // fall through to the warning below
  }
  console.warn(`[hotkeys] Failed to register the default ${fallback} too`)
}

/**
 * (Re)registers the global hotkeys from settings after `app.whenReady()`:
 *   hotkeys.toggleOverlay  (default Alt+O)         toggle overlay visibility
 *   hotkeys.placementMode  (default Ctrl+Alt+O)    toggle overlay placement mode
 * Idempotent — call again after a settings change to swap bindings live. When a
 * user binding can't be registered, the default is tried as a fallback.
 */
export function registerHotkeys(overlay: OverlayController): void {
  globalShortcut.unregisterAll()
  const hotkeys = getSettings().getAll().hotkeys
  reg(hotkeys.toggleOverlay, DEFAULT_HOTKEYS.toggleOverlay, () => overlay.toggle())
  reg(hotkeys.placementMode, DEFAULT_HOTKEYS.placementMode, () => overlay.togglePlacementMode())
}

/** Must be called on `will-quit` so we never leak system-wide hotkeys. */
export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
