import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  X,
  Eye,
  Swords,
  TrendingUp,
  TrendingDown,
  Map as MapIcon,
} from 'lucide-react'
import { CIV_PROFILES } from '@data/civProfiles'
import { unitsForCiv, type VendoredUnit } from '@data/gameData'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import type { BuildOrder } from '@domain/buildOrderSchema'
import { roleFromUnit, counterFor } from '@domain/counters'
import type { CivMatchup } from '@domain/civDetailStats'
import { computePlayerStats, type StatGame } from '@domain/playerStats'
import { civDisplayName } from '@domain/civ'
import { Badge } from '@shared/components/ui/badge'
import { Card, CardContent } from '@shared/components/ui/card'
import { BuildOrderViewer } from '../components/BuildOrderViewer'
import { StatTile } from '../components/StatTile'
import { WinRateBar } from '../components/WinRateBar'
import { TierBadge } from '../components/TierBadge'
import { useCivDetailStats } from '../queries/useCivDetailStats'
import { LandmarkPlan } from '../components/LandmarkPlan'
import { useHistory } from '../queries/useHistory'
import { useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

const DIFFICULTY_VARIANT = {
  easy: 'success',
  medium: 'default',
  hard: 'destructive',
} as const

export function CivDetail() {
  const { slug = '' } = useParams()
  const profile = CIV_PROFILES[slug]

  if (!profile) {
    return (
      <div className="animate-fade-in space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">Unknown civilization: {slug}</p>
      </div>
    )
  }

  const builds = BUNDLED_BUILD_ORDERS.filter(
    (bo) => String(bo.civilization).toLowerCase() === profile.name.toLowerCase(),
  ) as unknown as BuildOrder[]
  const units = unitsForCiv(slug)
  const keyUnits = pickKeyUnits(units)

  return (
    <div className="animate-fade-in space-y-6">
      <BackLink />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
          <Badge variant={DIFFICULTY_VARIANT[profile.difficulty]}>{profile.difficulty}</Badge>
        </div>
        <p className="text-sm text-primary">{profile.focus}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{profile.summary}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {profile.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <CivMetaSection slug={slug} />

      <LandmarkPlan civ={slug} />

      <LandmarkStatsCard civ={slug} />

      <LandmarkRecordCard civ={slug} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-win">Strengths</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {profile.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-win" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-destructive">Weaknesses</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {profile.weaknesses.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Recommended opening">{profile.opening}</InfoCard>
        <InfoCard title="Game plan">{profile.gamePlan}</InfoCard>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Eye className="h-4 w-4 text-primary" />
            Facing {profile.name}? Watch for
          </h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {profile.watchFor.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {w}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {builds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Recommended build orders</h2>
          {builds.map((bo, i) => (
            <BuildOrderViewer key={i} bo={bo} />
          ))}
        </section>
      )}

      {keyUnits.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Swords className="h-4 w-4" />
            Key units
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {keyUnits.map((u) => (
              <UnitCard key={u.id} unit={u} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/civ-meta"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Civ Meta
    </Link>
  )
}

/** Live meta stats for the civ: global + your personal win rate, matchups, maps. */
function CivMetaSection({ slug }: { slug: string }) {
  const { data, isLoading } = useCivDetailStats(slug)
  const { data: history } = useHistory()

  const stats = data?.ok ? data.data : null

  // Your personal win rate with this civ, from synced history.
  const matches = history?.ok ? history.data : []
  const games: StatGame[] = matches.map((m) => ({
    result: m.result,
    civ: m.civ,
    oppCiv: m.oppCiv,
    map: m.map,
    durationSec: m.durationSec,
    ratingDiff: m.ratingDiff,
    format: m.format,
    playedAt: m.playedAt,
  }))
  const mine = computePlayerStats(games).byCiv.find((b) => b.key === slug) ?? null

  if (isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-lg border border-border bg-card/40" aria-hidden />
    )
  }

  const hasMeta = stats != null && stats.winRate != null
  if (!hasMeta && !mine) return null

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Win rate (ranked)"
          value={
            stats?.winRate != null ? (
              <span className="flex items-center gap-2">
                {stats.winRate}%{stats.tier && <TierBadge tier={stats.tier} />}
              </span>
            ) : (
              '—'
            )
          }
          sub={stats?.games ? `${stats.games.toLocaleString()} games` : 'no meta data'}
        />
        <StatTile label="Pick rate" value={stats?.pickRate != null ? `${stats.pickRate}%` : '—'} />
        <StatTile
          label="Your win rate"
          value={mine?.winRate != null ? `${mine.winRate}%` : '—'}
          sub={mine ? `${mine.games} of your games` : 'play it to track'}
        />
        <StatTile
          label="Your record"
          value={mine ? `${mine.wins}–${mine.losses}` : '—'}
          sub={mine ? 'W–L with this civ' : undefined}
        />
      </div>

      {stats && (stats.best.length > 0 || stats.worst.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <MatchupList
            title="Best matchups"
            icon={<TrendingUp className="h-4 w-4 text-win" />}
            rows={stats.best}
          />
          <MatchupList
            title="Toughest matchups"
            icon={<TrendingDown className="h-4 w-4 text-loss" />}
            rows={stats.worst}
          />
        </div>
      )}

      {stats && stats.strongMaps.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <MapIcon className="h-4 w-4 text-primary" />
              Strongest on these maps
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {stats.strongMaps.map((m) => (
                <span
                  key={m}
                  className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {m}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Maps where {civDisplayName(slug)} has the highest win rate of any civ.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function MatchupList({
  title,
  icon,
  rows,
}: {
  title: string
  icon: React.ReactNode
  rows: CivMatchup[]
}) {
  if (rows.length === 0) return null
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        <div className="space-y-0.5">
          {rows.map((r) => (
            <Link
              key={r.civ}
              to={`/civ/${r.civ}`}
              className="-mx-2 flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-secondary/70 hover:text-primary"
            >
              <span>{r.civName}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-xs text-muted-foreground">{r.games.toLocaleString()}g</span>
                <WinRateBar winRate={r.winRate} className="w-28 shrink-0" />
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  )
}

function UnitCard({ unit }: { unit: VendoredUnit }) {
  const role = roleFromUnit(unit)
  const counter = role ? counterFor(role) : null
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{unit.name}</span>
        {unit.unique && <Badge variant="outline">unique</Badge>}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{unit.displayClasses[0] ?? '—'}</div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {unit.hitpoints != null && <span>{unit.hitpoints} HP</span>}
        {unit.attack && (
          <span>
            {unit.attack.damage} {unit.attack.type} atk
          </span>
        )}
        {unit.costs && unit.costs.total > 0 && <span>{unit.costs.total} res</span>}
      </div>
      {counter && counter.weakVs.length > 0 && (
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          Countered by:{' '}
          <span className="text-destructive/90">{counter.weakVs.slice(0, 3).join(', ')}</span>
        </div>
      )}
    </div>
  )
}

/** Picks a beginner-friendly set of a civ's units: a few per age, prioritising core combat roles. */
function pickKeyUnits(units: VendoredUnit[]): VendoredUnit[] {
  const seen = new Set<string>()
  const out: VendoredUnit[] = []
  for (const u of units) {
    const role = roleFromUnit(u)
    if (!role) continue
    if (seen.has(role) && out.length > 6) continue
    seen.add(role)
    out.push(u)
    if (out.length >= 9) break
  }
  return out
}

/**
 * YOUR per-landmark record, computed from the landmark build events decoded out
 * of your own games' stat files. Shown because no public dataset tracks global
 * landmark win rates (AoE4World aggregates at civ level only) — this is the
 * honest, personal version.
 */
function LandmarkRecordCard({ civ }: { civ: string }) {
  const { data } = useQuery({
    queryKey: ['landmarkRecord', civ],
    queryFn: () => ipc.getLandmarkRecord(civ),
    staleTime: 60_000,
  })
  const rows = data?.ok ? data.data : []
  if (rows.length === 0) return null
  const totalGames = Math.max(...rows.map((r) => r.games))
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm">Your landmark record</h3>
          <span className="text-[11px] text-muted-foreground">
            from your synced {civDisplayName(civ)} games — small sample, real data
          </span>
        </div>
        <div className="overflow-x-auto rounded-sm border border-border/70">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-background/40">
                <th className="rts-ledger-head px-3 py-2 text-left">Landmark</th>
                <th className="rts-ledger-head px-2 py-2 text-left">Age</th>
                <th className="rts-ledger-head px-2 py-2 text-left">Results</th>
                <th className="rts-ledger-head px-3 py-2 text-right">Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.landmark} className="border-b border-border/50 last:border-b-0">
                  <td className="px-3 py-2 font-medium">{r.landmark}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {r.age === 2 ? 'Feudal' : r.age === 3 ? 'Castle' : 'Imperial'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="min-w-28">
                      <WinRateBar winRate={r.games >= 2 ? r.winRate : null} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.wins}W–{r.losses}L
                    {r.games >= 2 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{r.winRate}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalGames < 5 && (
          <p className="text-[11px] text-muted-foreground">
            Win rates firm up as you play more games with this civ — under ~5 games per landmark
            is a hint, not a verdict.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * GLOBAL landmark pick & win rates from AoE4World's ageup analytics — real
 * ladder data (ranked 1v1, current-patch sampled dataset). Aggregated across
 * every age-up path so each landmark's record covers all games that built it.
 */
function LandmarkStatsCard({ civ }: { civ: string }) {
  const { data } = useQuery({
    queryKey: ['landmarkStats', civ],
    queryFn: () => ipc.getLandmarkStats(civ),
    staleTime: 60 * 60_000,
  })
  const rows = data?.ok ? data.data : []
  if (rows.length === 0) return null
  const fmtUp = (sec: number | null) =>
    sec == null ? '—' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm">Landmark pick &amp; win rates</h3>
          <span className="text-[11px] text-muted-foreground">
            AoE4World analytics · ranked 1v1 · current patch (sampled dataset)
          </span>
        </div>
        <div className="overflow-x-auto rounded-sm border border-border/70">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-background/40">
                <th className="rts-ledger-head px-3 py-2 text-left">Landmark</th>
                <th className="rts-ledger-head px-2 py-2 text-left">Age</th>
                <th className="rts-ledger-head px-2 py-2 text-right">Pick rate</th>
                <th className="rts-ledger-head px-2 py-2 text-left">Win rate</th>
                <th className="rts-ledger-head px-2 py-2 text-right">Games</th>
                <th className="rts-ledger-head px-3 py-2 text-right">Avg age-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.age}-${r.name}`} className="border-b border-border/50 last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      {r.icon && <img src={r.icon} alt="" className="h-6 w-6 rounded-sm object-contain" />}
                      {r.name}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {r.age === 2 ? 'Feudal' : r.age === 3 ? 'Castle' : 'Imperial'}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.pickRate}%</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-24 flex-1">
                        <WinRateBar winRate={r.winRate} />
                      </div>
                      <span className="w-12 text-right tabular-nums text-xs">{r.winRate}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {r.games.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtUp(r.avgAgeUpSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A low-pick landmark with a high win rate is often a hidden gem for specific matchups —
          pick rate measures popularity, not strength.
        </p>
      </CardContent>
    </Card>
  )
}
