import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowUpDown,
  BookOpen,
  ChevronRight,
  History,
  Info,
  ListOrdered,
  Map as MapIcon,
  ShieldHalf,
  Swords,
  Table2,
} from 'lucide-react'
import type { RankLevel, StatsLeaderboard } from '@api/types'
import type { CivTier, Tier } from '@domain/tierList'
import { TIERS } from '@domain/tierList'
import type { MapStat } from '@domain/mapStats'
import { CIV_PROFILES } from '@data/civProfiles'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import { counterPlanForCiv } from '@domain/civUnits'
import { buildIndexForCiv } from '@domain/buildOrderSchema'
import { COUNTER_MATRIX } from '@domain/counters'
import { civDisplayName } from '@domain/civ'
import { buildPersonalMatchup } from '@domain/matchupLab'
import { filterPersonalHistory } from '@domain/historyFilters'
import {
  formatDurationShort,
  formatLeaderboard,
  formatPercent,
  formatRankLevel,
  relativeTime,
} from '@shared/format'
import { cn } from '@shared/lib/utils'
import { PageHead } from '../components/PageHead'
import { Card, CardContent } from '@shared/components/ui/card'
import { Skeleton } from '@shared/components/ui/skeleton'
import { useCivMeta, useMatchupLab } from '../queries/useCivMeta'
import { useFullHistory } from '../queries/useHistory'
import { useSettings } from '../queries/useProfile'
import { TierBadge } from '../components/TierBadge'
import { EmptyBox, ErrorBox } from '../components/feedback'

const LADDERS: { label: string; value: StatsLeaderboard }[] = [
  { label: 'Ranked 1v1', value: 'rm_solo' },
  { label: 'Quick Match 1v1', value: 'qm_1v1' },
  { label: 'Ranked 2v2', value: 'rm_2v2' },
  { label: 'Ranked 3v3', value: 'rm_3v3' },
  { label: 'Ranked 4v4', value: 'rm_4v4' },
]

const BRACKETS: { label: string; value: RankLevel | undefined }[] = [
  { label: 'All ranks', value: undefined },
  { label: 'Gold', value: 'gold' },
  { label: 'Platinum', value: 'platinum' },
  { label: 'Diamond', value: 'diamond' },
  { label: 'Conqueror', value: 'conqueror' },
]

const TABS = [
  { key: 'tier', label: 'Tier list', icon: ListOrdered },
  { key: 'stats', label: 'Civ stats', icon: Table2 },
  { key: 'matchups', label: 'Matchups', icon: Swords },
  { key: 'maps', label: 'Maps', icon: MapIcon },
] as const
type TabKey = (typeof TABS)[number]['key']

function rankFilterable(lb: StatsLeaderboard): boolean {
  return lb === 'rm_solo' || lb === 'qm_1v1'
}

type SortKey = 'civName' | 'winRate' | 'pickRate' | 'games'

