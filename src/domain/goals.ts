/**
 * Goal generation + checking (pure). Goals are derived from a match analysis
 * and the bracket benchmarks. Where the data allows (local economy stats), a
 * goal is auto-checkable against the next game; otherwise it is a self-check
 * habit. No Date.now/random here — callers pass `nowIso` and a `matchId` seed.
 */

import type { Benchmarks } from './benchmarks'
import { computeApm, type LocalGameStats, type MatchAnalysis } from './analysis'
import { formatDuration } from './format'

export type GoalMetric = 'villagersProduced' | 'apm' | 'result' | 'self'

export interface Goal {
  id: string
  text: string
  metric: GoalMetric
  target: number
  comparison: 'gte' | 'lte'
  createdAt: string
  sourceMatchId?: string
}

export interface GoalCheck {
  goal: Goal
  status: 'achieved' | 'missed' | 'pending'
  actual: number | null
  note: string
}

export interface GenerateGoalsContext {
  nowIso: string
  matchId?: string
}

export interface CheckContext {
  stats?: LocalGameStats
  result?: 'win' | 'loss' | null
}

/** Generates 1–3 concrete, mostly-checkable goals for the next game. */
export function generateGoals(
  analysis: MatchAnalysis,
  bench: Benchmarks,
  ctx: GenerateGoalsContext,
): Goal[] {
  const seed = ctx.matchId ?? 'g'
  const goals: Goal[] = []
  const has = (id: string) => analysis.signals.some((s) => s.id === id)

  if (has('low-villagers')) {
    goals.push({
      id: `${seed}-villagers`,
      text: `Produce at least ${bench.villagersBy10min} villagers — keep your Town Center working nonstop.`,
      metric: 'villagersProduced',
      target: bench.villagersBy10min,
      comparison: 'gte',
      createdAt: ctx.nowIso,
      sourceMatchId: ctx.matchId,
    })
  }

  if (has('low-apm')) {
    const target = Math.round(bench.targetApm * 0.8)
    goals.push({
      id: `${seed}-apm`,
      text: `Stay active — aim for ~${target} APM by macroing between fights.`,
      metric: 'apm',
      target,
      comparison: 'gte',
      createdAt: ctx.nowIso,
      sourceMatchId: ctx.matchId,
    })
  }

  if (has('tough-matchup')) {
    goals.push({
      id: `${seed}-scout`,
      text: 'Scout your opponent by the Feudal Age and adapt to what they are doing.',
      metric: 'self',
      target: 1,
      comparison: 'gte',
      createdAt: ctx.nowIso,
      sourceMatchId: ctx.matchId,
    })
  }

  // Fallback habit goal so there's always at least one actionable target.
  if (goals.length === 0) {
    goals.push({
      id: `${seed}-feudal`,
      text: `Reach Feudal Age before ${formatDuration(bench.feudalSec)} without stopping villager production.`,
      metric: 'self',
      target: 1,
      comparison: 'gte',
      createdAt: ctx.nowIso,
      sourceMatchId: ctx.matchId,
    })
  }

  return goals.slice(0, 3)
}

function satisfied(comparison: Goal['comparison'], actual: number, target: number): boolean {
  return comparison === 'gte' ? actual >= target : actual <= target
}

/** Checks a single goal against the outcome of a (subsequent) game. */
export function checkGoal(goal: Goal, ctx: CheckContext): GoalCheck {
  let actual: number | null = null
  switch (goal.metric) {
    case 'villagersProduced': {
      // 0 villagers = local-log parse miss, not a real result — leave as "no data".
      const v = ctx.stats?.villagersProduced ?? null
      actual = v != null && v > 0 ? v : null
      break
    }
    case 'apm': {
      const a = computeApm(ctx.stats)
      actual = a != null && a > 0 ? a : null
      break
    }
    case 'result':
      actual = ctx.result == null ? null : ctx.result === 'win' ? 1 : 0
      break
    case 'self':
      return { goal, status: 'pending', actual: null, note: 'Self-check this one after your game.' }
  }

  if (actual == null) {
    return {
      goal,
      status: 'pending',
      actual: null,
      note: 'No data for this one yet — it tracks automatically from your local games.',
    }
  }

  const ok = satisfied(goal.comparison, actual, goal.target)
  return {
    goal,
    status: ok ? 'achieved' : 'missed',
    actual,
    note: ok ? 'Nice — target hit!' : `Got ${actual}, target was ${goal.target}.`,
  }
}

export function checkGoals(goals: Goal[], ctx: CheckContext): GoalCheck[] {
  return goals.map((g) => checkGoal(g, ctx))
}
