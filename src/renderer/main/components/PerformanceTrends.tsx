import { TrendingUp } from 'lucide-react'
import type { StoredMatch } from '@store/historyStore'
import { computeTrends } from '@domain/trends'
import { StatTile } from './StatTile'
import { Sparkline } from './Sparkline'

/**
 * DORMANT (not currently imported): removed from the Dashboard (its content now
 * lives in My Stats). Kept for a possible trends surface.
 *
 * DPM-style recent-performance panel: trend tiles + a rating sparkline.
 */
export function PerformanceTrends({ matches }: { matches: StoredMatch[] }) {
  if (matches.length === 0) return null

  const trends = computeTrends(
    matches.map((m) => ({
      result: m.result,
      rating: m.rating,
      ratingDiff: m.ratingDiff,
      durationSec: m.durationSec,
    })),
  )

  const streakText =
    trends.streak === 0 ? '—' : `${Math.abs(trends.streak)}${trends.streak > 0 ? 'W' : 'L'}`
  const ratingDelta = trends.rating.delta

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        Recent performance · last {trends.games}
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Win rate"
          value={trends.winRate != null ? `${trends.winRate}%` : '—'}
          sub={`${trends.wins}W–${trends.losses}L`}
          accent={
            trends.winRate == null ? undefined : trends.winRate >= 50 ? 'win' : 'loss'
          }
        />
        <StatTile
          label="Streak"
          value={streakText}
          sub={trends.streak > 0 ? 'on a roll' : trends.streak < 0 ? 'shake it off' : undefined}
        />
        <StatTile
          label="Rating Δ / game"
          value={
            trends.avgRatingDiff != null
              ? `${trends.avgRatingDiff > 0 ? '+' : ''}${trends.avgRatingDiff}`
              : '—'
          }
        />
        <StatTile
          label="Avg length"
          value={trends.avgGameMin != null ? `${trends.avgGameMin}m` : '—'}
        />
      </div>

      {trends.rating.series.length >= 2 && (
        <div className="rts-menu-card rounded-lg border border-primary/20 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Rating trend</span>
            {ratingDelta != null && (
              <span className={ratingDelta >= 0 ? 'text-win' : 'text-loss'}>
                {ratingDelta >= 0 ? '+' : ''}
                {ratingDelta} over {trends.rating.series.length}
              </span>
            )}
          </div>
          <Sparkline values={trends.rating.series} className="mt-1 w-full" />
        </div>
      )}
    </section>
  )
}
