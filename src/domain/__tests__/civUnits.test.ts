import { describe, it, expect } from 'vitest'
import { COUNTER_MATRIX } from '../counters'
import { counterPlanForCiv, matchupTroops, matchupTroopsForTeam } from '../civUnits'

describe('counterPlanForCiv', () => {
  it('lists a civ key units and what beats them', () => {
    const plan = counterPlanForCiv('mongols')!
    expect(plan.keyUnits.map((u) => u.name)).toContain('Mangudai')
    // Mongols field archers + knights → spearmen (vs knights) should be advised.
    expect(plan.counters.some((c) => c.role === 'spearman')).toBe(true)
    expect(plan.counters.length).toBeGreaterThan(0)
  })

  it('advises spears/camels against a cavalry civ (French)', () => {
    const plan = counterPlanForCiv('french')!
    const roles = plan.counters.map((c) => c.role)
    expect(roles).toContain('spearman') // beats Royal Knights
  })

  it('resolves variants to their base civ roster', () => {
    expect(counterPlanForCiv('sengoku_daimyo')?.civSlug).toBe('japanese')
    expect(counterPlanForCiv('tughlaq_dynasty')?.civSlug).toBe('delhi_sultanate')
    expect(counterPlanForCiv('order_of_the_dragon')?.civSlug).toBe('holy_roman_empire')
  })

  it('caps the number of counters and returns null for unknown/empty', () => {
    expect(counterPlanForCiv('mongols', 2)!.counters.length).toBeLessThanOrEqual(2)
    expect(counterPlanForCiv(null)).toBeNull()
    expect(counterPlanForCiv('atlantis')).toBeNull()
  })
})

describe('matchupTroops', () => {
  it('shows both rosters and flags YOUR counters (Knights Templar vs Delhi)', () => {
    const m = matchupTroops('knights_templar', 'delhi_sultanate')!
    expect(m.theirs.map((u) => u.name)).toContain('War Elephant')
    expect(m.mine.map((u) => u.name)).toContain('Templar Brother')
    // Spearmen beat War Elephants → Spearman is the priority pick, not the knight.
    expect(m.priority.has('Spearman')).toBe(true)
    expect(m.priority.has('Templar Brother')).toBe(false)
  })

  it('orders your side by build sequence — earliest age first (Spearman before Templar Brother)', () => {
    const order = matchupTroops('knights_templar', 'french')!.mine.map((u) => u.name)
    expect(order.indexOf('Spearman')).toBeLessThan(order.indexOf('Templar Brother'))
  })

  it('every key unit carries an image slug + age', () => {
    const m = matchupTroops('knights_templar', 'mongols')!
    expect(m.mine.every((u) => u.icon.length > 0 && u.age >= 2)).toBe(true)
  })

  it('resolves variants to their base roster (Jeanne d’Arc → French)', () => {
    expect(matchupTroops('jeanne_darc', 'mongols')!.mine.map((u) => u.name)).toContain(
      'Royal Knight',
    )
  })

  it('is null only when NEITHER civ is known', () => {
    expect(matchupTroops('atlantis', 'narnia')).toBeNull()
    expect(matchupTroops('knights_templar', null)).not.toBeNull()
  })

  it('merges enemy team threats for 2v2 without duplicating obvious units', () => {
    const m = matchupTroopsForTeam('english', ['french', 'mongols'])!
    expect(m.theirs.map((u) => u.name)).toContain('Royal Knight')
    expect(m.theirs.map((u) => u.name)).toContain('Mangudai')
    expect(m.priority.has('Spearman')).toBe(true)
    expect(m.theirs.filter((u) => u.name === 'Spearman')).toHaveLength(1)
  })
})

describe('VARIANT_KEY_UNITS overrides (research + adversarial verification pass, 2026-07-01)', () => {
  // Variants confirmed to differ from their base civ's roster; the app's own
  // vendored units.json civs/minAge fields were cross-checked to confirm each.
  const OVERRIDDEN = {
    house_of_lancaster: ['Spearman', 'Yeoman', "Earl's Guard"],
    order_of_the_dragon: ['Gilded Spearman', 'Gilded Man-at-Arms', 'Gilded Landsknecht'],
    jin_dynasty: ['Man-at-Arms', 'Mohe Tribesman', 'Bed Crossbow', 'Nest of Bees'],
    ayyubids: ['Spearman', 'Ghulam', 'Camel Lancer'],
    sengoku_daimyo: ['Naginata Samurai', 'Mounted Samurai'],
    golden_horde: ['Horseman', 'Keshik', 'Kipchak Archer'],
    macedonian_dynasty: ['Atgeirmaðr', 'Varangian Guard', 'Bogmaðr', 'Riddari'],
  }

  it('uses the override roster, not the base civ roster, for overridden variants', () => {
    for (const [civ, names] of Object.entries(OVERRIDDEN)) {
      const plan = counterPlanForCiv(civ)!
      expect(plan.keyUnits.map((u) => u.name).sort(), civ).toEqual([...names].sort())
    }
  })

  it("House of Lancaster no longer recommends Man-at-Arms (the originally-reported bug)", () => {
    const names = matchupTroops('house_of_lancaster', 'mongols')!.mine.map((u) => u.name)
    expect(names).not.toContain('Man-at-Arms')
    expect(names).not.toContain('Longbowman')
    expect(names).toContain('Yeoman')
    expect(names).toContain("Earl's Guard")
  })

  it("Ayyubids build Camel Lancer, not Abbasid's Camel Rider", () => {
    const names = matchupTroops('ayyubids', 'french')!.mine.map((u) => u.name)
    expect(names).toContain('Camel Lancer')
    expect(names).not.toContain('Camel Rider')
  })

  it('fully-inheriting variants (no override) stay byte-identical to their base roster', () => {
    const jeanneDArc = counterPlanForCiv('jeanne_darc')!.keyUnits
    const french = counterPlanForCiv('french')!.keyUnits
    expect(jeanneDArc).toEqual(french)

    const zhuXi = counterPlanForCiv('zhu_xis_legacy')!.keyUnits
    const chinese = counterPlanForCiv('chinese')!.keyUnits
    expect(zhuXi).toEqual(chinese)

    const tughlaq = counterPlanForCiv('tughlaq_dynasty')!.keyUnits
    const delhi = counterPlanForCiv('delhi_sultanate')!.keyUnits
    expect(tughlaq).toEqual(delhi)
  })

  it('every override unit has a valid role and a sensible age', () => {
    const validRoles = new Set(Object.keys(COUNTER_MATRIX))
    for (const civ of Object.keys(OVERRIDDEN)) {
      for (const u of counterPlanForCiv(civ)!.keyUnits) {
        expect(validRoles.has(u.role), `${civ}: ${u.name} role`).toBe(true)
        expect([2, 3, 4], `${civ}: ${u.name} age`).toContain(u.age)
        expect(u.icon.length, `${civ}: ${u.name} icon`).toBeGreaterThan(0)
      }
    }
  })
})
