/**
 * Runtime accent (action) colour. The palette tokens `--primary` / `--accent` /
 * `--ring` drive every action-coloured element (buttons, active nav, links,
 * focus rings, the title bar brand). The user can override that colour from
 * Settings; we apply it by setting those CSS variables on <html>, and clear the
 * overrides to fall back to the skin's default blue.
 */

/** Convert `#rrggbb` to an `"H S% L%"` triplet (the form our hsl(var(--x)) tokens expect). */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const int = parseInt(m[1]!, 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Perceived luminance 0–1 of a `#rrggbb`, for picking a contrasting foreground. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return 0
  const int = parseInt(m[1]!, 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const ACCENT_VARS = ['--primary', '--accent', '--ring'] as const
const FG_VARS = ['--primary-foreground', '--accent-foreground'] as const

/** Apply a custom accent hex, or pass null to clear it (revert to the default). */
export function applyAccent(hex: string | null): void {
  const root = document.documentElement
  const triplet = hex ? hexToHslTriplet(hex) : null
  if (!hex || !triplet) {
    for (const v of [...ACCENT_VARS, ...FG_VARS]) root.style.removeProperty(v)
    return
  }
  for (const v of ACCENT_VARS) root.style.setProperty(v, triplet)
  // Dark text on a light accent, light text on a dark one, so labels stay legible.
  const fg = luminance(hex) > 0.55 ? '224 40% 6%' : '0 0% 100%'
  for (const v of FG_VARS) root.style.setProperty(v, fg)
}

/** `"H S% L%"` triplet (our CSS-var form) → `#rrggbb`; null when unparsable. */
function tripletToHex(triplet: string): string | null {
  const m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(triplet.trim())
  if (!m) return null
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const to255 = (v: number): string =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to255(channel(h + 1 / 3))}${to255(channel(h))}${to255(channel(h - 1 / 3))}`
}

/**
 * The accent hex currently in effect (custom override or the theme default),
 * read from the live `--primary` token — for UI that needs a concrete colour,
 * like the Settings custom-colour input's initial value.
 */
export function currentAccentHex(): string {
  const triplet = getComputedStyle(document.documentElement).getPropertyValue('--primary')
  return tripletToHex(triplet) ?? '#c9ad6e'
}

/** Curated quick-pick accents (the default is electric blue). */
export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#1fa8e0' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'Green', hex: '#4ade80' },
  { name: 'Amber', hex: '#f4b740' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Red', hex: '#f0556b' },
  { name: 'Purple', hex: '#a78bfa' },
  { name: 'Pink', hex: '#f472b6' },
]
