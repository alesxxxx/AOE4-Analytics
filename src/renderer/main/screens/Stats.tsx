import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Clock,
  Map as MapIcon,
  Swords,
  Hourglass,
  RefreshCw,
  ChevronRight,
  Filter,
} from 'lucide-react'
import type { StoredMatch } from '@store/historyStore'
import { filterPersonalHistory } from '@domain/historyFilters'
import { resourcesPerMinute, resultFromPerPlayer, villagersPerMinute } from '@domain/analysis'
import type { BenchmarkGame } from '@domain/benchmarkLens'
import { computePlayerStats, type Breakdown, type StatGame } from '@domain/playerStats'
import { computePlaystyle, type PlaystyleGame } from '@domain/playstyle'
import {
  computeProfileOverview,
  type PerformanceTiles,
  type ProfileGame,
} from '@domain/profileOverview'
import { computeTrends, type TrendGame } from '@domain/trends'
import type { RankInfo } from '@domain/types'
import { civDisplayName, teamCivLabel } from '@domain/civ'
import { formatDurationShort, relativeTime } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'
import { useHistory, useAnalyzeRecent } from '../queries/useHistory'
import { useDashboard, useSettings, useUpdateSettings } from '../queries/useProfile'
import { WinRateBar } from '../components/WinRateBar'
import { RatingChart } from '../components/RatingChart'
import { PlaystyleRadar } from '../components/PlaystyleRadar'
import { StatTile } from '../components/StatTile'
import { CivOverviewTable, ProfileIdentityCard } from '../components/ProfileOverview'
import { PageHead } from '../components/PageHead'
import { BenchmarkLens } from '../components/BenchmarkLens'
import { EmptyBox, Spinner, ErrorBox } from '../components/feedback'

export function Stats() {
  const { data, isLoading, refetch } = useHistory()
  const { data: settings } = useSettings()
  const { data: dash } = useDashboard(settings?.profileId != null)
  const analyze = useAnalyzeRecent()
  const updateSettings = useUpdateSettings()
  const excludeAi = settings?.localData.excludeAiFromStats ?? false
  const matches = useMemo(
    () => filterPersonalHistory(data?.ok ? data.data : [], excludeAi),
    [data, excludeAi],
  )

  return (
    <div className="animate-fade-in space-y-6">
      <PageHead
        kicker="Chronicle"
        title="My Stats"
        sub="Your playstyle, win-rate breakdowns, and game-by-game history."
        aside={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={!settings || updateSettings.isPending}
              onClick={() => {
                if (!settings) return
                updateSettings.mutate({
                  localData: {
                    ...settings.localData,
                    excludeAiFromStats: !excludeAi,
                  },
                })
              }}
              aria-pressed={excludeAi}
              title="Keep AI and custom practice games out of the stats on this page"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                excludeAi
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {excludeAi ? 'Practice games hidden' : 'Hide AI / custom'}
            </button>
            <button
              type="button"
              onClick={() => analyze.mutate(20)}
              disabled={analyze.isPending}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', analyze.isPending && 'animate-spin')} />
              {analyze.isPending ? 'Analyzing…' : 'Sync recent games'}
            </button>
          </div>
        }
      />

      {analyze.data && !analyze.data.ok && (
        <ErrorBox message={analyze.data.error.message} onRetry={() => analyze.mutate(20)} />
      )}
      {analyze.data?.ok && (
        <p className="text-xs text-muted-foreground">
          Analyzed {analyze.data.data.analyzed} new game(s) · {analyze.data.data.total} total ·
          storage: {analyze.data.data.backend}
        </p>
      )}

      {isLoading && <Spinner />}
      {!isLoading && data && !data.ok && (
        <ErrorBox message={data.error.message} onRetry={() => refetch()} />
      )}

      {!isLoading && data?.ok && matches.length === 0 && (
        <EmptyBox>
          <div className="space-y-1">
            <p>No analyzed games yet.</p>
            <p className="text-xs">Click “Sync recent games” to pull and analyze your matches.</p>
          </div>
        </EmptyBox>
      )}

      {!isLoading && matches.length > 0 && (
        <Content
          matches={matches}
          profileId={settings?.profileId ?? null}
          identity={
            dash?.ok
              ? { name: dash.data.name, country: dash.data.country, primary: dash.data.primary }
              : null
          }
        />
      )}
    </div>
  )
}

