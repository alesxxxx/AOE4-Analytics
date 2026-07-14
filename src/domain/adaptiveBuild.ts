/**
 * Adaptive build coaching (pure).
 *
 * Post-game recommendations are derived only from Build Trainer checkpoints.
 * Live response forks use the selected reference build plus static civilization
 * counter data. They never imply that RTSLytics observed an opponent's hidden
 * build, resources, or army.
 */
import type { BuildOrder } from './buildOrderSchema'
import type { TrainerCheckpoint, TrainerReport } from './buildTrainer'
import { counterPlanForCiv } from './civUnits'
import { formatDuration } from './format'

export type RecoveryKind = 'late-age' | 'villager-deficit' | 'data-gap'

export interface RecoveryRecommendation {
  kind: RecoveryKind
  title: string
  /** A factual observation from a TrainerReport checkpoint. */
  evidence: string
  /** A practice suggestion, deliberately separate from the evidence. */
  advice: string
}

/**
 * Builds a short, deterministic recovery plan from actual checkpoint misses.
 * At most one recommendation per problem type is shown so repeated checkpoints
 * do not overwhelm the post-game review.
 */
export function buildRecoveryPlan(
  report: TrainerReport,
  maxRecommendations = 3,
): RecoveryRecommendation[] {
  if (maxRecommendations <= 0) return []

  const recommendations: RecoveryRecommendation[] = []
  const lateAge = report.checkpoints
    .filter(isLateAgeMiss)
    .sort((a, b) => (b.deltaSec ?? 0) - (a.deltaSec ?? 0) || a.targetTimeSec - b.targetTimeSec)[0]
  if (lateAge?.actualTimeSec != null && lateAge.deltaSec != null) {
    recommendations.push({
      kind: 'late-age',
      title: `${lateAge.label} timing`,
      evidence: `${lateAge.label} completed at ${formatDuration(lateAge.actualTimeSec)}, ${formatDuration(lateAge.deltaSec)} after the ${formatDuration(lateAge.targetTimeSec)} target.`,
      advice: `Practice the steps immediately before this checkpoint and aim to complete the landmark by ${formatDuration(lateAge.targetTimeSec)}; only branch away when your scouting calls for it.`,
    })
  }

  const villagerDeficit = report.checkpoints
    .filter(isVillagerDeficit)
    .sort(
      (a, b) =>
        (a.villagerDelta ?? 0) - (b.villagerDelta ?? 0) || a.targetTimeSec - b.targetTimeSec,
    )[0]
  if (
    villagerDeficit?.actualVillagers != null &&
    villagerDeficit.targetVillagers != null &&
    villagerDeficit.villagerDelta != null
  ) {
    const behind = Math.abs(villagerDeficit.villagerDelta)
    recommendations.push({
      kind: 'villager-deficit',
      title: `Villagers at ${formatDuration(villagerDeficit.targetTimeSec)}`,
      evidence: `${villagerDeficit.actualVillagers} villagers were recorded against a target of ${villagerDeficit.targetVillagers} (${behind} behind).`,
      advice: `Practice uninterrupted villager production through ${formatDuration(villagerDeficit.targetTimeSec)}; if the queue stops, restart it before optional build steps.`,
    })
  }

  const ungradeable = report.checkpoints.filter((checkpoint) => checkpoint.ok == null)
  if (ungradeable.length > 0) {
    const villagerCount = ungradeable.filter((checkpoint) => checkpoint.kind === 'villagers').length
    const ageCount = ungradeable.filter((checkpoint) => checkpoint.kind === 'ageup').length
    const unavailable = [
      checkpointCount(villagerCount, 'villager checkpoint'),
      checkpointCount(ageCount, 'landmark checkpoint'),
    ].filter(Boolean)
    recommendations.push({
      kind: 'data-gap',
      title: 'Unrecorded checkpoints',
      evidence: `Decoded match data could not grade ${joinList(unavailable)}.`,
      advice:
        'Review those checkpoints manually in a custom-game practice run; do not treat missing decoded data as a failed step.',
    })
  }

  return recommendations.slice(0, Math.floor(maxRecommendations))
}

function isLateAgeMiss(
  checkpoint: TrainerCheckpoint,
): checkpoint is TrainerCheckpoint & { kind: 'ageup'; actualTimeSec: number; deltaSec: number } {
  return (
    checkpoint.kind === 'ageup' &&
    checkpoint.ok === false &&
    checkpoint.actualTimeSec != null &&
    checkpoint.deltaSec != null &&
    checkpoint.deltaSec > 0
  )
}

function isVillagerDeficit(checkpoint: TrainerCheckpoint): checkpoint is TrainerCheckpoint & {
  kind: 'villagers'
  actualVillagers: number
  targetVillagers: number
  villagerDelta: number
} {
  return (
    checkpoint.kind === 'villagers' &&
    checkpoint.ok === false &&
    checkpoint.actualVillagers != null &&
    checkpoint.targetVillagers != null &&
    checkpoint.villagerDelta != null &&
    checkpoint.villagerDelta < 0
  )
}

