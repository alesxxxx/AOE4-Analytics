import { Dumbbell } from 'lucide-react'
import { civFromToken, type MatchSummary } from '@domain/statsSummary'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import { buildIndexForCiv } from '@domain/buildOrderSchema'
import { gradeBuildFollow, type TrainerCheckpoint } from '@domain/buildTrainer'
import { formatDuration } from '@domain/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'

/**
 * The practice loop: this game's decoded build events graded against the
 * bundled reference build for your civ. Renders nothing when there's no
 * bundled build, no decoded events for you, or no timed reference steps.
 */
export function BuildTrainerCard({ summary, myCiv }: { summary: MatchSummary; myCiv: string }) {
  const idx = buildIndexForCiv(BUNDLED_BUILD_ORDERS, myCiv)
  const reference = idx != null ? BUNDLED_BUILD_ORDERS[idx]! : null
  const me = summary.players.find((p) => civFromToken(p.civToken) === myCiv) ?? null
  if (!reference || !me || me.buildOrder.length === 0) return null

  const report = gradeBuildFollow({ reference, events: me.buildOrder, civ: myCiv })
  if (report.checkpoints.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Dumbbell className="h-4 w-4 text-primary" />
        Build trainer
        <ScoreBadge score={report.score} />
      </h2>
      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs text-muted-foreground">
            This game vs <span className="font-medium text-foreground">{report.buildName}</span> —
            replay the build in a custom game and watch the score climb.
          </p>
          <div className="overflow-hidden rounded-md border border-border/70">
            {report.checkpoints.map((c, i) => (
              <CheckpointRow key={i} c={c} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Villager counts assume the reference's opening villagers plus your production (the stat
            file doesn't record losses); age-ups are read from when your landmark went down.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const tone = score >= 80 ? 'bg-win/15 text-win' : score >= 50 ? 'bg-warn/15 text-warn' : 'bg-loss/15 text-loss'
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums', tone)}>
      {score}% on plan
    </span>
  )
}

function CheckpointRow({ c }: { c: TrainerCheckpoint }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem] items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-b-0">
      <span className="truncate">{c.label}</span>
      <span className="text-right text-xs tabular-nums text-muted-foreground">
        {c.kind === 'villagers' ? `${c.targetVillagers} vills` : formatDuration(c.targetTimeSec)}
      </span>
      <span className="text-right text-xs tabular-nums">
        {c.kind === 'villagers'
          ? (c.actualVillagers ?? '—')
          : c.actualTimeSec != null
            ? formatDuration(c.actualTimeSec)
            : 'not seen'}
      </span>
      <DeltaChip c={c} />
    </div>
  )
}

function DeltaChip({ c }: { c: TrainerCheckpoint }) {
  if (c.ok == null) {
    return <span className="text-right text-xs text-muted-foreground">—</span>
  }
  const text =
    c.kind === 'villagers'
      ? `${c.villagerDelta! > 0 ? '+' : ''}${c.villagerDelta}`
      : `${c.deltaSec! > 0 ? '+' : c.deltaSec! < 0 ? '−' : ''}${formatDuration(Math.abs(c.deltaSec!))}`
  return (
    <span
      className={cn(
        'text-right text-xs font-semibold tabular-nums',
        c.ok ? 'text-win' : 'text-loss',
      )}
    >
      {c.kind === 'ageup' && c.deltaSec === 0 ? 'on time' : text}
    </span>
  )
}
