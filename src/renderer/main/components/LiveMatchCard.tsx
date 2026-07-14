import { Gamepad2, Radio, Play, Swords, Loader2, Users } from 'lucide-react'
import { civDisplayName } from '@domain/civ'
import { buildAdvisoryTeamPlan } from '@domain/teamInsights'
import { formatRankLevel, formatRating, rankColor } from '@shared/format'
import { useLiveMatch, useLaunchGame } from '../queries/useLiveMatch'
import { useSettings } from '../queries/useProfile'

/** Top-of-dashboard card: shows the CURRENT live matchup, or a Start AoE4 button. */
export function LiveMatchCard() {
  const { data: live } = useLiveMatch()
  const { data: settings } = useSettings()
  const launch = useLaunchGame()

  if (!live) return null

  if (live.isLive) {
    const teamPlan = live.teams ? buildAdvisoryTeamPlan(live.teams) : null
    const myTeam = live.teams?.[0] ?? []
    const enemyTeam = live.teams?.[1] ?? []
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          Live match
          {live.map && <span className="font-normal text-muted-foreground">· {live.map}</span>}
        </div>

        {teamPlan && live.teams ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {myTeam.map((player) => civDisplayName(player.civ ?? '')).join(' + ')}
              </span>
              <Swords className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {enemyTeam.map((player) => civDisplayName(player.civ ?? '')).join(' + ')}
              </span>
            </div>
            <div className="mt-1 grid gap-x-4 text-[11px] text-muted-foreground sm:grid-cols-2">
              <span>
                Your side:{' '}
                {myTeam
                  .map((player) => `${player.name} (${civDisplayName(player.civ ?? '')})`)
                  .join(' · ')}
              </span>
              <span>
                Opponents:{' '}
                {enemyTeam
                  .map((player) => `${player.name} (${civDisplayName(player.civ ?? '')})`)
                  .join(' · ')}
              </span>
            </div>
            <div className="mt-3 rounded-md border border-border/70 bg-card/70 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {teamPlan.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{teamPlan.basis}</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{teamPlan.headline}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {teamPlan.assignments.map((assignment) => (
                  <div
                    key={assignment.profileId}
                    className="rounded border border-border/60 px-2.5 py-2"
                  >
                    <div className="text-xs font-medium">
                      {assignment.name} · {assignment.role}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {assignment.rationale}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {teamPlan.priorities.map((priority) => (
                  <li key={priority}>• {priority}</li>
                ))}
              </ul>
            </div>
          </>
        ) : live.opponent ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span>{live.myCiv ? civDisplayName(live.myCiv) : 'You'}</span>
              <Swords className="h-4 w-4 text-muted-foreground" />
              <span>{civDisplayName(live.opponent.civ)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">vs</span>
              <span className="font-medium">{live.opponent.name}</span>
              <span style={{ color: rankColor(live.opponent.rankLevel) }}>
                {formatRankLevel(live.opponent.rankLevel)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatRating(live.opponent.rating)}
              </span>
            </div>
          </div>
        ) : live.custom ? (
          <div className="mt-2 text-sm text-muted-foreground">Custom / AI game in progress.</div>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Match detected — fetching opponent…
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          The overlay shows your matchup — press{' '}
          <kbd className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">
            {settings?.hotkeys.toggleOverlay ?? 'Alt+O'}
          </kbd>{' '}
          in-game.
        </p>
      </div>
    )
  }

  // Not in a live match. Offer to launch when the game is closed; while the game
  // is open there's nothing to say — detection is fast and reliable now, so the
  // old "looking for your match…" status card is gone.
  const gameClosed = live.processRunning !== true
  if (!gameClosed) return null
  // The launcher reports failure two ways: a rejected IPC call, or a resolved
  // LaunchResult with ok:false and the launcher's own message.
  const launchFailed = launch.isError || (launch.data != null && !launch.data.ok)
  const launchError =
    launch.data != null && !launch.data.ok && launch.data.message
      ? launch.data.message
      : "Couldn't launch the game — is it installed?"
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Gamepad2 className="h-4 w-4" />
        Age of Empires IV is not running.
      </div>
      <button
        type="button"
        onClick={() => launch.mutate()}
        disabled={launch.isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        <Play className="h-3.5 w-3.5" />
        Start AoE4
      </button>
      {launchFailed && <p className="w-full text-xs text-destructive">{launchError}</p>}
    </div>
  )
}
