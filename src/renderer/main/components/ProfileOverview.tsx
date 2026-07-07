import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import type { RankInfo } from '@domain/types'
import type { PlaystyleTag } from '@domain/playstyle'
import type { CivOverviewRow } from '@domain/profileOverview'
import { formatDurationShort, countryFlag, formatPercent } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'
import { RankBadge } from './RankBadge'
import { WinRateBar } from './WinRateBar'

/** The player's identity + rank + tags column (Mobalytics-profile style). */
export function ProfileIdentityCard({
  identity,
  totalGames,
  wins,
  losses,
  winRate,
  longestWinStreak,
  longestLossStreak,
  tags,
}: {
  /** From the dashboard fetch; null when offline / no profile; card degrades. */
  identity: { name: string; country: string | null; primary: RankInfo | null } | null
  totalGames: number
  wins: number
  losses: number
  winRate: number | null
  longestWinStreak: number
  longestLossStreak: number
  tags: PlaystyleTag[]
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {identity && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                {countryFlag(identity.country)}
              </span>
              <h3 className="truncate text-lg font-semibold">{identity.name}</h3>
            </div>
            <RankBadge rank={identity.primary} />
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.label}
                title={t.hint}
                className={cn(
                  'cursor-help rounded-sm px-2 py-0.5 text-xs font-medium',
                  t.tone === 'pos' ? 'bg-win/15 text-win' : 'bg-secondary text-muted-foreground',
                )}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1.5 rounded-md border border-border/70 bg-background/40 p-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Synced games</span>
            <span className="font-semibold tabular-nums">
              {totalGames} - {wins}W-{losses}L
            </span>
          </div>
          <WinRateBar winRate={winRate} />
          <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
            <span>Longest streaks</span>
            <span className="tabular-nums">
              <span className="text-win">{longestWinStreak}W</span> -{' '}
              <span className="text-loss">{longestLossStreak}L</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Per-civ results, economy, army, and pacing — one quiet ledger table. */
export function CivOverviewTable({ rows }: { rows: CivOverviewRow[] }) {
  if (rows.length === 0) return null
  const display = rows.slice(0, 10)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm">
            <Shield className="h-4 w-4 text-primary" />
            Civilizations
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {rows.length} civ{rows.length === 1 ? '' : 's'} played
          </span>
        </div>

        <div className="overflow-x-auto rounded-sm border border-border/70">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-background/40 text-left">
                <th className="rts-ledger-head px-3 py-2 text-left">Civ</th>
                <th className="rts-ledger-head px-2 py-2 text-left">Style</th>
                <th className="rts-ledger-head px-2 py-2 text-left">Results</th>
                <th className="rts-ledger-head px-2 py-2 text-right">Economy</th>
                <th className="rts-ledger-head px-2 py-2 text-right">Army</th>
                <th className="rts-ledger-head px-2 py-2 text-right">Pace</th>
                <th className="rts-ledger-head px-3 py-2 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r) => (
                <CivRow key={r.civ} r={r} />
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > display.length && (
          <p className="text-[11px] text-muted-foreground">+{rows.length - display.length} more</p>
        )}
      </CardContent>
    </Card>
  )
}

function CivRow({ r }: { r: CivOverviewRow }) {
  return (
    <tr className="border-b border-border/50 last:border-b-0 hover:bg-secondary/30">
      <td className="px-3 py-2.5 align-top">
        <Link to={`/civ/${r.civ}`} className="font-medium hover:text-primary">
          {r.civName}
        </Link>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {r.games}g - {r.wins}W-{r.losses}L
        </div>
      </td>
      <td className="px-2 py-2.5 align-top">
        <span
          title={r.style.detail}
          className={cn(
            'inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold',
            r.style.tone === 'fight' && 'bg-loss/15 text-loss',
            r.style.tone === 'eco' && 'bg-win/15 text-win',
            r.style.tone === 'macro' && 'bg-primary/15 text-primary',
            r.style.tone === 'balanced' && 'bg-secondary text-muted-foreground',
          )}
        >
          {r.style.label}
        </span>
      </td>
      <td className="px-2 py-2.5 align-top">
        <div className="min-w-24">
          <WinRateBar winRate={r.winRate} />
        </div>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {formatPercent(r.winRate)}
        </div>
      </td>
      <Metric
        value={
          r.avgResourcesPerMinute != null
            ? `${r.avgResourcesPerMinute}`
            : r.avgVillagersPerMinute != null
              ? `${r.avgVillagersPerMinute}`
              : null
        }
        sub={
          r.avgResourcesGathered != null
            ? `${Math.round(r.avgResourcesGathered).toLocaleString()} gathered`
            : r.avgVillagersProduced != null
            ? `${r.avgVillagersProduced} villagers`
            : null
        }
        suffix={r.avgResourcesPerMinute != null ? 'res/min' : 'vil/min'}
      />
      <Metric
        value={r.avgUnitsProduced}
        sub={r.avgKills != null ? `${r.avgKills} kills` : null}
        suffix="units"
      />
      <Metric
        value={r.avgDurationSec != null ? formatDurationShort(r.avgDurationSec) : null}
        sub={r.lateGameShare != null ? `${r.lateGameShare}% 20m+` : null}
      />
      <td className="px-3 py-2.5 text-right align-top">
        <span
          className={cn(
            'text-xs font-semibold tabular-nums',
            r.ratingDelta == null
              ? 'text-muted-foreground'
              : r.ratingDelta >= 0
                ? 'text-win'
                : 'text-loss',
          )}
        >
          {r.ratingDelta == null ? '-' : `${r.ratingDelta > 0 ? '+' : ''}${r.ratingDelta}`}
        </span>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {r.avgApm ?? '-'} APM - {r.avgKd ?? '-'} K/D
        </div>
      </td>
    </tr>
  )
}

function Metric({
  value,
  sub,
  suffix,
}: {
  value: ReactNode | null
  sub?: ReactNode | null
  suffix?: string
}) {
  return (
    <td className="px-2 py-2.5 text-right align-top">
      <div className="text-xs font-semibold tabular-nums">
        {value ?? '-'}
        {value != null && suffix ? (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      {sub != null && (
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{sub}</div>
      )}
    </td>
  )
}
