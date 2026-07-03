import { cn } from '@shared/lib/utils'
import { winRateTone } from '@shared/format'

const FILL: Record<'win' | 'loss' | 'even', string> = {
  win: 'bg-win',
  loss: 'bg-loss',
  even: 'bg-muted-foreground/60',
}
const TEXT: Record<'win' | 'loss' | 'even', string> = {
  win: 'text-win',
  loss: 'text-loss',
  even: 'text-muted-foreground',
}

/**
 * The core win-rate viz: a bar filled to `winRate%`, color-thresholded, with a
 * faint 50% reference tick and the value inline — the visual anchor op.gg / U.GG
 * build their stat tables around.
 */
export function WinRateBar({
  winRate,
  className,
}: {
  winRate: number | null | undefined
  className?: string
}) {
  const tone = winRateTone(winRate)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-secondary">
        {winRate != null && (
          <div
            className={cn('h-full rounded-sm', FILL[tone])}
            style={{ width: `${Math.max(0, Math.min(100, winRate))}%` }}
          />
        )}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </div>
      <span className={cn('w-10 shrink-0 text-right text-xs font-semibold tabular-nums', TEXT[tone])}>
        {winRate != null ? `${winRate}%` : '—'}
      </span>
    </div>
  )
}
