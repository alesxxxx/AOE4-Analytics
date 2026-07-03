import { describe, it, expect } from 'vitest'
import { currentReminder, MACRO_REMINDERS, type Reminder } from '../reminders'

describe('currentReminder', () => {
  const rs: Reminder[] = [
    { atSec: 0, text: 'a' },
    { atSec: 60, text: 'b' },
    { atSec: 120, text: 'c' },
  ]

  it('returns the latest reminder reached', () => {
    expect(currentReminder(0, rs)?.text).toBe('a')
    expect(currentReminder(59, rs)?.text).toBe('a')
    expect(currentReminder(60, rs)?.text).toBe('b')
    expect(currentReminder(1000, rs)?.text).toBe('c')
  })

  it('returns null before the first reminder or when no clock', () => {
    expect(currentReminder(null, rs)).toBeNull()
    expect(currentReminder(-5, rs)).toBeNull()
    expect(currentReminder(10, [{ atSec: 20, text: 'x' }])).toBeNull()
  })

  it('bundled reminders are ordered by time', () => {
    for (let i = 1; i < MACRO_REMINDERS.length; i++) {
      expect(MACRO_REMINDERS[i]!.atSec).toBeGreaterThan(MACRO_REMINDERS[i - 1]!.atSec)
    }
  })
})
