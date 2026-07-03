import { describe, it, expect } from 'vitest'
import {
  formatRankLevel,
  rankTier,
  countryFlag,
  relativeTime,
  formatRating,
  formatLeaderboard,
} from '../format'

describe('formatLeaderboard', () => {
  it('maps mode keys to friendly names', () => {
    expect(formatLeaderboard('rm_solo')).toBe('Ranked 1v1')
    expect(formatLeaderboard('rm_1v1_elo')).toBe('Ranked 1v1 (Elo)')
    expect(formatLeaderboard('qm_2v2')).toBe('Quick Match 2v2')
    expect(formatLeaderboard('rm_team')).toBe('Ranked Team')
    expect(formatLeaderboard('qm_4v4_ew')).toBe('Quick Match 4v4 (Empire Wars)')
    expect(formatLeaderboard(null)).toBe('—')
  })
})

describe('formatRankLevel', () => {
  it('prettifies rank slugs', () => {
    expect(formatRankLevel('gold_2')).toBe('Gold 2')
    expect(formatRankLevel('conqueror_4')).toBe('Conqueror 4')
    expect(formatRankLevel('unranked')).toBe('Unranked')
    expect(formatRankLevel(null)).toBe('Unranked')
  })
})

describe('rankTier', () => {
  it('extracts the base tier', () => {
    expect(rankTier('platinum_1')).toBe('platinum')
    expect(rankTier(null)).toBe('unranked')
  })
})

describe('formatRating', () => {
  it('rounds or dashes', () => {
    expect(formatRating(1215.6)).toBe('1216')
    expect(formatRating(null)).toBe('—')
  })
})

describe('countryFlag', () => {
  it('maps a valid 2-letter code to a flag emoji', () => {
    expect(countryFlag('se')).toBe('🇸🇪')
    expect(countryFlag('US')).toBe('🇺🇸')
    expect(countryFlag('')).toBe('')
    expect(countryFlag('xyz')).toBe('')
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-06-26T12:00:00.000Z')
  it('formats coarse buckets', () => {
    expect(relativeTime('2026-06-26T11:59:30.000Z', now)).toBe('just now')
    expect(relativeTime('2026-06-26T11:30:00.000Z', now)).toBe('30m ago')
    expect(relativeTime('2026-06-26T09:00:00.000Z', now)).toBe('3h ago')
    expect(relativeTime('2026-06-23T12:00:00.000Z', now)).toBe('3d ago')
    expect(relativeTime(null, now)).toBe('')
  })
})
