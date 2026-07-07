/**
 * Expected win probability (%) for `myRating` vs `oppRating` under the Elo
 * expected-score formula the ladder's rating system approximates:
 * E = 1 / (1 + 10^((opp − mine) / 400)).
 *
 * This is a rating-gap estimate only (no civ/map factors) — present it as
 * "by rating", never as a prediction. Returns null when either rating is
 * missing, so callers can simply omit the figure.
 */
export function winProbability(
  myRating: number | null | undefined,
  oppRating: number | null | undefined,
): number | null {
  if (
    typeof myRating !== 'number' ||
    typeof oppRating !== 'number' ||
    !Number.isFinite(myRating) ||
    !Number.isFinite(oppRating)
  ) {
    return null
  }
  return (100 * 1) / (1 + Math.pow(10, (oppRating - myRating) / 400))
}
