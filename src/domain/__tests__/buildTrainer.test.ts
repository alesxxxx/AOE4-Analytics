import { describe, it, expect } from 'vitest'
import type { BuildOrder } from '../buildOrderSchema'
import type { BuildEvent } from '../statsSummary'
import { gradeBuildFollow } from '../buildTrainer'

const R = { food: 0, wood: 0, gold: 0, stone: 0 }

/** English-style reference: open on 6 vills, Feudal @ 5:00 with 13 vills. */
const reference: BuildOrder = {
  name: 'Test 2TC',
  civilization: 'English',
  build_order: [
    { population_count: 6, villager_count: 6, age: 1, resources: R, notes: ['Open'] },
    { population_count: 10, villager_count: 10, age: 1, resources: R, notes: ['More vills'], time: '2:30' },
    { population_count: 14, villager_count: 13, age: 2, resources: R, notes: ['Age up'], time: '5:00' },
    { population_count: 30, villager_count: 26, age: 3, resources: R, notes: ['Castle'], time: '11:00' },
  ],
}

function ev(timeSec: number, category: BuildEvent['category'], name: string): BuildEvent {
  return { timeSec, playerId: 1, category, blueprint: name.toLowerCase().replace(/\s+/g, '_'), name }
}

/** N villagers, one every `gapSec` seconds starting at t0. */
function villagers(n: number, t0: number, gapSec: number): BuildEvent[] {
  return Array.from({ length: n }, (_, i) => ev(t0 + i * gapSec, 'unit', 'Villager'))
}

describe('gradeBuildFollow', () => {
  it('grades villager checkpoints against produced villagers + the reference opening count', () => {
    // 6 starting vills (from the reference opening row); ~1 vill / 22s.
    const events = [...villagers(20, 20, 22), ev(300, 'building', 'Council Hall')]
    const report = gradeBuildFollow({ reference, events, civ: 'english' })

    const v1 = report.checkpoints.find((c) => c.kind === 'villagers' && c.targetTimeSec === 150)!
    // by 2:30 → 6 produced (20,42,…,130s) + 6 starting = 12 vs target 10
    expect(v1.actualVillagers).toBe(12)
    expect(v1.villagerDelta).toBe(2)
    expect(v1.ok).toBe(true) // within ±2

    const v2 = report.checkpoints.find((c) => c.kind === 'villagers' && c.targetTimeSec === 300)!
    expect(v2.targetVillagers).toBe(13)
    expect(v2.actualVillagers).toBe(19) // 13 produced by 300s + 6 starting
    expect(v2.ok).toBe(false) // 6 over target is off-plan too
  })

  it('detects age-up timing from landmark build events (normalized names)', () => {
    const events = [
      ...villagers(24, 20, 25),
      ev(330, 'building', 'Council Hall'), // Feudal, 30s late vs 5:00
      ev(700, 'building', 'King’s Palace'), // Castle, matches typographic apostrophe data
    ]
    const report = gradeBuildFollow({ reference, events, civ: 'english' })

    const feudal = report.checkpoints.find((c) => c.kind === 'ageup' && c.ageUpTo === 2)!
    expect(feudal.actualTimeSec).toBe(330)
    expect(feudal.deltaSec).toBe(30)
    expect(feudal.ok).toBe(true) // within ±60s

    const castle = report.checkpoints.find((c) => c.kind === 'ageup' && c.ageUpTo === 3)!
    expect(castle.actualTimeSec).toBe(700)
    expect(castle.deltaSec).toBe(40)
    expect(castle.ok).toBe(true)
  })

  it('marks an age-up ungradeable when no landmark event matches', () => {
    const events = villagers(10, 20, 25) // never aged up
    const report = gradeBuildFollow({ reference, events, civ: 'english' })
    const feudal = report.checkpoints.find((c) => c.kind === 'ageup' && c.ageUpTo === 2)!
    expect(feudal.actualTimeSec).toBeNull()
    expect(feudal.ok).toBeNull()
  })

  it('marks age-ups ungradeable for a civ without landmark data', () => {
    const report = gradeBuildFollow({
      reference: { ...reference, civilization: 'Atlantis' },
      events: [ev(300, 'building', 'Council Hall')],
      civ: 'atlantis',
    })
    const ageups = report.checkpoints.filter((c) => c.kind === 'ageup')
    expect(ageups.length).toBeGreaterThan(0)
    expect(ageups.every((c) => c.ok === null)).toBe(true)
  })

  it('scores as passed / gradeable, null when nothing is gradeable', () => {
    const events = [...villagers(20, 20, 22), ev(310, 'building', 'Council Hall')]
    const report = gradeBuildFollow({ reference, events, civ: 'english' })
    const gradeable = report.checkpoints.filter((c) => c.ok !== null)
    const passed = gradeable.filter((c) => c.ok).length
    expect(report.score).toBe(Math.round((passed / gradeable.length) * 100))

    const empty = gradeBuildFollow({ reference, events: [], civ: null })
    // no villager events at all → villager checkpoints ungradeable, no landmarks
    expect(empty.score).toBeNull()
  })

  it('returns no checkpoints for a reference without timed steps', () => {
    const untimed: BuildOrder = {
      name: 'No times',
      civilization: 'English',
      build_order: [{ population_count: 6, villager_count: 6, age: 1, resources: R, notes: [] }],
    }
    const report = gradeBuildFollow({ reference: untimed, events: villagers(5, 20, 25), civ: 'english' })
    expect(report.checkpoints).toEqual([])
    expect(report.score).toBeNull()
  })
})
