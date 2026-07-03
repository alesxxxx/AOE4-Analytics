import type { Game } from '../api/types'
import type { CivUsage, MapUsage } from './types'
import { civDisplayName } from './civ'
import { playerInGame, round1 } from './form'

/** Civilizations a player has used in the given games, most-played first. */
export function mostPlayedCivs(games: Game[], profileId: number): CivUsage[] {
  const counts = new Map<string, { games: number; wins: number }>()
  for (const game of games) {
    if (game.ongoing) continue
    const me = playerInGame(game, profileId)
    if (!me || (me.result !== 'win' && me.result !== 'loss')) continue
    const entry = counts.get(me.civilization) ?? { games: 0, wins: 0 }
    entry.games++
    if (me.result === 'win') entry.wins++
    counts.set(me.civilization, entry)
  }
  return [...counts.entries()]
    .map(([civ, e]) => ({
      civ,
      civName: civDisplayName(civ),
      games: e.games,
      wins: e.wins,
      winRate: e.games ? round1((e.wins / e.games) * 100) : null,
    }))
    .sort((a, b) => b.games - a.games || a.civ.localeCompare(b.civ))
}

/** Maps a player has played in the given games, most-played first. */
export function mapPreferences(games: Game[], profileId: number): MapUsage[] {
  const counts = new Map<string, { games: number; wins: number }>()
  for (const game of games) {
    if (game.ongoing) continue
    const me = playerInGame(game, profileId)
    if (!me || (me.result !== 'win' && me.result !== 'loss')) continue
    const entry = counts.get(game.map) ?? { games: 0, wins: 0 }
    entry.games++
    if (me.result === 'win') entry.wins++
    counts.set(game.map, entry)
  }
  return [...counts.entries()]
    .map(([map, e]) => ({
      map,
      games: e.games,
      wins: e.wins,
      winRate: e.games ? round1((e.wins / e.games) * 100) : null,
    }))
    .sort((a, b) => b.games - a.games || a.map.localeCompare(b.map))
}
