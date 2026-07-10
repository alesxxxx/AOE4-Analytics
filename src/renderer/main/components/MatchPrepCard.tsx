import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Swords } from 'lucide-react'
import type { StoredMatch } from '@store/historyStore'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import { resultFromPerPlayer } from '@domain/analysis'
import { buildIndexForCiv, condenseBuildOrder, type BuildKeyTiming } from '@domain/buildOrderSchema'
import { matchupTroops, type CivKeyUnit } from '@domain/civUnits'
import { landmarksForCiv } from '@domain/landmarks'
import { civDisplayName } from '@domain/civ'
import { computePlayerStats, type StatGame } from '@domain/playerStats'
import { cn } from '@shared/lib/utils'
import { useLiveMatch } from '../queries/useLiveMatch'
import { useSettings } from '../queries/useProfile'

const UNIT_CDN = 'https://data.aoe4world.com/images/units'
const AGE_NAME: Record<2 | 3 | 4, string> = { 2: 'Feudal', 3: 'Castle', 4: 'Imperial' }

/**
 * The pre-queue "match prep" surface (op.gg-style): your civ's key build
 * timings, landmark picks, matchup counters, and last-game goals in one card.
 * Idle mode preps vs your most-faced opponent civ; when a live ranked match is
 * detected it flips to the real opponent. Hidden until history exists — the
 * beginner on-ramp is RecommendedCivs.
 */
export function MatchPrepCard({ matches }: { matches: StoredMatch[] }) {
  const { data: live } = useLiveMatch()
  const { data: settings } = useSettings()
  const profileId = settings?.profileId ?? null

  const stats = useMemo(() => {
    const games: StatGame[] = matches.map((m) => ({
      result: m.result ?? resultFromPerPlayer(m.perPlayer, profileId),
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

  const liveOppCiv = live?.isLive && !live.custom ? (live.opponent?.civ ?? null) : null
  const myCiv = (live?.isLive ? live.myCiv : null) ?? stats.byCiv[0]?.key ?? null
  const oppCiv = liveOppCiv ?? stats.byOppCiv[0]?.key ?? null

  if (!myCiv) return null

  const buildIdx = buildIndexForCiv(BUNDLED_BUILD_ORDERS, myCiv)
  const build = buildIdx != null ? BUNDLED_BUILD_ORDERS[buildIdx]! : null
  const timings = build ? condenseBuildOrder(build) : []
  const landmarks = landmarksForCiv(myCiv)
  const troops = matchupTroops(myCiv, oppCiv)
  const goals = matches[0]?.goals ?? []

  const hasAnything = timings.length > 0 || landmarks != null || troops != null || goals.length > 0
  if (!hasAnything) return null

  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Swords className="h-4 w-4 text-primary" />
          Match prep · {civDisplayName(myCiv)}
        </h3>
        {liveOppCiv ? (
          <span className="rounded-sm bg-loss/15 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-loss">
            Live · vs {civDisplayName(liveOppCiv)}
          </span>
        ) : (
          oppCiv != null && (
            <span className="text-[11px] text-muted-foreground">
              prepped vs {civDisplayName(oppCiv)} (your most-faced civ)
            </span>
          )
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {build && timings.length > 0 && (
          <PrepCell title="Key timings">
            <ul className="space-y-1">
              {timings.map((t, i) => (
                <TimingRow key={i} t={t} />
              ))}
            </ul>
            <Link
              to={`/civ/${myCiv}`}
              className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              Full build: {build.name}
              <ChevronRight className="h-3 w-3" />
            </Link>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Practice it in a custom game — the game's detail page grades how closely you followed
              it.
            </p>
          </PrepCell>
        )}

        {landmarks && (
          <PrepCell title="Landmarks">
            <ul className="space-y-1">
              {landmarks.ages.map((a) => (
                <li key={a.age} className="flex items-baseline gap-2 text-xs">
                  <span className="w-14 shrink-0 font-semibold text-primary">
                    {AGE_NAME[a.age]}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={a.reason}>
                    {a.pick}
                  </span>
                </li>
              ))}
            </ul>
          </PrepCell>
        )}

        {troops && (troops.mine.length > 0 || troops.theirs.length > 0) && oppCiv != null && (
          <PrepCell title={`Counters vs ${civDisplayName(oppCiv)}`}>
            <div className="space-y-1.5">
              {troops.mine.length > 0 && (
                <TroopsLine
                  label="Build"
                  units={troops.mine.slice(0, 4)}
                  priority={troops.priority}
                />
              )}
              {troops.theirs.length > 0 && (
                <TroopsLine label="Expect" units={troops.theirs.slice(0, 4)} />
              )}
            </div>
          </PrepCell>
        )}

        {goals.length > 0 && (
          <PrepCell title="Focus from your last game">
            <ul className="space-y-1">
              {goals.map((g) => (
                <li key={g.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{g.text}</span>
                </li>
              ))}
            </ul>
          </PrepCell>
        )}
      </div>
    </section>
  )
}

function PrepCell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-3">
      <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function TimingRow({ t }: { t: BuildKeyTiming }) {
  return (
    <li className="grid grid-cols-[2.5rem_3rem_minmax(0,1fr)] items-start gap-2 text-xs">
      <span className="font-semibold tabular-nums text-primary">{t.time ?? '—'}</span>
      <span className="tabular-nums text-muted-foreground">{t.villagers} vill</span>
      <span className="min-w-0 leading-snug">
        {t.ageUpTo != null ? `${AGE_NAME[t.ageUpTo]} age` : (t.note ?? 'Opening')}
      </span>
    </li>
  )
}

function TroopsLine({
  label,
  units,
  priority,
}: {
  label: string
  units: CivKeyUnit[]
  priority?: Set<string>
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {units.map((u) => (
          <UnitChip key={u.name} unit={u} priority={priority?.has(u.name)} />
        ))}
      </div>
    </div>
  )
}

/** Compact CDN unit thumbnail with age-suffix fallback (same scheme as the
 *  overlay's MatchupBar UnitIcon); falls back to the unit name if all fail. */
function UnitChip({ unit, priority }: { unit: CivKeyUnit; priority?: boolean }) {
  const candidates = useMemo(
    () => Array.from(new Set([`-${unit.age}`, '-1', '-2', '-3', '-4', ''])),
    [unit.age],
  )
  const [idx, setIdx] = useState(0)
  const ring = priority ? 'ring-2 ring-win' : 'ring-1 ring-border'
  if (idx >= candidates.length) {
    return (
      <span
        title={unit.name}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded bg-secondary px-0.5 text-center text-[8px] font-semibold leading-tight',
          ring,
        )}
      >
        {unit.name}
      </span>
    )
  }
  return (
    <img
      key={candidates[idx]}
      src={`${UNIT_CDN}/${unit.icon}${candidates[idx]}.png`}
      alt={unit.name}
      title={unit.name}
      onError={() => setIdx((i) => i + 1)}
      className={cn('h-9 w-9 rounded bg-secondary object-contain', ring)}
    />
  )
}
