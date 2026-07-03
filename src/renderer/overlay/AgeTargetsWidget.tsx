// DORMANT (D55): unimported since the overlay redesign — kept as the pattern
// base for the planned overlay micro-coach; do not delete without reading D55.
import type { Benchmarks, Bracket } from '@domain/benchmarks'
import { cn } from '@shared/lib/utils'

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * Age-up pace targets as a compact horizontal cell for the overlay bar: target
 * Feudal/Castle/Imperial times for the player's rank, the next age highlighted.
 * Honest by design — AoE4's ToS rules out reading real age-ups, so these are
 * pace targets next to the match clock, never a live "you aged at X" reading.
 */
export function AgeTargetsWidget({
  benchmarks,
  bracket,
  elapsedSec,
}: {
  benchmarks: Benchmarks
  bracket: Bracket
  elapsedSec: number | null
}) {
  const ages = [
    { name: 'Feud', sec: benchmarks.feudalSec },
    { name: 'Cstl', sec: benchmarks.castleSec },
    { name: 'Imp', sec: benchmarks.imperialSec },
  ]
  const nextIdx = elapsedSec == null ? -1 : ages.findIndex((a) => elapsedSec < a.sec)

  return (
    <div className="flex h-full flex-col justify-center px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
        <span>Age targets · {bracket}</span>
        {elapsedSec != null && (
          <span className="tabular-nums text-white/60">{mmss(elapsedSec)}</span>
        )}
      </div>
      <div className="flex gap-1">
        {ages.map((a, i) => {
          const passed = elapsedSec != null && elapsedSec >= a.sec
          const isNext = i === nextIdx
          return (
            <div
              key={a.name}
              className={cn(
                'flex-1 rounded border px-1 py-0.5 text-center',
                isNext
                  ? 'border-cyan-400/60 bg-cyan-500/10'
                  : passed
                    ? 'border-white/10 bg-white/5 opacity-60'
                    : 'border-white/10',
              )}
            >
              <div className="text-[9px] text-white/50">{a.name}</div>
              <div className="text-[11px] font-semibold tabular-nums">{mmss(a.sec)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}