function Content({
  matches,
  profileId,
  identity,
}: {
  matches: StoredMatch[]
  profileId: number | null
  identity: { name: string; country: string | null; primary: RankInfo | null } | null
}) {
  const s = useMemo(() => {
    const games: StatGame[] = matches.map((m) => ({
      result: displayedResult(m, profileId),
      civ: m.civ,
      oppCiv: m.oppCiv,
      map: m.map,
      durationSec: m.durationSec,
      ratingDiff: m.ratingDiff,
      format: m.format,
      playedAt: m.playedAt,
    }))
    return computePlayerStats(games, { civLabel: civDisplayName })
  }, [matches, profileId])

  const playstyle = useMemo(() => {
    const playstyleGames: PlaystyleGame[] = matches.map((m) => {
      const mine = m.perPlayer?.find((p) => p.profileId === profileId)
      return {
        result: displayedResult(m, profileId),
        civ: m.civ,
        durationSec: m.durationSec,
        apm: mine?.apm ?? m.analysis.apm,
        // A grade from a 0-villager parse-miss game is bogus — don't feed it to the radar.
        grade: (m.local?.villagersProduced ?? 0) > 0 ? m.analysis.grade : null,
        local: m.local,
        kd: mine?.kd ?? null,
        deaths: mine?.deaths ?? null,
        unitsProduced: mine?.unitsProduced ?? null,
        techsResearched: mine?.techsResearched ?? null,
      }
    })
    return computePlaystyle(playstyleGames)
  }, [matches, profileId])

  const overview = useMemo(() => {
    const profileGames: ProfileGame[] = matches.map((m) => ({
      civ: m.civ,
      result: displayedResult(m, profileId),
      ratingDiff: m.ratingDiff,
      durationSec: m.durationSec,
      local: m.local,
      perPlayer: m.perPlayer,
    }))
    return computeProfileOverview(profileGames, profileId)
  }, [matches, profileId])

  // Recent-window trends (rating momentum) for the tiles' delta arrows.
  const trends = useMemo(() => {
    const trendGames: TrendGame[] = matches.map((m) => ({
      result: displayedResult(m, profileId),
      rating: m.rating,
      ratingDiff: m.ratingDiff,
      durationSec: m.durationSec,
    }))
    return computeTrends(trendGames)
  }, [matches, profileId])

  const r = s.recent2w
  const recentWr = r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : null
  const benchmarkGames = useMemo<BenchmarkGame[]>(
    () =>
      matches.map((match) => {
        const mine = match.perPlayer?.find((player) => player.profileId === profileId)
        return {
          playedAt: match.playedAt,
          result: displayedResult(match, profileId),
          civ: match.civ,
          map: match.map,
          format: match.format ?? null,
          apm: mine?.apm ?? match.analysis.apm,
          resourcesPerMinute: resourcesPerMinute(match.local),
          villagersPerMinute: villagersPerMinute(match.local),
        }
      }),
    [matches, profileId],
  )

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ProfileIdentityCard
          identity={identity}
          totalGames={s.totalGames}
          wins={s.wins}
          losses={s.losses}
          winRate={s.winRate}
          longestWinStreak={s.longestWinStreak}
          longestLossStreak={s.longestLossStreak}
          tags={playstyle.tags}
        />
        <PlaystyleRadar profile={playstyle} showTags={false} />
      </div>

      {/* One performance panel: averages, the rating curve, and the recent-
          fortnight record — instead of three stacked cards. */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              Performance
            </h3>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Last 2 weeks: {r.games} games · {r.wins}W–{r.losses}L
              {recentWr != null ? ` · ${recentWr}%` : ''} · {r.hours}h played
            </span>
          </div>
          <PerformanceTilesRow tiles={overview.tiles} ratingTrend={trends.rating.delta} />
          <div>
            <div className="rts-ledger-head mb-1.5">Rating over time</div>
            <RatingChart matches={matches} />
          </div>
        </CardContent>
      </Card>

      <BenchmarkLens games={benchmarkGames} />

      <CivOverviewTable rows={overview.civs} />

      <details className="group rounded-lg border border-border/70 bg-background/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            More breakdowns
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            opponent civ, map, format, game length, time of day
          </span>
        </summary>
        <div className="border-t border-border/70 p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard
              title="Versus opponent civ"
              icon={<Swords className="h-4 w-4 text-primary" />}
              rows={s.byOppCiv}
              emptyHint="opponent civ not recorded"
            />
            <BreakdownCard
              title="By map"
              icon={<MapIcon className="h-4 w-4 text-primary" />}
              rows={s.byMap}
            />
            <BreakdownCard
              title="By team format"
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              rows={s.byFormat}
            />
            <BreakdownCard
              title="By game length"
              icon={<Hourglass className="h-4 w-4 text-primary" />}
              rows={s.byGameLength}
              keepOrder
            />
            <BreakdownCard
              title="By time of day"
              icon={<Clock className="h-4 w-4 text-primary" />}
              rows={s.byTimeOfDay}
              keepOrder
            />
          </div>
        </div>
      </details>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Game history</h2>
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} profileId={profileId} />
        ))}
      </section>

      <p className="text-xs text-muted-foreground">
        Computed from your {s.totalGames} synced games. Small samples are noisy — treat a low game
        count with caution.
      </p>
    </>
  )
}

