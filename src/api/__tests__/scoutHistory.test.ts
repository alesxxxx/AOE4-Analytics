import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Game, GamePlayer, GamesResponse } from '../types'

const mocks = vi.hoisted(() => ({
  getPlayerGames: vi.fn(),
  getAllSettings: vi.fn(),
}))

vi.mock('../../../electron/services/appContext', () => ({
  getClient: () => ({ getPlayerGames: mocks.getPlayerGames }),
  getSettings: () => ({ getAll: mocks.getAllSettings }),
  getRelicClient: vi.fn(),
}))

import { getScoutHistory } from '../../../electron/services/scoutService'

function player(
  profileId: number,
  name: string,
  civilization: string,
  result: 'win' | 'loss' | null,
): GamePlayer {
  return {
    profile_id: profileId,
    name,
    result,
    civilization,
    rating: null,
    rating_diff: null,
    mmr: null,
  }
}

function game(gameId: number, first: GamePlayer, second: GamePlayer): Game {
  return {
    game_id: gameId,
    started_at: '2026-07-14T12:00:00Z',
    duration: 1_200,
    map: 'Dry Arabia',
    kind: 'rm_1v1',
    leaderboard: 'rm_solo',
    ongoing: false,
    just_finished: false,
    teams: [[{ player: first }], [{ player: second }]],
  }
}

function response(games: Game[], totalCount = games.length): GamesResponse {
  return {
    games,
    total_count: totalCount,
    count: games.length,
  }
}

describe('getScoutHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllSettings.mockReturnValue({ profileId: 101, playerName: 'Active player' })
  })

  it('loads bounded recent games and opponent-filtered head-to-head', async () => {
    const recent = response([
      game(1, player(202, 'Viewed', 'french', 'win'), player(303, 'Opponent', 'english', 'loss')),
    ])
    const headToHead = response(
      [
        game(
          2,
          player(101, 'Active player', 'english', 'loss'),
          player(202, 'Viewed', 'french', 'win'),
        ),
      ],
      4,
    )
    mocks.getPlayerGames.mockImplementation(async (profileId: number) =>
      profileId === 202 ? recent : headToHead,
    )

    const result = await getScoutHistory(202)

    expect(mocks.getPlayerGames).toHaveBeenNthCalledWith(1, 202, { limit: 10 })
    expect(mocks.getPlayerGames).toHaveBeenNthCalledWith(2, 101, {
      limit: 20,
      opponentProfileId: 202,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.recent).toMatchObject({
      ok: true,
      data: {
        sampleSize: 1,
        matches: [{ result: 'win', civilization: 'french', opponentNames: ['Opponent'] }],
      },
    })
    expect(result.data.headToHead).toMatchObject({
      ok: true,
      data: {
        sampleSize: 1,
        totalCount: 4,
        wins: 0,
        losses: 1,
        decidedGames: 1,
        winRate: 0,
      },
    })
  })

  it('does not request head-to-head when viewing the active profile', async () => {
    mocks.getAllSettings.mockReturnValue({ profileId: 202, playerName: 'Viewed' })
    mocks.getPlayerGames.mockResolvedValue(response([]))

    const result = await getScoutHistory(202)

    expect(mocks.getPlayerGames).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: true, data: { headToHead: null } })
  })

  it('keeps recent matches available when the head-to-head request fails', async () => {
    const recent = response([
      game(3, player(202, 'Viewed', 'french', 'win'), player(303, 'Opponent', 'english', 'loss')),
    ])
    mocks.getPlayerGames.mockImplementation(async (profileId: number) => {
      if (profileId === 202) return recent
      throw new Error('Head-to-head unavailable')
    })

    const result = await getScoutHistory(202)

    expect(result).toMatchObject({
      ok: true,
      data: {
        recent: { ok: true, data: { sampleSize: 1 } },
        headToHead: { ok: false, error: { message: 'Head-to-head unavailable' } },
      },
    })
  })

  it('rejects invalid renderer profile ids without making a request', async () => {
    const result = await getScoutHistory(-1)

    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } })
    expect(mocks.getPlayerGames).not.toHaveBeenCalled()
  })
})
