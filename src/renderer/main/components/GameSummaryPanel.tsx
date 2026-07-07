import type { ReactNode } from 'react'
import {
  Activity,
  Clock,
  Coins,
  Hammer,
  LineChart as LineChartIcon,
  Pickaxe,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PerPlayerMatchStats } from '@domain/analysis'
import type {
  BuildEvent,
  MatchSummary,
  PlayerSummary,
  ResourceAmounts,
  ScorePoint,
} from '@domain/statsSummary'
import { civFromToken } from '@domain/statsSummary'
import { villagerGaps, type VillagerProductionRhythm } from '@domain/summaryCoaching'
import { civDisplayName } from '@domain/civ'
import { landmarksForCiv } from '@domain/landmarks'
import { formatDurationShort } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'

const GRID = 'hsl(var(--border))'
const MUTED = 'hsl(var(--muted-foreground))'
// "You" always draws in the accent; the rest stay fixed but distinct from it.
const SERIES_COLORS = ['hsl(var(--primary))', 'hsl(var(--loss))', 'hsl(190, 95%, 50%)', 'hsl(280, 65%, 62%)']
const RESOURCE_KEYS = ['food', 'wood', 'gold', 'stone'] as const

type ResourceKey = (typeof RESOURCE_KEYS)[number]

function playerLabel(p: PlayerSummary): string {
  const slug = civFromToken(p.civToken)
  const civ = slug ? civDisplayName(slug) : (p.civToken ?? 'Unknown')
  if (p.name && !/^\d[\d.]*$/.test(p.name)) return `${p.name} - ${civ}`
  return civ
}

const CATEGORY_STYLE: Record<BuildEvent['category'], string> = {
  unit: 'text-foreground',
  building: 'text-primary',
  upgrade: 'text-warn',
  other: 'text-muted-foreground',
}

/**
 * The full post-game breakdown from the stat summary: exact score/resource
 * totals, age timings, Relic combat counters, trend charts, and each player's
 * timed build order.
 */