/** Overall performance tiles from real per-game data (- when unavailable). */
function PerformanceTilesRow({
  tiles,
  ratingTrend,
}: {
  tiles: PerformanceTiles
  /** Rating change across the recent window (computeTrends), for the arrow. */
  ratingTrend: number | null
}) {
  const delta = tiles.ratingDelta
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Net rating"
        value={delta == null ? '-' : `${delta > 0 ? '+' : ''}${delta}`}
        accent={delta == null ? undefined : delta >= 0 ? 'win' : 'loss'}
        sub={`over ${tiles.games} games`}
        delta={ratingTrend}
      />
      <StatTile label="APM" value={tiles.avgApm ?? '-'} sub="avg, Relic counters" />
      <StatTile label="K/D" value={tiles.avgKd ?? '-'} sub="units, avg" />
      <StatTile label="Units / game" value={tiles.avgUnitsProduced ?? '-'} sub="produced, avg" />
      <StatTile label="Kills / game" value={tiles.avgKills ?? '-'} sub="avg" />
      <StatTile
        label="Eco pace"
        value={tiles.avgResourcesPerMinute ?? tiles.avgVillagersPerMinute ?? '-'}
        sub={tiles.avgResourcesPerMinute != null ? 'resources/min' : 'villagers/min'}
      />
    </div>
  )
}

function BreakdownCard({
  title,
  icon,
  rows,
  emptyHint,
  keepOrder,
}: {
  title: string
  icon: ReactNode
  rows: Breakdown[]
  emptyHint?: string
  keepOrder?: boolean
}) {
  const display = keepOrder ? rows : rows.slice(0, 10)
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {display.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No data yet{emptyHint ? ` — ${emptyHint}` : ''}.
          </p>
        ) : (
          <div className="space-y-2">
            {display.map((b) => (
              <WinRateRow key={b.key} b={b} />
            ))}
          </div>
        )}
        {!keepOrder && rows.length > display.length && (
          <p className="text-[11px] text-muted-foreground">+{rows.length - display.length} more</p>
        )}
      </CardContent>
    </Card>
  )
}

function WinRateRow({ b }: { b: Breakdown }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{b.label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {b.games}g · {b.wins}–{b.losses}
        </span>
      </div>
      <WinRateBar winRate={b.winRate} />
    </div>
  )
}

function MatchCard({ match, profileId }: { match: StoredMatch; profileId: number | null }) {
  const result = displayedResult(match, profileId)
  const win = result === 'win'
  const loss = result === 'loss'
  const isTeamGame = (match.myTeam?.length ?? 0) > 0 || (match.oppTeam?.length ?? 0) > 1
  const myLabel = isTeamGame ? teamCivLabel(match.civ, match.myTeam) : civDisplayName(match.civ)
  const oppLabel =
    isTeamGame && match.oppTeam?.length
      ? match.oppTeam.map((p) => civDisplayName(p.civ)).join(' + ')
      : match.oppCiv
        ? civDisplayName(match.oppCiv)
        : null
  const mine = match.perPlayer?.find((p) => p.profileId === profileId)
  const apm = mine?.apm ?? match.analysis.apm
  const vpm = villagersPerMinute(match.local)
  const rpm = resourcesPerMinute(match.local)
  // One quiet stat cluster per row (APM · K/D · eco pace) — details live in the
  // game view; the history list stays scannable.
  const statBits = [
    apm != null ? `${apm} APM` : null,
    mine?.kd != null ? `${mine.kd} K/D` : null,
    rpm != null ? `${rpm} res/min` : vpm != null ? `${vpm} vil/min` : null,
  ].filter(Boolean)
  return (
    <Card className="transition-colors hover:border-primary/40">
      <Link to={`/game/${match.id}`} className="block" title="Open full post-game breakdown">
        <CardContent className="flex items-center gap-3 p-3">
          <span
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm font-display font-bold',
              win
                ? 'bg-win/15 text-win'
                : loss
                  ? 'bg-loss/15 text-loss'
                  : 'bg-secondary text-muted-foreground',
            )}
          >
            {win ? 'W' : loss ? 'L' : '–'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{myLabel}</span>
              {oppLabel && <span className="text-muted-foreground">vs {oppLabel}</span>}
              {match.custom && (
                <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {match.vsAI ? 'vs AI' : 'Custom'}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {match.format ? `${match.format} · ` : ''}
              {match.map} · {formatDurationShort(match.durationSec)} ·{' '}
              {relativeTime(match.playedAt)}
            </div>
          </div>
          {statBits.length > 0 && (
            <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block">
              {statBits.join(' · ')}
            </span>
          )}
          {match.ratingDiff != null && (
            <span
              className={cn(
                'w-9 shrink-0 text-right tabular-nums text-xs font-semibold',
                match.ratingDiff >= 0 ? 'text-win' : 'text-loss',
              )}
            >
              {match.ratingDiff >= 0 ? '+' : ''}
              {match.ratingDiff}
            </span>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Link>
    </Card>
  )
}

function displayedResult(match: StoredMatch, profileId: number | null): 'win' | 'loss' | null {
  return match.result ?? resultFromPerPlayer(match.perPlayer, profileId)
}
