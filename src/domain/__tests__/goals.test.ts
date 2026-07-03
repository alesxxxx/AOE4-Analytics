import { describe, it, expect } from 'vitest'
import { analyzeMatch, type AnalyzedGame } from '../analysis'
import { getBenchmarks } from '../benchmarks'
import { generateGoals, checkGoal, checkGoals } from '../goals'

const game: AnalyzedGame = {
  result: 'loss',
  civ: 'english',
  oppCiv: 'mongols',
  map: 'Dry Arabia',
  durationSec: 1200,
}
const bench = getBenchmarks('gold')
const ctx = { nowIso: '2026-06-26T12:00:00.000Z', matchId: 'm1' }

describe('generateGoals', () => {
  it('turns a low-villager leak into a checkable villager goal', () => {
    const analysis = analyzeMatch({
      game,
      bracket: 'gold',
      local: { villagersProduced: 28, gameTimeSec: 1200 },
    })
    const goals = generateGoals(analysis, bench, ctx)
    const v = goals.find((g) => g.metric === 'villagersProduced')
    expect(v).toBeDefined()
    expect(v!.target).toBe(bench.villagersBy10min)
    expect(v!.createdAt).toBe(ctx.nowIso)
  })

  it('falls back to a Feudal habit goal when there are no leaks', () => {
    const analysis = analyzeMatch({ game, bracket: 'gold' })
    const goals = generateGoals(analysis, bench, ctx)
    expect(goals.length).toBeGreaterThanOrEqual(1)
    expect(goals.length).toBeLessThanOrEqual(3)
    expect(goals.some((g) => g.id.includes('feudal'))).toBe(true)
  })
})

describe('checkGoal', () => {
  const goal = {
    id: 'g-villagers',
    text: '...',
    metric: 'villagersProduced' as const,
    target: 44,
    comparison: 'gte' as const,
    createdAt: ctx.nowIso,
  }

  it('marks achieved when the next game hits the target', () => {
    const c = checkGoal(goal, { stats: { villagersProduced: 50 } })
    expect(c.status).toBe('achieved')
    expect(c.actual).toBe(50)
  })

  it('marks missed when below target', () => {
    expect(checkGoal(goal, { stats: { villagersProduced: 30 } }).status).toBe('missed')
  })

  it('marks pending when there is no data', () => {
    expect(checkGoal(goal, {}).status).toBe('pending')
  })

  it('treats villagersProduced=0 as a parse miss (pending), not a missed goal', () => {
    const c = checkGoal(goal, { stats: { villagersProduced: 0, gameTimeSec: 1200 } })
    expect(c.status).toBe('pending')
    expect(c.actual).toBeNull()
  })

  it('treats self-check goals as pending', () => {
    const self = { ...goal, metric: 'self' as const }
    expect(checkGoal(self, { stats: { villagersProduced: 99 } }).status).toBe('pending')
  })
})

describe('checkGoals', () => {
  it('checks a list', () => {
    const goals = [
      {
        id: 'a',
        text: '',
        metric: 'result' as const,
        target: 1,
        comparison: 'gte' as const,
        createdAt: ctx.nowIso,
      },
    ]
    expect(checkGoals(goals, { result: 'win' })[0]!.status).toBe('achieved')
    expect(checkGoals(goals, { result: 'loss' })[0]!.status).toBe('missed')
  })
})
