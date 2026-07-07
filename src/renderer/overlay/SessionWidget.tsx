import type { SessionSummary } from '@domain/session'
import { cn } from '@shared/lib/utils'
import { panelBg } from './panelBg'

/**
 * Today's ladder session at a glance — "TODAY 3W–1L +42" — so a losing streak
 * (or a good stopping point) is visible without leaving the game. Rendered
 * only when there is at least one finished game today; the MMR figure is
 * omitted when no game carried a rating change (custom/vs-AI only sessions).
 */
export function SessionWidget({ session }: { session: SessionSummary }) {
  const delta = session.ratingDelta
  return (
    <div
      className="pointer-events-none flex select-none items-center gap-2 rounded-md px-2.5 py-1.5 font-sans text-white shadow-xl ring-1 ring-white/10"
      style={{ background: panelBg(0.92), textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Today</span>
      <span className="text-[13px] font-semibold tabular-nums leading-none">
        <span className="text-win">{session.wins}W</span>
        <span className="text-white/45"> – </span>
        <span className="text-loss">{session.losses}L</span>
      </span>
      {delta != null && (
        <span
          className={cn(
            'text-[13px] font-bold tabular-nums leading-none',
            delta >= 0 ? 'text-win' : 'text-loss',
          )}
        >
          {delta >= 0 ? `+${delta}` : delta}
        </span>
      )}
    </div>
  )
}
