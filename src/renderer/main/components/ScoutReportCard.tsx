import type { ScoutReport } from '@domain/types'
import { Link } from 'react-router-dom'
import { Swords, Map as MapIcon, Info, ShieldCheck, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@shared/components/ui/card'
import { countryFlag, formatPercent, formatRating, formatDurationShort, winRateTone } from '@shared/format'
import { counterPlanForCiv } from '@domain/civUnits'
import { RankBadge } from './RankBadge'
import { FormPips } from './FormPips'

const CIV_BAR_FILL = { win: 'bg-win/80', loss: 'bg-loss/80', even: 'bg-primary/70' } as const

/**
 * Full scouting card: identity, rank, recent form, civ/map tendencies, counter note.
 * `showProfileLink` adds a "View full profile" button (omit it on the profile page
 * itself, which would link to where you already are).
 */
export function ScoutReportCard({
  report,
  showProfileLink = false,
}: {
  report: ScoutReport
  showProfileLink?: boolean
}) {
  const topCiv = report.topCivs[0]
  const topGames = topCiv?.games ?? 1
  const counterPlan = counterPlanForCiv(topCiv?.civ)
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                {countryFlag(report.country)}
              </span>
              <h2 className="truncate text-lg font-semibold">{report.name}</h2>
            </div>
            <div className="mt-1.5">
              <RankBadge rank={report.primary} />
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {report.primary?.maxRating != null && (
              <div>Peak {formatRating(report.primary.maxRating)}</div>
            )}
            {report.primary && <div>{report.primary.gamesCount} games</div>}
            {showProfileLink && (
              <Link
                to={`/profile/${report.profileId}`}
                className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                View full profile <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {!report.hasData && (
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Limited public data — this player may have a private match history or few rated games.
          </div>
        )}

        <section>
          <h3 className="rts-ledger-head mb-1.5">Recent form</h3>
          <FormPips form={report.recentForm} />
          {report.recentForm.avgDurationSec != null && (
            <div className="mt-1 text-xs text-muted-foreground">
              Avg game {formatDurationShort(report.recentForm.avgDurationSec)}
            </div>
          )}
        </section>

        {report.topCivs.length > 0 && (
          <section>
            <h3 className="rts-ledger-head mb-2 flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5" />
              Most-played civs
            </h3>
            <div className="space-y-1.5">
              {report.topCivs.map((c) => (
                <div key={c.civ} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{c.civName}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-secondary">
                    <div
                      className={`h-full rounded-sm ${CIV_BAR_FILL[winRateTone(c.winRate)]}`}
                      style={{ width: `${Math.min(100, (c.games / topGames) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {c.games}g{c.winRate != null ? ` · ${formatPercent(c.winRate)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {counterPlan && topCiv && counterPlan.counters.length > 0 && (
          <section>
            <h3 className="rts-ledger-head mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              How to beat their {topCiv.civName}
            </h3>
            <p className="rounded-md border border-win/20 bg-win/5 px-3 py-2 text-sm leading-relaxed">
              Build{' '}
              <span className="font-semibold text-win">
                {counterPlan.counters
                  .slice(0, 2)
                  .map((c) => c.label)
                  .join(' + ')}
              </span>{' '}
              <span className="text-muted-foreground">
                — answers their {counterPlan.keyUnits.map((u) => u.name).join(' & ')}.
              </span>
            </p>
          </section>
        )}

        {report.topMaps.length > 0 && (
          <section>
            <h3 className="rts-ledger-head mb-2 flex items-center gap-1.5">
              <MapIcon className="h-3.5 w-3.5" />
              Favourite maps
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {report.topMaps.map((m) => (
                <span key={m.map} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                  {m.map} <span className="text-muted-foreground">{m.games}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="rts-ledger-head mb-1.5 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            What to expect
          </h3>
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-relaxed">
            {report.note}
          </p>
        </section>
      </CardContent>
    </Card>
  )
}
