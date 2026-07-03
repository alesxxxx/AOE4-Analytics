import { describe, it, expect } from 'vitest'
import { loadFixture } from '../../api/__tests__/fixtures'
import type { Game } from '../../api/types'
import {
  evaluateLiveMatch,
  buildLiveMatchInfo,
  buildLiveMatchup,
  buildLocalLiveMatchup,
  type LiveEval,
} from '../liveMatch'
import type { RankInfo } from '../types'

function player(over: Record<string, unknown>) {
  return { result: null, civilization_randomized: false, rating_diff: null, ...over }
}
/** Minimal 1v1 ongoing game: me in team index 1 (to test reordering). */
function twoPlayerGame(): Game {
  return {
    game_id: 1,
    started_at: '2026-06-29T00:00:00Z',
    duration: null,
    map: 'Dry Arabia',
    kind: 'rm_solo',
    leaderboard: 'rm_solo',
    ongoing: true,
    just_finished: false,
    teams: [
      [player({ profile_id: 2, name: 'Opp', civilization: 'english', rating: 1200, mmr: 1190 })],
      [player({ profile_id: 1, name: 'Me', civilization: 'french', rating: null, mmr: 1500 })],
    ],
  } as unknown as Game
}

function fourPlayerGame(): Game {
  return {
    game_id: 2,
    started_at: '2026-06-29T00:00:00Z',
    duration: null,
    map: 'Dry Arabia',
    kind: 'rm_2v2',
    leaderboard: 'rm_2v2',
    ongoing: true,
    just_finished: false,
    teams: [
      [
        player({ profile_id: 3, name: 'Enemy A', civilization: 'english', rating: 1200, mmr: 1190 }),
        player({ profile_id: 4, name: 'Enemy B', civilization: 'mongols', rating: 1210, mmr: 1200 }),
      ],
      [
        player({ profile_id: 1, name: 'Me', civilization: 'french', rating: null, mmr: 1500 }),
        player({ profile_id: 2, name: 'Ally', civilization: 'abbasid_dynasty', rating: 1480, mmr: 1470 }),
      ],
    ],
  } as unknown as Game
}

const rank = (rankN: number): RankInfo => ({
  leaderboard: 'rm_solo',
  rankLevel: 'gold_2',
  rating: 1500,
  maxRating: 1550,
  rank: rankN,
  winRate: 55,
  gamesCount: 100,
})

const ongoing = loadFixture<Game>('game-ongoing_synthetic.json')
const finished = loadFixture<Game>('games-last-10240693.json') // ongoing:false, an old game

const NOW = Date.parse('2026-06-26T12:00:00.000Z')