export function GameSummaryPanel({
  summary,
  myCiv,
  perPlayer,
  myProfileId,
}: {
  summary: MatchSummary
  /** The signed-in player's civ slug, to highlight "you". */
  myCiv: string | null
  /** Relic comparison counters for combat/production/APM, when available. */
  perPlayer?: PerPlayerMatchStats[]
  myProfileId?: number | null
}) {
  const meFirst = (a: PlayerSummary, b: PlayerSummary) =>
    Number(isMe(b, myProfileId ?? null, myCiv)) - Number(isMe(a, myProfileId ?? null, myCiv))
  const players = [...summary.players].sort(meFirst)
  const me = players.find((p) => isMe(p, myProfileId ?? null, myCiv)) ?? players[0] ?? null
  const colorOf = new Map(players.map((p, i) => [p.playerId, SERIES_COLORS[i % SERIES_COLORS.length]!]))

  const ecoData = mergeSeries(players, (p) =>
    p.resources.map((r) => ({
      t: r.timeSec,
      v: Math.round(totalResources(r.gathered)),
    })),
  )
  const scoreData = mergeSeries(players, (p) =>
    p.scores.map((s) => ({ t: s.timeSec, v: Math.round(s.total) })),
  )

  const hasEco = ecoData.length > 1
  const hasScore = scoreData.length > 1
  const hasBuild = players.some((p) => p.buildOrder.length > 0)
  const myResources = me ? finalResources(me) : null
  const myScore = me ? finalScore(me) : null
  const myTc = me ? villagerGaps(me) : null
  const myVillHigh = me?.totals?.villagerHigh ?? null
  const myAge = me ? ageTimings(me, myCiv) : new Map<2 | 3 | 4, number>()

  return (
    <div className="space-y-4">
      {me && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            icon={<Coins className="h-4 w-4 text-primary" />}
            label="Resources gathered"
            value={myResources ? fmtInt(totalResources(myResources)) : '-'}
            hint={myResources ? resourceLine(myResources) : 'Summary did not include resource totals.'}
          />
          <InsightCard
            icon={<Trophy className="h-4 w-4 text-primary" />}
            label="Score"
            value={myScore ? fmtInt(myScore.total) : '-'}
            hint={myScore ? strongestScoreLane(myScore) : 'No final score split decoded.'}
          />
          <InsightCard
            icon={<Clock className="h-4 w-4 text-primary" />}
            label="Age timing"
            value={formatDurationShort(myAge.get(2))}
            hint={`Castle ${formatDurationShort(myAge.get(3))} / Imperial ${formatDurationShort(myAge.get(4))}`}
          />
          <InsightCard
            icon={<Users className="h-4 w-4 text-primary" />}
            label={myVillHigh != null ? 'Villager high' : 'Town Center rhythm'}
            value={
              myVillHigh != null
                ? `${myVillHigh} villagers`
                : myTc
                  ? `${myTc.villagersMade} vills made`
                  : '-'
            }
            hint={villagerHint(myTc, myVillHigh)}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ScoreTable players={players} />
        <ResourceTable players={players} />
        <AgeTable players={players} myProfileId={myProfileId ?? null} myCiv={myCiv} />
        <CombatTable perPlayer={perPlayer ?? []} players={players} myProfileId={myProfileId ?? null} />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Scores are the game&apos;s last sampled values (up to ~20s before the end screen), so they can
        sit slightly under the score screen&apos;s finals. Resource totals count DELIVERED resources —
        the game&apos;s own screen also credits what villagers were still carrying when the game ended.
      </p>

      {(hasEco || hasScore) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {hasEco && (
            <ChartCard title="Resources over time" icon={<LineChartIcon className="h-4 w-4 text-primary" />}>
              <TimeChart data={ecoData} players={players} colorOf={colorOf} meId={me?.playerId ?? null} />
            </ChartCard>
          )}
          {hasScore && (
            <ChartCard title="Score over time" icon={<Trophy className="h-4 w-4 text-primary" />}>
              <TimeChart data={scoreData} players={players} colorOf={colorOf} meId={me?.playerId ?? null} />
            </ChartCard>
          )}
        </div>
      )}

      {hasBuild && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Hammer className="h-4 w-4 text-primary" /> Build order timeline
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {players.map((p) => (
                <BuildOrderColumn
                  key={p.playerId}
                  player={p}
                  me={isMe(p, myProfileId ?? null, myCiv)}
                  color={colorOf.get(p.playerId)!}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InsightCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

interface TableColumn<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  better?: 'high' | 'low'
  value: (row: T) => number | string | null
  display?: (value: number | string | null, row: T) => string
}

function DataTable<T>({
  title,
  icon,
  rows,
  columns,
  rowKey,
  rowClassName,
  empty,
}: {
  title: string
  icon: ReactNode
  rows: T[]
  columns: TableColumn<T>[]
  rowKey: (row: T, i: number) => string
  rowClassName?: (row: T) => string | undefined
  empty?: string
}) {
  const best = new Map<string, number>()
  for (const col of columns) {
    if (!col.better) continue
    const nums = rows.map((r) => Number(col.value(r))).filter((n) => Number.isFinite(n))
    if (nums.length === 0) continue
    best.set(col.key, col.better === 'low' ? Math.min(...nums) : Math.max(...nums))
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold">
          {icon}
          {title}
        </div>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty ?? 'No data decoded for this table.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border/70">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={cn('rts-ledger-head px-3 py-2', c.align === 'right' ? 'text-right' : 'text-left')}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={rowKey(row, i)} className={cn('border-b border-border/50 last:border-b-0', rowClassName?.(row))}>
                    {columns.map((c) => {
                      const raw = c.value(row)
                      const n = Number(raw)
                      const isBest = c.better && Number.isFinite(n) && n === best.get(c.key)
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            'px-3 py-2 tabular-nums',
                            c.align === 'right' && 'text-right',
                            isBest && 'font-semibold text-primary',
                          )}
                        >
                          {c.display ? c.display(raw, row) : fmtCell(raw)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ScoreTable({ players }: { players: PlayerSummary[] }) {
  const rows = players
    .map((player) => ({ player, score: finalScore(player) }))
    .filter((r): r is { player: PlayerSummary; score: ScorePoint } => r.score != null)
  return (
    <DataTable
      title="Scoreboard"
      icon={<Trophy className="h-4 w-4 text-primary" />}
      rows={rows}
      rowKey={(r) => String(r.player.playerId)}
      columns={[
        { key: 'player', label: 'Player', value: (r) => playerLabel(r.player), display: (_, r) => playerLabel(r.player) },
        { key: 'total', label: 'Total', align: 'right', better: 'high', value: (r) => r.score.total },
        { key: 'military', label: 'Military', align: 'right', better: 'high', value: (r) => r.score.military },
        { key: 'economy', label: 'Economy', align: 'right', better: 'high', value: (r) => r.score.economy },
        { key: 'technology', label: 'Tech', align: 'right', better: 'high', value: (r) => r.score.technology },
        { key: 'society', label: 'Society', align: 'right', better: 'high', value: (r) => r.score.society },
      ]}
    />
  )
}

function ResourceTable({ players }: { players: PlayerSummary[] }) {
  const rows = players
    .map((player) => ({ player, resources: finalResources(player) }))
    .filter((r): r is { player: PlayerSummary; resources: ResourceAmounts } => r.resources != null)
  return (
    <DataTable
      title="Economy"
      icon={<Pickaxe className="h-4 w-4 text-primary" />}
      rows={rows}
      rowKey={(r) => String(r.player.playerId)}
      columns={[
        { key: 'player', label: 'Player', value: (r) => playerLabel(r.player), display: (_, r) => playerLabel(r.player) },
        // Whole numbers, like the game's own screen (raw values are floats).
        { key: 'total', label: 'Total', align: 'right', better: 'high', value: (r) => Math.round(totalResources(r.resources)) },
        { key: 'food', label: 'Food', align: 'right', better: 'high', value: (r) => Math.round(r.resources.food) },
        { key: 'wood', label: 'Wood', align: 'right', better: 'high', value: (r) => Math.round(r.resources.wood) },
        { key: 'stone', label: 'Stone', align: 'right', better: 'high', value: (r) => Math.round(r.resources.stone) },
        { key: 'gold', label: 'Gold', align: 'right', better: 'high', value: (r) => Math.round(r.resources.gold) },
        { key: 'foodRate', label: 'Max food/min', align: 'right', better: 'high', value: (r) => maxGatherRate(r.player, 'food') },
        { key: 'woodRate', label: 'Max wood/min', align: 'right', better: 'high', value: (r) => maxGatherRate(r.player, 'wood') },
      ]}
    />
  )
}

function AgeTable({
  players,
  myProfileId,
  myCiv,
}: {
  players: PlayerSummary[]
  myProfileId: number | null
  myCiv: string | null
}) {
  const rows = players.map((player) => ({
    player,
    timings: ageTimings(player, isMe(player, myProfileId, myCiv) ? myCiv : civFromToken(player.civToken)),
  }))
  return (
    <DataTable
      title="Technology timing"
      icon={<Activity className="h-4 w-4 text-primary" />}
      rows={rows}
      rowKey={(r) => String(r.player.playerId)}
      columns={[
        { key: 'player', label: 'Player', value: (r) => playerLabel(r.player), display: (_, r) => playerLabel(r.player) },
        { key: 'age2', label: 'Age II', align: 'right', better: 'low', value: (r) => r.timings.get(2) ?? null, display: (v) => formatDurationShort(typeof v === 'number' ? v : null) },
        { key: 'age3', label: 'Age III', align: 'right', better: 'low', value: (r) => r.timings.get(3) ?? null, display: (v) => formatDurationShort(typeof v === 'number' ? v : null) },
        { key: 'age4', label: 'Age IV', align: 'right', better: 'low', value: (r) => r.timings.get(4) ?? null, display: (v) => formatDurationShort(typeof v === 'number' ? v : null) },
        {
          key: 'upgrades',
          label: 'Upgrades',
          align: 'right',
          better: 'high',
          value: (r) =>
            r.player.totals?.techResearched ??
            r.player.buildOrder.filter((e) => e.category === 'upgrade').length,
        },
      ]}
    />
  )
}

function CombatTable({
  perPlayer,
  players,
  myProfileId,
}: {
  perPlayer: PerPlayerMatchStats[]
  players: PlayerSummary[]
  myProfileId: number | null
}) {
  const labelByCiv = labelsByCiv(players)
  const rows = [...perPlayer].sort((a, b) => Number(b.profileId === myProfileId) - Number(a.profileId === myProfileId))
  // The game's "Largest Army" lives in the stat-summary header (Relic's counters
  // only carry units PRODUCED, a different stat) — join it in by profile id.
  const largestArmyFor = (profileId: number): number | null =>
    players.find((p) => p.profileId === profileId)?.totals?.largestArmy ?? null
  const villagerHighFor = (profileId: number): number | null =>
    players.find((p) => p.profileId === profileId)?.totals?.villagerHigh ?? null
  return (
    <DataTable
      title="Military and production"
      icon={<Swords className="h-4 w-4 text-primary" />}
      rows={rows}
      rowKey={(r) => String(r.profileId)}
      rowClassName={(r) => (r.profileId === myProfileId ? 'bg-primary/5' : undefined)}
      empty="Relic comparison counters are not attached to this game yet."
      columns={[
        {
          key: 'player',
          label: 'Player',
          value: (r) => combatPlayerLabel(r, labelByCiv, myProfileId),
          display: (_, r) => combatPlayerLabel(r, labelByCiv, myProfileId),
        },
        { key: 'units', label: 'Units made', align: 'right', better: 'high', value: (r) => r.unitsProduced },
        { key: 'army', label: 'Largest army', align: 'right', better: 'high', value: (r) => largestArmyFor(r.profileId) },
        { key: 'villHigh', label: 'Vill high', align: 'right', better: 'high', value: (r) => villagerHighFor(r.profileId) },
        { key: 'kills', label: 'Killed', align: 'right', better: 'high', value: (r) => r.kills },
        { key: 'deaths', label: 'Lost', align: 'right', better: 'low', value: (r) => r.deaths },
        { key: 'kd', label: 'K/D', align: 'right', better: 'high', value: (r) => r.kd },
        { key: 'buildings', label: 'Buildings', align: 'right', better: 'high', value: (r) => r.buildingsProduced },
        { key: 'blost', label: 'Bldgs lost', align: 'right', better: 'low', value: (r) => r.buildingsLost ?? null },
        { key: 'struct', label: 'Struct dmg', align: 'right', better: 'high', value: (r) => r.structureDamage ?? null },
        { key: 'techs', label: 'Techs', align: 'right', better: 'high', value: (r) => r.techsResearched },
        { key: 'apm', label: 'APM', align: 'right', better: 'high', value: (r) => r.apm },
      ]}
    />
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  )
}

interface TimeRow {
  t: number
  [series: string]: number
}

/** Merge each player's (t,v) points into rows keyed by timestamp, one column per player. */
function mergeSeries(
  players: PlayerSummary[],
  pick: (p: PlayerSummary) => { t: number; v: number }[],
): TimeRow[] {
  const byTime = new Map<number, TimeRow>()
  for (const p of players) {
    for (const { t, v } of pick(p)) {
      const row = byTime.get(t) ?? ({ t } as TimeRow)
      row[`p${p.playerId}`] = v
      byTime.set(t, row)
    }
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t)
}

function TimeChart({
  data,
  players,
  colorOf,
  meId,
}: {
  data: TimeRow[]
  players: PlayerSummary[]
  colorOf: Map<number, string>
  meId: number | null
}) {
  return (
    <div className="h-52 w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            stroke={MUTED}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatDurationShort}
          />
          <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} width={44} tickFormatter={fmtK} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              color: 'hsl(var(--popover-foreground))',
              border: `1px solid ${GRID}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: MUTED }}
            labelFormatter={(t) => formatDurationShort(Number(t))}
            formatter={(v, key) => {
              const pid = Number(String(key).slice(1))
              const p = players.find((x) => x.playerId === pid)
              return [Number(v).toLocaleString(), p ? playerLabel(p) : String(key)]
            }}
          />
          {players.map((p) => (
            <Line
              key={p.playerId}
              type="monotone"
              dataKey={`p${p.playerId}`}
              stroke={colorOf.get(p.playerId)}
              strokeWidth={p.playerId === meId ? 2.5 : 1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function BuildOrderColumn({ player, me, color }: { player: PlayerSummary; me: boolean; color: string }) {
  const rows = collapseRuns(player.buildOrder)
  const rhythm = villagerGaps(player)
  return (
    <div className={cn('overflow-hidden rounded-md border border-border', me && 'ring-1 ring-primary/40')}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-sm font-medium">{playerLabel(player)}</span>
        {me && (
          <span className="rounded bg-primary/15 px-1 text-[9px] font-semibold uppercase text-primary">You</span>
        )}
        {rhythm && (
          <span className="ml-auto whitespace-nowrap text-[11px] text-muted-foreground">
            {rhythm.villagersMade} vills
          </span>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline gap-2 px-3 py-1 text-xs">
            <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{formatDurationShort(r.timeSec)}</span>
            <span className={cn('flex-1 truncate', CATEGORY_STYLE[r.category])}>
              {r.name}
              {r.count > 1 && <span className="text-muted-foreground"> x{r.count}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface BuildRun {
  timeSec: number
  name: string
  category: BuildEvent['category']
  count: number
}

/** Merge consecutive same-name events into a single run with a count. */
function collapseRuns(events: BuildEvent[]): BuildRun[] {
  const out: BuildRun[] = []
  for (const e of events) {
    const last = out[out.length - 1]
    if (last && last.name === e.name && last.category === e.category) last.count++
    else out.push({ timeSec: e.timeSec, name: e.name, category: e.category, count: 1 })
  }
  return out
}

/** Profile-id match from the summary header when available; civ as fallback. */
function isMe(p: PlayerSummary, myProfileId: number | null, myCiv: string | null): boolean {
  if (myProfileId != null && p.profileId != null) return p.profileId === myProfileId
  if (!myCiv) return false
  return civFromToken(p.civToken) === myCiv
}

/** Exact end-game totals from the header; last timeline sample only as fallback. */
function finalResources(p: PlayerSummary): ResourceAmounts | null {
  if (p.totals && totalResources(p.totals.resourcesGathered) > 0) return p.totals.resourcesGathered
  const last = [...p.resources].sort((a, b) => a.timeSec - b.timeSec).at(-1)
  return last?.gathered ?? null
}

function finalScore(p: PlayerSummary): ScorePoint | null {
  return [...p.scores].sort((a, b) => a.timeSec - b.timeSec).at(-1) ?? null
}

function totalResources(r: ResourceAmounts): number {
  return RESOURCE_KEYS.reduce((sum, k) => sum + (r[k] ?? 0), 0)
}

/**
 * Peak gather rate — the max of the game's own per-minute series (what the
 * post-match screen calls "Max food/min"). Falls back to extrapolating deltas
 * between cumulative samples for summaries without the per-minute dict.
 */
function maxGatherRate(p: PlayerSummary, key: ResourceKey): number | null {
  let max = 0
  let sawPerMinute = false
  for (const point of p.resources) {
    if (point.perMinute) {
      sawPerMinute = true
      max = Math.max(max, point.perMinute[key])
    }
  }
  if (!sawPerMinute) {
    const points = [...p.resources].sort((a, b) => a.timeSec - b.timeSec)
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!
      const cur = points[i]!
      const dt = cur.timeSec - prev.timeSec
      if (dt <= 0) continue
      const delta = cur.gathered[key] - prev.gathered[key]
      if (delta > 0) max = Math.max(max, (delta / dt) * 60)
    }
  }
  return max > 0 ? Math.round(max) : null
}

function villagerHint(
  tc: VillagerProductionRhythm | null,
  villagerHigh: number | null,
): string {
  const parts: string[] = []
  if (villagerHigh != null && tc) parts.push(`${tc.villagersMade} trained`)
  if (tc) {
    parts.push(
      tc.idleWindows > 0
        ? `${tc.idleWindows} long gap(s), longest ${formatDurationShort(tc.longestGapSec)}`
        : 'no long villager gaps',
    )
  }
  return parts.length > 0 ? parts.join(' · ') : 'No villager production events decoded.'
}

/**
 * Age-up timings. Authoritative source: the summary header's per-age timestamps
 * (what AoE4World displays). Fallback for headerless summaries: first landmark
 * build event matching the civ's landmark options.
 */
function ageTimings(player: PlayerSummary, civ: string | null | undefined): Map<2 | 3 | 4, number> {
  const byAge = new Map<2 | 3 | 4, number>()
  if (player.totals) {
    if (player.totals.age2Sec != null) byAge.set(2, player.totals.age2Sec)
    if (player.totals.age3Sec != null) byAge.set(3, player.totals.age3Sec)
    if (player.totals.age4Sec != null) byAge.set(4, player.totals.age4Sec)
    return byAge
  }
  const plan = landmarksForCiv(civ)
  if (!plan) return byAge
  for (const choice of plan.ages) {
    const names = new Set(choice.options.map(normName))
    for (const e of player.buildOrder) {
      if (e.category !== 'building' || !names.has(normName(e.name))) continue
      const prev = byAge.get(choice.age)
      if (prev == null || e.timeSec < prev) byAge.set(choice.age, e.timeSec)
    }
  }
  return byAge
}

function normName(name: string): string {
  return name.normalize('NFKD').toLowerCase().replace(/[\u2018\u2019'`]/g, '').replace(/[^a-z0-9]+/g, '')
}

function strongestScoreLane(score: ScorePoint): string {
  const entries = [
    ['Military', score.military],
    ['Economy', score.economy],
    ['Technology', score.technology],
    ['Society', score.society],
  ] as const
  const [label, value] = [...entries].sort((a, b) => b[1] - a[1])[0]!
  return `${label} led your score split at ${fmtInt(value)}.`
}

function resourceLine(r: ResourceAmounts): string {
  return `F ${fmtK(r.food)} / W ${fmtK(r.wood)} / G ${fmtK(r.gold)} / S ${fmtK(r.stone)}`
}

function labelsByCiv(players: PlayerSummary[]): Map<string, string> {
  const seen = new Map<string, string | null>()
  for (const p of players) {
    const civ = civFromToken(p.civToken)
    if (!civ) continue
    seen.set(civ, seen.has(civ) ? null : playerLabel(p))
  }
  const out = new Map<string, string>()
  for (const [civ, label] of seen) if (label) out.set(civ, label)
  return out
}

function combatPlayerLabel(
  row: PerPlayerMatchStats,
  labelByCiv: Map<string, string>,
  myProfileId: number | null,
): string {
  if (row.profileId === myProfileId) return 'You'
  if (row.civ) return labelByCiv.get(row.civ) ?? civDisplayName(row.civ)
  return String(row.profileId)
}

function fmtCell(v: number | string | null): string {
  if (v == null) return '-'
  if (typeof v === 'string') return v
  return Number.isInteger(v) ? fmtInt(v) : String(Math.round(v * 10) / 10)
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString()
}

function fmtK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n))
}
