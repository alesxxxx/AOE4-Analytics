import { formatDuration } from './format'
import { VILLAGER_IDLE_GAP_SEC, summaryPlayerForMe } from './summaryCoaching'
import type { MatchSummary, PlayerSummary, ResourceAmounts, ScorePoint } from './statsSummary'

export type TurningPointKind =
  | 'age-up'
  | 'resource-swing'
  | 'resource-bank'
  | 'score-swing'
  | 'score-lane'
  | 'unit-milestone'
  | 'villager-gap'

export type TurningPointAnchor = 'summary' | 'resources' | 'score' | 'build-order'
export type TurningPointTone = 'positive' | 'caution' | 'neutral'

export interface TurningPoint {
  id: string
  kind: TurningPointKind
  title: string
  /** The timestamp displayed for a single moment, or the end of an interval. */
  timeSec: number
  /** Present when the evidence covers an interval instead of one instant. */
  startTimeSec: number | null
  /** A statement supported directly by the decoded post-game summary. */
  observed: string
  /** A cautious interpretation that does not claim the underlying cause is known. */
  coaching: string
  anchor: TurningPointAnchor
  tone: TurningPointTone
}

export interface TurningPointInput {
  summary: MatchSummary
  myProfileId: number | null
  myCiv: string | null
}

interface RankedTurningPoint {
  point: TurningPoint
  priority: number
}

interface GapChange {
  startSec: number
  endSec: number
  before: number
  after: number
  change: number
}

interface TimedValue {
  timeSec: number
  value: number
}

const MAX_TURNING_POINTS = 5
const AGE_NAMES = new Map<number, string>([
  [2, 'Feudal'],
  [3, 'Castle'],
  [4, 'Imperial'],
])

/**
 * Produce a short, chronological post-game story from facts in MatchSummary.
 * Comparisons are deliberately limited to two-player summaries because the
 * summary does not identify team membership. Team games use only the user's row.
 */
export function deriveTurningPoints(input: TurningPointInput): TurningPoint[] {
  const me = summaryPlayerForMe(input.summary, input.myProfileId, input.myCiv)
  if (!me) return []

  const opponent =
    input.summary.players.length === 2
      ? (input.summary.players.find((player) => player.playerId !== me.playerId) ?? null)
      : null

  const candidates: RankedTurningPoint[] = []
  addCandidate(candidates, ageUpPoint(me, opponent), 3)
  addCandidate(candidates, longestVillagerGapPoint(me), 2)
  addCandidate(candidates, firstNonVillagerUnitPoint(me), 4)

  if (opponent) {
    addCandidate(candidates, comparisonScoreSwingPoint(me, opponent), 0)
    const resourceSwing = comparisonResourceSwingPoint(me, opponent)
    addCandidate(candidates, resourceSwing, 1)
    if (!resourceSwing) addCandidate(candidates, resourceBankPoint(me), 1)
  } else {
    addCandidate(candidates, selfScoreLanePoint(me), 0)
    addCandidate(candidates, resourceBankPoint(me), 1)
  }

  return candidates
    .sort((a, b) => a.priority - b.priority || comparePoints(a.point, b.point))
    .slice(0, MAX_TURNING_POINTS)
    .map(({ point }) => point)
    .sort(comparePoints)
}

function addCandidate(
  candidates: RankedTurningPoint[],
  point: TurningPoint | null,
  priority: number,
): void {
  if (point) candidates.push({ point, priority })
}

function comparePoints(a: TurningPoint, b: TurningPoint): number {
  return a.timeSec - b.timeSec || a.id.localeCompare(b.id)
}

