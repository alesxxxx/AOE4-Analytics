import { useMemo, useState } from 'react'
import { civDisplayName } from '@domain/civ'
import type { CivKeyUnit, MatchupTroops } from '@domain/civUnits'
import type { LiveMatchup, MatchupPlayer } from '@domain/liveMatch'
import { winProbability } from '@domain/winProbability'
import { UNIT_ICONS } from '@data/vendor/aoe4world-overlay/units'
import { formatRankLevel, formatRating } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { CivFlag } from './CivFlag'
import { panelBg } from './panelBg'

const AGE_ROMAN: Record<number, string> = { 2: 'II', 3: 'III', 4: 'IV' }
const UNIT_CDN = 'https://data.aoe4world.com/images/units'

/** One side of the legacy 1v1 matchup fallback. */
export interface MatchupSide {
  civ: string | null
  name: string | null
  rankLevel: string | null
  rating: number | null
  winRate: number | null
  favoriteCivs: string[]
  isAI: boolean
}

export function MatchupBar({
  me,
  opponent,
  matchup,
  troops,
}: {
  me: MatchupSide
  opponent: MatchupSide
  matchup?: LiveMatchup | null
  troops?: MatchupTroops | null
}) {
  const teams = matchup?.teams ?? []
  const hasTeams = teams.length >= 2 && teams.some((t) => t.length > 0)
  const hasTroops = !!troops && (troops.mine.length > 0 || troops.theirs.length > 0)
  const maxTeamSize = hasTeams ? Math.max(...teams.map((t) => t.length)) : 1
  // Pre-game win odds by rating gap (Elo expectation) — 1v1 with two rated
  // humans only; anything else (teams, AI, missing rating) hides the chip.
  const winOdds = useMemo(() => {
    const t = matchup?.teams ?? []
    if (t.length >= 2 && t.some((team) => team.length > 0)) {
      const mine = t[0] ?? []
      const theirs = t.slice(1).flat()
      if (mine.length !== 1 || theirs.length !== 1 || theirs[0]!.isAI) return null
      return winProbability(mine[0]!.rating, theirs[0]!.rating)
    }
    return opponent.isAI ? null : winProbability(me.rating, opponent.rating)
  }, [matchup, me.rating, opponent.isAI, opponent.rating])

  return (
    <div
      className="pointer-events-none select-none font-sans text-white"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
    >
      {hasTeams ? (
        <div className="flex flex-col items-center">
          <div className="flex items-start">
            <TeamColumn
              label={maxTeamSize > 1 ? 'Your Team' : null}
              players={teams[0] ?? []}
              align="left"
              winOdds={winOdds}
            />
            <div className="w-[220px] shrink-0" aria-hidden />
            <TeamColumn
              label={maxTeamSize > 1 ? 'Enemy Team' : null}
              players={teams.slice(1).flat()}
              align="right"
            />
          </div>
          {hasTroops && (
            // Wider center gap than the names row: the game draws its age-up
            // progress banner top-center BELOW its HUD bar — exactly at troop-row
            // height — so the icons must keep clear of a bigger center band.
            <div className="mt-1 flex items-start">
              <TroopsCol
                units={troops!.mine}
                priority={troops!.priority}
                align="left"
                label="Your army"
              />
              <div className="w-[430px] shrink-0" aria-hidden />
              <TroopsCol units={troops!.theirs} align="right" label="They make" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="flex items-start">
            <LegacySide side={me} align="left" winOdds={winOdds} />
            <div className="w-[280px] shrink-0" aria-hidden />
            <LegacySide side={opponent} align="right" />
          </div>
          {hasTroops && (
            <div className="mt-1 flex items-start">
              <TroopsCol
                units={troops!.mine}
                priority={troops!.priority}
                align="left"
                label="Your army"
              />
              <div className="w-[460px] shrink-0" aria-hidden />
              <TroopsCol units={troops!.theirs} align="right" label="They make" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TeamColumn({
  label,
  players,
  align,
  winOdds,
}: {
  label: string | null
  players: MatchupPlayer[]
  align: 'left' | 'right'
  /** Pre-game win odds (%) shown on the primary line; my column in a 1v1 only. */
  winOdds?: number | null
}) {
  const isRight = align === 'right'
  const color = isRight ? 'hsl(var(--loss))' : 'hsl(var(--win))'
  // One player gets today's full-size row; the rest render compact underneath, so
  // a 2v2+ bar doesn't take up nearly as much screen. Primary = me on my column,
  // else the first player (matches the "first opponent" convention used
  // elsewhere — liveMatch.ts, OverlayApp's enemyCivs — there's no existing
  // "most relevant opponent" heuristic beyond that).
  const primaryIdx = Math.max(
    0,
    players.findIndex((p) => p.isMe),
  )
  const primary = players[primaryIdx]
  const rest = players.filter((_, i) => i !== primaryIdx)
  return (
    <div
      className={cn(
        'min-w-[330px] max-w-[430px] overflow-hidden shadow-xl ring-1 ring-white/10',
        isRight ? 'rounded-l-xl' : 'rounded-r-xl',
      )}
      style={{
        background: `linear-gradient(to right, ${panelBg(0.97)}, ${panelBg(0.9)}, ${panelBg(0.61)})`,
        boxShadow: `inset ${isRight ? '-' : ''}3px 0 0 0 ${color}`,
      }}
    >
      {label && (
        <div
          className={cn(
            'border-b border-white/10 px-3 py-1 text-[10px] font-semibold uppercase text-white/45',
            isRight && 'text-right',
          )}
        >
          {label}
        </div>
      )}
      {primary && <PlayerLine player={primary} align={align} winOdds={winOdds} />}
      {rest.length > 0 && (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {rest.map((p, i) => (
            <CompactPlayerLine
              key={`${p.profileId}-${p.name}-${p.civ ?? 'unknown'}-${i}`}
              player={p}
              align={align}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerLine({
  player,
  align,
  winOdds,
}: {
  player: MatchupPlayer
  align: 'left' | 'right'
  winOdds?: number | null
}) {
  const isRight = align === 'right'
  const color = player.isMe
    ? 'hsl(var(--primary))'
    : isRight
      ? 'hsl(var(--loss))'
      : 'hsl(var(--win))'
  const rank =
    player.rankLevel && /[a-z]/i.test(player.rankLevel) ? formatRankLevel(player.rankLevel) : null
  return (
    <div
      className={cn('flex items-center gap-2 px-3 py-2', isRight && 'flex-row-reverse text-right')}
    >
      <CivFlag civ={player.civ} compact={false} />
      <div className={cn('min-w-0 flex-1', isRight && 'items-end')}>
        <div className={cn('flex items-baseline gap-2', isRight && 'flex-row-reverse')}>
          <span className="whitespace-nowrap text-[15px] font-bold" style={{ color }}>
            {player.civ ? civDisplayName(player.civ) : 'Unknown'}
          </span>
          <span
            className={cn(
              'flex min-w-0 items-center gap-1 text-[12px] text-white/85',
              isRight && 'flex-row-reverse',
            )}
          >
            {player.isMe && (
              <span className="rounded bg-primary/20 px-1 py-px text-[8px] font-semibold uppercase text-primary">
                You
              </span>
            )}
            {player.isAI && (
              <span className="rounded bg-white/15 px-1 py-px text-[8px] font-semibold uppercase text-white/75">
                AI
              </span>
            )}
            <span className="max-w-[150px] truncate">{player.name}</span>
          </span>
        </div>
        {(rank || player.rating != null || winOdds != null) && (
          <div
            className={cn(
              'mt-1 flex items-center gap-2 text-[11px] text-white/65',
              isRight && 'flex-row-reverse',
            )}
          >
            {rank && <span className="whitespace-nowrap">{rank}</span>}
            {player.rating != null && (
              <span className="font-semibold tabular-nums text-white/85">
                {formatRating(player.rating)}
              </span>
            )}
            {winOdds != null && <WinOddsChip pct={winOdds} />}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Pre-game win odds from the rating gap (Elo expectation) — an estimate, so the
 * label says "by rating" rather than presenting it as a prediction.
 */
function WinOddsChip({ pct }: { pct: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className={pct >= 50 ? 'text-win' : 'text-loss'}>{Math.round(pct)}%</span>{' '}
      <span className="text-white/55">by rating</span>
    </span>
  )
}

/** A teammate/opponent beyond the column's primary player — civ + name only, no rank/rating row. */
function CompactPlayerLine({ player, align }: { player: MatchupPlayer; align: 'left' | 'right' }) {
  const isRight = align === 'right'
  const color = player.isMe
    ? 'hsl(var(--primary))'
    : isRight
      ? 'hsl(var(--loss))'
      : 'hsl(var(--win))'
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1',
        isRight && 'flex-row-reverse text-right',
      )}
    >
      <CivFlag civ={player.civ} compact />
      <span
        className={cn('flex min-w-0 items-center gap-1 text-[11px]', isRight && 'flex-row-reverse')}
      >
        <span className="whitespace-nowrap font-semibold" style={{ color }}>
          {player.civ ? civDisplayName(player.civ) : 'Unknown'}
        </span>
        {player.isMe && (
          <span className="rounded bg-primary/20 px-1 py-px text-[7px] font-semibold uppercase text-primary">
            You
          </span>
        )}
        {player.isAI && (
          <span className="rounded bg-white/15 px-1 py-px text-[7px] font-semibold uppercase text-white/75">
            AI
          </span>
        )}
        <span className="max-w-[110px] truncate text-white/80">{player.name}</span>
      </span>
    </div>
  )
}

function TroopsCol({
  units,
  priority,
  align,
  label,
}: {
  units: CivKeyUnit[]
  priority?: Set<string>
  align: 'left' | 'right'
  label: string
}) {
  if (units.length === 0) return <div className="max-w-[380px]" aria-hidden />
  const isRight = align === 'right'
  return (
    <div className={cn('flex max-w-[430px] flex-col gap-1', isRight && 'items-end')}>
      <span
        className={cn('text-[10px] font-bold uppercase', isRight ? 'text-loss/85' : 'text-win/85')}
      >
        {label}
      </span>
      <div className={cn('flex items-start gap-1.5', isRight && 'flex-row-reverse')}>
        {units.map((u) => (
          <UnitIcon key={u.name} unit={u} priority={priority?.has(u.name)} />
        ))}
      </div>
    </div>
  )
}

function UnitIcon({ unit, priority }: { unit: CivKeyUnit; priority?: boolean }) {
  // Vendored icon first (bundled — instant, offline); the CDN self-heal chain
  // stays as the fallback for units added before the next vendoring run.
  const candidates = useMemo(() => {
    const cdn = Array.from(new Set([`-${unit.age}`, '-1', '-2', '-3', '-4', ''])).map(
      (suffix) => `${UNIT_CDN}/${unit.icon}${suffix}.png`,
    )
    const vendored = UNIT_ICONS[unit.icon]
    return vendored ? [vendored, ...cdn] : cdn
  }, [unit.age, unit.icon])
  const [idx, setIdx] = useState(0)
  const broken = idx >= candidates.length
  const ring = priority ? 'ring-2 ring-win' : 'ring-1 ring-white/15'
  // The green ring means "hard-counters something they make" — NOT "build only
  // this". Un-ringed units are still your civ's core army.
  const title = priority ? `${unit.name} — counters one of their key units` : unit.name
  return (
    <div className="flex w-[62px] flex-col items-center gap-0.5" title={title}>
      {broken ? (
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded bg-white/10 px-0.5 text-center text-[8px] font-semibold leading-tight text-white/90',
            ring,
          )}
        >
          {unit.name}
        </span>
      ) : (
        <img
          key={candidates[idx]}
          src={candidates[idx]}
          alt={unit.name}
          onError={() => setIdx((i) => i + 1)}
          className={cn('h-11 w-11 rounded bg-black/40 object-contain', ring)}
        />
      )}
      <span className="h-[22px] w-full overflow-hidden text-center text-[9px] font-medium leading-[11px] text-white/80">
        {unit.name}
      </span>
      <span className="text-[8px] font-bold leading-none text-white/55">{AGE_ROMAN[unit.age]}</span>
    </div>
  )
}

function LegacySide({
  side,
  align,
  winOdds,
}: {
  side: MatchupSide
  align: 'left' | 'right'
  winOdds?: number | null
}) {
  const isRight = align === 'right'
  const color = isRight ? 'hsl(var(--loss))' : 'hsl(var(--win))'
  const rank =
    side.rankLevel && /[a-z]/i.test(side.rankLevel) ? formatRankLevel(side.rankLevel) : null
  const hasRow2 =
    !side.isAI &&
    (rank != null ||
      side.rating != null ||
      side.winRate != null ||
      side.favoriteCivs.length > 0 ||
      winOdds != null)
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2',
        isRight ? 'flex-row-reverse rounded-l-xl' : 'rounded-r-xl',
      )}
      style={{
        background: `linear-gradient(to ${isRight ? 'left' : 'right'}, ${panelBg(0.97)}, ${panelBg(0.82)}, ${panelBg(0.15)})`,
        boxShadow: `inset ${isRight ? '-' : ''}3px 0 0 0 ${color}`,
      }}
    >
      <CivFlag civ={side.civ} compact={false} />
      <div className={cn('flex min-w-0 flex-col gap-1', isRight && 'items-end')}>
        <div
          className={cn('flex items-baseline gap-2 leading-none', isRight && 'flex-row-reverse')}
        >
          <span className="whitespace-nowrap text-[17px] font-bold" style={{ color }}>
            {side.civ ? civDisplayName(side.civ) : 'Unknown'}
          </span>
          <span
            className={cn(
              'flex items-center gap-1 text-[12px] font-medium text-white/85',
              isRight && 'flex-row-reverse',
            )}
          >
            {side.isAI && (
              <span className="rounded bg-white/15 px-1 py-px text-[8px] font-semibold uppercase text-white/80">
                AI
              </span>
            )}
            <span className="max-w-[170px] truncate">
              {side.name ?? (isRight ? 'Opponent' : 'You')}
            </span>
          </span>
        </div>
        {hasRow2 && (
          <div
            className={cn(
              'flex items-center gap-2.5 text-[11px] leading-none text-white/75',
              isRight && 'flex-row-reverse',
            )}
          >
            {rank && <span className="whitespace-nowrap">{rank}</span>}
            {side.rating != null && (
              <span className="whitespace-nowrap font-semibold tabular-nums text-white/90">
                {formatRating(side.rating)}
              </span>
            )}
            {side.winRate != null && (
              <span className="whitespace-nowrap tabular-nums">
                <span className={side.winRate >= 50 ? 'text-win' : 'text-loss'}>
                  {Math.round(side.winRate)}%
                </span>{' '}
                WR
              </span>
            )}
            {winOdds != null && <WinOddsChip pct={winOdds} />}
            {side.favoriteCivs.length > 0 && (
              <span className={cn('flex items-center gap-1', isRight && 'flex-row-reverse')}>
                {side.favoriteCivs.map((c) => (
                  <CivFlag key={c} civ={c} compact />
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
