import { describe, it, expect } from 'vitest'
import { targetVillagers, bracketFromRankLevel, getBenchmarks } from '../benchmarks'

describe('targetVillagers', () => {
  it('is 6 at the start and grows ~1 per 20s', () => {
    expect(targetVillagers(0)).toBe(6)
    expect(targetVillagers(200)).toBe(16)
    expect(targetVillagers(600)).toBe(36)
  })
  it('guards bad input and clamps', () => {
    expect(targetVillagers(-5)).toBe(6)
    expect(targetVillagers(100000, 80)).toBe(80)
  })
})

describe('bracketFromRankLevel', () => {
  it('extracts the base tier and defaults to gold', () => {
    expect(bracketFromRankLevel('gold_2')).toBe('gold')
    expect(bracketFromRankLevel('conqueror_3')).toBe('conqueror')
    expect(bracketFromRankLevel(null)).toBe('gold')
    expect(bracketFromRankLevel('unranked')).toBe('gold')
  })
})

describe('getBenchmarks', () => {
  it('returns tighter targets at higher brackets', () => {
    expect(getBenchmarks('bronze').feudalSec).toBeGreaterThan(getBenchmarks('conqueror').feudalSec)
    expect(getBenchmarks('gold').villagersBy10min).toBe(44)
  })
})
