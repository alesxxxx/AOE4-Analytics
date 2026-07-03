/** Pure rules for when the overlay window may be on screen. */

/** Strip a trailing `.exe` and lowercase, for tolerant process-name comparison. */
function normProc(name: string): string {
  return name.toLowerCase().replace(/\.exe$/, '')
}

/**
 * Whether the given foreground process is one the overlay is allowed to float
 * over — the game itself, or our own app (so unlocking the overlay to drag it,
 * which focuses our window, doesn't make it hide itself).
 */
export function isFriendlyForeground(
  foregroundProcess: string | null | undefined,
  friendly: string[],
): boolean {
  if (!foregroundProcess) return false
  const fg = normProc(foregroundProcess)
  return friendly.some((f) => normProc(f) === fg)
}

/**
 * Whether the overlay should currently be visible. It must be both *wanted*
 * (a match is live or the user toggled it on) and — when foreground gating is
 * enabled (Windows) — the game/our app must be the foreground window, so the
 * overlay never floats over unrelated apps (the user's "only show on AoE4").
 */
export function shouldShowOverlay(opts: {
  desiredVisible: boolean
  gameForeground: boolean
  gatingEnabled: boolean
}): boolean {
  if (!opts.gatingEnabled) return opts.desiredVisible
  return opts.desiredVisible && opts.gameForeground
}
