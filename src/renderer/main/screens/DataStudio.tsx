import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Database, RotateCcw } from 'lucide-react'
import {
  aggregateDataStudioGames,
  DATA_STUDIO_LEGACY_UNKNOWN,
  DATA_STUDIO_LOCAL_UNKNOWN,
  DATA_STUDIO_SEARCH_PARAMS,
  DATA_STUDIO_UNKNOWN,
  dataStudioCoverage,
  dataStudioFilterOptions,
  dataStudioGameFromStored,
  DEFAULT_DATA_STUDIO_FILTERS,
  filterDataStudioGames,
  parseDataStudioFilters,
  type CountedOption,
  type DataStudioFilterOptions,
  type DataStudioFilters,
  type DataStudioGame,
  type DataStudioMetric,
} from '@domain/dataStudio'
import { civDisplayName } from '@domain/civ'
import { filterPersonalHistory } from '@domain/historyFilters'
import { formatDurationShort } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'
import { PageHead } from '../components/PageHead'
import { EmptyBox, ErrorBox, Spinner } from '../components/feedback'
import { useFullHistory } from '../queries/useHistory'
import { useSettings } from '../queries/useProfile'

type FilterKey = keyof DataStudioFilters

export function DataStudio() {
  const { data, isLoading, refetch } = useFullHistory()
  const { data: settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [nowMs] = useState(() => Date.now())
  const search = searchParams.toString()
  const filters = useMemo(() => parseDataStudioFilters(new URLSearchParams(search)), [search])
  const excludePractice = settings?.localData.excludeAiFromStats ?? false
  const matches = useMemo(
    () => filterPersonalHistory(data?.ok ? data.data : [], excludePractice),
    [data, excludePractice],
  )
  const games = useMemo(
    () => matches.map((match) => dataStudioGameFromStored(match, settings?.profileId ?? null)),
    [matches, settings?.profileId],
  )
  const filtered = useMemo(
    () => filterDataStudioGames(games, filters, nowMs),
    [filters, games, nowMs],
  )
  const aggregate = useMemo(() => aggregateDataStudioGames(filtered), [filtered])
  const options = useMemo(() => dataStudioFilterOptions(games), [games])
  const coverage = useMemo(() => dataStudioCoverage(games), [games])

  function setFilter(key: FilterKey, value: string) {
    const next = new URLSearchParams(searchParams)
    const param = DATA_STUDIO_SEARCH_PARAMS[key]
    if (!value || value === DEFAULT_DATA_STUDIO_FILTERS[key]) next.delete(param)
    else next.set(param, value)
    setSearchParams(next, { replace: true })
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const hasFilters = searchParams.size > 0

  return (
    <div className="animate-fade-in space-y-6">
      <PageHead
        kicker="Personal match lab"
        title="Data Studio"
        sub="Filter your own synced history and inspect the sample behind every average."
        aside={
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="inline-flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset view
          </button>
        }
      />

      {isLoading && <Spinner label="Loading personal match data..." />}
      {!isLoading && data && !data.ok && (
        <ErrorBox message={data.error.message} onRetry={() => refetch()} />
      )}
      {!isLoading && data?.ok && games.length === 0 && (
        <EmptyBox>
          <div className="space-y-1">
            <p>No synced matches to explore yet.</p>
            <p className="text-xs">Sync recent games from My Stats, then return here.</p>
          </div>
        </EmptyBox>
      )}

      {!isLoading && data?.ok && games.length > 0 && (
        <>
          <FilterPanel filters={filters} options={options} onChange={setFilter} />

          <p className="rounded-sm border border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            Personal history only: {coverage.publicPatchKnown}/{coverage.publicGames} loaded public
            matches include a stored patch and {coverage.publicSeasonKnown}/{coverage.publicGames}{' '}
            include a season. {coverage.legacyPatchUnknown} legacy public{' '}
            {coverage.legacyPatchUnknown === 1 ? 'match lacks' : 'matches lack'} patch metadata and{' '}
            {coverage.legacySeasonUnknown} {coverage.legacySeasonUnknown === 1 ? 'lacks' : 'lack'}{' '}
            season metadata
            {coverage.localGames > 0
              ? `; ${coverage.localGames} local/custom match${coverage.localGames === 1 ? '' : 'es'} cannot be assigned a public patch.`
              : '.'}{' '}
            Filters show correlation in your matches, not patch causality or global performance.
            {excludePractice ? ' Practice games are hidden by your Settings preference.' : ''}
          </p>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Filtered performance</h2>
                <p className="text-xs text-muted-foreground">
                  {aggregate.games} of {games.length} loaded matches fit this view.
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Each tile uses only games where that metric was observed.
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Win rate"
                metric={aggregate.winRate}
                value={formatPercent(aggregate.winRate.value)}
                detail={`${aggregate.wins}W-${aggregate.losses}L${aggregate.unknownResults > 0 ? `; ${aggregate.unknownResults} unknown` : ''}`}
              />
              <MetricCard
                label="Average duration"
                metric={aggregate.averageDurationSec}
                value={formatDurationShort(aggregate.averageDurationSec.value)}
                detail="Mean of matches with a recorded duration"
              />
              <MetricCard
                label="Rating change"
                metric={aggregate.averageRatingChange}
                value={formatSigned(aggregate.averageRatingChange.value)}
                detail={
                  aggregate.totalRatingChange.value == null
                    ? 'No rating delta recorded'
                    : `${formatSigned(aggregate.totalRatingChange.value)} net across the same sample`
                }
              />
              <MetricCard
                label="APM"
                metric={aggregate.averageApm}
                value={formatNumber(aggregate.averageApm.value, 1)}
                detail="Mean observed actions per minute"
              />
              <MetricCard
                label="Resources / min"
                metric={aggregate.averageResourcesPerMinute}
                value={formatNumber(aggregate.averageResourcesPerMinute.value, 0)}
                detail="Mean observed resource-gather rate"
              />
              <MetricCard
                label="Villagers / min"
                metric={aggregate.averageVillagersPerMinute}
                value={formatNumber(aggregate.averageVillagersPerMinute.value, 1)}
                detail="Mean observed villager-production rate"
              />
            </div>
          </section>

          <MatchTable games={filtered} />
        </>
      )}
    </div>
  )
}

function FilterPanel({
  filters,
  options,
  onChange,
}: {
  filters: DataStudioFilters
  options: DataStudioFilterOptions
  onChange: (key: FilterKey, value: string) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Saved-view filters</h2>
          <span className="text-[11px] text-muted-foreground">
            The current view is stored in the page address.
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <FilterSelect
            label="Civilization"
            value={filters.civilization}
            onChange={(value) => onChange('civilization', value)}
          >
            {categoryOptions(options.civilizations, filters.civilization, civOptionLabel)}
          </FilterSelect>
          <FilterSelect
            label="Opponent civilization"
            value={filters.opponentCivilization}
            onChange={(value) => onChange('opponentCivilization', value)}
          >
            {categoryOptions(
              options.opponentCivilizations,
              filters.opponentCivilization,
              civOptionLabel,
            )}
          </FilterSelect>
          <FilterSelect
            label="Map"
            value={filters.map}
            onChange={(value) => onChange('map', value)}
          >
            {categoryOptions(options.maps, filters.map, plainOptionLabel)}
          </FilterSelect>
          <FilterSelect
            label="Format"
            value={filters.format}
            onChange={(value) => onChange('format', value)}
          >
            {categoryOptions(options.formats, filters.format, plainOptionLabel)}
          </FilterSelect>
          <FilterSelect
            label="Patch"
            value={filters.patch}
            onChange={(value) => onChange('patch', value)}
          >
            {categoryOptions(options.patches, filters.patch, patchOptionLabel)}
          </FilterSelect>
          <FilterSelect
            label="Season"
            value={filters.season}
            onChange={(value) => onChange('season', value)}
          >
            {categoryOptions(options.seasons, filters.season, seasonOptionLabel)}
          </FilterSelect>
          <FilterSelect
            label="Result"
            value={filters.result}
            onChange={(value) => onChange('result', value)}
          >
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="unknown">Unknown result</option>
          </FilterSelect>
          <FilterSelect
            label="Duration"
            value={filters.duration}
            onChange={(value) => onChange('duration', value)}
          >
            <option value="under-15">Under 15 minutes</option>
            <option value="15-25">15-25 minutes</option>
            <option value="25-40">25-40 minutes</option>
            <option value="40-plus">40+ minutes</option>
            <option value="unknown">Unknown duration</option>
          </FilterSelect>
          <FilterSelect
            label="Recent window"
            value={filters.window}
            allLabel="Default: 90 days"
            onChange={(value) => onChange('window', value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="180d">Last 180 days</option>
            <option value="365d">Last year</option>
            <option value="all">All loaded history</option>
          </FilterSelect>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  label,
  value,
  allLabel = 'All',
  onChange,
  children,
}: {
  label: string
  value: string
  allLabel?: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-sm border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
      >
        <option value="">{allLabel}</option>
        {children}
      </select>
    </label>
  )
}

function categoryOptions(
  options: CountedOption[],
  selected: string,
  label: (value: string) => string,
): ReactNode {
  const selectedIsMissing = selected && !options.some((option) => option.value === selected)
  return (
    <>
      {selectedIsMissing && <option value={selected}>{label(selected)} (not loaded)</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {label(option.value)} ({option.games})
        </option>
      ))}
    </>
  )
}

function civOptionLabel(value: string): string {
  return value === DATA_STUDIO_UNKNOWN ? 'Unknown' : civDisplayName(value)
}

function plainOptionLabel(value: string): string {
  return value === DATA_STUDIO_UNKNOWN ? 'Unknown' : value
}

function patchOptionLabel(value: string): string {
  if (value === DATA_STUDIO_LEGACY_UNKNOWN) return 'Legacy public - unrecorded'
  if (value === DATA_STUDIO_LOCAL_UNKNOWN) return 'Local/custom - unknown'
  return `Patch ${value}`
}

function seasonOptionLabel(value: string): string {
  if (value === DATA_STUDIO_LEGACY_UNKNOWN) return 'Legacy public - unrecorded'
  if (value === DATA_STUDIO_LOCAL_UNKNOWN) return 'Local/custom - unknown'
  return `Season ${value}`
}

function MetricCard({
  label,
  metric,
  value,
  detail,
}: {
  label: string
  metric: DataStudioMetric
  value: string
  detail: string
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{detail}</p>
        <p className="text-[11px] tabular-nums text-primary/80">
          n={metric.sampleSize} observed {metric.sampleSize === 1 ? 'game' : 'games'}
        </p>
      </CardContent>
    </Card>
  )
}

function MatchTable({ games }: { games: DataStudioGame[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Matching games</h2>
      {games.length === 0 ? (
        <EmptyBox>
          <div className="space-y-1">
            <p>No games fit every selected filter.</p>
            <p className="text-xs">Broaden the view or reset the filters.</p>
          </div>
        </EmptyBox>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                <tr>
                  <TableHead>Date</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Matchup</TableHead>
                  <TableHead>Map / format</TableHead>
                  <TableHead>Patch / season</TableHead>
                  <TableHead align="right">Duration</TableHead>
                  <TableHead align="right">Rating</TableHead>
                  <TableHead align="right">APM</TableHead>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {games.map((game) => (
                  <tr key={game.id} className="transition-colors hover:bg-secondary/25">
                    <TableCell>
                      <Link to={`/game/${game.id}`} className="font-medium hover:text-primary">
                        {formatDate(game.playedAt)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ResultLabel result={game.result} />
                    </TableCell>
                    <TableCell>
                      {civDisplayName(game.civilization)}
                      <span className="text-muted-foreground">
                        {' '}
                        vs{' '}
                        {game.opponentCivilizations.length > 0
                          ? game.opponentCivilizations.map(civDisplayName).join(' + ')
                          : 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {game.map || 'Unknown'}
                      <span className="text-muted-foreground"> · {game.format ?? 'Unknown'}</span>
                    </TableCell>
                    <TableCell>
                      {game.patch != null
                        ? `Patch ${game.patch}`
                        : game.custom
                          ? 'Local - unknown'
                          : 'Legacy - unrecorded'}
                      <span className="text-muted-foreground">
                        {' '}
                        ·{' '}
                        {game.season != null
                          ? `Season ${game.season}`
                          : game.custom
                            ? 'local season unknown'
                            : 'legacy season unrecorded'}
                      </span>
                    </TableCell>
                    <TableCell align="right">{formatDurationShort(game.durationSec)}</TableCell>
                    <TableCell align="right">{formatSigned(game.ratingDiff)}</TableCell>
                    <TableCell align="right">{formatNumber(game.apm, 0)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function TableHead({ children, align }: { children: ReactNode; align?: 'right' }) {
  return (
    <th className={cn('px-3 py-2 font-medium', align === 'right' && 'text-right')}>{children}</th>
  )
}

function TableCell({ children, align }: { children: ReactNode; align?: 'right' }) {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-3 py-2.5',
        align === 'right' && 'text-right tabular-nums',
      )}
    >
      {children}
    </td>
  )
}

function ResultLabel({ result }: { result: DataStudioGame['result'] }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-12 justify-center rounded-sm px-1.5 py-0.5 font-semibold',
        result === 'win'
          ? 'bg-win/15 text-win'
          : result === 'loss'
            ? 'bg-loss/15 text-loss'
            : 'bg-secondary text-muted-foreground',
      )}
    >
      {result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Unknown'}
    </span>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString()
}

function formatSigned(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function formatNumber(value: number | null, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toFixed(decimals).replace(/\.0$/, '')
}

function formatPercent(value: number | null): string {
  return value == null ? '-' : `${value}%`
}
