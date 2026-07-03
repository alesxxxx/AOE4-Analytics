/**
 * DORMANT (not yet wired into the UI): built + tested, but no screen renders it
 * yet. It is one import from mounting on the Dashboard — a recommended follow-up.
 *
 * "Biggest leak" — the single recurring weakness to highlight on the dashboard
 * (pure), inspired by DPM's "Lens". Aggregates the per-game analysis signals over
 * recent games and surfaces the most frequent, most severe one.
 */
import type { Signal } from './analysis'

export interface Leak {
  id: string
  title: string
  detail: string
  /** How many of the considered games showed this leak. */
  count: number
  /** How many games were considered. */
  games: number
}

const WEIGHT: Record<Signal['severity'], number> = { major: 3, minor: 1, info: 0, good: 0 }

/**
 * @param signalsPerGame analysis.signals for recent games (any order)
 * @param window how many recent games to consider
 */
export function biggestLeak(signalsPerGame: Signal[][], window = 10): Leak | null {
  const recent = signalsPerGame.slice(0, window)
  if (recent.length === 0) return null

  const acc = new Map<string, { sig: Signal; count: number; score: number }>()
  for (const game of recent) {
    // Count a leak at most once per game.
    const seen = new Set<string>()
    for (const s of game) {
      if (WEIGHT[s.severity] === 0 || seen.has(s.id)) continue
      seen.add(s.id)
      const cur = acc.get(s.id)
      if (cur) {
        cur.count++
        cur.score += WEIGHT[s.severity]
      } else {
        acc.set(s.id, { sig: s, count: 1, score: WEIGHT[s.severity] })
      }
    }
  }
  if (acc.size === 0) return null

  // Most total severity-weight, then most frequent.
  const top = [...acc.values()].sort((a, b) => b.score - a.score || b.count - a.count)[0]!
  return {
    id: top.sig.id,
    title: top.sig.title,
    detail: top.sig.detail,
    count: top.count,
    games: recent.length,
  }
}
