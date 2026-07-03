import type { CivStatsResponse, MapStatsResponse, MatchupStatsResponse } from '../api/types'
import { civDisplayName } from './civ'
import { round1 } from './form'
import { tierForWinRate, type Tier } from './tierList'

/** This civ's win rate against one opponent civ. */
export interface CivMatchup {
  civ: string
  civName: string
  winRate: number
  games: number
}

/** Aggregate meta stats for a single civ (for the civ detail page). */
export interface CivDetailStats {
  civ: string
  winRate: number | null
  pickRate: number | null
  games: number
  tier: Tier | null
  /** Opponent civs this civ beats most (highest win rate). */
  best: CivMatchup[]
  /** Opponent civs this civ struggles against (lowest win rate). */
  worst: CivMatchup[]
  /** Maps where this civ is the single strongest pick. */
  strongMaps: string[]
}

export interface CivDetailOptions {
  /** Ignore matchups below this many games (noise). */
  minMatchupGames?: number
  /** How many best/worst matchups to keep. */
  topN?: number
}

/** Builds per-civ meta stats from the civ-stats, matchup, and map responses. */
export function buildCivDetailStats(
  civ: string,
  civStats: CivStatsResponse,
  matchups: MatchupStatsResponse,
  maps: MapStatsResponse,
  options: CivDetailOptions = {},
): CivDetailStats {
  const minGames = options.minMatchupGames ?? 50
  const topN = options.topN ?? 5

  const stat = civStats.data.find((d) => d.civilization === civ) ?? null

  const mine = matchups.data
    .filter((m) => m.civilization === civ && m.other_civilization !== civ)
    .filter((m) => m.games_count >= minGames)
    .map((m) => ({
      civ: m.other_civilization,
      civName: civDisplayName(m.other_civilization),
      winRate: round1(m.win_rate),
      games: m.games_count,
    }))

  const byWinDesc = [...mine].sort((a, b) => b.winRate - a.winRate)
  const best = byWinDesc.slice(0, topN)
  const worst = [...byWinDesc].reverse().slice(0, topN)

  const strongMaps = maps.data
    .filter((m) => m.highest_win_rate_civilization === civ)
    .map((m) => m.map)
    .sort((a, b) => a.localeCompare(b))

  return {
    civ,
    winRate: stat ? round1(stat.win_rate) : null,
    pickRate: stat ? round1(stat.pick_rate) : null,
    games: stat ? stat.games_count : 0,
    tier: stat ? tierForWinRate(stat.win_rate) : null,
    best,
    worst,
    strongMaps,
  }
}
