import type {
  LocalGameStats,
  MatchAnalysis,
  PerPlayerMatchStats,
  RosterPlayer,
} from '../domain/analysis'
import type { Goal, GoalCheck } from '../domain/goals'

/** A persisted, analyzed match plus the goals it produced and how the prior goals fared. */
export interface StoredMatch {
  id: string
  playedAt: string
  result: 'win' | 'loss' | null
  civ: string
  oppCiv: string | null
  oppName: string | null
  map: string
  durationSec: number | null
  rating: number | null
  ratingDiff: number | null
  analysis: MatchAnalysis
  /** Goals generated from THIS match (targets for the next game). */
  goals: Goal[]
  /** How the PREVIOUS match's goals turned out in this game. */
  priorGoalChecks: GoalCheck[]
  local?: LocalGameStats
  createdAt: string
  /**
   * User-removed (e.g. a desynced game the game itself never recorded). The row
   * is kept as a tombstone so a later Sync can't re-fold the same game; hidden
   * rows are filtered out of listHistory.
   */
  hidden?: boolean
  /** A local custom/vs-AI game folded in from the replay (not an AoE4World game). */
  custom?: boolean
  /** True when the opponent(s) were AI (custom games only). */
  vsAI?: boolean
  /** Team format label, e.g. "1v1", "2v2", "3v3v3", "2v2v2v2", "FFA (8)". */
  format?: string
  /** My teammates' civ + name (team formats only); absent for 1v1/unknown. */
  myTeam?: RosterPlayer[]
  /** All opponents across enemy team(s), civ + name; absent for 1v1/unknown. */
  oppTeam?: RosterPlayer[]
  /**
   * Per-player end-of-game stats (production/kills/deaths/tech/APM) from Relic's
   * counters — the numbers behind AoE4World's comparison table. Present when the
   * game was matched to Relic recent-match-history; absent otherwise.
   */
  perPlayer?: PerPlayerMatchStats[]
}

/** Persistence for analyzed match history. Implemented by JSON (default) and SQLite. */
export interface HistoryStore {
  saveMatch(match: StoredMatch): void
  getMatch(id: string): StoredMatch | null
  hasMatch(id: string): boolean
  /** Permanently removes one stored match (e.g. a desynced game the game itself never recorded). */
  deleteMatch(id: string): void
  /** Newest first, optionally limited. */
  listMatches(limit?: number): StoredMatch[]
  /** Goals from the most recent match (the current targets), or []. */
  activeGoals(): Goal[]
  close(): void
}
