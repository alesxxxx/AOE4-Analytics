import { globalShortcut } from 'electron'
import type { OverlayController } from './services/overlayController'

function reg(accelerator: string, handler: () => void): void {
  const ok = globalShortcut.register(accelerator, handler)
  if (!ok) {
    console.warn(`[hotkeys] Failed to register ${accelerator} (already in use by another app?)`)
  }
}

/**
 * Registers global hotkeys after `app.whenReady()`.
 *   Alt+O   toggle overlay visibility
 *   Ctrl+I  toggle overlay placement mode
 */
export function registerHotkeys(overlay: OverlayController): void {
  reg('Alt+O', () => overlay.toggle())
  reg('Control+I', () => overlay.togglePlacementMode())
}

/** Must be called on `will-quit` so we never leak system-wide hotkeys. */
export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
