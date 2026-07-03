import { describe, it, expect } from 'vitest'
import { biggestLeak } from '../leaks'
import type { Signal } from '../analysis'

const sig = (id: string, severity: Signal['severity']): Signal => ({
  id,
  severity,
  title: `${id} title`,
  detail: `${id} detail`,
})

describe('biggestLeak', () => {
  it('surfaces the most frequent, most severe recurring leak', () => {
    const games: Signal[][] = [
      [sig('slow_feudal', 'major'), sig('low_apm', 'minor')],
      [sig('slow_feudal', 'major'), sig('floating', 'minor')],
      [sig('low_apm', 'minor')],
    ]
    const leak = biggestLeak(games)
    expect(leak?.id).toBe('slow_feudal')
    expect(leak?.count).toBe(2)
    expect(leak?.games).toBe(3)
    expect(leak?.title).toBe('slow_feudal title')
  })

  it('ignores good/info signals and dedupes within a game', () => {
    const games: Signal[][] = [
      [sig('nice', 'good'), sig('fyi', 'info'), sig('idle_tc', 'minor'), sig('idle_tc', 'minor')],
    ]
    const leak = biggestLeak(games)
    expect(leak?.id).toBe('idle_tc')
    expect(leak?.count).toBe(1) // deduped within the game
  })

  it('returns null with no leaks', () => {
    expect(biggestLeak([])).toBeNull()
    expect(biggestLeak([[sig('nice', 'good')]])).toBeNull()
  })
})
