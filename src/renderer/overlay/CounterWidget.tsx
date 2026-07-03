// DORMANT (D55): unimported since the overlay redesign — kept as the pattern
// base for the planned overlay micro-coach; do not delete without reading D55.
import { Swords } from 'lucide-react'
import { civDisplayName } from '@domain/civ'
import type { CivCounterPlan } from '@domain/civUnits'

/**
 * Compact "how to beat this civ" cell for the horizontal overlay bar: opponent
 * civ, your matchup win rate, and what to build. Auto-targets a known ranked
 * opponent; Alt+C cycles civs so it's usable in custom/AI games too.
 */
export function CounterWidget({
  plan,
  manual,
  matchupWinRate,
  myCivName,
}: {
  plan: CivCounterPlan
  manual: boolean
  /** Your civ's historical win rate (%) vs this civ, if known. */
  matchupWinRate?: number | null
  myCivName?: string | null
}) {
  return (
    <div className="flex h-full flex-col justify-center px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between text-white/60">
        <span className="flex items-center gap-1 font-medium text-white/80">
          <Swords className="h-3 w-3 text-loss" />
          Counter {civDisplayName(plan.civSlug)}
        </span>
        <span className={manual ? 'text-warn' : 'text-win'}>
          {manual ? 'Alt+C' : 'opp'}
        </span>
      </div>

      {matchupWinRate != null && myCivName && (
        <div className="mt-0.5 text-white/55">
          {myCivName} vs {civDisplayName(plan.civSlug)}:{' '}
          <span
            className={
              matchupWinRate >= 50
                ? 'font-semibold text-win'
                : 'font-semibold text-loss'
            }
          >
            {Math.round(matchupWinRate)}%
          </span>
        </div>
      )}

      <div className="mt-1 leading-snug text-white/80">
        <span className="text-white/45">Build </span>
        <span className="font-semibold text-cyan-200">
          {plan.counters.map((c) => c.label).join(' + ') || '—'}
        </span>
      </div>
    </div>
  )
}