function ageUpPoint(me: PlayerSummary, opponent: PlayerSummary | null): TurningPoint | null {
  const ages = [
    { age: 2, timeSec: finiteNonNegative(me.totals?.age2Sec) },
    { age: 3, timeSec: finiteNonNegative(me.totals?.age3Sec) },
    { age: 4, timeSec: finiteNonNegative(me.totals?.age4Sec) },
  ]
  const reached = ages.find((entry) => entry.timeSec != null)
  if (!reached || reached.timeSec == null) return null

  const ageName = AGE_NAMES.get(reached.age) ?? `Age ${reached.age}`
  const opponentTime = finiteNonNegative(ageTime(opponent, reached.age))
  let observed = `You reached ${ageName} Age at ${formatDuration(reached.timeSec)}.`
  let coaching =
    'Use this as an opening checkpoint. The timestamp alone does not show whether the timing fit the matchup or your chosen build.'
  let tone: TurningPointTone = 'neutral'

  if (opponentTime != null) {
    const deltaSec = Math.round(reached.timeSec - opponentTime)
    if (deltaSec > 0) {
      observed = `You reached ${ageName} Age at ${formatDuration(reached.timeSec)}, ${formatDuration(deltaSec)} after the other player.`
      coaching =
        'That timing difference may have created a technology window, but the summary does not show how either player used it.'
      tone = 'caution'
    } else if (deltaSec < 0) {
      observed = `You reached ${ageName} Age at ${formatDuration(reached.timeSec)}, ${formatDuration(Math.abs(deltaSec))} before the other player.`
      coaching =
        'That timing difference may have created a technology window. Check nearby production events to see whether you converted it into pressure or economy.'
      tone = 'positive'
    } else {
      observed = `Both players reached ${ageName} Age at ${formatDuration(reached.timeSec)}.`
      coaching =
        'The age timing was even; nearby production and resource choices are more useful for explaining what happened next.'
    }
  }

  return {
    id: `turning-age-${reached.age}`,
    kind: 'age-up',
    title: `${ageName} timing`,
    timeSec: reached.timeSec,
    startTimeSec: null,
    observed,
    coaching,
    anchor: 'summary',
    tone,
  }
}

function ageTime(player: PlayerSummary | null, age: number): number | null {
  if (!player?.totals) return null
  if (age === 2) return player.totals.age2Sec
  if (age === 3) return player.totals.age3Sec
  if (age === 4) return player.totals.age4Sec
  return null
}

function longestVillagerGapPoint(me: PlayerSummary): TurningPoint | null {
  const times = me.buildOrder
    .filter(
      (event) =>
        event.category === 'unit' &&
        (event.blueprint.startsWith('unit_villager') || event.name === 'Villager'),
    )
    .map((event) => finiteNonNegative(event.timeSec))
    .filter((timeSec): timeSec is number => timeSec != null)
    .sort((a, b) => a - b)

  let longest: { startSec: number; endSec: number; durationSec: number } | null = null
  for (let index = 1; index < times.length; index++) {
    const startSec = times[index - 1]!
    const endSec = times[index]!
    const durationSec = endSec - startSec
    if (durationSec <= VILLAGER_IDLE_GAP_SEC) continue
    if (!longest || durationSec > longest.durationSec) {
      longest = { startSec, endSec, durationSec }
    }
  }
  if (!longest) return null

  return {
    id: `turning-villager-gap-${Math.round(longest.endSec)}`,
    kind: 'villager-gap',
    title: 'Longest villager-production gap',
    timeSec: longest.endSec,
    startTimeSec: longest.startSec,
    observed: `No villager completion was recorded for ${formatDuration(longest.durationSec)}, from ${formatDuration(longest.startSec)} to ${formatDuration(longest.endSec)}.`,
    coaching:
      'This may indicate Town Center idle time. Extra Town Centers, production-speed changes, or incomplete build events can also affect the interval.',
    anchor: 'build-order',
    tone: 'caution',
  }
}

