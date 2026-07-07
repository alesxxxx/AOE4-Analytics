/**
 * Recent-performance trends for the dashboard (pure). Computes sparkline series
 * and "vs earlier" deltas from the stored game history — the DPM-style metric
 * tiles, but only from data we actually have (rating, result, duration).
 */

/** Minimal per-game shape the trends need (mapped from StoredMatch). */
export interface TrendGame {
  result: 'win' | 'loss' | null
  rating: number | null
  ratingDiff: number | null
  durationSec: number | null
}

export interface Metric {
  /** Chronological values (oldest → newest) for a sparkline. */
  series: number[]
  /** Latest value, or null when there's no data. */
  current: number | null
  /** Change from the first to the last value in the window, or null. */
  delta: number | null
}

export interface DashboardTrends {
  games: number
  /** Win rate (%) over the window. */
  winRate: number | null
  /** Wins / losses counted in the window. */
  wins: number
  losses: number
  /** Current win/loss streak: positive = wins, negative = losses. */
  streak: number
  /** Average game length in minutes over the window. */
  avgGameMin: number | null
  /** Average rating change per game over the window. */
  avgRatingDiff: number | null
  /** Rating over time (ranked games), for a sparkline. */
  rating: Metric
}

function metric(series: number[]): Metric {
  if (series.length === 0) return { series, current: null, delta: null }
  const current = series[series.length - 1]!
  const delta = series.length >= 2 ? current - series[0]! : null
  return { series, current, delta }
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * @param matches newest-first (as History returns them)
 * @param window how many recent games to consider
 */
export function computeTrends(matches: TrendGame[], window = 20): DashboardTrends {
  const recent = matches.slice(0, window)
  const chrono = [...recent].reverse() // oldest → newest for series

  const decided = recent.filter((m) => m.result === 'win' || m.result === 'loss')
  const wins = decided.filter((m) => m.result === 'win').length
  const losses = decided.length - wins

  // Streak from the newest decided games.
  let streak = 0
  for (const m of recent) {
    if (m.result !== 'win' && m.result !== 'loss') continue
    if (streak === 0) streak = m.result === 'win' ? 1 : -1
    else if (m.result === 'win' && streak > 0) streak++
    else if (m.result === 'loss' && streak < 0) streak--
    else break
  }

  const durations = chrono
    .map((m) => m.durationSec)
    .filter((d): d is number => d != null)
    .map((d) => d / 60)
  const ratingDiffs = recent.map((m) => m.ratingDiff).filter((d): d is number => d != null)
  const ratings = chrono.map((m) => m.rating).filter((r): r is number => r != null)

  return {
    games: recent.length,
    winRate: decided.length ? Math.round((wins / decided.length) * 100) : null,
    wins,
    losses,
    streak,
    avgGameMin: durations.length ? round1(avg(durations)!) : null,
    avgRatingDiff: ratingDiffs.length ? round1(avg(ratingDiffs)!) : null,
    rating: metric(ratings),
  }
}
