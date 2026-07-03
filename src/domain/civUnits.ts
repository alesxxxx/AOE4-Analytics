/**
 * Per-civ signature units mapped onto counter roles, and a "how to beat this civ"
 * plan (pure). Built on the role matrix in `counters.ts`: for each of a civ's key
 * units we look up what hard-counters that role, then rank the counters by how
 * many of the civ's threats they answer. Beginner-facing — "vs Mongols, build
 * spearmen + crossbows", not a full unit database.
 */
import { COUNTER_MATRIX, whatBeats, type CounterEntry, type UnitRole } from './counters'

export interface CivKeyUnit {
  name: string
  role: UnitRole
  /** aoe4world CDN unit slug for the image (best-effort; the UI falls back to the name). */
  icon: string
  /** Age it becomes a realistic option (2=Feudal, 3=Castle, 4=Imperial) — drives build order. */
  age: 2 | 3 | 4
}

/** Variant civs share their base civ's unit roster for counter purposes. */
const VARIANT_TO_BASE: Record<string, string> = {
  house_of_lancaster: 'english',
  jeanne_darc: 'french',
  order_of_the_dragon: 'holy_roman_empire',
  zhu_xis_legacy: 'chinese',
  jin_dynasty: 'chinese',
  ayyubids: 'abbasid_dynasty',
  sengoku_daimyo: 'japanese',
  tughlaq_dynasty: 'delhi_sultanate',
  golden_horde: 'mongols',
  macedonian_dynasty: 'byzantines',
}

const CIV_KEY_UNITS: Record<string, CivKeyUnit[]> = {
  english: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Longbowman', role: 'archer', icon: 'longbowman', age: 2 },
    { name: 'Man-at-Arms', role: 'manatarms', icon: 'man-at-arms', age: 3 },
  ],
  french: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Royal Knight', role: 'knight', icon: 'royal-knight', age: 2 },
    { name: 'Arbalétrier', role: 'crossbow', icon: 'arbaletrier', age: 3 },
  ],
  holy_roman_empire: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Man-at-Arms', role: 'manatarms', icon: 'man-at-arms', age: 2 },
    { name: 'Landsknecht', role: 'manatarms', icon: 'landsknecht', age: 4 },
  ],
  rus: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Knight', role: 'knight', icon: 'knight', age: 3 },
    { name: 'Streltsy', role: 'handcannon', icon: 'streltsy', age: 4 },
  ],
  mongols: [
    { name: 'Horseman', role: 'horseman', icon: 'horseman', age: 2 },
    { name: 'Mangudai', role: 'archer', icon: 'mangudai', age: 3 },
    { name: 'Knight', role: 'knight', icon: 'knight', age: 3 },
  ],
  abbasid_dynasty: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Camel Rider', role: 'camel', icon: 'camel-rider', age: 3 },
    { name: 'Ghulam', role: 'manatarms', icon: 'ghulam', age: 3 },
  ],
  ottomans: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Sipahi', role: 'knight', icon: 'sipahi', age: 3 },
    { name: 'Janissary', role: 'handcannon', icon: 'janissary', age: 3 },
  ],
  delhi_sultanate: [
    { name: 'Man-at-Arms', role: 'manatarms', icon: 'man-at-arms', age: 2 },
    { name: 'War Elephant', role: 'elephant', icon: 'war-elephant', age: 3 },
  ],
  japanese: [
    { name: 'Samurai', role: 'manatarms', icon: 'samurai', age: 2 },
    { name: 'Mounted Samurai', role: 'knight', icon: 'mounted-samurai', age: 3 },
  ],
  chinese: [
    { name: 'Palace Guard', role: 'manatarms', icon: 'palace-guard', age: 2 },
    { name: 'Zhuge Nu', role: 'crossbow', icon: 'zhuge-nu', age: 3 },
    { name: 'Nest of Bees', role: 'mangonel', icon: 'nest-of-bees', age: 3 },
  ],
  byzantines: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Cataphract', role: 'knight', icon: 'cataphract', age: 3 },
    { name: 'Varangian Guard', role: 'manatarms', icon: 'varangian-guard', age: 3 },
  ],
  malians: [
    { name: 'Donso', role: 'spearman', icon: 'donso', age: 2 },
    { name: 'Sofa', role: 'knight', icon: 'sofa', age: 2 },
    { name: 'Javelin Thrower', role: 'archer', icon: 'javelin-thrower', age: 3 },
  ],
  // Knights Templar — verified roster (official AoE4 site, 2026 patch). No gunpowder;
  // wins through heavy cavalry + men-at-arms + siege. Early Spearmen vs cavalry, then
  // Templar Brothers (Castle), with Genitour as the anti-ranged answer.
  knights_templar: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Hospitaller Knight', role: 'manatarms', icon: 'hospitaller-knight', age: 2 },
    { name: 'Templar Brother', role: 'knight', icon: 'templar-brother', age: 3 },
    { name: 'Genitour', role: 'horseman', icon: 'genitour', age: 3 },
  ],
}