function firstNonVillagerUnitPoint(me: PlayerSummary): TurningPoint | null {
  const event = [...me.buildOrder]
    .filter(
      (entry) =>
        entry.category === 'unit' &&
        entry.timeSec >= 30 &&
        !entry.blueprint.startsWith('unit_villager') &&
        entry.name !== 'Villager' &&
        Number.isFinite(entry.timeSec),
    )
    .sort((a, b) => a.timeSec - b.timeSec || a.name.localeCompare(b.name))[0]
  if (!event) return null

  return {
    id: `turning-unit-${Math.round(event.timeSec)}`,
    kind: 'unit-milestone',
    title: 'First non-villager unit',
    timeSec: event.timeSec,
    startTimeSec: null,
    observed: `${event.name} was the first recorded non-villager unit, completed at ${formatDuration(event.timeSec)}.`,
    coaching:
      'Treat this as an opening checkpoint. Whether it was early or late depends on the selected build, civilization, and matchup.',
    anchor: 'build-order',
    tone: 'neutral',
  }
}

function comparisonScoreSwingPoint(
  me: PlayerSummary,
  opponent: PlayerSummary,
): TurningPoint | null {
  const change = largestGapChange(
    timedValues(me.scores, (point) => point.total),
    timedValues(opponent.scores, (point) => point.total),
  )
  if (!change || Math.abs(change.change) < 1) return null

  const inMyFavor = change.change > 0
  return {
    id: `turning-score-swing-${Math.round(change.endSec)}`,
    kind: 'score-swing',
    title: `Largest recorded score shift ${inMyFavor ? 'in your favor' : 'against you'}`,
    timeSec: change.endSec,
    startTimeSec: change.startSec,
    observed: `The total-score gap moved by ${whole(Math.abs(change.change))} ${inMyFavor ? 'in your favor' : 'against you'}, from ${signed(change.before)} to ${signed(change.after)}.`,
    coaching:
      'This may mark a momentum shift. Compare the score lanes and build events around this interval; total score alone does not identify a fight or its cause.',
    anchor: 'score',
    tone: inMyFavor ? 'positive' : 'caution',
  }
}

function selfScoreLanePoint(me: PlayerSummary): TurningPoint | null {
  const points = validScorePoints(me.scores)
  let best: {
    startSec: number
    endSec: number
    lane: 'economy' | 'military' | 'society' | 'technology'
    change: number
    rate: number
  } | null = null
  const lanes = ['economy', 'military', 'society', 'technology'] as const

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!
    const current = points[index]!
    const durationSec = current.timeSec - previous.timeSec
    if (durationSec <= 0) continue
    for (const lane of lanes) {
      const change = current[lane] - previous[lane]
      const rate = change / durationSec
      if (change > 0 && (!best || rate > best.rate)) {
        best = {
          startSec: previous.timeSec,
          endSec: current.timeSec,
          lane,
          change,
          rate,
        }
      }
    }
  }
  if (!best) return null

  const laneName = capitalize(best.lane)
  return {
    id: `turning-score-lane-${Math.round(best.endSec)}`,
    kind: 'score-lane',
    title: `Fastest ${laneName.toLowerCase()} score growth`,
    timeSec: best.endSec,
    startTimeSec: best.startSec,
    observed: `Your recorded ${laneName.toLowerCase()} score rose by ${whole(best.change)} during this interval.`,
    coaching:
      'This shows where that score lane grew fastest between samples. It does not identify a fight, decision, teammate contribution, or underlying cause.',
    anchor: 'score',
    tone: 'neutral',
  }
}

function comparisonResourceSwingPoint(
  me: PlayerSummary,
  opponent: PlayerSummary,
): TurningPoint | null {
  const change = largestGapChange(
    timedValues(me.resources, (point) => resourceTotal(point.gathered)),
    timedValues(opponent.resources, (point) => resourceTotal(point.gathered)),
  )
  if (!change || Math.abs(change.change) < 1) return null

  const inMyFavor = change.change > 0
  return {
    id: `turning-resource-swing-${Math.round(change.endSec)}`,
    kind: 'resource-swing',
    title: `Largest recorded economy shift ${inMyFavor ? 'in your favor' : 'against you'}`,
    timeSec: change.endSec,
    startTimeSec: change.startSec,
    observed: `The cumulative gathered-resource gap moved by ${whole(Math.abs(change.change))} ${inMyFavor ? 'in your favor' : 'against you'}, from ${signed(change.before)} to ${signed(change.after)}.`,
    coaching:
      'This may reflect worker count, idle time, or access to safer resources. The resource totals do not prove which cause was responsible.',
    anchor: 'resources',
    tone: inMyFavor ? 'positive' : 'caution',
  }
}

