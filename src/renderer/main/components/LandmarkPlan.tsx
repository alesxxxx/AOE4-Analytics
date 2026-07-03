import { Landmark as LandmarkIcon, Check } from 'lucide-react'
import { landmarksForCiv } from '@domain/landmarks'
import { Card, CardContent } from '@shared/components/ui/card'

const ROMAN: Record<number, string> = { 2: 'II', 3: 'III', 4: 'IV' }
const AGE_NAME: Record<number, string> = { 2: 'Feudal', 3: 'Castle', 4: 'Imperial' }

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'community consensus',
  medium: 'consensus · adapt to your build',
  low: 'rough guide',
}

/**
 * The recommended landmark (age-up) picks for a civ — the pick per age plus the
 * alternative and why, or the civ's special age-up mechanic. Check it before a
 * game / during load-in. Data from `@domain/landmarks`.
 */
export function LandmarkPlan({ civ }: { civ: string }) {
  const data = landmarksForCiv(civ)
  if (!data) return null

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <LandmarkIcon className="h-4 w-4 text-primary" />
          Landmark plan
          <span className="ml-auto text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            {CONFIDENCE_LABEL[data.confidence] ?? data.confidence}
          </span>
        </h3>

        {data.special && (
          <p className="rounded-md border border-primary/25 bg-primary/[0.06] p-2.5 text-xs leading-relaxed text-muted-foreground">
            {data.special}
          </p>
        )}

        {data.ages.length > 0 && (
          <div className="space-y-2.5">
            {data.ages.map((a) => (
              <div key={a.age} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-8 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                  {ROMAN[a.age]}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {AGE_NAME[a.age]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      {a.pick}
                    </span>
                    {a.options
                      .filter((o) => o !== a.pick)
                      .map((o) => (
                        <span key={o} className="text-xs text-muted-foreground">
                          or {o}
                        </span>
                      ))}
                  </div>
                  <p className="text-xs leading-snug text-muted-foreground">{a.reason}</p>
                  {a.dependsOn && (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      <span className="text-primary/70">↳ </span>
                      {a.dependsOn}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
