import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import type { DashboardData } from '@ipc/contract'
import {
  countryFlag,
  formatLeaderboard,
  formatPercent,
  formatRankLevel,
  formatRating,
  rankColor,
  winRateTone,
} from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Skeleton } from '@shared/components/ui/skeleton'
import { useDashboard, useSettings, useSteamAvatar } from '../queries/useProfile'
import { useHistory } from '../queries/useHistory'
import { LiveMatchCard } from '../components/LiveMatchCard'
import { MatchPrepCard } from '../components/MatchPrepCard'
import { RecommendedCivs } from '../components/RecommendedCivs'
import { RankBadge } from '../components/RankBadge'
import { FormPips } from '../components/FormPips'
import { AccountAvatar } from '../components/AccountSwitcher'
import { PageHead } from '../components/PageHead'
import { ErrorBox } from '../components/feedback'

/**
 * The landing surface: a hero ladder-standing slab (identity, vitals, form,
 * every rated mode) and the match-prep card. Deep stats live in My Stats.
 * No refresh button — polling + query invalidation keep this current.
 */
export function Dashboard() {
  const { data: settings } = useSettings()
  const hasProfile = settings?.profileId != null
  const { data, isLoading, refetch } = useDashboard(!!hasProfile)
  const { data: history } = useHistory()
  const excludeAi = settings?.localData.excludeAiFromStats ?? false
  // Stable reference so MatchPrepCard's useMemo doesn't recompute every render.
  const matches = useMemo(
    () => (history?.ok ? history.data : []).filter((m) => !excludeAi || (!m.vsAI && !m.custom)),
    [history, excludeAi],
  )
  const latestMatch = matches[0]

  return (
    <div className="animate-fade-in space-y-5">
      <PageHead
        kicker="War room"
        title="Dashboard"
        sub="Your ranks, rating, and recent form."
        aside={
          latestMatch ? (
            <Link
              to={`/game/${latestMatch.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              Review latest game
            </Link>
          ) : null
        }
      />

      <LiveMatchCard />

      {isLoading && <DashboardSkeleton />}

      {!isLoading && data && !data.ok && (
        <ErrorBox message={data.error.message} onRetry={() => refetch()} />
      )}

      {!isLoading && data?.ok && <LadderStanding data={data.data} />}

      <MatchPrepCard matches={matches} />

      {/* Beginner on-ramp — only while the player is still light on synced games. */}
      {matches.length < 15 && <RecommendedCivs />}
    </div>
  )
}

/** Identity + vitals + form + every rated mode, as one flat ledger slab. */
function LadderStanding({ data }: { data: DashboardData }) {
  const { data: avatar } = useSteamAvatar()
  const { primary, recentForm, modes } = data
  return (
    <section className="rts-menu-card overflow-hidden rounded-md border">
      {/* Identity row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <AccountAvatar avatar={avatar ?? null} name={data.name} size="h-11 w-11" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg leading-tight">{data.name}</h2>
            {data.country && (
              <span
                className="rounded-sm bg-secondary px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                title="Country"
              >
                {countryFlag(data.country)}
              </span>
            )}
          </div>
          <div className="mt-0.5">
            <RankBadge rank={primary} />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="rts-ledger-head">Recent form</span>
          <FormPips form={recentForm} />
        </div>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
        <Vital
          label="Rating"
          value={formatRating(primary?.rating)}
          sub={formatLeaderboard(primary?.leaderboard)}
        />
        <Vital label="Peak" value={formatRating(primary?.maxRating)} />
        <Vital label="Rank" value={primary?.rank != null ? `#${primary.rank}` : '—'} />
        <Vital
          label="Win rate"
          value={formatPercent(primary?.winRate)}
          sub={primary ? `${primary.gamesCount} games` : undefined}
          tone={winRateTone(primary?.winRate)}
        />
      </div>

      {/* Every rated mode */}
      {modes.length > 0 && (
        <div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 px-4 pb-1 pt-2.5">
            <span className="rts-ledger-head">Mode</span>
            <span className="rts-ledger-head text-right">Rank</span>
            <span className="rts-ledger-head w-16 text-right">Rating</span>
            <span className="rts-ledger-head w-24 text-right">Record</span>
          </div>
          {modes.map((m) => (
            <div
              key={m.leaderboard}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 border-t border-border/60 px-4 py-2 text-sm"
            >
              <span className="font-medium">{formatLeaderboard(m.leaderboard)}</span>
              {/* Quick Match has no rank tiers — only Ranked ladders do, so a QM
                  row showing "Unranked" would be misleading. */}
              {m.leaderboard?.startsWith('qm') ? (
                <span className="text-right text-muted-foreground">—</span>
              ) : (
                <span className="text-right" style={{ color: rankColor(m.rankLevel) }}>
                  {formatRankLevel(m.rankLevel)}
                </span>
              )}
              <span className="w-16 text-right tabular-nums">{formatRating(m.rating)}</span>
              <span className="w-24 text-right tabular-nums text-muted-foreground">
                {formatPercent(m.winRate)} · {m.gamesCount}g
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Vital({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'win' | 'loss' | 'even'
}) {
  return (
    <div className="px-4 py-3">
      <div className="rts-ledger-head">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-xl font-semibold tabular-nums',
          tone === 'win' && 'text-win',
          tone === 'loss' && 'text-loss',
          tone === 'even' && 'text-muted-foreground',
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-64" />
    </div>
  )
}
