import { describe, it, expect } from 'vitest'
import type { Game, GamePlayer } from '../../api/types'
import {
  analyzeMatch,
  computeApm,
  extractAnalyzedGame,
  localEconomyScore,
  resourcesPerMinute,
  resultFromPerPlayer,
  sanitizeStoredSignals,
  totalResourcesGathered,
  villagersPerMinute,
  type AnalyzedGame,
  type Signal,
} from '../analysis'

const baseGame: AnalyzedGame = {
  result: 'loss',
  civ: 'english',
  oppCiv: 'mongols',
  map: 'Dry Arabia',
  durationSec: 1200,
}

describe('computeApm', () => {
  it('derives APM from commands and game time', () => {
    expect(computeApm({ totalCommands: 600, gameTimeSec: 600 })).toBe(60)
    expect(computeApm({ totalCommands: 600 })).toBeNull()
    expect(computeApm(undefined)).toBeNull()
  })
})

describe('villagersPerMinute', () => {
  it('computes villagers per minute from local stats', () => {
    expect(villagersPerMinute({ villagersProduced: 60, gameTimeSec: 1200 })).toBe(3) // 60 over 20 min
  })
  it('returns null on a parse miss (0 villagers), no time, or no data', () => {
    expect(villagersPerMinute({ villagersProduced: 0, gameTimeSec: 1200 })).toBeNull()
    expect(villagersPerMinute({ villagersProduced: 50, gameTimeSec: 0 })).toBeNull()
    expect(villagersPerMinute(null)).toBeNull()
  })
})

describe('resource economy helpers', () => {
  const local = {
    gameTimeSec: 1200,
    resourcesGathered: { food: 6000, wood: 3000, gold: 2000, stone: 1000 },
  }

  it('computes resource totals and resources per minute from stat summaries', () => {
    expect(totalResourcesGathered(local)).toBe(12000)
    expect(resourcesPerMinute(local)).toBe(600)
  })

  it('scores economy from resources when villager counters are unavailable', () => {
    expect(localEconomyScore(local)).toBeGreaterThan(50)
    expect(localEconomyScore({ gameTimeSec: 1200 })).toBeNull()
  })
})

describe('resultFromPerPlayer', () => {
  it('uses the current player row as a result fallback', () => {
    expect(
      resultFromPerPlayer(
        [
          { profileId: 1, teamId: 0, civ: 'french', result: 'win', unitsProduced: null, kills: null, deaths: null, kd: null, buildingsProduced: null, techsResearched: null, apm: null, gameTimeSec: null },
          { profileId: 2, teamId: 1, civ: 'japanese', result: 'loss', unitsProduced: null, kills: null, deaths: null, kd: null, buildingsProduced: null, techsResearched: null, apm: null, gameTimeSec: null },
        ],
        1,
      ),
    ).toBe('win')
  })

  it('returns null without a matching profile row', () => {
    expect(resultFromPerPlayer([], 1)).toBeNull()
    expect(resultFromPerPlayer(undefined, null)).toBeNull()
  })
})

describe('analyzeMatch (Tier-1 only)', () => {
  it('flags a short game and produces no grade', () => {
    const a = analyzeMatch({ game: { ...baseGame, durationSec: 300 }, bracket: 'gold' })
    expect(a.hasLocalStats).toBe(false)
    expect(a.grade).toBeNull()
    expect(a.signals.some((s) => s.id === 'short-game')).toBe(true)
  })

  it('flags a tough matchup from matchup win rate', () => {
    const a = analyzeMatch({ game: baseGame, bracket: 'gold', matchupWinRate: 44 })
    expect(a.signals.some((s) => s.id === 'tough-matchup')).toBe(true)
  })
})

describe('analyzeMatch (with local stats)', () => {
  it('flags low villager production as a major leak and grades it', () => {
    const a = analyzeMatch({
      game: baseGame,
      bracket: 'gold',
      local: { villagersProduced: 28, totalCommands: 300, gameTimeSec: 1200 },
    })
    expect(a.hasLocalStats).toBe(true)
    const low = a.signals.find((s) => s.id === 'low-villagers')
    expect(low?.severity).toBe('major')
    expect(a.signals[0]!.id).toBe('low-villagers') // majors sort first
    expect(a.grade).not.toBeNull()
  })

  it('rewards solid villager production with a good signal and higher grade', () => {
    const a = analyzeMatch({
      game: baseGame,
      bracket: 'gold',
      local: { villagersProduced: 60, totalCommands: 1400, gameTimeSec: 1200 },
    })
    expect(a.signals.some((s) => s.id === 'good-villagers')).toBe(true)
    expect(['A', 'B']).toContain(a.grade)
  })

  it('treats villagersProduced=0 as a parse miss: no "low villager" leak, no F grade', () => {
    // A real 20-min game can't have 0 villagers — don't flag it or grade F off it.
    const a = analyzeMatch({
      game: baseGame,
      bracket: 'gold',
      local: { villagersProduced: 0, totalCommands: 1200, gameTimeSec: 1200 },
    })
    expect(a.signals.some((s) => s.id === 'low-villagers')).toBe(false)
    expect(a.grade).toBeNull()
    expect(a.apm).toBe(60) // APM still derived from the real command count
  })

  it('treats 0 APM (no commands parsed) as no data: no low-apm leak', () => {
    const a = analyzeMatch({
      game: baseGame,
      bracket: 'gold',
      local: { villagersProduced: 50, totalCommands: 0, gameTimeSec: 1200 },
    })
    expect(a.signals.some((s) => s.id === 'low-apm')).toBe(false)
  })
})

