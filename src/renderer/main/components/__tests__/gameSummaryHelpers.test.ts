import { describe, expect, it } from 'vitest'
import { finiteMetricValue, selectTrainerPlayer } from '../gameSummaryHelpers'

describe('finiteMetricValue', () => {
  it('keeps real finite numbers, including zero', () => {
    expect(finiteMetricValue(0)).toBe(0)
    expect(finiteMetricValue(42.5)).toBe(42.5)
  })

  it('does not turn missing values into a comparable zero', () => {
    expect(finiteMetricValue(null)).toBeNull()
    expect(finiteMetricValue(undefined)).toBeNull()
    expect(finiteMetricValue(Number.NaN)).toBeNull()
    expect(finiteMetricValue(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('selectTrainerPlayer', () => {
  const mirrorPlayers = [
    { profileId: 11, civToken: 'eng' },
    { profileId: 22, civToken: 'eng' },
  ]

  it('uses the signed-in profile id before a same-civ fallback', () => {
    expect(selectTrainerPlayer(mirrorPlayers, 22, 'english')).toBe(mirrorPlayers[1])
  })

  it('does not grade a same-civ opponent when the requested profile is absent', () => {
    expect(selectTrainerPlayer(mirrorPlayers, 33, 'english')).toBeNull()
  })

  it('falls back to civilization only for identity-less legacy summaries', () => {
    const legacyPlayers = [
      { profileId: null, civToken: 'fre' },
      { profileId: null, civToken: 'eng' },
    ]
    expect(selectTrainerPlayer(legacyPlayers, 22, 'english')).toBe(legacyPlayers[1])
  })
})
