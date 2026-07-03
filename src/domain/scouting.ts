import type { Game, Modes, Player } from '../api/types'
import type { CivUsage, RankInfo, RecentForm, ScoutReport } from './types'
import { summarizeRecentForm } from './form'
import { mapPreferences, mostPlayedCivs } from './usage'

/** Modes we prefer when picking a representative rating, best first. */
const PREFERRED_MODES = ['rm_solo', 'rm_1v1_elo', 'rm_1v1', 'qm_1v1', 'rm_team']

export function extractRankInfo(modes: Modes, key: string): RankInfo | null {
  const m = modes[key]
  if (!m) return null
  return {
    leaderboard: key,
    rankLevel: m.rank_level ?? null,
    rating: m.rating ?? null,
    maxRating: m.max_rating ?? null,
    rank: m.rank ?? null,
    winRate: m.win_rate ?? null,
    gamesCount: m.games_count ?? 0,
  }
}

/** All modes the player has actually played, most-played first. */
export function ratedModes(modes: Modes): RankInfo[] {
  return Object.keys(modes)
    .map((k) => extractRankInfo(modes, k))
    .filter((r): r is RankInfo => r !== null && r.gamesCount > 0)
    .sort((a, b) => b.gamesCount - a.gamesCount)
}

/** Picks the most representative rated mode (rm_solo preferred), or null if unranked. */
export function pickPrimaryMode(modes: Modes): RankInfo | null {
  const rated = ratedModes(modes)
  if (rated.length === 0) return null
  for (const pref of PREFERRED_MODES) {
    const found = rated.find((r) => r.leaderboard === pref && r.rating != null)
    if (found) return found
  }
  return rated.find((r) => r.rating != null) ?? rated[0] ?? null
}

export function buildCounterNote(topCivs: CivUsage[], form: RecentForm): string {
  if (topCivs.length === 0) {
    return 'No recent public games to scout. Play your standard opening and scout in-game to read their plan.'
  }
  const main = topCivs[0]!
  const parts: string[] = []
  parts.push(
    `Mostly plays ${main.civName} (${main.games} of last ${form.games}` +
      `${main.winRate != null ? `, ${main.winRate}% win` : ''}).`,
  )
  if (topCivs.length > 1) {
    parts.push(
      `Also seen on: ${topCivs
        .slice(1)
        .map((c) => c.civName)
        .join(', ')}.`,
    )
  }
  if (form.streak <= -3) parts.push('On a losing streak — may play it safe or tilt.')
  else if (form.streak >= 3) parts.push('On a win streak — likely confident and aggressive.')
  parts.push(
    'Scout early, deny their key economy, and prepare a counter to their main composition. ' +
      '(Civ-specific counters arrive in Phase 2.)',
  )
  return parts.join(' ')
}

export interface BuildScoutInput {
  player: Player
  games: Game[]
}

/** Assembles a full ScoutReport from a player profile + their recent games. */
export function buildScoutReport({ player, games }: BuildScoutInput): ScoutReport {
  const recentForm = summarizeRecentForm(games, player.profile_id)
  const topCivs = mostPlayedCivs(games, player.profile_id).slice(0, 4)
  const topMaps = mapPreferences(games, player.profile_id).slice(0, 4)
  const modes = ratedModes(player.modes)
  const primary = pickPrimaryMode(player.modes)
  const hasData = recentForm.games > 0 || modes.length > 0

  return {
    profileId: player.profile_id,
    name: player.name,
    country: player.country ?? null,
    primary,
    modes,
    recentForm,
    topCivs,
    topMaps,
    note: buildCounterNote(topCivs, recentForm),
    hasData,
  }
}
