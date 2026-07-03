import { describe, it, expect } from 'vitest'
import { CIV_LANDMARKS, landmarksForCiv, landmarkAgeLabel } from '../landmarks'

describe('CIV_LANDMARKS data integrity', () => {
  const civs = Object.entries(CIV_LANDMARKS)

  it('covers every app civ', () => {
    // The 23 civ slugs the app knows (base + variants).
    const expected = [
      'abbasid_dynasty',
      'ayyubids',
      'byzantines',
      'chinese',
      'delhi_sultanate',
      'english',
      'french',
      'golden_horde',
      'holy_roman_empire',
      'house_of_lancaster',
      'japanese',
      'jeanne_darc',
      'jin_dynasty',
      'knights_templar',
      'macedonian_dynasty',
      'malians',
      'mongols',
      'order_of_the_dragon',
      'ottomans',
      'rus',
      'sengoku_daimyo',
      'tughlaq_dynasty',
      'zhu_xis_legacy',
    ]
    for (const slug of expected) expect(CIV_LANDMARKS[slug], slug).toBeTruthy()
  })

  it('every civ has either a two-landmark plan or a special mechanic', () => {
    for (const [civ, d] of civs) {
      expect(d.ages.length > 0 || d.special != null, civ).toBe(true)
    }
  })

  it("every age's recommended pick is one of its options, at a valid age, in order", () => {
    for (const [civ, d] of civs) {
      let prevAge = 0
      for (const a of d.ages) {
        expect([2, 3, 4], `${civ} age`).toContain(a.age)
        expect(a.options, `${civ} A${a.age} pick`).toContain(a.pick)
        expect(a.options.length, `${civ} A${a.age} options`).toBeGreaterThanOrEqual(2)
        expect(a.age, `${civ} ages ascending`).toBeGreaterThan(prevAge)
        prevAge = a.age
      }
    }
  })

  it('locks in the verifier corrections', () => {
    // English Castle/Imperial names were cross-contaminated in raw research.
    const eng = CIV_LANDMARKS.english!
    expect(eng.ages.find((a) => a.age === 3)!.options).toEqual(['White Tower', 'King’s Palace'])
    expect(eng.ages.find((a) => a.age === 4)!.pick).toBe('Wynguard Palace')
    // Byzantines Castle pick was corrected to the community-standard landmark.
    expect(CIV_LANDMARKS.byzantines!.ages.find((a) => a.age === 3)!.pick).toBe('Golden Horn Tower')
  })

  it('flags special-mechanic civs (no forced two-landmark pick)', () => {
    expect(CIV_LANDMARKS.knights_templar!.special).toBeTruthy()
    expect(CIV_LANDMARKS.knights_templar!.ages).toHaveLength(0)
    expect(CIV_LANDMARKS.abbasid_dynasty!.special).toBeTruthy()
    expect(CIV_LANDMARKS.golden_horde!.special).toBeTruthy()
  })

  it('resolves civs and returns null for unknown', () => {
    expect(landmarksForCiv('french')?.ages[0]?.pick).toBe('School of Cavalry')
    expect(landmarksForCiv('atlantis')).toBeNull()
    expect(landmarksForCiv(null)).toBeNull()
  })

  it('formats age labels', () => {
    expect(landmarkAgeLabel(2)).toBe('Feudal (II)')
    expect(landmarkAgeLabel(4)).toBe('Imperial (IV)')
  })
})