function resourceBankPoint(me: PlayerSummary): TurningPoint | null {
  let peak: { timeSec: number; total: number } | null = null
  for (const point of me.resources) {
    const timeSec = finiteNonNegative(point.timeSec)
    const total = resourceTotal(point.bank)
    if (timeSec == null || !Number.isFinite(total) || total <= 0) continue
    if (!peak || total > peak.total || (total === peak.total && timeSec < peak.timeSec)) {
      peak = { timeSec, total }
    }
  }
  if (!peak) return null

  return {
    id: `turning-bank-${Math.round(peak.timeSec)}`,
    kind: 'resource-bank',
    title: 'Largest recorded resource bank',
    timeSec: peak.timeSec,
    startTimeSec: null,
    observed: `Your recorded bank peaked at ${whole(peak.total)} total resources at ${formatDuration(peak.timeSec)}.`,
    coaching:
      'This may have been intentional saving for an age-up or technology. If it was not, check whether units, upgrades, or production could have been queued sooner.',
    anchor: 'resources',
    tone: 'neutral',
  }
}

function largestGapChange(mine: TimedValue[], theirs: TimedValue[]): GapChange | null {
  const theirsByTime = new Map(theirs.map((point) => [timeKey(point.timeSec), point.value]))
  const shared = mine
    .map((point) => {
      const other = theirsByTime.get(timeKey(point.timeSec))
      return other == null ? null : { timeSec: point.timeSec, difference: point.value - other }
    })
    .filter(
      (point): point is { timeSec: number; difference: number } =>
        point != null && Number.isFinite(point.difference),
    )
    .sort((a, b) => a.timeSec - b.timeSec)

  let best: (GapChange & { magnitude: number; rate: number }) | null = null
  for (let index = 1; index < shared.length; index++) {
    const previous = shared[index - 1]!
    const current = shared[index]!
    const durationSec = current.timeSec - previous.timeSec
    if (durationSec <= 0) continue
    const change = current.difference - previous.difference
    const magnitude = Math.abs(change)
    const rate = magnitude / durationSec
    if (
      change !== 0 &&
      (!best || magnitude > best.magnitude || (magnitude === best.magnitude && rate > best.rate))
    ) {
      best = {
        startSec: previous.timeSec,
        endSec: current.timeSec,
        before: previous.difference,
        after: current.difference,
        change,
        magnitude,
        rate,
      }
    }
  }
  if (!best) return null
  const { magnitude: _magnitude, rate: _rate, ...change } = best
  return change
}

function timedValues<T extends { timeSec: number }>(
  points: T[],
  valueOf: (point: T) => number,
): TimedValue[] {
  return points
    .map((point) => ({ timeSec: point.timeSec, value: valueOf(point) }))
    .filter(
      (point) =>
        Number.isFinite(point.timeSec) && point.timeSec >= 0 && Number.isFinite(point.value),
    )
    .sort((a, b) => a.timeSec - b.timeSec)
}

function validScorePoints(points: ScorePoint[]): ScorePoint[] {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.timeSec) &&
        point.timeSec >= 0 &&
        Number.isFinite(point.economy) &&
        Number.isFinite(point.military) &&
        Number.isFinite(point.society) &&
        Number.isFinite(point.technology),
    )
    .sort((a, b) => a.timeSec - b.timeSec)
}

function resourceTotal(resources: ResourceAmounts): number {
  return resources.food + resources.wood + resources.gold + resources.stone
}

function finiteNonNegative(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null
}

/** Timelines share whole-second sample keys even when the decoded floats differ slightly. */
function timeKey(timeSec: number): number {
  return Math.round(timeSec)
}

function signed(value: number): string {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}`
  return String(rounded)
}

function whole(value: number): string {
  return String(Math.round(value))
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
