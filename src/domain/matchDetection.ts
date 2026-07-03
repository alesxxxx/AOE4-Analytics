/**
 * Pure match-detection state machine (D9). Given the previous
 * detector state and the latest `games/last` response, decides whether a match
 * just started or ended. The polling loop (timers + IPC) is the impure glue that
 * drives this — keeping the decision pure makes it fixture-testable.
 *
 * Recipe (matches the proven reference overlays): key off the `ongoing` boolean;
 * a finished game is `ongoing === false`; `just_finished` flags a very recently
 * ended game we may have missed the start of.
 */
import type { Game } from '../api/types'

export interface DetectorState {
  lastGameId: number | null
  lastOngoing: boolean
}

export type MatchEvent = 'match-started' | 'match-ended' | 'none'

export interface DetectorOutput {
  state: DetectorState
  event: MatchEvent
  game: Game | null
}

export const INITIAL_DETECTOR_STATE: DetectorState = { lastGameId: null, lastOngoing: false }

export function detect(prev: DetectorState, game: Game | null): DetectorOutput {
  if (!game) return { state: prev, event: 'none', game: null }

  const id = game.game_id
  const ongoing = game.ongoing
  const next: DetectorState = { lastGameId: id, lastOngoing: ongoing }

  let event: MatchEvent = 'none'
  if (ongoing) {
    // A new ongoing game (or a transition into ongoing) means a match started.
    if (!(prev.lastGameId === id && prev.lastOngoing)) event = 'match-started'
  } else {
    // The game we were tracking as ongoing just finished…
    if (prev.lastGameId === id && prev.lastOngoing) event = 'match-ended'
    // …or a brand-new just-finished game appeared (we missed the live start).
    else if (prev.lastGameId !== id && game.just_finished) event = 'match-ended'
  }

  return { state: next, event, game }
}
