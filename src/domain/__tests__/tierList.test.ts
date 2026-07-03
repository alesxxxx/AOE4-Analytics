import { describe, it, expect } from 'vitest'
import { loadFixture } from '../../api/__tests__/fixtures'
import type { CivStatsResponse } from '../../api/types'
import { buildTierList, tierForWinRate } from '../tierList'

const stats = loadFixture<CivStatsResponse>('stats-rmsolo-civilizations.json')

describe('tierForWinRate', () => {
  it('maps win rate to the right band', () => {
    expect(tierForWinRate(56)).toBe('Z')
    expect(tierForWinRate(54)).toBe('Z')
    expect(tierForWinRate(53)).toBe('S')
    expect(tierForWinRate(52.5)).toBe('S')
    expect(tierForWinRate(51.4)).toBe('A')
    expect(tierForWinRate(50)).toBe('B')
    expect(tierForWinRate(48)).toBe('C')
    expect(tierForWinRate(45)).toBe('D')
  })
})

describe('buildTierList (real fixture)', () => {
  const result = buildTierList(stats)

  it('places the top civ (≥54%) in Z, above S, and the lowest in D', () => {
    expect(result.civs[0]!.civ).toBe('macedonian_dynasty') // 55.0% win rate
    expect(result.civs[0]!.tier).toBe('Z')
    const last = result.civs[result.civs.length - 1]!
    expect(last.civ).toBe('chinese')
    expect(last.tier).toBe('D')
  })

  it('covers all civilizations exactly once across tiers', () => {
    const total = result.civs.length
    const grouped = Object.values(result.byTier).reduce((s, arr) => s + arr.length, 0)
    expect(grouped).toBe(total)
    expect(total).toBe(stats.data.length)
  })

  it('sorts by win rate descending and includes a methodology note', () => {
    for (let i = 1; i < result.civs.length; i++) {
      expect(result.civs[i - 1]!.winRate).toBeGreaterThanOrEqual(result.civs[i]!.winRate)
    }
    expect(result.methodology).toContain('win rate')
  })

  it('flags low-sample civs by the threshold', () => {
    const flagged = buildTierList(stats, { minGames: 1_000_000 })
    expect(flagged.civs.every((c) => c.lowSample)).toBe(true)
  })
})