function checkpointCount(count: number, label: string): string {
  if (count <= 0) return ''
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function joinList(values: string[]): string {
  if (values.length === 0) return 'any checkpoints'
  if (values.length === 1) return values[0]!
  return `${values[0]} and ${values[1]}`
}

export interface LiveBuildFork {
  source: 'reference-build' | 'static-matchup'
  /** Always framed as a condition the player must verify by scouting. */
  condition: string
  advice: string
}

export interface LiveBuildForkPlan {
  forks: LiveBuildFork[]
  /** Honest coverage note for absent/partial opponent civilization data. */
  coverageNote: string | null
}

/**
 * Produces compact read-only branches for the overlay. Opponent civilization
 * names select static matchup guidance only; they are not evidence of a live
 * unit or strategy. Team guidance is merged and capped.
 */
export function liveBuildForkPlan(input: {
  reference: BuildOrder
  opponentCivs: (string | null | undefined)[]
  maxForks?: number
}): LiveBuildForkPlan {
  const maxForks = Math.max(0, Math.floor(input.maxForks ?? 2))
  const knownCivs = dedupe(input.opponentCivs.filter(isKnownCiv))
  const unknownCount = input.opponentCivs.length - input.opponentCivs.filter(isKnownCiv).length
  const forks: LiveBuildFork[] = []

  const staticFork = matchupFork(input.reference, knownCivs)
  if (staticFork) forks.push(staticFork)

  const buildFork = referenceBuildFork(input.reference)
  if (buildFork) forks.push(buildFork)

  let coverageNote: string | null = null
  if (knownCivs.length === 0) {
    coverageNote = 'Opponent civilization unavailable — no matchup branch inferred.'
  } else if (unknownCount > 0) {
    coverageNote = `${unknownCount} opponent civilization${unknownCount === 1 ? '' : 's'} unknown — matchup guidance covers known civilizations only.`
  } else if (!staticFork) {
    coverageNote = 'No static counter guidance is available for the known opponent civilization.'
  }

  return { forks: forks.slice(0, maxForks), coverageNote }
}

function matchupFork(reference: BuildOrder, knownCivs: string[]): LiveBuildFork | null {
  const plans = knownCivs.map((civ) => counterPlanForCiv(civ, 2)).filter((plan) => plan != null)
  if (plans.length === 0) return null

  // Round-robin keeps team guidance representative: the first enemy cannot
  // consume both compact slots before the next enemy contributes one.
  const threats = mergeLimited(
    plans.map((plan) => plan.keyUnits.map((unit) => unit.name)),
    2,
  )
  const counters = mergeLimited(
    plans.map((plan) => plan.counters.map((counter) => counter.label)),
    2,
  )
  if (threats.length === 0 || counters.length === 0) return null

  return {
    source: 'static-matchup',
    condition: `If you scout ${joinOr(threats)}:`,
    advice: `Keep ${reference.name} as the baseline; prioritize ${joinAnd(counters)}.`,
  }
}

/** Extract one opponent-dependent branch already authored in the selected build. */
function referenceBuildFork(reference: BuildOrder): LiveBuildFork | null {
  for (const step of reference.build_order) {
    for (const rawNote of step.notes) {
      const parsed = parseOpponentConditional(rawNote)
      if (parsed) return { source: 'reference-build', ...parsed }
    }
  }
  return null
}

function parseOpponentConditional(
  rawNote: string,
): Pick<LiveBuildFork, 'condition' | 'advice'> | null {
  const note = cleanNote(rawNote)
  const leading = note.match(/^if\s+(.+?)[,:]\s*(.+)$/i)
  if (leading && isOpponentCondition(leading[1]!)) {
    return {
      condition: `If you scout ${normalizeCondition(leading[1]!)}:`,
      advice: compact(leading[2]!),
    }
  }

  const trailing = note.match(/^(.+?)\s+if\s+(.+?)[.]?$/i)
  if (trailing && isOpponentCondition(trailing[2]!)) {
    return {
      condition: `If you scout ${normalizeCondition(trailing[2]!)}:`,
      advice: compact(trailing[1]!),
    }
  }
  return null
}

function isOpponentCondition(value: string): boolean {
  return /\b(enemy|opponent|they|aggress|rush|pressure|spearmen?|archers?|cavalry|knights?|horsemen?|2\s*tc|fast castle|fc)\b/i.test(
    value,
  )
}

function normalizeCondition(value: string): string {
  return compact(
    value
      .replace(/^your opponent is aggressive$/i, 'opponent aggression')
      .replace(/^the enemy is crippled$/i, 'the enemy is badly damaged')
      .replace(/^they overbuild spearmen$/i, 'mass Spearmen')
      .replace(/[.]+$/, ''),
    64,
  )
}

function cleanNote(note: string): string {
  return note
    .replace(/@[^@]+@/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compact(value: string, maxLength = 105): string {
  const clean = value.trim().replace(/[.]+$/, '')
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`
}

function isKnownCiv(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function mergeLimited(groups: string[][], limit: number): string[] {
  const merged: string[] = []
  const seen = new Set<string>()
  const longest = Math.max(0, ...groups.map((group) => group.length))
  for (let index = 0; index < longest && merged.length < limit; index++) {
    for (const group of groups) {
      const value = group[index]
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(value)
      if (merged.length >= limit) break
    }
  }
  return merged
}

function joinOr(values: string[]): string {
  if (values.length <= 1) return values[0] ?? 'the listed threat'
  return `${values[0]} or ${values[1]}`
}

function joinAnd(values: string[]): string {
  if (values.length <= 1) return values[0] ?? 'the listed counter'
  return `${values[0]} and ${values[1]}`
}
