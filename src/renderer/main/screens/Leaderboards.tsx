import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Radio, Trophy } from 'lucide-react'
import type { Leaderboard } from '@api/types'
import type { LeaderboardRow } from '@domain/leaderboard'
import {
  countryFlag,
  formatPercent,
  formatRankLevel,
  formatRating,
  rankColor,
} from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'
import { Skeleton } from '@shared/components/ui/skeleton'
import { useLeaderboard } from '../queries/useLeaderboard'
import { EmptyBox, ErrorBox } from '../components/feedback'

const LADDERS: { label: string; value: Leaderboard }[] = [
  { label: 'Ranked 1v1', value: 'rm_solo' },
  { label: 'Ranked Team', value: 'rm_team' },
  { label: 'Quick Match 1v1', value: 'qm_1v1' },
  { label: 'Quick Match 2v2', value: 'qm_2v2' },
  { label: 'Quick Match 3v3', value: 'qm_3v3' },
  { label: 'Quick Match 4v4', value: 'qm_4v4' },
]

const COUNTRIES: { code: string | undefined; label: string }[] = [
  { code: undefined, label: 'All countries' },
  { code: 'ar', label: 'Argentina' },
  { code: 'au', label: 'Australia' },
  { code: 'at', label: 'Austria' },
  { code: 'be', label: 'Belgium' },
  { code: 'br', label: 'Brazil' },
  { code: 'bg', label: 'Bulgaria' },
  { code: 'ca', label: 'Canada' },
  { code: 'cl', label: 'Chile' },
  { code: 'cn', label: 'China' },
  { code: 'co', label: 'Colombia' },
  { code: 'cz', label: 'Czechia' },
  { code: 'dk', label: 'Denmark' },
  { code: 'eg', label: 'Egypt' },
  { code: 'fi', label: 'Finland' },
  { code: 'fr', label: 'France' },
  { code: 'de', label: 'Germany' },
  { code: 'gr', label: 'Greece' },
  { code: 'hk', label: 'Hong Kong' },
  { code: 'hu', label: 'Hungary' },
  { code: 'in', label: 'India' },
  { code: 'id', label: 'Indonesia' },
  { code: 'ie', label: 'Ireland' },
  { code: 'il', label: 'Israel' },
  { code: 'it', label: 'Italy' },
  { code: 'jp', label: 'Japan' },
  { code: 'kz', label: 'Kazakhstan' },
  { code: 'my', label: 'Malaysia' },
  { code: 'mx', label: 'Mexico' },
  { code: 'ma', label: 'Morocco' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'no', label: 'Norway' },
  { code: 'pe', label: 'Peru' },
  { code: 'ph', label: 'Philippines' },
  { code: 'pl', label: 'Poland' },
  { code: 'pt', label: 'Portugal' },
  { code: 'ro', label: 'Romania' },
  { code: 'ru', label: 'Russia' },
  { code: 'sa', label: 'Saudi Arabia' },
  { code: 'rs', label: 'Serbia' },
  { code: 'sg', label: 'Singapore' },
  { code: 'sk', label: 'Slovakia' },
  { code: 'za', label: 'South Africa' },
  { code: 'kr', label: 'South Korea' },
  { code: 'es', label: 'Spain' },
  { code: 'se', label: 'Sweden' },
  { code: 'ch', label: 'Switzerland' },
  { code: 'tw', label: 'Taiwan' },
  { code: 'th', label: 'Thailand' },
  { code: 'tr', label: 'Turkey' },
  { code: 'ua', label: 'Ukraine' },
  { code: 'ae', label: 'United Arab Emirates' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'us', label: 'United States' },
  { code: 'uy', label: 'Uruguay' },
  { code: 've', label: 'Venezuela' },
  { code: 'vn', label: 'Vietnam' },
]

