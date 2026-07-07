import { useSearchParams } from 'react-router-dom'
import { BookOpen, ListOrdered, Shield, Sparkles, ArrowLeft, Clock } from 'lucide-react'
import { GUIDES, type Guide } from '@data/guides'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import type { BuildOrder } from '@domain/buildOrderSchema'
import { buildOrderCivLabel } from '@domain/buildOrderSchema'
import { Markdown } from '@shared/components/Markdown'
import { Card, CardContent } from '@shared/components/ui/card'
import { Badge } from '@shared/components/ui/badge'
import { PageHead } from '../components/PageHead'
import { BuildOrderViewer } from '../components/BuildOrderViewer'
import { CounterHelper } from '../components/tools/CounterHelper'
import { CivQuiz } from '../components/tools/CivQuiz'

type Tab = 'guides' | 'builds' | 'counters' | 'quiz'

const TABS = [
  { id: 'guides', label: 'Guides', icon: BookOpen },
  { id: 'builds', label: 'Build Orders', icon: ListOrdered },
  { id: 'counters', label: 'Counter Helper', icon: Shield },
  { id: 'quiz', label: 'Civ Quiz', icon: Sparkles },
] as const

export function Guides() {
  // Tab lives in the URL so a refresh or deep link restores it.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'guides'
  const setTab = (id: Tab) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', id)
        return next
      },
      { replace: true },
    )

  return (
    <div className="animate-fade-in space-y-6">
      <PageHead
        kicker="Library"
        title="Guides & Tools"
        sub="Beginner tactics, build orders, a counter helper, and a civ-picker quiz."
      />

      <div className="flex gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {tab === 'guides' && <GuideLibrary />}
        {tab === 'builds' && <BuildLibrary />}
        {tab === 'counters' && <CounterHelper />}
        {tab === 'quiz' && <CivQuiz />}
      </div>
    </div>
  )
}

function GuideLibrary() {
  // The open guide lives in the URL (`?guide=slug`) so it survives a refresh.
  const [searchParams, setSearchParams] = useSearchParams()
  const guideSlug = searchParams.get('guide')
  const active = guideSlug != null ? (GUIDES.find((g) => g.slug === guideSlug) ?? null) : null
  const setActive = (g: Guide | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (g) next.set('guide', g.slug)
        else next.delete('guide')
        return next
      },
      { replace: true },
    )

  if (active) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActive(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All guides
        </button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{active.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{active.category}</Badge>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {active.readMinutes} min
            </span>
          </div>
        </div>
        <Card>
          <CardContent className="p-5">
            <Markdown content={active.body} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {GUIDES.map((g) => (
        <button key={g.slug} type="button" onClick={() => setActive(g)} className="text-left">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="space-y-1.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{g.title}</h3>
                <Badge variant="secondary">{g.category}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{g.summary}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {g.readMinutes} min read
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  )
}

const DIFFICULTY_TONE: Record<string, string> = {
  easy: 'bg-win/15 text-win',
  medium: 'bg-warn/15 text-warn',
  hard: 'bg-loss/15 text-loss',
}

/**
 * The build library, organized BY CIV. The primary builds are curated from
 * aoe4guides' top-scored community builds (research pass, authors credited);
 * each carries a reasoning line for why it earned its slot.
 */
function BuildLibrary() {
  const builds = BUNDLED_BUILD_ORDERS as unknown as BuildOrder[]
  // The selected build lives in the URL (`?build=index`) so it survives a refresh.
  const [searchParams, setSearchParams] = useSearchParams()
  const rawIdx = Number(searchParams.get('build'))
  const idx = Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < builds.length ? rawIdx : 0
  const setIdx = (i: number) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('build', String(i))
        return next
      },
      { replace: true },
    )
  const active = builds[idx]

  // Group by primary civ label, keeping library order within each group.
  const groups = new Map<string, { bo: BuildOrder; i: number }[]>()
  builds.forEach((bo, i) => {
    const civ = buildOrderCivLabel(bo)
    const list = groups.get(civ) ?? []
    list.push({ bo, i })
    groups.set(civ, list)
  })
  const civNames = [...groups.keys()].sort((a, b) => a.localeCompare(b))

  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {civNames.map((civ) => (
          <div key={civ} className="space-y-1">
            <div className="rts-ledger-head">{civ}</div>
            {groups.get(civ)!.map(({ bo, i }) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`flex w-full items-center gap-2 rounded-sm border px-2.5 py-1.5 text-left text-sm transition-colors ${
                  i === idx
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{bo.name}</span>
                {bo.archetype && (
                  <span className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {bo.archetype}
                  </span>
                )}
                {bo.difficulty && (
                  <span
                    className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${DIFFICULTY_TONE[bo.difficulty] ?? ''}`}
                  >
                    {bo.difficulty}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {active?.reasoning && (
        <div className="rounded-sm border border-border bg-card/60 px-4 py-3">
          <div className="rts-ledger-head mb-1">Why this build</div>
          <p className="text-sm leading-relaxed text-muted-foreground">{active.reasoning}</p>
          {active.source && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Build by <span className="text-foreground">{active.author ?? 'community'}</span> —
              curated from{' '}
              <a
                href={active.source}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                aoe4guides.com
              </a>
              . Curation: we pull only the top-scored builds that match proven meta archetypes;
              step timings are the author&apos;s.
            </p>
          )}
        </div>
      )}

      {active && <BuildOrderViewer bo={active} />}
    </div>
  )
}
