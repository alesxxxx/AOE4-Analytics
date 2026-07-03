/** Civilization slug → display-name helpers. Pure. */

const CIV_NAME_OVERRIDES: Record<string, string> = {
  zhu_xis_legacy: "Zhu Xi's Legacy",
  jeanne_darc: "Jeanne d'Arc",
  holy_roman_empire: 'Holy Roman Empire',
  hre: 'Holy Roman Empire',
  knights_templar: 'Knights Templar',
  house_of_lancaster: 'House of Lancaster',
  order_of_the_dragon: 'Order of the Dragon',
  delhi_sultanate: 'Delhi Sultanate',
  abbasid_dynasty: 'Abbasid Dynasty',
  ayyubids: 'Ayyubids',
}

function titleCase(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Human-readable civilization name from an API slug (e.g. `abbasid_dynasty` → `Abbasid Dynasty`). */
export function civDisplayName(slug: string): string {
  if (!slug) return 'Unknown'
  return CIV_NAME_OVERRIDES[slug] ?? titleCase(slug)
}

/** A minimal shape for `teamCivLabel` — matches `RosterPlayer` without importing analysis.ts. */
interface CivOnly {
  civ: string
}

/**
 * A team's combined civ label for team-format games, e.g. "Ottomans + Byzantines".
 * `myCiv` first, then teammates in order. For a 1v1 (no teammates) this is just
 * `civDisplayName(myCiv)`.
 */
export function teamCivLabel(myCiv: string, myTeam: CivOnly[] | undefined): string {
  const civs = [myCiv, ...(myTeam ?? []).map((p) => p.civ)]
  return civs.map(civDisplayName).join(' + ')
}
