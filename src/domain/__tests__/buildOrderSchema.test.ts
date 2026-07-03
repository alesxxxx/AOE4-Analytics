import { describe, it, expect } from 'vitest'
import {
  validateBuildOrder,
  parseNote,
  stepIndexForElapsed,
  buildIndexForCiv,
  condenseBuildOrder,
  type BuildOrder,
} from '../buildOrderSchema'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'

const validBO = {
  name: 'Test BO',
  civilization: 'English',
  author: 'me',
  build_order: [
    {
      population_count: -1,
      villager_count: 6,
      age: 1,
      resources: { food: 6, wood: 0, gold: 0, stone: 0 },
      notes: ['Send all villagers to sheep'],
      time: '0:00',
    },
  ],
}

describe('validateBuildOrder', () => {
  it('accepts a well-formed build order', () => {
    const result = validateBuildOrder(validBO)
    expect(result.ok).toBe(true)
  })

  it('rejects a missing build_order array', () => {
    const result = validateBuildOrder({ name: 'x', civilization: 'English' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('build_order')
  })

  it('reports a step missing villager_count', () => {
    const bad = {
      ...validBO,
      build_order: [
        {
          population_count: -1,
          age: 1,
          resources: { food: 6, wood: 0, gold: 0, stone: 0 },
          notes: [],
        },
      ],
    }
    const result = validateBuildOrder(bad)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('villager_count'))).toBe(true)
  })

  it('accepts a string or array civilization', () => {
    expect(validateBuildOrder({ ...validBO, civilization: ['English', 'French'] }).ok).toBe(true)
  })
})

describe('parseNote', () => {
  it('returns a single text part for plain notes', () => {
    expect(parseNote('Build a house')).toEqual([{ type: 'text', text: 'Build a house' }])
  })

  it('splits @icon@ tokens into image parts', () => {
    const parts = parseNote('5 @unit_worker/villager.webp@ on @resource/food.webp@')
    expect(parts).toEqual([
      { type: 'text', text: '5 ' },
      { type: 'image', path: 'unit_worker/villager.webp' },
      { type: 'text', text: ' on ' },
      { type: 'image', path: 'resource/food.webp' },
    ])
  })
})

describe('stepIndexForElapsed', () => {
  const steps = [
    {
      population_count: -1,
      villager_count: 6,
      age: 1,
      resources: { food: 6, wood: 0, gold: 0, stone: 0 },
      notes: [],
      time: '0:00',
    },
    {
      population_count: -1,
      villager_count: 9,
      age: 1,
      resources: { food: 9, wood: 0, gold: 0, stone: 0 },
      notes: [],
      time: '1:00',
    },
    {
      population_count: -1,
      villager_count: 14,
      age: 1,
      resources: { food: 9, wood: 5, gold: 0, stone: 0 },
      notes: [],
      time: '2:30',
    },
    {
      population_count: -1,
      villager_count: 20,
      age: 2,
      resources: { food: 10, wood: 6, gold: 4, stone: 0 },
      notes: [],
      time: '4:00',
    },
  ]

  it('returns the step matching the match clock', () => {
    expect(stepIndexForElapsed(steps, 0)).toBe(0)
    expect(stepIndexForElapsed(steps, 65)).toBe(1)
    expect(stepIndexForElapsed(steps, 150)).toBe(2)
    expect(stepIndexForElapsed(steps, 200)).toBe(2)
    expect(stepIndexForElapsed(steps, 300)).toBe(3)
  })

  it('handles steps without times by holding the last reached step', () => {
    const mixed = [steps[0]!, { ...steps[1]!, time: undefined }, steps[2]!]
    expect(stepIndexForElapsed(mixed, 65)).toBe(0) // step 1 has no time → stays on 0
    expect(stepIndexForElapsed(mixed, 150)).toBe(2)
  })
})

describe('buildIndexForCiv', () => {
  const builds = BUNDLED_BUILD_ORDERS as unknown as BuildOrder[]

  // Helper: the civ labels of the build that matched a slug.
  const matchedCivs = (slug: string): string[] | null => {
    const i = buildIndexForCiv(builds, slug)
    if (i == null) return null
    const c = builds[i]!.civilization
    return Array.isArray(c) ? c : [c]
  }

  it('matches a base civ slug to its bundled build via display name', () => {
    expect(matchedCivs('english')).toContain('English')
    expect(matchedCivs('french')).toContain('French')
    expect(matchedCivs('hre')).toContain('Holy Roman Empire') // alt slug → same display name
    for (const [slug, civ] of [
      ['ottomans', 'Ottomans'],
      ['abbasid_dynasty', 'Abbasid Dynasty'],
      ['delhi_sultanate', 'Delhi Sultanate'],
      ['japanese', 'Japanese'],
      ['chinese', 'Chinese'],
      ['byzantines', 'Byzantines'],
      ['malians', 'Malians'],
    ] as const) {
      expect(matchedCivs(slug)).toContain(civ)
    }
  })

  it('matches variant civs to their own curated build, or the base fallback', () => {
    for (const [slug, civ] of [
      // Variants with their own curated builds (aoe4guides research pass):
      ['sengoku_daimyo', 'Sengoku Daimyo'],
      ['tughlaq_dynasty', 'Tughlaq Dynasty'],
      ['house_of_lancaster', 'House of Lancaster'],
      ['jeanne_darc', "Jeanne d'Arc"],
      ['order_of_the_dragon', 'Order of the Dragon'],
      ['zhu_xis_legacy', "Zhu Xi's Legacy"],
      ['macedonian_dynasty', 'Macedonian Dynasty'],
      // Variants still covered by their base civ's build:
      ['ayyubids', 'Abbasid Dynasty'],
      ['golden_horde', 'Mongols'],
    ] as const) {
      expect(matchedCivs(slug)).toContain(civ)
    }
  })

  it('returns null for an unknown civ', () => {
    expect(buildIndexForCiv(builds, 'atlantis')).toBeNull()
  })

  it('returns null for a null/empty civ (custom/AI game)', () => {
    expect(buildIndexForCiv(builds, null)).toBeNull()
    expect(buildIndexForCiv(builds, undefined)).toBeNull()
    expect(buildIndexForCiv(builds, '')).toBeNull()
  })

  it('matches the array form of civilization, case-insensitively', () => {
    const arr: BuildOrder[] = [
      {
        name: 'multi',
        civilization: ['Foo', 'MONGOLS'],
        build_order: [
          {
            population_count: -1,
            villager_count: 6,
            age: 1,
            resources: { food: 6, wood: 0, gold: 0, stone: 0 },
            notes: [],
          },
        ],
      },
    ]
    expect(buildIndexForCiv(arr, 'mongols')).toBe(0)
  })
})

