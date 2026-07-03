import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HistoryStore, StoredMatch } from '../historyStore'
import { JsonHistoryStore } from '../jsonHistoryStore'
import { SqliteHistoryStore } from '../sqliteHistoryStore'
import { createHistoryStore } from '../historyStoreFactory'

function makeMatch(id: string, playedAt: string): StoredMatch {
  return {
    id,
    playedAt,
    result: 'win',
    civ: 'english',
    oppCiv: 'mongols',
    oppName: 'Opp',
    map: 'Dry Arabia',
    durationSec: 1200,
    rating: 1000,
    ratingDiff: 12,
    analysis: {
      result: 'win',
      signals: [],
      apm: null,
      grade: null,
      summary: 's',
      hasLocalStats: false,
    },
    goals: [
      {
        id: `${id}-g`,
        text: 'goal',
        metric: 'self',
        target: 1,
        comparison: 'gte',
        createdAt: playedAt,
      },
    ],
    priorGoalChecks: [],
    createdAt: playedAt,
  }
}

// The committed better-sqlite3 binary is built for Electron's ABI, so it may
// not load under vitest's Node runtime. Detect availability and only exercise
// the SQLite store directly when it loads here; the factory-fallback test below
// covers the unavailable case (which is what happens in this CI/test runtime).
let sqliteAvailable = true
try {
  const probe = new SqliteHistoryStore(':memory:')
  probe.close()
} catch {
  sqliteAvailable = false
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rtslytics-hist-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const backends: [string, () => HistoryStore][] = [
  ['JsonHistoryStore', () => new JsonHistoryStore(join(dir, 'history.json'))],
  ...(sqliteAvailable
    ? ([['SqliteHistoryStore', () => new SqliteHistoryStore(join(dir, 'history.db'))]] as [
        string,
        () => HistoryStore,
      ][])
    : []),
]

describe.each(backends)('%s', (_name, make) => {
  it('round-trips myTeam/oppTeam for a team-format match', () => {
    const store = make()
    const m = makeMatch('team-1', '2026-06-26T10:00:00.000Z')
    m.format = '2v2'
    m.myTeam = [{ civ: 'byzantines', name: 'Ally' }]
    m.oppTeam = [
      { civ: 'chinese', name: 'Foe1' },
      { civ: 'golden_horde', name: 'Foe2' },
    ]
    store.saveMatch(m)
    const loaded = store.getMatch('team-1')!
    expect(loaded.myTeam).toEqual(m.myTeam)
    expect(loaded.oppTeam).toEqual(m.oppTeam)
    store.close()
  })

  it('loads an old-shape record with no myTeam/oppTeam keys without throwing', () => {
    const store = make()
    // makeMatch() never sets myTeam/oppTeam — this simulates pre-this-change history.
    store.saveMatch(makeMatch('old-1', '2026-06-26T10:00:00.000Z'))
    const loaded = store.getMatch('old-1')!
    expect(loaded.myTeam).toBeUndefined()
    expect(loaded.oppTeam).toBeUndefined()
    expect(store.listMatches()).toHaveLength(1)
    store.close()
  })

  it('saves and retrieves a match', () => {
    const store = make()
    store.saveMatch(makeMatch('1', '2026-06-26T10:00:00.000Z'))
    expect(store.hasMatch('1')).toBe(true)
    expect(store.getMatch('1')?.civ).toBe('english')
    expect(store.getMatch('nope')).toBeNull()
    store.close()
  })

  it('lists matches newest-first and respects the limit', () => {
    const store = make()
    store.saveMatch(makeMatch('a', '2026-06-26T10:00:00.000Z'))
    store.saveMatch(makeMatch('b', '2026-06-26T12:00:00.000Z'))
    store.saveMatch(makeMatch('c', '2026-06-26T11:00:00.000Z'))
    const all = store.listMatches()
    expect(all.map((m) => m.id)).toEqual(['b', 'c', 'a'])
    expect(store.listMatches(2).map((m) => m.id)).toEqual(['b', 'c'])
    store.close()
  })

  it('upserts on duplicate id and exposes the latest match goals as active', () => {
    const store = make()
    store.saveMatch(makeMatch('a', '2026-06-26T10:00:00.000Z'))
    store.saveMatch(makeMatch('b', '2026-06-26T12:00:00.000Z'))
    const updated = makeMatch('a', '2026-06-26T10:00:00.000Z')
    updated.result = 'loss'
    store.saveMatch(updated)
    expect(store.listMatches().length).toBe(2)
    expect(store.getMatch('a')?.result).toBe('loss')
    expect(store.activeGoals()[0]?.id).toBe('b-g') // newest match's goals
    store.close()
  })
})

describe('createHistoryStore', () => {
  it('prefers sqlite when available and falls back to json otherwise', async () => {
    const auto = await createHistoryStore({
      sqlitePath: join(dir, 'h.db'),
      jsonPath: join(dir, 'h.json'),
    })
    // Either SQLite (when the native binary matches this runtime's ABI) or a
    // clean JSON fallback — both are valid, and the store must work either way.
    expect(auto.backend).toBe(sqliteAvailable ? 'sqlite' : 'json')
    auto.store.saveMatch(makeMatch('x', '2026-06-26T10:00:00.000Z'))
    expect(auto.store.getMatch('x')?.id).toBe('x')
    auto.store.close()
  })

  it('returns json when forced', async () => {
    const js = await createHistoryStore({
      sqlitePath: join(dir, 'h2.db'),
      jsonPath: join(dir, 'h2.json'),
      prefer: 'json',
    })
    expect(js.backend).toBe('json')
    js.store.close()
  })
})
