import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PlayerSearch } from '../components/PlayerSearch'
import { ScoutReportCard } from '../components/ScoutReportCard'
import { PageHead } from '../components/PageHead'
import { ErrorBox, Spinner } from '../components/feedback'
import { useScout } from '../queries/useScout'
import { LeaderboardPanel } from './Leaderboards'

/**
 * Scout: the ladder leaderboard is the default view, with a single search bar on
 * top — type any player name to pull their scout report (rank, form, civs,
 * counters). Clearing the report returns to the leaderboard.
 */
export function Scout() {
  const [selected, setSelected] = useState<{ profileId: number; name: string } | null>(null)
  const { data, isLoading, refetch } = useScout(selected?.profileId ?? null)

  return (
    <div className="animate-fade-in space-y-6">
      <PageHead
        kicker="Reconnaissance"
        title="Scout"
        sub="Look up any opponent: rank, recent form, favourite civs and maps, and how to counter them."
      />

      <div className="max-w-xl">
        <PlayerSearch
          autoFocus
          placeholder="Search any player to scout..."
          onSelect={(hit) => setSelected({ profileId: hit.profileId, name: hit.name })}
        />
      </div>

      {selected ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to leaderboard
          </button>
          <div className="max-w-xl">
            {isLoading && <Spinner label={`Scouting ${selected.name}...`} />}
            {!isLoading && data && !data.ok && (
              <ErrorBox message={data.error.message} onRetry={() => refetch()} />
            )}
            {!isLoading && data?.ok && <ScoutReportCard report={data.data} showProfileLink />}
          </div>
        </div>
      ) : (
        <LeaderboardPanel embedded />
      )}
    </div>
  )
}
