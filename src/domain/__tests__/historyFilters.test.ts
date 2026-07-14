import { describe, expect, it } from 'vitest'
import { filterPersonalHistory } from '../historyFilters'

describe('filterPersonalHistory', () => {
  const matches = [
    { id: 'ranked' },
    { id: 'custom-human', custom: true },
    { id: 'custom-ai', custom: true, vsAI: true },
  ]

  it('keeps every game when the preference is disabled', () => {
    expect(filterPersonalHistory(matches, false)).toEqual(matches)
  })

  it('removes custom and AI practice games when the preference is enabled', () => {
    expect(filterPersonalHistory(matches, true)).toEqual([{ id: 'ranked' }])
  })
})
