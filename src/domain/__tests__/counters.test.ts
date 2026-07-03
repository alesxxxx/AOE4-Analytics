import { describe, it, expect } from 'vitest'
import { counterFor, whatBeats, roleFromUnit, COUNTER_ROLES } from '../counters'

describe('counter matrix', () => {
  it('spearmen beat cavalry, lose to ranged', () => {
    const spear = counterFor('spearman')
    expect(spear.strongVs).toContain('knight')
    expect(spear.strongVs).toContain('horseman')
    expect(spear.weakVs).toContain('archer')
  })

  it('whatBeats(knight) includes spearman and camel', () => {
    const beats = whatBeats('knight').map((c) => c.role)
    expect(beats).toContain('spearman')
    expect(beats).toContain('camel')
  })

  it('whatBeats(archer) includes cavalry and mangonel', () => {
    const beats = whatBeats('archer').map((c) => c.role)
    expect(beats).toEqual(expect.arrayContaining(['horseman', 'knight', 'mangonel']))
  })

  it('the matrix is internally consistent (every role resolvable)', () => {
    for (const role of COUNTER_ROLES) {
      expect(counterFor(role).role).toBe(role)
    }
  })
})

describe('roleFromUnit', () => {
  it('maps unit ids to roles', () => {
    expect(roleFromUnit({ id: 'spearman' })).toBe('spearman')
    expect(roleFromUnit({ id: 'horseman' })).toBe('horseman')
    expect(roleFromUnit({ id: 'man-at-arms' })).toBe('manatarms')
    expect(roleFromUnit({ id: 'crossbowman' })).toBe('crossbow')
    expect(roleFromUnit({ id: 'longbowman' })).toBe('archer')
    expect(roleFromUnit({ id: 'battering-ram' })).toBe('siege_ram')
    expect(roleFromUnit({ id: 'camel-archer' })).toBe('camel')
  })

  it('falls back to displayClasses when the id is unknown', () => {
    expect(roleFromUnit({ id: 'mystery', displayClasses: ['Heavy Melee Cavalry'] })).toBe('knight')
    expect(roleFromUnit({ id: 'mystery', displayClasses: ['Siege'] })).toBe('mangonel')
    expect(roleFromUnit({ id: 'totally-unknown' })).toBeNull()
  })
})
