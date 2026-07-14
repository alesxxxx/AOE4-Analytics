import { History, Swords } from 'lucide-react'
import type { ReactNode } from 'react'
import { civDisplayName } from '@domain/civ'
import type {
  HeadToHeadData,
  IpcResult,
  ScoutHistoryData,
  ScoutMatchPage,
  ScoutMatchRow,
} from '@ipc/contract'
import { formatDurationShort, formatLeaderboard, formatPercent, relativeTime } from '@shared/format'
import { EmptyBox, ErrorBox, Spinner } from './feedback'

interface ScoutHistoryPanelProps {
  result: IpcResult<ScoutHistoryData> | undefined
  isLoading: boolean
  error: unknown
  viewedName: string
  onRetry: () => void
}

export function ScoutHistoryPanel({
  result,
  isLoading,
  error,
  viewedName,
  onRetry,
}: ScoutHistoryPanelProps) {
  if (isLoading) return <Spinner label="Loading public match history…" />

  if (error) {
    return <ErrorBox message={errorMessage(error)} onRetry={onRetry} />
  }
  if (!result) return null
  if (!result.ok) return <ErrorBox message={result.error.message} onRetry={onRetry} />

  const { recent, headToHead, activeProfile, viewedProfileId } = result.data
  const viewingSelf = activeProfile?.profileId === viewedProfileId

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="overflow-hidden rounded-lg border border-border bg-card/50">
        <SectionHeader
          icon={<History className="h-4 w-4" />}
          title="Recent public matches"
          detail={recent.ok ? sampleLabel(recent.data) : undefined}
        />
        <div className="p-4">
          {!recent.ok ? (
            <ErrorBox message={recent.error.message} onRetry={onRetry} />
          ) : recent.data.matches.length === 0 ? (
            <EmptyBox>
              <p>No public matches were returned for {viewedName}.</p>
              <p className="text-xs">Their history may be private or not yet indexed.</p>
            </EmptyBox>
          ) : (
            <MatchList page={recent.data} />
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card/50">
        <SectionHeader
          icon={<Swords className="h-4 w-4" />}
          title="Personal head-to-head"
          detail={headToHead?.ok ? sampleLabel(headToHead.data) : undefined}
        />
        <div className="p-4">
          {activeProfile == null ? (
            <EmptyBox>
              <p>Link an account to see your matches against {viewedName}.</p>
            </EmptyBox>
          ) : viewingSelf ? (
            <EmptyBox>
              <p>Head-to-head appears when you scout a different player.</p>
            </EmptyBox>
          ) : headToHead == null ? (
            <EmptyBox>
              <p>Head-to-head is unavailable for this profile.</p>
            </EmptyBox>
          ) : !headToHead.ok ? (
            <ErrorBox message={headToHead.error.message} onRetry={onRetry} />
          ) : headToHead.data.matches.length === 0 ? (
            <EmptyBox>
              <p>No public matches found between you and {viewedName}.</p>
            </EmptyBox>
          ) : (
            <>
              <HeadToHeadSummary data={headToHead.data} />
              <MatchList page={headToHead.data} />
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail?: string
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </header>
  )
}

function HeadToHeadSummary({ data }: { data: HeadToHeadData }) {
  const unknown = data.sampleSize - data.decidedGames
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-xs">
      <span className="font-semibold">
        <span className="text-win">{data.wins}W</span>
        {' – '}
        <span className="text-loss">{data.losses}L</span>
      </span>
      <span className="text-muted-foreground">
        {formatPercent(data.winRate)} across {data.decidedGames} decided in this sample
      </span>
      {unknown > 0 && <span className="text-muted-foreground">· {unknown} undecided</span>}
    </div>
  )
}

function MatchList({ page }: { page: ScoutMatchPage }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      {page.matches.map((match) => (
        <MatchRow key={match.gameId} match={match} />
      ))}
    </div>
  )
}

function MatchRow({ match }: { match: ScoutMatchRow }) {
  const opponentCivs = match.opponentCivilizations.map(civDisplayName).join(' + ')
  const matchup = `${displayCiv(match.civilization)} vs ${opponentCivs || 'Unknown'}`
  const when = relativeTime(match.startedAt) || 'Date unavailable'

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2.5 text-xs last:border-b-0"
      title={
        match.opponentNames.length > 0 ? `Opponents: ${match.opponentNames.join(', ')}` : undefined
      }
    >
      <ResultBadge result={match.result} />
      <span className="min-w-48 flex-1 font-medium text-foreground">{matchup}</span>
      <span className="min-w-28 text-muted-foreground">{match.map ?? 'Map unavailable'}</span>
      <span className="min-w-28 text-muted-foreground">
        {match.format ? formatLeaderboard(match.format) : 'Format unavailable'}
      </span>
      <span className="text-muted-foreground">{formatDurationShort(match.durationSec)}</span>
      <time
        className="min-w-16 text-right text-muted-foreground"
        dateTime={match.startedAt}
        title={absoluteDate(match.startedAt)}
      >
        {when}
      </time>
    </div>
  )
}

function ResultBadge({ result }: { result: ScoutMatchRow['result'] }) {
  const style =
    result === 'win'
      ? 'bg-win/15 text-win'
      : result === 'loss'
        ? 'bg-loss/15 text-loss'
        : 'bg-secondary text-muted-foreground'
  return (
    <span className={`w-12 rounded px-1.5 py-0.5 text-center font-semibold uppercase ${style}`}>
      {result === 'unknown' ? '—' : result}
    </span>
  )
}

function displayCiv(civilization: string | null): string {
  return civilization ? civDisplayName(civilization) : 'Unknown'
}

function sampleLabel(page: ScoutMatchPage): string {
  if (page.totalCount > page.sampleSize) {
    return `Showing ${page.sampleSize} of ${page.totalCount}`
  }
  return `${page.sampleSize} ${page.sampleSize === 1 ? 'match' : 'matches'}`
}

function absoluteDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
