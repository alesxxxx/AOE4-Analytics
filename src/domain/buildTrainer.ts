/**
 * Build trainer (pure): grades how closely a played game followed a reference
 * build order, using the game's decoded stat summary (`statsSummary.ts`). Two
 * checkpoint kinds, both derived from the reference's timed steps:
 *
 *  - villagers: produced-villager events + the reference's opening count give
 *    the villager total at each timed step. Approximate by design — the summary
 *    records production, not deaths — so the tolerance is generous (±2).
 *  - ageup: the first building event whose name matches one of the civ's
 *    landmarks for that age (landmarks.ts) is taken as the age-up. Civs without
 *    landmark data (or games where none matched) leave the checkpoint
 *    ungradeable rather than guessed (D10).
 *
 * `score` is the share of gradeable checkpoints passed; null when nothing
 * could be graded (e.g. an empty/missing summary).
 */
import type { BuildOrder } from './buildOrderSchema'
import type { BuildEvent } from './statsSummary'
import { formatDuration, parseDuration } from './format'
import { landmarksForCiv } from './landmarks'

export interface TrainerCheckpoint {
  kind: 'villagers' | 'ageup'
  label: string
  /** For ageups: the age this checkpoint enters. */
  ageUpTo?: 2 | 3 | 4
  targetTimeSec: number
  targetVillagers?: number
  actualVillagers?: number | null
  /** actual − target villagers (+ = over the plan). */
  villagerDelta?: number | null
  actualTimeSec?: number | null
  /** actual − target seconds (+ = late). */
  deltaSec?: number | null
  /** Passed within tolerance; null when ungradeable (no data / no landmark match). */
  ok: boolean | null
}

export interface TrainerReport {
  buildName: string
  checkpoints: TrainerCheckpoint[]
  /** % of gradeable checkpoints passed; null when nothing was gradeable. */
  score: number | null
}

const VILLAGER_TOLERANCE = 2
const AGEUP_TOLERANCE_SEC = 60
const AGE_LABEL: Record<2 | 3 | 4, string> = { 2: 'Feudal', 3: 'Castle', 4: 'Imperial' }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Earliest building event matching one of the civ's landmarks, per age. */
function landmarkTimes(events: BuildEvent[], civ: string | null): Map<2 | 3 | 4, number> {
  const times = new Map<2 | 3 | 4, number>()
  const landmarks = landmarksForCiv(civ)
  if (!landmarks) return times
  for (const choice of landmarks.ages) {
    const names = new Set(choice.options.map(norm))
    for (const e of events) {
      if (e.category !== 'building' || !names.has(norm(e.name))) continue
      const prev = times.get(choice.age)
      if (prev == null || e.timeSec < prev) times.set(choice.age, e.timeSec)
    }
  }
  return times
}

export function gradeBuildFollow(input: {
  reference: BuildOrder
  events: BuildEvent[]
  /** My civ slug (for the landmark lookup). */
  civ: string | null
}): TrainerReport {
  const { reference, events, civ } = input
  // An empty event list means "no data", not "produced nothing" — leave
  // villager checkpoints ungradeable instead of scoring a phantom zero.
  const hasData = events.length > 0
  const startingVillagers = reference.build_order[0]?.villager_count ?? 6
  const villagerTimes = events
    .filter((e) => e.name === 'Villager')
    .map((e) => e.timeSec)
    .sort((a, b) => a - b)
  const producedBy = (t: number) => villagerTimes.filter((ts) => ts <= t).length
  const ageUps = landmarkTimes(events, civ)

  const checkpoints: TrainerCheckpoint[] = []
  let maxAge = 1
  reference.build_order.forEach((s, i) => {
    const t = s.time != null ? parseDuration(s.time) : null
    const agedUp = i !== 0 && s.age > maxAge && s.age >= 2
    maxAge = Math.max(maxAge, s.age)
    if (t == null) return

    const actualVillagers = hasData ? startingVillagers + producedBy(t) : null
    checkpoints.push({
      kind: 'villagers',
      label: `Villagers @ ${formatDuration(t)}`,
      targetTimeSec: t,
      targetVillagers: s.villager_count,
      actualVillagers,
      villagerDelta: actualVillagers != null ? actualVillagers - s.villager_count : null,
      ok:
        actualVillagers != null
          ? Math.abs(actualVillagers - s.villager_count) <= VILLAGER_TOLERANCE
          : null,
    })

    if (agedUp) {
      const age = Math.min(s.age, 4) as 2 | 3 | 4
      const actual = ageUps.get(age) ?? null
      checkpoints.push({
        kind: 'ageup',
        ageUpTo: age,
        label: `${AGE_LABEL[age]} landmark`,
        targetTimeSec: t,
        actualTimeSec: actual,
        deltaSec: actual != null ? actual - t : null,
        ok: actual != null ? Math.abs(actual - t) <= AGEUP_TOLERANCE_SEC : null,
      })
    }
  })

  const gradeable = checkpoints.filter((c) => c.ok !== null)
  const passed = gradeable.filter((c) => c.ok).length
  return {
    buildName: reference.name,
    checkpoints,
    score: gradeable.length > 0 ? Math.round((passed / gradeable.length) * 100) : null,
  }
}
