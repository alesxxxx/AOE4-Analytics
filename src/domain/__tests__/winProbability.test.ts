import { describe, expect, it } from 'vitest'
import { winProbability } from '../winProbability'

describe('winProbability', () => {
  it('is 50% for equal ratings', () => {
    expect(winProbability(1000, 1000)).toBe(50)
  })

  it('matches the Elo expected score for a 100-point gap', () => {
    // 1 / (1 + 10^(-100/400)) ≈ 0.640065
    expect(winProbability(1100, 1000)!).toBeCloseTo(64.0065, 3)
    expect(winProbability(1000, 1100)!).toBeCloseTo(35.9935, 3)
  })

  it('is symmetric: P(a,b) + P(b,a) = 100', () => {
    const p = winProbability(1234, 987)!
    const q = winProbability(987, 1234)!
    expect(p + q).toBeCloseTo(100, 9)
  })

  it('returns null when either rating is missing', () => {
    expect(winProbability(null, 1000)).toBeNull()
    expect(winProbability(1000, undefined)).toBeNull()
    expect(winProbability(Number.NaN, 1000)).toBeNull()
  })
})
