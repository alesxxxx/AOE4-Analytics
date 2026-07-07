import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  countryFlag,
  formatLeaderboard,
  formatPercent,
  formatRankLevel,
  formatRating,
  rankColor,
} from '@shared/format'
import { useScout } from '../queries/useScout'
import { ScoutReportCard } from '../components/ScoutReportCard'
import { RankBadge } from '../components/RankBadge'
import { StatTile } from '../components/StatTile'
import { EmptyBox, ErrorBox, Spinner } from '../components/feedback'

/**
 * The full public profile for any player (reachable from a scout card). Everything
 * `scoutPlayer` returns — rank, all rated modes, recent form, top civs & maps,
 * counter plan — laid out as a full page. Public data only (no local
 * playstyle/rating-trend, which exist only for the signed-in user).
 */
export function PlayerProfile() {
  const { profileId: raw } = useParams()
  const parsed = raw ? Number(raw) : NaN
  const profileId = Number.isFinite(parsed) ? parsed : null
  const { data, isLoading, refetch } = useScout(profileId)

  return (
    <div className="animate-fade-in space-y-6">
      <Link
        to="/scout"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Scout
      </Link>

      {profileId == null && (
        <EmptyBox>
          <p>Player not found.</p>
        </EmptyBox>
      )}

      {isLoading && <Spinner label="Loading profile…" />}
      {!isLoading && data && !data.ok && (
        <ErrorBox message={data.error.message} onRetry={() => refetch()} />
      )}

      {!isLoading && data?.ok && (
        <ProfileBody report={data.data} />
      )}
    </div>
  )
}

function ProfileBody({ report }: { report: Parameters<typeof ScoutReportCard>[0]['report'] }) {
  const { primary, modes } = report
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {countryFlag(report.country)}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{report.name}</h1>
        <RankBadge rank={primary} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Rating"
          value={formatRating(primary?.rating)}
          sub={primary ? formatLeaderboard(primary.leaderboard) : undefined}
        />
        <StatTile label="Peak" value={formatRating(primary?.maxRating)} />
        <StatTile label="Rank" value={primary?.rank != null ? `#${primary.rank}` : '—'} />
        <StatTile
          label="Win rate"
          value={formatPercent(primary?.winRate)}
          sub={primary ? `${primary.gamesCount} games` : undefined}
          accent={primary?.winRate == null ? undefined : primary.winRate >= 50 ? 'win' : 'loss'}
        />
      </div>

      {modes.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All rated modes
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            {modes.map((m) => (
              <div
                key={m.leaderboard}
                className="flex items-center justify-between border-b border-border px-4 py-2 text-sm last:border-b-0"
              >
                <span className="font-medium">{formatLeaderboard(m.leaderboard)}</span>
                <span className="flex items-center gap-4 text-muted-foreground">
                  <span style={{ color: rankColor(m.rankLevel) }}>{formatRankLevel(m.rankLevel)}</span>
                  <span className="tabular-nums text-foreground">{formatRating(m.rating)}</span>
                  <span className="w-20 text-right tabular-nums">
                    {formatPercent(m.winRate)} · {m.gamesCount}g
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ScoutReportCard report={report} />
    </div>
  )
}