export function LeaderboardPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [leaderboard, setLeaderboard] = useState<Leaderboard>('rm_solo')
  const [country, setCountry] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching, refetch } = useLeaderboard({ leaderboard, page, country })

  const result = data?.ok ? data.data : null
  const totalPages =
    result && result.perPage > 0 ? Math.max(1, Math.ceil(result.totalCount / result.perPage)) : 1

  const changeLadder = (lb: Leaderboard) => {
    setLeaderboard(lb)
    setPage(1)
  }
  const changeCountry = (c: string | undefined) => {
    setCountry(c)
    setPage(1)
  }

  return (
    <div className={cn(embedded ? 'space-y-4' : 'animate-fade-in space-y-6')}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className="text-lg font-semibold tracking-tight">Leaderboards</h2>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">Leaderboards</h1>
          )}
          <p className="text-sm text-muted-foreground">
            Top players on the AoE4World ladder. {result ? result.totalCount.toLocaleString() : '—'}{' '}
            players.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={leaderboard}
            onChange={(e) => changeLadder(e.target.value as Leaderboard)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LADDERS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={country ?? ''}
            onChange={(e) => changeCountry(e.target.value || undefined)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {COUNTRIES.map((c) => (
              <option key={c.label} value={c.code ?? ''}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {result?.you && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-1 p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-warn" />
              Your rank
            </h3>
            <Stat label="Rank" value={`#${result.you.rank.toLocaleString()}`} />
            <Stat label="Rating" value={formatRating(result.you.rating)} />
            <Stat label="Win rate" value={formatPercent(result.you.winRate)} />
            <Stat label="Games" value={result.you.games.toLocaleString()} />
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-96" />}
      {!isLoading && data && !data.ok && (
        <ErrorBox message={data.error.message} onRetry={() => refetch()} />
      )}

      {!isLoading && result && result.rows.length === 0 && (
        <EmptyBox>
          <p>No players found for this filter.</p>
        </EmptyBox>
      )}

      {!isLoading && result && result.rows.length > 0 && (
        <>
          <Card>
            <CardContent className={cn('p-0', isFetching && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="rts-ledger-head px-4 py-2.5">#</th>
                    <th className="rts-ledger-head px-2 py-2.5">Player</th>
                    <th className="rts-ledger-head px-2 py-2.5 text-right">Rating</th>
                    <th className="rts-ledger-head px-2 py-2.5 text-right">Win %</th>
                    <th className="rts-ledger-head px-2 py-2.5 text-right">Games</th>
                    <th className="rts-ledger-head px-4 py-2.5 text-right">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <Row key={r.profileId} r={r} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="text-sm text-muted-foreground">
              Page {result.page} of {totalPages.toLocaleString()}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Row({ r }: { r: LeaderboardRow }) {
  return (
    <tr
      className={cn(
        'border-b border-border/60 last:border-0 hover:bg-secondary/40',
        r.isYou && 'bg-primary/10 hover:bg-primary/15',
      )}
    >
      <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.rank.toLocaleString()}</td>
      <td className="px-2 py-2">
        <span className="flex items-center gap-2">
          <span aria-hidden>{countryFlag(r.country)}</span>
          <Link
            to={`/profile/${r.profileId}`}
            className={cn(
              'font-medium underline-offset-2 hover:text-primary hover:underline',
              r.isYou && 'text-primary',
            )}
            title={`Open ${r.name}'s full profile`}
          >
            {r.name}
          </Link>
          {r.isYou && <span className="text-[10px] text-primary">you</span>}
          {r.live && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-loss/15 px-1 py-0.5 text-[10px] font-medium text-loss"
              title="Live on Twitch"
            >
              <Radio className="h-2.5 w-2.5" />
              LIVE
            </span>
          )}
          {r.rankLevel && (
            <span className="text-[11px]" style={{ color: rankColor(r.rankLevel) }}>
              {formatRankLevel(r.rankLevel)}
            </span>
          )}
        </span>
      </td>
      <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatRating(r.rating)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
        {formatPercent(r.winRate)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
        {r.games.toLocaleString()}
      </td>
      <td
        className={cn(
          'px-4 py-2 text-right tabular-nums',
          r.streak > 0 ? 'text-win' : r.streak < 0 ? 'text-loss' : 'text-muted-foreground',
        )}
      >
        {r.streak > 0 ? `+${r.streak}` : r.streak}
      </td>
    </tr>
  )
}
