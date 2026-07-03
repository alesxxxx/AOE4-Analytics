import type { RecentForm } from '@domain/types'
import { cn } from '@shared/lib/utils'

/** Renders recent W/L results as colored pips plus a compact record summary. */
export function FormPips({ form, max = 12 }: { form: RecentForm; max?: number }) {
  const pips = form.lastResults.slice(0, max)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex gap-1">
        {pips.map((r, i) => (
          <span
            key={i}
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-sm border font-display text-[10px] font-bold',
              r === 'W' ? 'border-win/50 text-win' : 'border-loss/50 text-loss',
            )}
          >
            {r}
          </span>
        ))}
        {pips.length === 0 && (
          <span className="text-xs text-muted-foreground">No recent games</span>
        )}
      </div>
      {form.games > 0 && (
        <span className="text-xs text-muted-foreground">
          {form.wins}W–{form.losses}L · {form.winRate}%
          {form.streak !== 0 && (
            <> · {form.streak > 0 ? `W${form.streak}` : `L${-form.streak}`} streak</>
          )}
        </span>
      )}
    </div>
  )
}
