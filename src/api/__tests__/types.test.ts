import { describe, it, expect } from 'vitest'
import { loadFixture } from './fixtures'
import {
  normalizeTeams,
  allPlayers,
  type SearchResponse,
  type Player,
  type GamesResponse,
  type Game,
  type CivStatsResponse,
  type MatchupStatsResponse,
} from '../types'

describe('API fixtures round-trip through the types', () => {
  it('search response exposes players with profile_id and leaderboards', () => {
    const search = loadFixture<SearchResponse>('search-beasty.json')
    expect(search.players.length).toBeGreaterThan(0)
    const first = search.players[0]!
    expect(typeof first.profile_id).toBe('number')
    expect(typeof first.name).toBe('string')
    expect(first.leaderboards).toBeTypeOf('object')
  })

  it('profile exposes per-mode stats under `modes`', () => {
    const player = loadFixture<Player>('player-10240693.json')
    expect(player.profile_id).toBe(10240693)
    expect(player.modes).toBeTypeOf('object')
    // Beasty has a populated rm_1v1_elo mode in the fixture.
    expect(player.modes['rm_1v1_elo']?.rating).toBeTypeOf('number')
  })

  it('normalizeTeams handles the WRAPPED slot shape (games list)', () => {
    const games = loadFixture<GamesResponse>('games-10240693-rmsolo.json')
    const game = games.games[0]!
    const teams = normalizeTeams(game)
    expect(teams.length).toBe(2)
    const p = teams[0]![0]!
    expect(typeof p.profile_id).toBe('number')
    expect(typeof p.civilization).toBe('string')
  })

  it('normalizeTeams handles the DIRECT slot shape (games/last) with embedded modes', () => {
    const last = loadFixture<Game>('games-last-10240693.json')
    const players = allPlayers(last)
    expect(players.length).toBe(2)
    const beasty = players.find((p) => p.profile_id === 10240693)!
    expect(beasty.name).toBe('Beastyqt')
    // games/last embeds the full profile, so modes are present directly.
    expect(beasty.modes).toBeTypeOf('object')
  })

  it('finished games report ongoing=false (there is no finished_at)', () => {
    const last = loadFixture<Game>('games-last-10240693.json')
    expect(last.ongoing).toBe(false)
  })

  it('civ stats expose win_rate + pick_rate per civilization', () => {
    const stats = loadFixture<CivStatsResponse>('stats-rmsolo-civilizations.json')
    expect(stats.data.length).toBeGreaterThan(10)
    const entry = stats.data[0]!
    expect(entry.civilization).toBeTypeOf('string')
    expect(entry.win_rate).toBeTypeOf('number')
    expect(entry.pick_rate).toBeTypeOf('number')
  })

  it('matchup stats expose civ vs other_civilization win rates', () => {
    const mu = loadFixture<MatchupStatsResponse>('stats-rmsolo-matchups.json')
    const entry = mu.data[0]!
    expect(entry.civilization).toBeTypeOf('string')
    expect(entry.other_civilization).toBeTypeOf('string')
    expect(entry.win_rate).toBeTypeOf('number')
  })
})