describe('evaluateLiveMatch — the stale-last-game problem', () => {
  it('a 2-night-old finished game is NOT live (the core bug)', () => {
    const r = evaluateLiveMatch({
      game: finished,
      localInMatch: null,
      processRunning: null,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(false)
    expect(r.isStale).toBe(true)
    expect(r.source).toBe('stale')
  })

  it('ongoing=true from AoE4World is live', () => {
    const r = evaluateLiveMatch({
      game: ongoing,
      localInMatch: null,
      processRunning: true,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(true)
    expect(r.source).toBe('ongoing')
  })

  it('local in-match beats AoE4World latency (game not yet ongoing)', () => {
    const r = evaluateLiveMatch({
      game: finished, // API still shows the previous game as not-ongoing
      localInMatch: true,
      processRunning: true,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(true)
    expect(r.source).toBe('local')
  })

  it('a definitive local menu overrides AoE4World stale ongoing (won-game-still-live bug)', () => {
    // After a win, AoE4World can keep `ongoing:true` for minutes while the local
    // log already says menu — the local signal must win.
    const r = evaluateLiveMatch({
      game: ongoing, // API still reports ongoing=true (lagging)
      localInMatch: false, // local log: back in menu (game ended)
      processRunning: true,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(false)
    expect(r.source).not.toBe('ongoing')
  })

  it('process closed → never live, even if API/local say otherwise', () => {
    const r = evaluateLiveMatch({
      game: ongoing,
      localInMatch: true,
      processRunning: false,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(false)
    expect(r.source).toBe('process-closed')
  })

  it('just_finished is flagged but not live or stale', () => {
    const r = evaluateLiveMatch({
      game: { ...finished, just_finished: true },
      localInMatch: false,
      processRunning: true,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(false)
    expect(r.isStale).toBe(false)
    expect(r.source).toBe('just_finished')
  })

  it('a finished game within the recent window is "recent" (last game), not stale', () => {
    const recentGame: Game = {
      ...finished,
      just_finished: false,
      started_at: new Date(NOW - 5 * 60_000).toISOString(),
    }
    const r = evaluateLiveMatch({
      game: recentGame,
      localInMatch: false,
      processRunning: true,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(false)
    expect(r.isStale).toBe(false)
    expect(r.source).toBe('recent')
  })

  it('no game + no local signal → not live', () => {
    const r = evaluateLiveMatch({
      game: null,
      localInMatch: null,
      processRunning: true,
      nowMs: NOW,
    })
    expect(r.isLive).toBe(false)
    expect(r.source).toBe('no-game')
  })
})

describe('buildLiveMatchInfo — never present the stale last game as a custom/AI match', () => {
  const ME = 10240693 // the "me" profile in the ongoing fixture

  it('ranked ongoing game: opponent, civs, map and start time come from the live game', () => {
    const live: LiveEval = { isLive: true, isStale: false, source: 'ongoing' }
    const info = buildLiveMatchInfo(ongoing, live, true, ME)
    expect(info.isLive).toBe(true)
    expect(info.custom).toBe(false)
    expect(info.myCiv).toBe('abbasid_dynasty')
    expect(info.map).toBe('Dry Arabia')
    expect(info.startedAt).toBe('2026-06-26T12:00:00.000Z')
    expect(info.opponent?.profileId).toBe(10694733)
    expect(info.opponent?.civ).toBe('mongols')
  })

  it('local (custom/AI) game: the stale games/last data is IGNORED — no opponent, no civ, no map, no timer', () => {
    // `finished` is the previous ranked game AoE4World still returns. It must NOT
    // be used to fill in the current custom/AI match (the House-of-Lancaster bug).
    const live: LiveEval = { isLive: true, isStale: false, source: 'local' }
    const info = buildLiveMatchInfo(finished, live, true, ME)
    expect(info.isLive).toBe(true)
    expect(info.custom).toBe(true)
    expect(info.opponent).toBeNull()
    expect(info.myCiv).toBeNull()
    expect(info.map).toBeNull()
    expect(info.startedAt).toBeNull()
  })

  it('not live: minimal info, custom false, still carries processRunning for the launcher', () => {
    const live: LiveEval = { isLive: false, isStale: true, source: 'stale' }
    const info = buildLiveMatchInfo(finished, live, true, ME)
    expect(info.isLive).toBe(false)
    expect(info.custom).toBe(false)
    expect(info.opponent).toBeNull()
    expect(info.processRunning).toBe(true)
  })
})

describe('buildLiveMatchup', () => {
  it('puts MY team first, marks isMe, and pulls rank from the map', () => {
    const ranks = new Map<number, RankInfo | null>([
      [1, rank(28)],
      [2, rank(871)],
    ])
    const m = buildLiveMatchup(twoPlayerGame(), 1, ranks)
    // me (profile 1) was in team index 1 → reordered to teams[0]
    expect(m.teams[0]![0]!.isMe).toBe(true)
    expect(m.teams[0]![0]!.name).toBe('Me')
    expect(m.teams[0]![0]!.rank).toBe(28)
    expect(m.teams[1]![0]!.name).toBe('Opp')
    expect(m.teams[1]![0]!.isMe).toBe(false)
  })

  it('falls back rating→mmr, and tolerates a player absent from the rank map', () => {
    const ranks = new Map<number, RankInfo | null>([[2, rank(871)]]) // no entry for me (1)
    const m = buildLiveMatchup(twoPlayerGame(), 1, ranks)
    const me = m.teams[0]![0]!
    expect(me.rating).toBe(1500) // rating null → mmr 1500
    expect(me.rank).toBeNull() // not in the map
    expect(m.teams[1]![0]!.rating).toBe(1200) // opp rating present
  })

  it('keeps original team order when myProfileId is null', () => {
    const m = buildLiveMatchup(twoPlayerGame(), null, new Map())
    expect(m.teams[0]![0]!.name).toBe('Opp') // unchanged (team index 0)
    expect(m.teams.flat().every((p) => !p.isMe)).toBe(true)
  })

  it('supports 2v2 by keeping both players on each team and moving my team first', () => {
    const ranks = new Map<number, RankInfo | null>([
      [1, rank(10)],
      [2, rank(20)],
      [3, rank(30)],
      [4, rank(40)],
    ])
    const m = buildLiveMatchup(fourPlayerGame(), 1, ranks)
    expect(m.teams).toHaveLength(2)
    expect(m.teams[0]!.map((p) => p.name)).toEqual(['Me', 'Ally'])
    expect(m.teams[1]!.map((p) => p.name)).toEqual(['Enemy A', 'Enemy B'])
    expect(m.teams[0]![0]!.isMe).toBe(true)
    expect(m.teams.flat().every((p) => p.isAI === false)).toBe(true)
  })
})

describe('buildLocalLiveMatchup', () => {
  it('groups a custom 2v2 roster by team and marks the configured player as me', () => {
    const m = buildLocalLiveMatchup(
      [
        { slot: 0, name: 'Me', id: 11, team: 0, civToken: 'french_ha_01', ai: false },
        { slot: 1, name: 'Ally', id: 22, team: 0, civToken: 'abbasid', ai: false },
        { slot: 2, name: 'Enemy A', id: 33, team: 1, civToken: 'english', ai: false },
        { slot: 3, name: 'Enemy B', id: 44, team: 1, civToken: 'mongol', ai: false },
      ],
      11,
    )!
    expect(m.teams[0]!.map((p) => p.name)).toEqual(['Me', 'Ally'])
    expect(m.teams[1]!.map((p) => p.name)).toEqual(['Enemy A', 'Enemy B'])
    expect(m.teams[0]![0]!.isMe).toBe(true)
    expect(m.teams[0]![0]!.civ).toBe('jeanne_darc')
    expect(m.teams[1]![1]!.civ).toBe('mongols')
  })

  it('falls back to the sole human as me in vs-AI local games', () => {
    const m = buildLocalLiveMatchup(
      [
        { slot: 0, name: 'Human', id: 11, team: 0, civToken: 'templar', ai: false },
        { slot: 1, name: 'A.I.', id: -1, team: 1, civToken: 'english', ai: true },
      ],
      null,
    )!
    expect(m.teams[0]![0]!.name).toBe('Human')
    expect(m.teams[0]![0]!.isMe).toBe(true)
    expect(m.teams[1]![0]!.isAI).toBe(true)
  })

  it('splits vs-AI rosters when the log repeats the same pseudo-team for everyone', () => {
    const m = buildLocalLiveMatchup(
      [
        { slot: 0, name: '1.1.1.1.2', id: 22223074, team: 10001, civToken: 'french_ha_01', ai: false },
        { slot: 1, name: '2 A.I. Intermediate', id: -1, team: 10001, civToken: 'sultanate', ai: true },
      ],
      22223074,
    )!
    expect(m.teams).toHaveLength(2)
    expect(m.teams[0]![0]).toMatchObject({ isMe: true, civ: 'jeanne_darc' })
    expect(m.teams[1]![0]).toMatchObject({
      name: '2 A.I. Intermediate',
      isAI: true,
      civ: 'delhi_sultanate',
    })
  })
})