/**
 * Per-variant unit-roster overrides, for variants whose actual accessible units
 * differ from their base civ (unique swaps, removed base-unit access, or a
 * notable added unique unit). Absent variants fully inherit
 * `CIV_KEY_UNITS[VARIANT_TO_BASE[slug]]` unchanged.
 *
 * Sourced from a per-civ research + adversarial-verification pass (2026-07-01,
 * anchored to live patch 16.2), then cross-checked unit-by-unit against this
 * repo's own vendored `aoe4world-data/units.json` (each unit's `civs`/`minAge`
 * fields) — ground truth that caught two things the research/verify agents
 * missed: Ayyubids' Camel Lancer is a genuinely exclusive unit (not a naming
 * variant of Abbasid's Camel Rider — `camel-lancer` civs=['ay'] only, while
 * `camel-rider` civs=['ab','by'] excludes Ayyubids), and confirmed the
 * originally-reported House of Lancaster bug (no Man-at-Arms/Longbowman access
 * — `man-at-arms`/`longbowman` civs both exclude 'hl').
 */
const VARIANT_KEY_UNITS: Partial<Record<string, CivKeyUnit[]>> = {
  house_of_lancaster: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Yeoman', role: 'archer', icon: 'yeoman', age: 2 },
    { name: "Earl's Guard", role: 'manatarms', icon: 'earls-guard', age: 3 },
  ],
  order_of_the_dragon: [
    { name: 'Gilded Spearman', role: 'spearman', icon: 'gilded-spearman', age: 2 },
    { name: 'Gilded Man-at-Arms', role: 'manatarms', icon: 'gilded-man-at-arms', age: 2 },
    { name: 'Gilded Landsknecht', role: 'manatarms', icon: 'gilded-landsknecht', age: 3 },
  ],
  jin_dynasty: [
    { name: 'Man-at-Arms', role: 'manatarms', icon: 'man-at-arms', age: 2 },
    { name: 'Mohe Tribesman', role: 'horseman', icon: 'mohe-tribesman', age: 2 },
    { name: 'Bed Crossbow', role: 'springald', icon: 'bed-crossbow', age: 2 },
    { name: 'Nest of Bees', role: 'mangonel', icon: 'nest-of-bees', age: 3 },
  ],
  ayyubids: [
    { name: 'Spearman', role: 'spearman', icon: 'spearman', age: 2 },
    { name: 'Ghulam', role: 'manatarms', icon: 'ghulam', age: 3 },
    { name: 'Camel Lancer', role: 'camel', icon: 'camel-lancer', age: 3 },
  ],
  sengoku_daimyo: [
    { name: 'Naginata Samurai', role: 'manatarms', icon: 'naginata-samurai', age: 2 },
    { name: 'Mounted Samurai', role: 'knight', icon: 'mounted-samurai', age: 3 },
  ],
  golden_horde: [
    { name: 'Horseman', role: 'horseman', icon: 'horseman', age: 2 },
    { name: 'Keshik', role: 'knight', icon: 'keshik', age: 2 },
    { name: 'Kipchak Archer', role: 'archer', icon: 'kipchak-archer', age: 3 },
  ],
  macedonian_dynasty: [
    { name: 'Atgeirmaðr', role: 'spearman', icon: 'atgeirmadr', age: 2 },
    { name: 'Varangian Guard', role: 'manatarms', icon: 'varangian-guard', age: 2 },
    { name: 'Bogmaðr', role: 'archer', icon: 'bogmadr', age: 2 },
    { name: 'Riddari', role: 'knight', icon: 'riddari', age: 3 },
  ],
  // jeanne_darc, zhu_xis_legacy, tughlaq_dynasty: fully inherit their base
  // roster (verified against units.json — no override needed).
}

/** Base civ slugs we have counter data for (for the overlay's Alt+C cycle). */
export const COUNTERABLE_CIVS: string[] = Object.keys(CIV_KEY_UNITS)

export interface CivCounterPlan {
  civSlug: string
  keyUnits: CivKeyUnit[]
  /** What to build to beat this civ's key units, best (answers the most) first. */
  counters: CounterEntry[]
}

