/**
 * Turns local files (the `match_history.jsn` result + the `.rec` replay matchup)
 * into an `AnalyzedGame` so CUSTOM and vs-AI games — which AoE4World never sees —
 * can flow through the same analysis/goals pipeline as ranked games and land in
 * History. Pure; the service wires the file reads.
 *
 * The replay header supplies civ (by name, incl. variants) + opponent identity;
 * `match_history.jsn` supplies the win/loss result and timing. (A per-minute
 * economy timeline would need the `.rec` command stream, which isn't ToS-safely
 * decodable — only the end-of-game economy stats from warnings.log are used.)
 */
import type { AnalyzedGame, RosterPlayer } from './analysis'
import type { LocalMatch } from './localMatch'
import type { ReplayMatchup, ReplayPlayer } from './replay'
import { teamFormat, teamSizesFromTeamIds } from './gameFormat'

/** A replay player's civ slug (falling back to its display name) + name, as a RosterPlayer. */
function toRosterPlayer(p: ReplayPlayer): RosterPlayer {
  return { civ: p.civSlug ?? p.civName, name: p.name || null }
}

/** Relic `resultType` → outcome. 1 = win, 0 = loss; anything else unknown. */
export function resultTypeToOutcome(resultType: number | null | undefined): 'win' | 'loss' | null {
  if (resultType === 1) return 'win'
  if (resultType === 0) return 'loss'
  return null
}

export interface LocalAnalyzedGame {
  game: AnalyzedGame
  oppName: string | null
  /** True when any opponent is AI (the games AoE4World never records). */
  isVsAI: boolean
  /** Team format label, e.g. "1v1", "2v2v2v2", "FFA (8)", "1v5". */
  format: string
}

/**
 * Builds an `AnalyzedGame` from a parsed `match_history.jsn` + its replay matchup
 * (same folder). Returns null when our own civ can't be determined (nothing to
 * analyze).
 */
export function buildLocalAnalyzedGame(
  match: LocalMatch,
  replay: ReplayMatchup | null,
): LocalAnalyzedGame | null {
  const myCiv = replay?.me?.civSlug ?? null
  if (!myCiv) return null

  const myRow = match.players.find((p) => p.profileId === match.myProfileId)

  const durationSec =
    match.startedAtMs != null &&
    match.completedAtMs != null &&
    match.completedAtMs > match.startedAtMs
      ? Math.round((match.completedAtMs - match.startedAtMs) / 1000)
      : null

  // "vs AI" means the local replay contains at least one AI player. Human custom
  // games are still custom games, but they should be analyzed and stored too.
  const isVsAI = replay ? replay.opponents.some((o) => o.ai) : match.opponentProfileIds.length === 0

  // Team format: prefer match_history team ids (present for real human team games,
  // and the only signal that maps players to actual sides). The replay fallback can
  // only infer common custom shapes from the parsed replay.
  const teamed = match.players.filter((p) => p.teamId != null && p.teamId >= 0)
  let teamSizes: number[]
  if (teamed.length >= 2) {
    teamSizes = teamSizesFromTeamIds(match.players.map((p) => p.teamId))
  } else if (replay) {
    const all = [replay.me, ...replay.opponents].filter(Boolean) as ReplayPlayer[]
    if (all.every((p) => !p.ai)) {
      // Human-only custom without team ids: safest fallback is solo sides. This
      // makes the common friend 1v1 show as 1v1 instead of "2 players".
      teamSizes = all.map(() => 1)
    } else {
      teamSizes = [all.filter((p) => !p.ai).length, all.filter((p) => p.ai).length]
    }
  } else {
    teamSizes = []
  }

  // Team ROSTER (who's with me vs against me): the replay header has names/civs
  // but no team ids, while match_history has team ids but not reliable names/civs.
  // Use exact/common shapes first, then fall back to the old human-vs-AI split.
  let myTeammates: ReplayPlayer[] = []
  let enemies: ReplayPlayer[] = replay?.opponents ?? []
  if (replay) {
    const humanOpponents = replay.opponents.filter((p) => !p.ai)
    const aiOpponents = replay.opponents.filter((p) => p.ai)
    if (humanOpponents.length > 0 && aiOpponents.length === 0) {
      myTeammates = []
      enemies = replay.opponents
    } else {
      const meIsHuman = !replay.me?.ai
      myTeammates = replay.opponents.filter((p) => !p.ai === meIsHuman)
      enemies = replay.opponents.filter((p) => !p.ai !== meIsHuman)
    }
  }
  const opp = enemies[0] ?? replay?.opponents[0] ?? null

  const game: AnalyzedGame = {
    result: resultTypeToOutcome(myRow?.resultType),
    civ: myCiv,
    oppCiv: opp?.civSlug ?? null,
    map: replay?.mapName ?? match.map ?? 'Unknown',
    durationSec,
    myTeam: myTeammates.length > 0 ? myTeammates.map(toRosterPlayer) : undefined,
    oppTeam: enemies.length > 1 ? enemies.map(toRosterPlayer) : undefined,
  }

  return { game, oppName: opp?.name ?? null, isVsAI, format: teamFormat(teamSizes) }
}
