import { describe, it, expect } from 'vitest'
import {
  parseLocalGameStats,
  determineSessionState,
  parseGameClock,
  gameElapsedSec,
  parseLiveMatchupPlayers,
  parseLatestGameResult,
} from '../localStats'

const tod = (h: number, m: number, s: number, ms = 0) =>
  h * 3_600_000 + m * 60_000 + s * 1000 + ms

describe('parseLiveMatchupPlayers', () => {
  // Real warnings.log shape: a roster block per match, after `StartMatch()`.
  const log = [
    '(I) [05:20:53.717] [t]: [Match Flow] MatchSetup::StartMatch() - session id -6',
    '(I) [05:20:58.003] [t]: GAME -- Human Player: 0 1.1.1.1.2 22223074 0 french_ha_01',
    '(I) [05:20:58.003] [t]: GAME -- AI Player: 1 2 A.I. Intermediate -1 1 abbasid',
    '(I) [05:21:28.931] [t]: GAME -- Starting mission:',
    '(I) [05:27:56.781] [t]: [Match Flow] MatchSetup::StartMatch() - session id -7',
    '(I) [05:27:57.561] [t]: GAME -- Human Player: 0 1.1.1.1.2 22223074 0 templar',
    '(I) [05:27:57.561] [t]: GAME -- AI Player: 1 2 A.I. Intermediate -1 1 english',
    '(I) [05:28:24.275] [t]: GAME -- Starting mission:',
  ].join('\n')

  it('parses only the CURRENT match (after the last StartMatch)', () => {
    const players = parseLiveMatchupPlayers(log)
    expect(players).toHaveLength(2)
    expect(players[0]).toMatchObject({ slot: 0, name: '1.1.1.1.2', ai: false, civToken: 'templar' })
    // AI names contain spaces — the parser must keep them whole.
    expect(players[1]).toMatchObject({
      slot: 1,
      name: '2 A.I. Intermediate',
      id: -1,
      ai: true,
      civToken: 'english',
    })
  })

  it('returns [] when no roster lines are present yet', () => {
    expect(parseLiveMatchupPlayers('(I) [00:00:00.000] [t]: loading…')).toEqual([])
  })
  it('keeps team ids for a 2v2 roster', () => {
    const players = parseLiveMatchupPlayers(
      [
        '(I) [05:20:53.717] [t]: [Match Flow] MatchSetup::StartMatch() - session id -8',
        '(I) [05:20:58.003] [t]: GAME -- Human Player: 0 Me 11 0 french',
        '(I) [05:20:58.003] [t]: GAME -- Human Player: 1 Ally 22 0 abbasid',
        '(I) [05:20:58.003] [t]: GAME -- Human Player: 2 Enemy A 33 1 english',
        '(I) [05:20:58.003] [t]: GAME -- Human Player: 3 Enemy B 44 1 mongol',
      ].join('\n'),
    )
    expect(players.map((p) => p.team)).toEqual([0, 0, 1, 1])
    expect(players.map((p) => p.civToken)).toEqual(['french', 'abbasid', 'english', 'mongol'])
  })
})

describe('parseGameClock + gameElapsedSec', () => {
  // Real log shape: `(I) [HH:MM:SS.mmm] [thread]: GAME -- ...`
  const log = [
    '(I) [02:45:07.196] [000016184]: GAME -- Starting mission:',
    '(I) [02:46:44.679] [000016184]: GAME -- SimulationController::Pause 1',
    '(I) [02:47:16.213] [000016184]: GAME -- SimulationController::Pause 0',
  ].join('\n')

  it('anchors to the mission start and sums completed pauses', () => {
    const c = parseGameClock(log)!
    expect(c.startTodMs).toBe(tod(2, 45, 7, 196))
    expect(c.pausedMs).toBe(tod(2, 47, 16, 213) - tod(2, 46, 44, 679)) // ~31.5s
    expect(c.paused).toBe(false)
  })

  it('subtracts paused time from elapsed (the drift fix)', () => {
    const c = parseGameClock(log)!
    // 02:50:00 → 292s since start, minus ~31.5s paused = ~261s
    expect(gameElapsedSec(c, tod(2, 50, 0))).toBe(261)
  })

  it('freezes elapsed while currently paused', () => {
    const paused = parseGameClock(
      [
        '(I) [02:45:00.000] [000016184]: GAME -- Starting mission:',
        '(I) [02:46:00.000] [000016184]: GAME -- SimulationController::Pause 1',
      ].join('\n'),
    )!
    expect(paused.paused).toBe(true)
    // even though "now" is 02:48, the clock is frozen at the 60s pause point
    expect(gameElapsedSec(paused, tod(2, 48, 0))).toBe(60)
  })

  it('returns null when no mission start is in view', () => {
    expect(parseGameClock('(I) [02:00:00.000] [x]: In Lobby')).toBeNull()
  })
})