/** The "best units + how to counter them" plan for a civ (or variant), or null. */
export function counterPlanForCiv(
  civSlug: string | null | undefined,
  maxCounters = 4,
): CivCounterPlan | null {
  if (!civSlug) return null
  const base = VARIANT_TO_BASE[civSlug] ?? civSlug
  const keyUnits = VARIANT_KEY_UNITS[civSlug] ?? CIV_KEY_UNITS[base]
  if (!keyUnits) return null

  // Which counter roles beat which of this civ's key-unit roles.
  const beats = new Map<UnitRole, Set<UnitRole>>()
  for (const u of keyUnits) {
    for (const c of whatBeats(u.role)) {
      if (!beats.has(c.role)) beats.set(c.role, new Set())
      beats.get(c.role)!.add(u.role)
    }
  }

  // Greedy set-cover: repeatedly take the counter that answers the most still-
  // uncovered threats, so every key unit gets an answer (not just the first one).
  const uncovered = new Set(keyUnits.map((u) => u.role))
  const chosen: UnitRole[] = []
  while (chosen.length < maxCounters && uncovered.size > 0) {
    let best: UnitRole | null = null
    let bestN = 0
    for (const [role, covered] of beats) {
      if (chosen.includes(role)) continue
      const n = [...covered].filter((r) => uncovered.has(r)).length
      if (n > bestN) {
        bestN = n
        best = role
      }
    }
    if (!best) break
    chosen.push(best)
    for (const r of beats.get(best)!) uncovered.delete(r)
  }

  return { civSlug: base, keyUnits, counters: chosen.map((role) => COUNTER_MATRIX[role]) }
}

/** A civ's key units (resolving variants to their base roster, or an override), or null. */
function unitsForCiv(civSlug: string | null | undefined): CivKeyUnit[] | null {
  if (!civSlug) return null
  const base = VARIANT_TO_BASE[civSlug] ?? civSlug
  return VARIANT_KEY_UNITS[civSlug] ?? CIV_KEY_UNITS[base] ?? null
}

export interface MatchupTroops {
  /** Your key units, in BUILD ORDER (earliest age first; counters first within an age). */
  mine: CivKeyUnit[]
  /** The opponent's key units (earliest age first). */
  theirs: CivKeyUnit[]
  /** Names of YOUR units to prioritize — each hard-counters one of the opponent's key units. */
  priority: Set<string>
}

/**
 * The "what to build this matchup" cheat-sheet: your key units vs the opponent's.
 * Your side is returned in BUILD ORDER — sorted by age (so the things you can make
 * NOW come first, e.g. Spearmen before Castle-age Templar Brothers) and, within an
 * age, the units that hard-counter the opponent's army first. Those counters are
 * flagged in `priority`. Variant civs resolve to their base roster. Null only when
 * NEITHER civ has unit data.
 */
export function matchupTroops(
  myCiv: string | null | undefined,
  oppCiv: string | null | undefined,
): MatchupTroops | null {
  return matchupTroopsForTeam(myCiv, oppCiv ? [oppCiv] : [])
}

/**
 * Team-game version of the matchup cheat-sheet: your key units are prioritized
 * against the combined enemy team's key threats, with duplicate unit names shown
 * once. Used by the 2v2 overlay while preserving the 1v1 helper above.
 */
export function matchupTroopsForTeam(
  myCiv: string | null | undefined,
  oppCivs: (string | null | undefined)[],
): MatchupTroops | null {
  const mine = unitsForCiv(myCiv)
  const theirs = dedupeUnits(oppCivs.flatMap((c) => unitsForCiv(c) ?? []))
  if (!mine && theirs.length === 0) return null
  const counterRoles = new Set<UnitRole>()
  for (const u of theirs) for (const c of whatBeats(u.role)) counterRoles.add(c.role)
  const isPriority = (u: CivKeyUnit): boolean => counterRoles.has(u.role)
  const mineSorted = [...(mine ?? [])].sort(
    (a, b) => a.age - b.age || Number(isPriority(b)) - Number(isPriority(a)),
  )
  const priority = new Set(mineSorted.filter(isPriority).map((u) => u.name))
  const theirsSorted = [...theirs].sort((a, b) => a.age - b.age || a.name.localeCompare(b.name))
  return { mine: mineSorted, theirs: theirsSorted, priority }
}

function dedupeUnits(units: CivKeyUnit[]): CivKeyUnit[] {
  const byName = new Map<string, CivKeyUnit>()
  for (const u of units) if (!byName.has(u.name)) byName.set(u.name, u)
  return [...byName.values()]
}
