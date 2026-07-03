/**
 * Human-readable team format from a list of team sizes (pure). Covers every
 * layout so nothing is missing: 1v1, 2v2, 3v3, 4v4, 3v3v3, 2v2v2v2, free-for-all,
 * and lopsided vs-AI counts like 1v5.
 */
export function teamFormat(teamSizes: number[]): string {
  const sizes = teamSizes.filter((n) => n > 0)
  if (sizes.length === 0) return ''
  if (sizes.length === 1) return `${sizes[0]} player${sizes[0] === 1 ? '' : 's'}`
  // 3+ teams that are all solo → a free-for-all.
  if (sizes.length >= 3 && sizes.every((n) => n === 1)) return `FFA (${sizes.length})`
  return sizes.join('v')
}

/** Team sizes from players grouped by team id (ids < 0 / null treated as solo). */
export function teamSizesFromTeamIds(teamIds: Array<number | null | undefined>): number[] {
  const byTeam = new Map<string, number>()
  let solo = 0
  for (const id of teamIds) {
    if (id == null || id < 0)
      solo++ // unteamed / FFA marker → its own side
    else byTeam.set(String(id), (byTeam.get(String(id)) ?? 0) + 1)
  }
  const sizes = [...byTeam.values()]
  for (let i = 0; i < solo; i++) sizes.push(1)
  return sizes
}
