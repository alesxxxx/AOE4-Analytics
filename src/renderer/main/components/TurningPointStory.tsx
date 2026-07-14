import { Activity, ArrowDown, Clock, Lightbulb } from 'lucide-react'
import type { MatchSummary } from '@domain/statsSummary'
import {
  deriveTurningPoints,
  type TurningPoint,
  type TurningPointAnchor,
  type TurningPointTone,
} from '@domain/turningPoints'
import { formatDurationShort } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'

const TONE_STYLE: Record<TurningPointTone, string> = {
  positive: 'border-win/40 bg-win/5',
  caution: 'border-warn/40 bg-warn/5',
  neutral: 'border-border bg-secondary/20',
}

const DOT_STYLE: Record<TurningPointTone, string> = {
  positive: 'bg-win',
  caution: 'bg-warn',
  neutral: 'bg-primary',
}

const LINK_LABEL: Record<TurningPointAnchor, string> = {
  summary: 'View summary evidence',
  resources: 'View resource evidence',
  score: 'View score evidence',
  'build-order': 'View build order',
}

const EVIDENCE_TARGET: Record<TurningPointAnchor, string> = {
  summary: 'game-summary-evidence',
  resources: 'game-summary-resources',
  score: 'game-summary-score',
  'build-order': 'game-summary-build-order',
}

export function TurningPointStory({
  summary,
  loading,
  myProfileId,
  myCiv,
}: {
  summary: MatchSummary | null
  loading: boolean
  myProfileId: number | null
  myCiv: string | null
}) {
  const points = summary
    ? deriveTurningPoints({ summary, myProfileId, myCiv })
    : ([] as TurningPoint[])
  const isTeamSummary = (summary?.players.length ?? 0) > 2

  return (
    <section className="space-y-2" aria-labelledby="turning-point-story-heading">
      <div>
        <h2
          id="turning-point-story-heading"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Activity className="h-4 w-4 text-primary" />
          Turning-point story
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Recorded facts are separated from possible takeaways. These cards use post-game summary
          data only.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Reading the game&apos;s stat summary…</p>
          ) : !summary ? (
            <p className="text-sm text-muted-foreground">
              Turning points need the game&apos;s post-match summary, which is not available for
              this game.
            </p>
          ) : points.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No evidence-backed turning points could be produced because your player row or the
              required timeline data was unavailable.
            </p>
          ) : (
            <div className="space-y-3">
              {isTeamSummary && (
                <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Team summary: these moments use only your own timelines. The summary does not
                  identify which other rows are allies, so it does not make opponent comparisons.
                </p>
              )}
              {points.length < 3 && (
                <p className="text-xs text-muted-foreground">
                  Only {points.length} evidence-backed{' '}
                  {points.length === 1 ? 'moment was' : 'moments were'} available; missing moments
                  were not estimated.
                </p>
              )}
              <ol className="space-y-3">
                {points.map((point, index) => (
                  <StoryCard key={point.id} point={point} number={index + 1} />
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function StoryCard({ point, number }: { point: TurningPoint; number: number }) {
  return (
    <li
      className={cn('rounded-md border p-3', TONE_STYLE[point.tone])}
      data-turning-point-kind={point.kind}
    >
      <article className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <div className="flex items-center gap-2 text-xs font-semibold tabular-nums text-muted-foreground sm:items-start">
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-primary-foreground',
              DOT_STYLE[point.tone],
            )}
          >
            {number}
          </span>
          <span className="inline-flex items-center gap-1 pt-0.5">
            <Clock className="h-3 w-3" />
            {formatRange(point)}
          </span>
        </div>
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold">{point.title}</h3>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Observed
            </div>
            <p className="text-xs leading-relaxed text-foreground">{point.observed}</p>
          </div>
          <div className="flex items-start gap-1.5">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Possible takeaway
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{point.coaching}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollToSummaryEvidence(point.anchor)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            {LINK_LABEL[point.anchor]}
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      </article>
    </li>
  )
}

function formatRange(point: TurningPoint): string {
  if (point.startTimeSec == null) return formatDurationShort(point.timeSec)
  return `${formatDurationShort(point.startTimeSec)}–${formatDurationShort(point.timeSec)}`
}

function scrollToSummaryEvidence(anchor: TurningPointAnchor): void {
  const target =
    document.getElementById(EVIDENCE_TARGET[anchor]) ??
    document.getElementById('game-summary-evidence')
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
