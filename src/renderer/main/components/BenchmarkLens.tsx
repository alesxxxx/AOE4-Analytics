import { useMemo, useState } from 'react'
import { Database, Scale } from 'lucide-react'
import {
  MIN_BENCHMARK_SAMPLES,
  benchmarkOptions,
  computeBenchmarkLens,
  type BenchmarkDimension,
  type BenchmarkGame,
  type BenchmarkMetric,
  type BenchmarkMetricValue,
  type BenchmarkSelection,
} from '@domain/benchmarkLens'
import { civDisplayName } from '@domain/civ'
import { Card, CardContent } from '@shared/components/ui/card'
import { cn } from '@shared/lib/utils'

const SCOPES: { kind: BenchmarkDimension; label: string }[] = [
  { kind: 'recent', label: 'Recent' },
  { kind: 'civ', label: 'Civilization' },
  { kind: 'map', label: 'Map' },
  { kind: 'format', label: 'Format' },
]

export function BenchmarkLens({ games }: { games: BenchmarkGame[] }) {
  const options = useMemo(() => benchmarkOptions(games), [games])
  const [selection, setSelection] = useState<BenchmarkSelection>({ kind: 'recent' })
  const effectiveSelection = useMemo<BenchmarkSelection>(() => {
    if (selection.kind === 'recent') return selection
    const available = options[selection.kind]
    const selected = available.some((option) => option.value === selection.value)
      ? selection.value
      : (available[0]?.value ?? '')
    return {
      kind: selection.kind,
      value: selected,
      label: optionLabel(selection.kind, selected),
    }
  }, [options, selection])
  const comparison = useMemo(
    () => computeBenchmarkLens(games, effectiveSelection),
    [effectiveSelection, games],
  )

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Scale className="h-4 w-4 text-primary" />
              Benchmark lens
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Compare non-overlapping groups from up to your latest 100 loaded games.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-sm border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
            <Database className="h-3 w-3" />
            Up to 100 personal games
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-sm border border-border/70 bg-background/40 p-0.5">
            {SCOPES.map((scope) => {
              const disabled = scope.kind !== 'recent' && options[scope.kind].length < 2
              return (
                <button
                  key={scope.kind}
                  type="button"
                  disabled={disabled}
                  aria-pressed={effectiveSelection.kind === scope.kind}
                  title={
                    disabled
                      ? `At least two known ${scope.label.toLowerCase()} values are needed`
                      : undefined
                  }
                  onClick={() => {
                    if (scope.kind === 'recent') {
                      setSelection({ kind: 'recent' })
                      return
                    }
                    setSelection({ kind: scope.kind, value: options[scope.kind][0]?.value ?? '' })
                  }}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                    effectiveSelection.kind === scope.kind
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {scope.label}
                </button>
              )
            })}
          </div>

          {effectiveSelection.kind !== 'recent' && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Compare
              <select
                value={effectiveSelection.value}
                onChange={(event) =>
                  setSelection({ kind: effectiveSelection.kind, value: event.target.value })
                }
                className="max-w-56 rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              >
                {options[effectiveSelection.kind].map((option) => (
                  <option key={option.value} value={option.value}>
                    {optionLabel(effectiveSelection.kind, option.value)} ({option.games}g)
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold">{comparison.title}</span>
          <span className="text-[11px] text-muted-foreground">
            At least {MIN_BENCHMARK_SAMPLES} usable games per metric and side
          </span>
        </div>

        <div className="overflow-x-auto rounded-sm border border-border/70">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-background/40 text-left">
                <th className="rts-ledger-head px-3 py-2">Metric</th>
                <CohortHead label={comparison.leftLabel} games={comparison.leftGames} />
                <CohortHead label={comparison.rightLabel} games={comparison.rightGames} />
                <th className="rts-ledger-head px-3 py-2 text-right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {comparison.metrics.map((metric) => (
                <MetricRow key={metric.key} metric={metric} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          These are personal comparisons, not global or rank percentiles. Missing counters and
          unresolved results stay excluded instead of being counted as zero.
        </p>
      </CardContent>
    </Card>
  )
}

function CohortHead({ label, games }: { label: string; games: number }) {
  return (
    <th className="rts-ledger-head px-3 py-2 text-right">
      <span className="block normal-case text-foreground">{label}</span>
      <span className="block font-normal normal-case text-muted-foreground">
        {games} game{games === 1 ? '' : 's'}
      </span>
    </th>
  )
}

function MetricRow({ metric }: { metric: BenchmarkMetric }) {
  return (
    <tr className="border-b border-border/50 last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="text-xs font-medium">{metric.label}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{metric.detail}</div>
      </td>
      <MetricCell metric={metric} reading={metric.left} />
      <MetricCell metric={metric} reading={metric.right} />
      <td className="px-3 py-2.5 text-right align-top">
        {metric.comparable && metric.delta != null ? (
          <span className="text-xs font-semibold tabular-nums text-primary">
            {formatDelta(metric)}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Not enough data</span>
        )}
      </td>
    </tr>
  )
}

function MetricCell({
  metric,
  reading,
}: {
  metric: BenchmarkMetric
  reading: BenchmarkMetricValue
}) {
  return (
    <td className="px-3 py-2.5 text-right align-top">
      <div className="text-xs font-semibold tabular-nums">{formatValue(metric, reading.value)}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        n={reading.samples}
      </div>
    </td>
  )
}

function formatValue(metric: BenchmarkMetric, value: number | null): string {
  if (value == null) return '-'
  const formatted = value.toFixed(metric.decimals)
  return metric.key === 'winRate' ? `${formatted}%` : formatted
}

function formatDelta(metric: BenchmarkMetric): string {
  if (metric.delta == null) return '-'
  const formatted = `${metric.delta > 0 ? '+' : ''}${metric.delta.toFixed(metric.decimals)}`
  return metric.key === 'winRate' ? `${formatted} pp` : formatted
}

function optionLabel(kind: Exclude<BenchmarkDimension, 'recent'>, value: string): string {
  return kind === 'civ' ? civDisplayName(value) : value
}
