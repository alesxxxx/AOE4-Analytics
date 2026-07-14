import { describe, expect, it } from 'vitest'
import { historyQueryKey } from '../historyQueryKey'

describe('historyQueryKey', () => {
  it('isolates cached history by active profile', () => {
    expect(historyQueryKey(101)).not.toEqual(historyQueryKey(202))
    expect(historyQueryKey(101)).toEqual(['history', 101, 'recent-100'])
  })

  it('uses a separate key before an account is linked', () => {
    expect(historyQueryKey(null)).toEqual(['history', null, 'recent-100'])
  })

  it('keeps complete-history analytics separate from the recent sample', () => {
    expect(historyQueryKey(101, 'all')).toEqual(['history', 101, 'all'])
    expect(historyQueryKey(101, 'all')).not.toEqual(historyQueryKey(101))
  })
})
