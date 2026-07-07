import { Monitor, MonitorX } from 'lucide-react'
import type { BuildOrder, BuildStep } from '@domain/buildOrderSchema'
import { parseNote, buildOrderCivLabel } from '@domain/buildOrderSchema'
import { CIV_PROFILES } from '@data/civProfiles'
import { ipc } from '@shared/ipc'
import { useSettings, useUpdateSettings } from '../queries/useProfile'

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
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  // Bundled builds are keyed by their unique name (validated by the test suite).
  const inOverlay = settings?.overlay.buildOrderId === bo.name
  const toggleOverlayPin = () => {
    update.mutate(
      { overlay: { buildOrderId: inOverlay ? null : bo.name } },
      { onSuccess: () => void ipc.applyOverlaySettings() },
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{bo.name}</div>
          <div className="text-xs text-muted-foreground">
            {buildOrderCivLabel(bo)}
            {bo.author ? ` · ${bo.author}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            disabled={!settings}
            onClick={toggleOverlayPin}
            title={
              inOverlay
                ? 'Stop showing this build on the in-game overlay'
                : 'Show this build step-by-step on the in-game overlay during matches'
            }
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              inOverlay
                ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {inOverlay ? <MonitorX className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            {inOverlay ? 'Remove from overlay' : 'Show in overlay'}
          </button>
          <span className="text-[11px] text-muted-foreground">{bo.build_order.length} steps</span>
        </div>
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
