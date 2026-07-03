import type { BuildOrder, BuildStep } from '@domain/buildOrderSchema'
import { parseNote, buildOrderCivLabel } from '@domain/buildOrderSchema'
import { CIV_PROFILES } from '@data/civProfiles'

const AGE_NAMES: Record<number, string> = { 1: 'Dark', 2: 'Feudal', 3: 'Castle', 4: 'Imperial' }

/** The civ's one-line win condition (P14), matched from the build's civ label. */
function focusForBuild(bo: BuildOrder): string | null {
  const label = buildOrderCivLabel(bo).toLowerCase()
  return Object.values(CIV_PROFILES).find((p) => p.name.toLowerCase() === label)?.focus ?? null
}

/** Renders a note's text, with icon tokens degraded to their (text) stem. */
function renderNote(note: string) {
  return parseNote(note).map((part, i) =>
    part.type === 'text' ? (
      <span key={i}>{part.text}</span>
    ) : (
      <span key={i} className="font-medium text-primary">
        {part.path
          .split('/')
          .pop()
          ?.replace(/\.\w+$/, '')
          .replace(/[-_]/g, ' ')}
      </span>
    ),
  )
}

function ResourceSplit({ r }: { r: BuildStep['resources'] }) {
  const items: [string, number, string][] = [
    ['F', r.food, 'text-emerald-400'],
    ['W', r.wood, 'text-lime-500'],
    ['G', r.gold, 'text-amber-400'],
    ['S', r.stone, 'text-stone-400'],
  ]
  if (r.builder) items.push(['B', r.builder, 'text-sky-400'])
  return (
    <span className="flex gap-1.5">
      {items
        .filter(([, n]) => n > 0)
        .map(([k, n, color]) => (
          <span key={k} className={`tabular-nums ${color}`}>
            {k}
            {n}
          </span>
        ))}
    </span>
  )
}

export function BuildOrderViewer({ bo }: { bo: BuildOrder }) {
  const focus = focusForBuild(bo)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="font-semibold">{bo.name}</div>
          <div className="text-xs text-muted-foreground">
            {buildOrderCivLabel(bo)}
            {bo.author ? ` · ${bo.author}` : ''}
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">{bo.build_order.length} steps</span>
      </div>
      {focus && (
        <div className="border-b border-border bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-primary">Win condition:</span> {focus}
        </div>
      )}
      <ol className="divide-y divide-border">
        {bo.build_order.map((step, i) => (
          <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
            <div className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span className="font-mono text-xs text-muted-foreground">
                {step.time ?? `#${i + 1}`}
              </span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {AGE_NAMES[step.age] ?? `Age ${step.age}`}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="tabular-nums">{step.villager_count} vills</span>
                <ResourceSplit r={step.resources} />
              </div>
              <ul className="space-y-0.5 leading-snug">
                {step.notes.map((n, j) => (
                  <li key={j}>{renderNote(n)}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
