import type { OverlayController } from './overlayController'

/** APM is "actions in the last minute"; we keep a rolling window of action times. */
const APM_WINDOW_MS = 60_000
const PUSH_INTERVAL_MS = 1500

/** Minimal shape we use from uiohook-napi (so a missing binary is easy to stub). */
interface InputHook {
  on(event: 'keydown' | 'mousedown', listener: () => void): void
  start(): void
  stop(): void
}

/**
 * Live APM tracker. AoE4 exposes no APM, and the overlay is click-through, so the
 * only way to count live actions is a global input hook (uiohook-napi). We count
 * key presses + mouse clicks (≈ in-game actions) ONLY while a match is live, keep a
 * rolling 60s window, and push the rate to the overlay. The hook is loaded lazily +
 * defensively: a missing/blocked native binary disables APM, it never crashes the
 * app. We only count counts — never which keys — and only during a live match.
 */
export class ApmTracker {
  private hook: InputHook | null = null
  private hookStarted = false
  private enabled = false
  private inMatch = false
  private actions: number[] = []
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly overlay: OverlayController) {}

  /** Turn live APM on/off (Settings toggle). Starts/stops the global input hook. */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return
    this.enabled = on
    if (on) {
      this.startHook()
    } else {
      this.stopHook()
      this.actions = []
      this.overlay.sendApm(null)
    }
  }

  /** Count only while actually in a live match (≈ while playing AoE4). */
  setInMatch(on: boolean): void {
    if (on === this.inMatch) return
    this.inMatch = on
    if (!on) {
      this.actions = []
      if (this.enabled) this.overlay.sendApm(null)
    }
  }

  private startHook(): void {
    if (this.hookStarted) {
      this.startTimer()
      return
    }
    try {
      // electron-vite externalizes the dep; require resolves the native binary at
      // runtime. Lazy + guarded so a blocked/missing hook can't take down the app.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('uiohook-napi') as { uIOhook: InputHook }
      this.hook = mod.uIOhook
      const bump = (): void => {
        if (this.enabled && this.inMatch) this.actions.push(Date.now())
      }
      this.hook.on('keydown', bump)
      this.hook.on('mousedown', bump)
      this.hook.start()
      this.hookStarted = true
      this.startTimer()
    } catch (e) {
      console.warn('[apm] live input hook unavailable — APM disabled:', e)
    }
  }

  private startTimer(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), PUSH_INTERVAL_MS)
  }

  private tick(): void {
    if (!this.enabled) return
    const cutoff = Date.now() - APM_WINDOW_MS
    this.actions = this.actions.filter((t) => t >= cutoff)
    this.overlay.sendApm(this.inMatch ? this.actions.length : null)
  }

  private stopHook(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    try {
      this.hook?.stop()
    } catch {
      // ignore
    }
    this.hookStarted = false
    this.hook = null
  }

  stop(): void {
    this.stopHook()
  }
}
