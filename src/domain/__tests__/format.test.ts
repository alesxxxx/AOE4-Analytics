import { describe, it, expect } from 'vitest'
import { formatDuration, parseDuration } from '@domain/format'

describe('formatDuration', () => {
  it('formats whole minutes and seconds as M:SS', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('keeps minutes uncapped (match timers can exceed an hour)', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })

  it('floors fractional seconds', () => {
    expect(formatDuration(75.9)).toBe('1:15')
  })

  it('guards against negative, NaN, and non-finite input', () => {
    expect(formatDuration(-10)).toBe('0:00')
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

describe('parseDuration', () => {
  it('parses M:SS back into seconds', () => {
    expect(parseDuration('0:00')).toBe(0)
    expect(parseDuration('1:15')).toBe(75)
    expect(parseDuration('10:00')).toBe(600)
  })

  it('parses H:MM:SS', () => {
    expect(parseDuration('1:01:01')).toBe(3661)
  })

  it('returns null for malformed input', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1:99')).toBeNull()
  })
})