describe('bundled build orders are all valid', () => {
  it('every bundled build order passes validation', () => {
    expect(BUNDLED_BUILD_ORDERS.length).toBeGreaterThan(0)
    for (const bo of BUNDLED_BUILD_ORDERS) {
      const result = validateBuildOrder(bo)
      if (!result.ok) {
        throw new Error(
          `Invalid bundled BO ${(bo as { name?: string }).name}: ${result.errors.join('; ')}`,
        )
      }
      expect(result.ok).toBe(true)
    }
  })

  it('keeps variant-specific and stone-dependent openings honest', () => {
    const byName = new Map(BUNDLED_BUILD_ORDERS.map((bo) => [bo.name, bo]))
    const jeanne = byName.get("Jeanne d'Arc Knight Pressure")!
    expect(jeanne.build_order[0]!.resources).toMatchObject({ food: 5, gold: 1 })
    expect(jeanne.build_order[0]!.notes.join(' ')).toMatch(/Jeanne.*gold/i)

    for (const name of ['Byzantine Cistern Economy', 'Ottoman Military School Pressure']) {
      const bo = byName.get(name)!
      expect(bo.build_order.some((s) => s.resources.stone > 0), name).toBe(true)
      expect(bo.build_order.some((s) => /stone/i.test(s.notes.join(' '))), name).toBe(true)
    }
  })
})

const R = (food: number, wood: number, gold: number, stone: number) => ({ food, wood, gold, stone })

describe('condenseBuildOrder', () => {
  const bo: BuildOrder = {
    name: 'Test build',
    civilization: 'English',
    build_order: [
      { population_count: 4, villager_count: 4, age: 1, resources: R(4, 0, 0, 0), notes: ['@icons/sheep.webp@ Send  villagers to sheep'] },
      { population_count: 8, villager_count: 8, age: 1, resources: R(6, 2, 0, 0), notes: ['Build a house'] },
      { population_count: 14, villager_count: 13, age: 2, resources: R(8, 5, 0, 0), notes: ['Age up with Council Hall'], time: '5:10' },
      { population_count: 20, villager_count: 18, age: 2, resources: R(10, 8, 0, 0), notes: ['Add a blacksmith'] },
      { population_count: 30, villager_count: 26, age: 3, resources: R(12, 10, 4, 0), notes: ["Age up with the King's Palace"], time: '11:00' },
      { population_count: 45, villager_count: 36, age: 4, resources: R(14, 14, 8, 0), notes: [], time: '18:30' },
    ],
  }

  it('keeps the opening step plus each age-up checkpoint', () => {
    const rows = condenseBuildOrder(bo)
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.ageUpTo)).toEqual([null, 2, 3, 4])
    expect(rows.map((r) => r.villagers)).toEqual([4, 13, 26, 36])
    expect(rows.map((r) => r.time)).toEqual([null, '5:10', '11:00', '18:30'])
  })

  it('strips icon tokens from notes and nulls empty notes', () => {
    const rows = condenseBuildOrder(bo)
    expect(rows[0]!.note).toBe('Send villagers to sheep')
    expect(rows[3]!.note).toBeNull()
  })

  it('returns a single opening row for a build that never ages up', () => {
    const flat: BuildOrder = {
      name: 'Dark only',
      civilization: 'Mongols',
      build_order: [
        { population_count: 5, villager_count: 5, age: 1, resources: R(5, 0, 0, 0), notes: ['Open with sheep'] },
        { population_count: 9, villager_count: 9, age: 1, resources: R(7, 2, 0, 0), notes: ['Ovoo on stone'] },
      ],
    }
    const rows = condenseBuildOrder(flat)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ ageUpTo: null, villagers: 5, note: 'Open with sheep' })
  })

  it('condenses every bundled build to 1-4 checkpoint rows', () => {
    for (const b of BUNDLED_BUILD_ORDERS) {
      const rows = condenseBuildOrder(b)
      expect(rows.length, b.name).toBeGreaterThanOrEqual(1)
      expect(rows.length, b.name).toBeLessThanOrEqual(4)
      expect(rows[0]!.villagers, b.name).toBe(b.build_order[0]!.villager_count)
    }
  })
})
