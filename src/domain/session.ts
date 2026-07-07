import type { StoredMatch } from '../store/historyStore'

/** Today's ladder session at a glance: W–L record + net rating change. */
export interface SessionSummary {
  /** Games played today with a known result. */
  games: number
  wins: number
  losses: number
  /**
   * Net rating change across today's games, summed from each game's
   * ratingDiff. Null when no game today carried a rating change (e.g. only
   * custom/vs-AI games) — so the UI can omit the MMR figure instead of
   * showing a misleading +0.
   */
  ratingDelta: number | null
}

/** The StoredMatch fields the session summary reads (narrow for testability). */
export type SessionMatch = Pick<
  StoredMatch,
  'playedAt' | 'result' | 'ratingDiff' | 'hidden' | 'custom' | 'vsAI'
>

/** True when the two timestamps fall on the same LOCAL calendar day. */
function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Summarizes today's session from stored history (any order): games played on
 * the same local calendar day as `now`, W–L record, and the net rating change.
 * Hidden (tombstoned) games and games without a result are skipped;
 * `excludeAi` additionally skips custom/vs-AI games, mirroring the
 * "exclude AI from stats" setting.
 */
export function sessionSummary(
  matches: SessionMatch[],
  now: Date | number,
  opts?: { excludeAi?: boolean },
): SessionSummary {
  const today = typeof now === 'number' ? new Date(now) : now
  let wins = 0
  let losses = 0
  let ratingDelta: number | null = null

  for (const m of matches) {
    if (m.hidden) continue
    if (m.result !== 'win' && m.result !== 'loss') continue
    if (opts?.excludeAi && (m.custom || m.vsAI)) continue
    const playedAt = new Date(m.playedAt)
    if (Number.isNaN(playedAt.getTime()) || !sameLocalDay(playedAt, today)) continue
    if (m.result === 'win') wins++
    else losses++
    if (typeof m.ratingDiff === 'number' && Number.isFinite(m.ratingDiff)) {
      ratingDelta = (ratingDelta ?? 0) + m.ratingDiff
    }
  }

  return { games: wins + losses, wins, losses, ratingDelta }
}
