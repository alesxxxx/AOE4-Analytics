import { useState } from 'react'
import { ArrowRight, ShieldCheck, Swords } from 'lucide-react'
import {
  COUNTER_MATRIX,
  COUNTER_ROLES,
  counterFor,
  whatBeats,
  type UnitRole,
} from '@domain/counters'

/** Beginner counter helper: pick an enemy unit role → see what beats it and what it does. */
export function CounterHelper() {
  const [role, setRole] = useState<UnitRole>('knight')
  const entry = counterFor(role)
  const beats = whatBeats(role)

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Enemy is massing…</label>
        <div className="flex flex-wrap gap-1.5">
          {COUNTER_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
                r === role
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-secondary'
              }`}
            >
              {COUNTER_MATRIX[r].label.replace(/\s*\(.*\)/, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-win/30 bg-win/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-win">
          <ShieldCheck className="h-4 w-4" />
          Counter {entry.label} with
        </h3>
        {beats.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {beats.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => setRole(c.role)}
                className="rounded-md bg-win/15 px-2.5 py-1 text-sm font-medium text-win hover:bg-win/25"
              >
                {c.label.replace(/\s*\(.*\)/, '')}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No hard counter — out-position it and target it with focus fire.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/50 p-4 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <Swords className="h-4 w-4 text-primary" />
          About {entry.label}
        </h3>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{entry.advice}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <CounterList label="Strong against" roles={entry.strongVs} tone="good" />
          <CounterList label="Weak against" roles={entry.weakVs} tone="bad" />
        </div>
      </div>
    </div>
  )
}

function CounterList({
  label,
  roles,
  tone,
}: {
  label: string
  roles: UnitRole[]
  tone: 'good' | 'bad'
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        {roles.map((r) => (
          <span
            key={r}
            className={`rounded px-1.5 py-0.5 text-xs ${
              tone === 'good'
                ? 'bg-win/15 text-win'
                : 'bg-destructive/15 text-destructive'
            }`}
          >
            {COUNTER_MATRIX[r].label.replace(/\s*\(.*\)/, '')}
          </span>
        ))}
      </div>
    </div>
  )
}