describe('sanitizeStoredSignals', () => {
  const sig = (over: Partial<Signal>): Signal => ({
    id: 'low-villagers',
    severity: 'major',
    title: 'placeholder',
    detail: 'placeholder',
    ...over,
  })

  it('strips a stale parse-miss "(0)" villager signal from old history', () => {
    expect(sanitizeStoredSignals([sig({ title: 'Low villager count (0)' })])).toHaveLength(0)
    expect(
      sanitizeStoredSignals([sig({ id: 'good-villagers', title: 'Solid villager production (0)' })]),
    ).toHaveLength(0)
  })

  it('strips a stale "(~0 APM)" signal', () => {
    expect(
      sanitizeStoredSignals([sig({ id: 'low-apm', severity: 'minor', title: 'Low activity (~0 APM)' })]),
    ).toHaveLength(0)
  })

  it('keeps a real nonzero villager signal', () => {
    expect(sanitizeStoredSignals([sig({ title: 'Low villager count (28)' })])).toHaveLength(1)
  })

  it('keeps unrelated signals untouched', () => {
    const others = [
      sig({ id: 'short-game', severity: 'minor', title: 'Short game (5:00)' }),
      sig({ id: 'tough-matchup', severity: 'info', title: 'Tough matchup' }),
    ]
    expect(sanitizeStoredSignals(others)).toHaveLength(2)
  })
})

describe('extractAnalyzedGame', () => {
  const player = (over: Partial<GamePlayer>): GamePlayer => ({
    profile_id: 0,
    name: 'p',
    result: 'win',
    civilization: 'english',
    rating: 1000,
    rating_diff: 5,
    mmr: null,
    mmr_diff: null,
    ...over,
  })

  const game1v1: Game = {
    game_id: 1,
    started_at: '2026-01-01T00:00:00Z',
    duration: 900,
    map: 'Arabia',
    kind: 'rm_1v1',
    leaderboard: 'rm_solo',
    ongoing: false,
    just_finished: true,
    teams: [
      [player({ profile_id: 1, name: 'Me', civilization: 'french', result: 'win' })],
      [player({ profile_id: 2, name: 'Foe', civilization: 'mongols', result: 'loss' })],
    ],
  }

  const game2v2: Game = {
    ...game1v1,
    game_id: 2,
    kind: 'rm_2v2',
    leaderboard: 'rm_team',
    teams: [
      [
        player({ profile_id: 1, name: 'Me', civilization: 'ottomans', result: 'win' }),
        player({ profile_id: 2, name: 'Ally', civilization: 'byzantines', result: 'win' }),
      ],
      [
        player({ profile_id: 3, name: 'Foe1', civilization: 'chinese', result: 'loss' }),
        player({ profile_id: 4, name: 'Foe2', civilization: 'golden_horde', result: 'loss' }),
      ],
    ],
  }

  it('1v1: leaves myTeam/oppTeam undefined (no regression)', () => {
    const ag = extractAnalyzedGame(game1v1, 1)!
    expect(ag.civ).toBe('french')
    expect(ag.oppCiv).toBe('mongols')
    expect(ag.myTeam).toBeUndefined()
    expect(ag.oppTeam).toBeUndefined()
  })

  it('2v2: captures the full roster on both sides', () => {
    const ag = extractAnalyzedGame(game2v2, 1)!
    expect(ag.civ).toBe('ottomans')
    expect(ag.oppCiv).toBe('chinese') // first-opponent convenience field unchanged
    expect(ag.myTeam).toEqual([{ civ: 'byzantines', name: 'Ally' }])
    expect(ag.oppTeam).toEqual([
      { civ: 'chinese', name: 'Foe1' },
      { civ: 'golden_horde', name: 'Foe2' },
    ])
  })
})
