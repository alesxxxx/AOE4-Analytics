import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  ArrowUpDown,
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
import { counterPlanForCiv } from '@domain/civUnits'
import { COUNTER_MATRIX } from '@domain/counters'
import { civDisplayName } from '@domain/civ'
import { ipc } from '@shared/ipc'
import { formatDurationShort } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { PageHead } from '../components/PageHead'
import { Card, CardContent } from '@shared/components/ui/card'
import { Skeleton } from '@shared/components/ui/skeleton'
import { useCivMeta } from '../queries/useCivMeta'
import { TierBadge } from '../components/TierBadge'
import { ErrorBox } from '../components/feedback'

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
  const [tab, setTab] = useState<TabKey>('tier')
  const [leaderboard, setLeaderboard] = useState<StatsLeaderboard>('rm_solo')
  const [bracketIdx, setBracketIdx] = useState(0)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'winRate',
    dir: 'desc',
  })

  const rankLevel = rankFilterable(leaderboard) ? BRACKETS[bracketIdx]!.value : undefined
  const { data, isLoading, isFetching, refetch } = useCivMeta({ leaderboard, rankLevel })

  const maps = data?.ok ? data.data.maps : []
  const showFilter = tab !== 'matchups'

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
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
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
        {showFilter && (
          <div className="flex flex-wrap gap-2">
            <select
              value={leaderboard}
              onChange={(e) => setLeaderboard(e.target.value as StatsLeaderboard)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LADDERS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <select
              value={bracketIdx}
              disabled={!rankFilterable(leaderboard)}
              onChange={(e) => setBracketIdx(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {BRACKETS.map((b, i) => (
                <option key={b.label} value={i}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showFilter && !rankFilterable(leaderboard) && (
        <p className="text-xs text-muted-foreground">
          Rank-band filtering isn&apos;t available for team ladders — showing all ranks.
        </p>
      )}

      {tab === 'matchups' ? (
        <MatchupsTab />
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
              Per-patch history isn&apos;t exposed by the API, so this reflects the current dataset.
            </p>
          </div>
        </div>
      ) : null}
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
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">
                <SortBtn label="Civilization" col="civName" sort={sort} onClick={onSort} />
              </th>
              <th className="px-2 py-2.5 text-center font-medium">Tier</th>
              <th className="px-2 py-2.5 text-right font-medium">
                <SortBtn label="Win %" col="winRate" sort={sort} onClick={onSort} right />
              </th>
              <th className="px-2 py-2.5 text-right font-medium">
                <SortBtn label="Pick %" col="pickRate" sort={sort} onClick={onSort} right />
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
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
  if (maps.length === 0) return null
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <MapIcon className="h-4 w-4 text-primary" />
          Map pool
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Map</th>
              <th className="px-2 py-2 text-right font-medium">Play %</th>
              <th className="px-2 py-2 text-right font-medium">Avg length</th>
              <th className="py-2 pl-2 text-right font-medium">Strongest civ</th>
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

function MatchupsTab() {
  const [myCiv, setMyCiv] = useState('english')
  const [oppCiv, setOppCiv] = useState('french')

  const { data: wr, isFetching } = useQuery({
    queryKey: ['matchup', myCiv, oppCiv],
    queryFn: () => ipc.getMatchupWinRate(myCiv, oppCiv),
    staleTime: 6 * 60 * 60 * 1000,
  })

  const plan = useMemo(() => counterPlanForCiv(oppCiv), [oppCiv])
  const mirror = myCiv === oppCiv

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
        {wr == null ? (
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
                : `${civDisplayName(myCiv)} win rate vs ${civDisplayName(oppCiv)} (ranked 1v1, all ranks)`}
            </p>
          </>
        )}
      </section>

      {plan ? (
        <section className="space-y-3 rounded-lg border border-border bg-card/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldHalf className="h-4 w-4 text-cyan-400" />
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
    </div>
  )
}
