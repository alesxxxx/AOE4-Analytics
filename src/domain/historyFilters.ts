/** Applies the user's shared practice-game preference to personal analytics. */
export function filterPersonalHistory<T extends { custom?: boolean; vsAI?: boolean }>(
  matches: readonly T[],
  excludePractice: boolean,
): T[] {
  return excludePractice ? matches.filter((match) => !match.vsAI && !match.custom) : [...matches]
}
