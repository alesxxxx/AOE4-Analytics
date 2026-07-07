import { Gamepad2, Radio, Play, Swords, Loader2 } from 'lucide-react'
import { civDisplayName } from '@domain/civ'
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
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          Live match
          {live.map && <span className="font-normal text-muted-foreground">· {live.map}</span>}
        </div>

        {live.opponent ? (
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