export function CivMeta() {
  // Tab lives in the URL so a refresh or deep link restores it.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'tier'
  const setTab = (key: TabKey) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', key)
        return next
      },
      { replace: true },
    )
  const ladderParam = searchParams.get('ladder')
  const leaderboard: StatsLeaderboard = LADDERS.some((l) => l.value === ladderParam)
    ? (ladderParam as StatsLeaderboard)
    : 'rm_solo'
  const rankParam = searchParams.get('rank')
  const rankLevel = rankFilterable(leaderboard)
    ? BRACKETS.find((b) => b.value === rankParam)?.value
    : undefined
  const setLeaderboard = (value: StatsLeaderboard) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'rm_solo') next.delete('ladder')
        else next.set('ladder', value)
        if (!rankFilterable(value)) next.delete('rank')
        return next
      },
      { replace: true },
    )
  const setRankLevel = (value: RankLevel | undefined) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('rank', value)
        else next.delete('rank')
        return next
      },
      { replace: true },
    )
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'winRate',
    dir: 'desc',
  })

  const { data, isLoading, isFetching, refetch } = useCivMeta({ leaderboard, rankLevel })

  const maps = data?.ok ? data.data.maps : []
  const sortedCivs = useMemo(() => {
    const civs = data?.ok ? data.data.civs : []
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...civs].sort((a, b) => {
      if (sort.key === 'civName') return dir * a.civName.localeCompare(b.civName)
      return dir * (a[sort.key] - b[sort.key])
    })
  }, [data, sort])

  const byTier = useMemo(() => {
    const civs = data?.ok ? data.data.civs : []
    const grouped = Object.fromEntries(TIERS.map((t) => [t, [] as CivTier[]])) as Record<
      Tier,
      CivTier[]
    >
    for (const c of civs) grouped[c.tier].push(c)
    return grouped
  }, [data])

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'civName' ? 'asc' : 'desc' },
    )

  return (
    <div className="animate-fade-in space-y-5">
      <PageHead
        kicker="The living meta"
        title="Civ Meta"
        sub="Live tier list, win/pick rates, matchups, and maps from AoE4World."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === t.key
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={leaderboard}
            onChange={(e) => setLeaderboard(e.target.value as StatsLeaderboard)}
            aria-label="Leaderboard"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LADDERS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={rankLevel ?? ''}
            disabled={!rankFilterable(leaderboard)}
            onChange={(e) => setRankLevel((e.target.value || undefined) as RankLevel | undefined)}
            aria-label="Rank bracket"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {BRACKETS.map((b) => (
              <option key={b.label} value={b.value ?? ''}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!rankFilterable(leaderboard) && (
        <p className="text-xs text-muted-foreground">
          Rank-band filtering isn&apos;t available for team ladders — showing all ranks.
        </p>
      )}

      <div role="tabpanel">
        {tab === 'matchups' ? (
          <MatchupsTab leaderboard={leaderboard} rankLevel={rankLevel} />
        ) : isLoading ? (
          <Skeleton className="h-96" />
        ) : data && !data.ok ? (
          <ErrorBox message={data.error.message} onRetry={() => refetch()} />
        ) : data?.ok ? (
          <div className={cn('space-y-5', isFetching && 'opacity-60')}>
            {tab === 'tier' && <TierTab byTier={byTier} />}
            {tab === 'stats' && <CivStatsTable civs={sortedCivs} sort={sort} onSort={toggleSort} />}
            {tab === 'maps' && <MapTable maps={maps} />}

            <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">
                Live aggregates from AoE4World ({data.data.totalCivGames.toLocaleString()} games in
                this slice). Win rate near 50% is normal — a few points is a real edge across many
                games, but at beginner level your own fundamentals matter far more than civ choice.
                Per-patch history isn&apos;t exposed by the API, so this reflects the current
                dataset.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TierTab({ byTier }: { byTier: Record<Tier, CivTier[]> }) {
  return (
    <div className="space-y-2">
      {TIERS.map((tier) => (
        <div
          key={tier}
          className="flex items-stretch gap-3 rounded-lg border border-border bg-card/40 p-2"
        >
          <div className="flex w-14 shrink-0 items-center justify-center">
            <TierBadge tier={tier} size="lg" />
          </div>
          <div className="flex flex-1 flex-wrap content-start gap-1.5">
            {byTier[tier].length === 0 && (
              <span className="self-center text-xs text-muted-foreground">— none —</span>
            )}
            {byTier[tier].map((c) => (
              <Link
                key={c.civ}
                to={`/civ/${c.civ}`}
                className="group flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-secondary"
                title={`${c.winRate}% win · ${c.pickRate}% pick · ${c.games.toLocaleString()} games`}
              >
                <span className="font-medium group-hover:text-primary">{c.civName}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{c.winRate}%</span>
                {c.lowSample && (
                  <span className="text-[10px] text-warn" title="Low sample size">
                    ⚠
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CivStatsTable({
  civs,
  sort,
  onSort,
}: {
  civs: CivTier[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="rts-ledger-head px-4 py-2.5 text-left">
                <SortBtn label="Civilization" col="civName" sort={sort} onClick={onSort} />
              </th>
              <th className="rts-ledger-head px-2 py-2.5 text-center">Tier</th>
              <th className="rts-ledger-head px-2 py-2.5 text-right">
                <SortBtn label="Win %" col="winRate" sort={sort} onClick={onSort} right />
              </th>
              <th className="rts-ledger-head px-2 py-2.5 text-right">
                <SortBtn label="Pick %" col="pickRate" sort={sort} onClick={onSort} right />
              </th>
              <th className="rts-ledger-head px-4 py-2.5 text-right">
                <SortBtn label="Games" col="games" sort={sort} onClick={onSort} right />
              </th>
            </tr>
          </thead>
          <tbody>
            {civs.map((c) => (
              <CivRow key={c.civ} c={c} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function SortBtn({
  label,
  col,
  sort,
  onClick,
  right,
}: {
  label: string
  col: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onClick: (k: SortKey) => void
  right?: boolean
}) {
  const active = sort.key === col
  return (
    <button
      type="button"
      onClick={() => onClick(col)}
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground',
        right && 'flex-row-reverse',
        active && 'text-foreground',
      )}
    >
      {label}
      <ArrowUpDown className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
    </button>
  )
}

function CivRow({ c }: { c: CivTier }) {
  const wrColor = c.winRate >= 52 ? 'text-win' : c.winRate < 48 ? 'text-loss' : ''
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
      <td className="px-4 py-2">
        <Link to={`/civ/${c.civ}`} className="font-medium hover:text-primary">
          {c.civName}
        </Link>
        {c.lowSample && (
          <span className="ml-1.5 text-[10px] text-warn" title="Low sample size">
            ⚠
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <TierBadge tier={c.tier} />
        </div>
      </td>
      <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', wrColor)}>
        {c.winRate}%
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{c.pickRate}%</td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
        {c.games.toLocaleString()}
      </td>
    </tr>
  )
}

function MapTable({ maps }: { maps: MapStat[] }) {
  if (maps.length === 0) {
    return <EmptyBox>No map stats for this leaderboard yet — try another ladder.</EmptyBox>
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <MapIcon className="h-4 w-4 text-primary" />
          Map pool
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="rts-ledger-head py-2 pr-2 text-left">Map</th>
              <th className="rts-ledger-head px-2 py-2 text-right">Play %</th>
              <th className="rts-ledger-head px-2 py-2 text-right">Avg length</th>
              <th className="rts-ledger-head py-2 pl-2 text-right">Strongest civ</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m.mapId} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-2 font-medium">{m.map}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                  {m.pickRate}%
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                  {formatDurationShort(m.durationAverageSec)}
                </td>
                <td className="py-2 pl-2 text-right text-muted-foreground">
                  {m.bestCivName ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground">
          “Strongest civ” is the single highest-win-rate civ per map (all the API exposes) — not a
          full civ×map table.
        </p>
      </CardContent>
    </Card>
  )
}

const CIVS = Object.values(CIV_PROFILES)
  .map((c) => ({ slug: c.slug, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name))

function CivSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {CIVS.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function MatchupsTab({
  leaderboard,
  rankLevel,
}: {
  leaderboard: StatsLeaderboard
  rankLevel: RankLevel | undefined
}) {
  const [myCiv, setMyCiv] = useState('english')
  const [oppCiv, setOppCiv] = useState('french')
  const [mapFilter, setMapFilter] = useState('')
  const [formatFilter, setFormatFilter] = useState('')

  const global = useMatchupLab({
    civilization: myCiv,
    opponentCivilization: oppCiv,
    leaderboard,
    rankLevel,
  })
  const history = useFullHistory()
  const { data: settings } = useSettings()
  const excludePractice = settings?.localData.excludeAiFromStats ?? false
  const matchup = global.data?.ok ? global.data.data : null
  const wr = matchup?.winRate ?? null
  const isFetching = global.isFetching

  const plan = useMemo(() => counterPlanForCiv(oppCiv), [oppCiv])
  const buildIndex = useMemo(() => buildIndexForCiv(BUNDLED_BUILD_ORDERS, myCiv), [myCiv])
  const build = buildIndex != null ? BUNDLED_BUILD_ORDERS[buildIndex]! : null
  const personalHistory = useMemo(
    () => filterPersonalHistory(history.data?.ok ? history.data.data : [], excludePractice),
    [excludePractice, history.data],
  )
  const personal = useMemo(
    () =>
      buildPersonalMatchup(personalHistory, {
        civilization: myCiv,
        opponentCivilization: oppCiv,
        map: mapFilter || undefined,
        format: formatFilter || undefined,
      }),
    [formatFilter, mapFilter, myCiv, oppCiv, personalHistory],
  )
  const mirror = myCiv === oppCiv

  useEffect(() => {
    setMapFilter('')
    setFormatFilter('')
  }, [myCiv, oppCiv])

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3 rounded-lg border border-border bg-card/50 p-4">
        <CivSelect label="Your civ" value={myCiv} onChange={setMyCiv} />
        <button
          type="button"
          onClick={() => {
            setMyCiv(oppCiv)
            setOppCiv(myCiv)
          }}
          className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Swap"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <CivSelect label="Opponent civ" value={oppCiv} onChange={setOppCiv} />
      </div>

      <section className="rounded-lg border border-border bg-card/60 p-5 text-center">
        <div className="flex items-center justify-center gap-3 text-lg font-semibold">
          <span>{civDisplayName(myCiv)}</span>
          <Swords className="h-4 w-4 text-muted-foreground" />
          <span>{civDisplayName(oppCiv)}</span>
        </div>
        {global.data && !global.data.ok ? (
          <div className="mt-4 text-left">
            <ErrorBox message={global.data.error.message} onRetry={() => global.refetch()} />
          </div>
        ) : wr == null ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {isFetching ? 'Loading matchup…' : 'No matchup data for this pairing.'}
          </p>
        ) : (
          <>
            <div
              className={cn(
                'mt-2 text-4xl font-bold tabular-nums',
                wr >= 50 ? 'text-win' : 'text-loss',
              )}
            >
              {Math.round(wr)}%
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {mirror
                ? 'Mirror match — it comes down to play, not the civ.'
                : `${civDisplayName(myCiv)} directional win rate vs ${civDisplayName(oppCiv)}`}
            </p>
          </>
        )}
        {matchup && (
          <>
            <div className="mt-5 grid gap-2 text-left sm:grid-cols-3">
              <Metric label="Games in sample" value={matchup.games.toLocaleString()} />
              {matchup.durationMedianSec != null && (
                <Metric
                  label="Median duration"
                  value={formatDurationShort(matchup.durationMedianSec)}
                />
              )}
              {matchup.durationAverageSec != null && (
                <Metric
                  label="Average duration"
                  value={formatDurationShort(matchup.durationAverageSec)}
                />
              )}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-md bg-background/60 p-3 text-left text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                {formatLeaderboard(matchup.source.leaderboard)} /{' '}
                {matchup.source.rankLevel ? formatRankLevel(matchup.source.rankLevel) : 'All ranks'}{' '}
                / source patch {matchup.source.patch?.replace(/,/g, ', ') || 'not reported'}.{' '}
                AoE4World&apos;s matchup endpoint does not expose a map filter, so this global
                sample is not map-filtered.
              </p>
            </div>
          </>
        )}
      </section>

      <PersonalMatchupSection
        civilization={myCiv}
        opponentCivilization={oppCiv}
        history={history}
        personal={personal}
        mapFilter={mapFilter}
        formatFilter={formatFilter}
        onMapFilter={setMapFilter}
        onFormatFilter={setFormatFilter}
        excludePractice={excludePractice}
      />

      {plan ? (
        <section className="space-y-3 rounded-lg border border-border bg-card/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldHalf className="h-4 w-4 text-primary" />
            How to beat {civDisplayName(oppCiv)}
          </h2>
          <div className="text-sm text-muted-foreground">
            They rely on{' '}
            <span className="font-medium text-foreground">
              {plan.keyUnits.map((u) => u.name).join(', ')}
            </span>
            .
          </div>
          <div>
            <div className="text-sm">
              Build{' '}
              <span className="font-semibold text-foreground">
                {plan.counters.map((c) => c.label).join(' + ') || '—'}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {plan.counters.map((c) => (
                <li key={c.role} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-medium text-foreground">{c.label}</span> —{' '}
                    {COUNTER_MATRIX[c.role].advice}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No counter data for {civDisplayName(oppCiv)} yet.
        </p>
      )}

      {build && buildIndex != null && (
        <section className="rounded-lg border border-border bg-card/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" />
            Bundled build for {civDisplayName(myCiv)}
          </h2>
          <div className="mt-2 font-semibold">{build.name}</div>
          <p className="mt-1 text-xs text-muted-foreground">{buildMetadata(build)}</p>
          <Link
            to={`/guides?tab=builds&build=${buildIndex}`}
            className="mt-3 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            Open full build
            <ChevronRight className="h-3 w-3" />
          </Link>
        </section>
      )}
    </div>
  )
}

function buildMetadata(build: { name: string }): string {
  const details: string[] = []
  if ('archetype' in build && typeof build.archetype === 'string') {
    details.push(build.archetype)
  }
  if ('difficulty' in build && typeof build.difficulty === 'string') {
    details.push(build.difficulty)
  }
  return details.join(' / ')
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

function PersonalMatchupSection({
  civilization,
  opponentCivilization,
  history,
  personal,
  mapFilter,
  formatFilter,
  onMapFilter,
  onFormatFilter,
  excludePractice,
}: {
  civilization: string
  opponentCivilization: string
  history: ReturnType<typeof useFullHistory>
  personal: ReturnType<typeof buildPersonalMatchup>
  mapFilter: string
  formatFilter: string
  onMapFilter: (value: string) => void
  onFormatFilter: (value: string) => void
  excludePractice: boolean
}) {
  if (history.isLoading) return <Skeleton className="h-48" />
  if (history.data && !history.data.ok) {
    return <ErrorBox message={history.data.error.message} onRetry={() => history.refetch()} />
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card/50 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary" />
            Your stored history
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Exact {civDisplayName(civilization)} vs {civDisplayName(opponentCivilization)} results.
            These local filters do not change the global sample above.
            {excludePractice ? ' Practice games are hidden by your Settings preference.' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={mapFilter}
            onChange={(event) => onMapFilter(event.target.value)}
            aria-label="Personal history map"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">All local maps</option>
            {personal.availableMaps.map((map) => (
              <option key={map} value={map}>
                {map}
              </option>
            ))}
          </select>
          <select
            value={formatFilter}
            onChange={(event) => onFormatFilter(event.target.value)}
            aria-label="Personal history format"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">All local formats</option>
            {personal.availableFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>
      </header>

      {personal.sampleSize === 0 ? (
        <EmptyBox>No matching games in your stored history for these local filters.</EmptyBox>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <strong className="tabular-nums">{personal.sampleSize}</strong>{' '}
              <span className="text-muted-foreground">games</span>
            </span>
            <span className="text-win">
              <strong className="tabular-nums">{personal.wins}</strong> wins
            </span>
            <span className="text-loss">
              <strong className="tabular-nums">{personal.losses}</strong> losses
            </span>
            <span>
              <strong className="tabular-nums">{formatPercent(personal.winRate)}</strong>{' '}
              <span className="text-muted-foreground">decided win rate</span>
            </span>
          </div>

          <div className="divide-y divide-border rounded-md border border-border">
            {personal.matches.slice(0, 10).map((match) => (
              <Link
                key={match.id}
                to={`/game/${encodeURIComponent(match.id)}`}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-secondary/50"
              >
                <span
                  className={cn(
                    'w-5 shrink-0 font-bold',
                    match.result === 'win'
                      ? 'text-win'
                      : match.result === 'loss'
                        ? 'text-loss'
                        : 'text-muted-foreground',
                  )}
                >
                  {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : '-'}
                </span>
                <span className="min-w-36 flex-1 font-medium">{match.map}</span>
                <span className="text-xs text-muted-foreground">
                  {match.format ?? 'Unknown format'} / {formatDurationShort(match.durationSec)} /{' '}
                  {relativeTime(match.playedAt) || 'Date unavailable'}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
          {personal.matches.length > 10 && (
            <p className="text-xs text-muted-foreground">
              Showing the 10 most recent of {personal.matches.length} matching games.
            </p>
          )}
        </>
      )}
    </section>
  )
}