// Build the GameResultNotificationMessage exactly as the game writes it:
// [0,"GameResultNotificationMessage",N,[[ <playerRows> ]]] where each row is
// [profileId, …, …, …, …, …, [["gt",..],["vprod",..],…]].
function resultLine(): string {
  const json = JSON.stringify([
    0,
    'GameResultNotificationMessage',
    1,
    [
      [
        [
          '10240693',
          0,
          0,
          0,
          0,
          0,
          [
            ['gt', 1320],
            ['vprod', 62],
            ['unitprod', 30],
            ['popmax', 150],
            ['totalcmds', 6200],
          ],
        ],
        [
          '999',
          0,
          0,
          0,
          0,
          0,
          [
            ['gt', 1320],
            ['vprod', 40],
            ['popmax', 120],
            ['totalcmds', 3000],
          ],
        ],
      ],
    ],
  ])
  return `[10:22:31] (websocket) message=${json}`
}

function fullResultLine(): string {
  const json = JSON.stringify([
    0,
    'GameResultNotificationMessage',
    10240693,
    [
      [
        [
          10240693,
          0,
          0,
          0,
          [],
          111,
          [
            ['gt', 1200],
            ['sqprod', 50],
            ['ekills', 40],
            ['sqlost', 20],
            ['bprod', 12],
            ['blost', 2],
            ['structdmg', 8],
            ['upg', 7],
            ['totalcmds', 2400],
          ],
        ],
        [
          999,
          0,
          0,
          0,
          [],
          222,
          [
            ['gt', 1200],
            ['sqprod', 45],
            ['ekills', 20],
            ['sqlost', 40],
            ['bprod', 9],
            ['upg', 5],
            ['totalcmds', 1800],
          ],
        ],
      ],
      [
        [111, 0, 0, 0, -1],
        [222, 0, 0, 0, 1],
      ],
      [],
      240962355,
    ],
  ])
  return `[12:08:36] (websocket) message=${json}`
}

const sampleLog = ['[10:00:01] GameWorld::AssignPlayers', resultLine(), ''].join('\n')

describe('parseLocalGameStats', () => {
  it('extracts the user row by preferred profile id', () => {
    const s = parseLocalGameStats(sampleLog, '10240693')
    expect(s).toMatchObject({
      profileId: '10240693',
      gameTimeSec: 1320,
      villagersProduced: 62,
      popMax: 150,
      totalCommands: 6200,
    })
  })

  it('falls back to the first valid row when no preference', () => {
    expect(parseLocalGameStats(sampleLog)?.profileId).toBe('10240693')
  })

  it('selects a specific opponent row when asked', () => {
    expect(parseLocalGameStats(sampleLog, '999')?.villagersProduced).toBe(40)
  })

  it('returns null when there is no result message', () => {
    expect(parseLocalGameStats('nothing here')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    expect(parseLocalGameStats('message=[0,"GameResultNotificationMessage",bad')).toBeNull()
  })

  it('uses the LAST result message when several are present', () => {
    const two = [resultLine(), resultLine().replace('62', '99')].join('\n')
    expect(parseLocalGameStats(two, '10240693')?.villagersProduced).toBe(99)
  })
})

describe('parseLatestGameResult', () => {
  it('extracts match id, signed result, counters, and APM from the latest result message', () => {
    const result = parseLatestGameResult(fullResultLine())!
    expect(result.matchId).toBe('240962355')
    expect(result.recipientProfileId).toBe(10240693)
    expect(result.players).toHaveLength(2)
    expect(result.players[0]).toMatchObject({
      profileId: 10240693,
      result: 'loss',
      unitsProduced: 50,
      kills: 40,
      deaths: 20,
      kd: 2,
      buildingsProduced: 12,
      buildingsLost: 2,
      structureDamage: 8,
      techsResearched: 7,
      apm: 120,
      gameTimeSec: 1200,
    })
    expect(result.players[1]).toMatchObject({ profileId: 999, result: 'win', apm: 90 })
  })

  it('returns null when no full result payload is available', () => {
    expect(parseLatestGameResult(resultLine())).toBeNull()
  })
})

describe('determineSessionState', () => {
  it('reports not-running when the process is closed', () => {
    expect(determineSessionState(false, sampleLog)).toBe('not-running')
  })

  it('is in-match when a start marker is the most recent lifecycle marker', () => {
    const log = 'GameResultNotificationMessage\nGameWorld::AssignPlayers'
    expect(determineSessionState(true, log)).toBe('in-match')
  })

  it('is menu when an end marker is the most recent', () => {
    const log = 'GameWorld::AssignPlayers\nGameResultNotificationMessage'
    expect(determineSessionState(true, log)).toBe('menu')
  })

  it('is menu on the post-game score screen / result stinger (before leaving the lobby)', () => {
    // A real surrender: the start marker is most recent UNTIL the results screen /
    // defeat stinger loads — which must count as game-over so the overlay flips.
    const results = 'GAME -- Starting mission\nUI loading ...PostGameResultsPage.xaml'
    expect(determineSessionState(true, results)).toBe('menu')
    const stinger = 'GAME -- Starting mission\nUI loading ...XboxDefeatStingerControl.xaml'
    expect(determineSessionState(true, stinger)).toBe('menu')
  })

  it('falls back to rich presence when no lifecycle markers', () => {
    expect(determineSessionState(true, 'status "In Game"')).toBe('in-match')
    expect(determineSessionState(true, 'status "In Lobby"')).toBe('menu')
  })
})
