import { useMemo } from 'react'
import { Bell, Eye, Landmark as LandmarkIcon, Users } from 'lucide-react'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import {
  buildIndexForCiv,
  condenseBuildOrder,
  type BuildKeyTiming,
} from '@domain/buildOrderSchema'
import { parseDuration } from '@domain/format'
import { cn } from '@shared/lib/utils'

const AGE_NAME: Record<number, string> = { 2: 'Feudal Age', 3: 'Castle Age', 4: 'Imperial Age' }
/** Show a checkpoint chip from this long before its target time. */
const LEAD_SEC = 90
/** Pulse the chip when the checkpoint is this close. */
const URGENT_SEC = 30
/** The early scouting nudge window. */
const SCOUT_FROM = 15
const SCOUT_UNTIL = 75

interface Checkpoint {
  atSec: number
  timing: BuildKeyTiming
}

/**
 * DORMANT (2026-07-02): built, shipped, and REMOVED from the overlay the same day
 * — the user found log-clock-driven reminders too rough in practice. NOT imported
 * by OverlayApp. The overlay:gameClock channel it would use currently has NO
 * producer (the push is not wired). Kept in case a tighter design comes back.
 *
 * The in-game coach: quiet, timed reminder chips driven by the REAL game clock
 * (warnings.log sim start + pauses — no game memory is ever read). Shows the
 * next key checkpoint of your civ's bundled build with a live countdown and
 * villager target, plus an early "scout them" nudge. Chips pulse gold as a
 * checkpoint arrives — the "look here" cue.
 */
export function CoachWidget({
  elapsedSec,
  civ,
  placement,
}: {
  /** Match time in seconds (log clock preferred, wall-clock fallback). */
  elapsedSec: number | null
  /** Your live civ slug, to pick the bundled build. */
  civ: string | null
  /** Placement mode renders a static preview. */
  placement?: boolean
}) {
  const checkpoints = useMemo<Checkpoint[]>(() => {
    const idx = buildIndexForCiv(BUNDLED_BUILD_ORDERS, civ)
    if (idx == null) return []
    const bo = BUNDLED_BUILD_ORDERS[idx]!
    return condenseBuildOrder(bo)
      .map((timing) => ({ atSec: timing.time ? parseDuration(timing.time) : null, timing }))
      .filter((c): c is Checkpoint => c.atSec != null && c.atSec > 0)
      .sort((a, b) => a.atSec - b.atSec)
  }, [civ])

  if (placement) {
    return (
      <Shell>
        <Chip icon={<LandmarkIcon className="h-3.5 w-3.5" />} title="Feudal Age — 6:15" urgent>
          18 villagers · in 0:24
        </Chip>
        <Chip icon={<Eye className="h-3.5 w-3.5" />} title="Scout their base">
          find their gold + army buildings
        </Chip>
      </Shell>
    )
  }

  if (elapsedSec == null) return null

  const next = checkpoints.find((c) => c.atSec > elapsedSec - 5)
  const showNext = next != null && next.atSec - elapsedSec <= LEAD_SEC
  const showScout = elapsedSec >= SCOUT_FROM && elapsedSec <= SCOUT_UNTIL
  if (!showNext && !showScout) return null

  return (
    <Shell>
      {showNext && next && (
        <Chip
          icon={
            next.timing.ageUpTo != null ? (
              <LandmarkIcon className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )
          }
          title={
            next.timing.ageUpTo != null
              ? `${AGE_NAME[next.timing.ageUpTo]} — ${next.timing.time}`
              : `Opening — ${next.timing.time ?? 'now'}`
          }
          urgent={next.atSec - elapsedSec <= URGENT_SEC}
        >
          {next.timing.villagers} villagers · {countdown(next.atSec - elapsedSec)}
        </Chip>
      )}
      {showScout && (
        <Chip icon={<Eye className="h-3.5 w-3.5" />} title="Scout their base">
          find their gold + army buildings
        </Chip>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-64 select-none flex-col gap-1.5 font-sans"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
    >
      <span className="flex items-center gap-1 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/55">
        <Bell className="h-3 w-3" /> Coach
      </span>
      {children}
    </div>
  )
}

function Chip({
  icon,
  title,
  children,
  urgent,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  urgent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-sm bg-[#0a0e1a]/90 px-2.5 py-1.5 ring-1',
        urgent ? 'rts-coach-pulse ring-primary/80' : 'ring-white/15',
      )}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
        <span className={urgent ? 'text-primary' : 'text-white/70'}>{icon}</span>
        {title}
      </div>
      <div className="pl-5 text-[11px] text-white/75">{children}</div>
    </div>
  )
}

function countdown(sec: number): string {
  if (sec <= 0) return 'now'
  const s = Math.round(sec)
  return `in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
