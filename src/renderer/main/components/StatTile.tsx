import type { ReactNode } from 'react'
import { cn } from '@shared/lib/utils'

type Accent = 'win' | 'loss' | 'warn' | 'primary'

// Static class strings (not interpolated) so Tailwind's content scan keeps them.
const ACCENT: Record<Accent, { value: string; border: string }> = {
  win: { value: 'text-win', border: 'border-win/30' },
  loss: { value: 'text-loss', border: 'border-loss/30' },
  warn: { value: 'text-warn', border: 'border-warn/30' },
  primary: { value: 'text-primary', border: 'border-primary/30' },
}

export function StatTile({
  label,
  value,
  sub,
  accent,
  delta,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Tints the value + border to convey good/bad/neutral. */
  accent?: Accent
  /** Optional signed change, rendered as a colored ▲/▼ row. */
  delta?: number | null
}) {
  const a = accent ? ACCENT[accent] : null
  return (
    <div
      className={cn('rts-menu-card rounded-sm border px-4 py-3', a ? a.border : 'border-border')}
    >
      <div className="rts-ledger-head">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', a?.value)}>{value}</div>
      {delta != null && delta !== 0 && (
        <div
          className={cn(
            'mt-0.5 text-xs font-medium tabular-nums',
            delta > 0 ? 'text-win' : 'text-loss',
          )}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
        </div>
      )}
      {sub != null && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
