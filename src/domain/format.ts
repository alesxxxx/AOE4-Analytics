/**
 * Time formatting helpers shared across the app (match timers, build-order
 * steps, history). Pure and dependency-free — part of the Node-free domain
 * layer. Build orders use the `M:SS` string format (see D14).
 */

/** Formats a number of seconds as `M:SS` (minutes uncapped). Non-finite or negative → `0:00`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parses a `M:SS` or `H:MM:SS` duration string into seconds.
 * Returns `null` for malformed input or out-of-range seconds/minutes.
 */
export function parseDuration(value: string): number | null {
  const parts = value.trim().split(':')
  if (parts.length < 2 || parts.length > 3) return null

  const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : Number.NaN))
  if (nums.some((n) => Number.isNaN(n))) return null

  if (parts.length === 2) {
    const [minutes, secs] = nums as [number, number]
    if (secs > 59) return null
    return minutes * 60 + secs
  }

  const [hours, minutes, secs] = nums as [number, number, number]
  if (minutes > 59 || secs > 59) return null
  return hours * 3600 + minutes * 60 + secs
}
