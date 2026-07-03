import { describe, it, expect } from 'vitest'
import { comparisonSignals, enemiesOf } from '../gameCoaching'
import type { PerPlayerMatchStats } from '../analysis'

function player(over: Partial<PerPlayerMatchStats>): PerPlayerMatchStats {
  return {
    profileId: 1,
    teamId: 0,
    civ: 'french',
    result: 'win',
    unitsProduced: 100,
    kills: 100,
    deaths: 100,
    kd: 1,
    buildingsProduced: 50,
    techsResearched: 20,
    apm: 120,
    gameTimeSec: 1200,
    ...over,
  }
}

describe('comparisonSignals', () => {
  it('flags a poor K/D as a major fight signal', () => {
    const me = player({ profileId: 1, teamId: 0, kd: 0.58 })
    const opp = player({ profileId: 2, teamId: 1, kd: 1.7 })
    const sigs = comparisonSignals([me, opp], 1)
    const kd = sigs.find((s) => s.id === 'cmp-kd-low')
    expect(kd?.severity).toBe('major')
    expect(kd?.title).toContain('0.58')
  })

  it('praises a strong K/D', () => {
    const me = player({ profileId: 1, teamId: 0, kd: 2.1 })
    const opp = player({ profileId: 2, teamId: 1, kd: 0.5 })
    const sigs = comparisonSignals([me, opp], 1)
    expect(sigs.find((s) => s.id === 'cmp-kd-high')?.severity).toBe('good')
  })

  it('flags being out-produced vs the enemy average', () => {
    const me = player({ profileId: 1, teamId: 0, unitsProduced: 100, kd: 1 })
    const opp = player({ profileId: 2, teamId: 1, unitsProduced: 200, kd: 1 })
    const sigs = comparisonSignals([me, opp], 1)
    const prod = sigs.find((s) => s.id === 'cmp-production-low')
    expect(prod?.severity).toBe('minor')
    expect(prod?.title).toContain('100 vs 200')
  })

  it('flags an upgrade deficit only when clearly behind', () => {
    const behind = comparisonSignals(
      [player({ profileId: 1, teamId: 0, techsResearched: 15 }), player({ profileId: 2, teamId: 1, techsResearched: 25 })],
      1,
    )
    expect(behind.find((s) => s.id === 'cmp-tech-low')).toBeTruthy()

    const even = comparisonSignals(
      [player({ profileId: 1, teamId: 0, techsResearched: 22 }), player({ profileId: 2, teamId: 1, techsResearched: 24 })],
      1,
    )
    expect(even.find((s) => s.id === 'cmp-tech-low')).toBeUndefined()
  })

  it('averages the enemy team in a 2v2 (per-player fairness)', () => {
    const me = player({ profileId: 1, teamId: 0, unitsProduced: 100 })
    const ally = player({ profileId: 2, teamId: 0, unitsProduced: 90 })
    const e1 = player({ profileId: 3, teamId: 1, unitsProduced: 210 })
    const e2 = player({ profileId: 4, teamId: 1, unitsProduced: 190 }) // avg 200
    const enemies = enemiesOf([me, ally, e1, e2], me)
    expect(enemies.map((p) => p.profileId).sort()).toEqual([3, 4])
    const sigs = comparisonSignals([me, ally, e1, e2], 1)
    expect(sigs.find((s) => s.id === 'cmp-production-low')?.title).toContain('100 vs 200')
  })

  it('returns nothing when the user is absent or has no opponents', () => {
    expect(comparisonSignals([player({ profileId: 2 })], 1)).toEqual([])
    expect(comparisonSignals([player({ profileId: 1, teamId: 0 })], 1)).toEqual([])
    expect(comparisonSignals(undefined, 1)).toEqual([])
  })

  it('falls back to profile-based opponents when team ids are missing', () => {
    const me = player({ profileId: 1, teamId: null, kd: 0.5 })
    const opp = player({ profileId: 2, teamId: null, kd: 2 })
    expect(enemiesOf([me, opp], me).map((p) => p.profileId)).toEqual([2])
    expect(comparisonSignals([me, opp], 1).find((s) => s.id === 'cmp-kd-low')).toBeTruthy()
  })
})
