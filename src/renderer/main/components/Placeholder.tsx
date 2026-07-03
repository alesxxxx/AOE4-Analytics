import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'

interface PlaceholderProps {
  title: string
  subtitle?: string
  phase: string
  children?: ReactNode
}

/**
 * DORMANT (unused): every screen is now built, so nothing renders this. Kept as a
 * scaffold helper only — not imported anywhere as of 2026-07.
 *
 * A consistent "scaffolded, not yet built" screen so the shell looks intentional.
 */
export function Placeholder({ title, subtitle, phase, children }: PlaceholderProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-block rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {phase}
            </span>
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {children ?? 'This screen is scaffolded and will be implemented in a later phase.'}
        </CardContent>
      </Card>
    </div>
  )
}
