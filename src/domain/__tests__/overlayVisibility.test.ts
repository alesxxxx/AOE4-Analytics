import { describe, it, expect } from 'vitest'
import { isFriendlyForeground, shouldShowOverlay } from '../overlayVisibility'

describe('isFriendlyForeground', () => {
  const friendly = ['RelicCardinal', 'RTSLytics']

  it('matches the game process (case- and extension-insensitive)', () => {
    expect(isFriendlyForeground('RelicCardinal', friendly)).toBe(true)
    expect(isFriendlyForeground('reliccardinal.exe', friendly)).toBe(true)
  })

  it('matches our own app (so unlock-to-drag keeps the overlay up)', () => {
    expect(isFriendlyForeground('RTSLytics.exe', friendly)).toBe(true)
    expect(isFriendlyForeground('rtslytics', friendly)).toBe(true)
  })

  it('is false for unrelated apps', () => {
    expect(isFriendlyForeground('WindowsTerminal', friendly)).toBe(false)
    expect(isFriendlyForeground('chrome', friendly)).toBe(false)
    expect(isFriendlyForeground(null, friendly)).toBe(false)
    expect(isFriendlyForeground('', friendly)).toBe(false)
  })
})

describe('shouldShowOverlay', () => {
  it('with gating: visible only when wanted AND the game is foreground', () => {
    expect(
      shouldShowOverlay({ desiredVisible: true, gameForeground: true, gatingEnabled: true }),
    ).toBe(true)
    expect(
      shouldShowOverlay({ desiredVisible: true, gameForeground: false, gatingEnabled: true }),
    ).toBe(false)
    expect(
      shouldShowOverlay({ desiredVisible: false, gameForeground: true, gatingEnabled: true }),
    ).toBe(false)
  })

  it('without gating (non-Windows): visibility follows desire only', () => {
    expect(
      shouldShowOverlay({ desiredVisible: true, gameForeground: false, gatingEnabled: false }),
    ).toBe(true)
    expect(
      shouldShowOverlay({ desiredVisible: false, gameForeground: true, gatingEnabled: false }),
    ).toBe(false)
  })
})
