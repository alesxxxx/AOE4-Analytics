import { civFromToken } from '@domain/statsSummary'

/** A table metric is comparable only when the summary supplied a finite number. */
export function finiteMetricValue(value: number | string | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

type TrainerPlayer = {
  profileId: number | null
  civToken: string | null
}

/**
 * Resolve the player whose build should be graded. Prefer the exact profile id;
 * civ is only a fallback for legacy summaries that contain no player identities.
 * That keeps a same-civ opponent from being graded as the signed-in player.
 */
export function selectTrainerPlayer<T extends TrainerPlayer>(
  players: readonly T[],
  myProfileId: number | null | undefined,
  myCiv: string,
): T | null {
  if (myProfileId != null) {
    const byProfile = players.find((player) => player.profileId === myProfileId)
    if (byProfile) return byProfile
    if (players.some((player) => player.profileId != null)) return null
  }

  return players.find((player) => civFromToken(player.civToken) === myCiv) ?? null
}
