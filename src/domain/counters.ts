/**
 * Beginner-facing unit counter helper — the classic AoE4 rock-paper-scissors,
 * expressed as a curated role matrix (pure). This is intentionally role-based
 * rather than parsing every unit's weapon modifiers: for beginners "spearmen
 * beat knights" is the useful takeaway. `roleFromUnit` maps vendored units onto
 * these roles for the unit reference.
 */

export type UnitRole =
  | 'spearman'
  | 'horseman'
  | 'knight'
  | 'archer'
  | 'crossbow'
  | 'handcannon'
  | 'manatarms'
  | 'siege_ram'
  | 'springald'
  | 'mangonel'
  | 'camel'
  | 'elephant'
  | 'scout'

export interface CounterEntry {
  role: UnitRole
  label: string
  strongVs: UnitRole[]
  weakVs: UnitRole[]
  advice: string
}

export const COUNTER_MATRIX: Record<UnitRole, CounterEntry> = {
  spearman: {
    role: 'spearman',
    label: 'Spearmen',
    strongVs: ['horseman', 'knight', 'camel', 'elephant'],
    weakVs: ['archer', 'crossbow', 'handcannon', 'manatarms', 'mangonel'],
    advice:
      'Cheap anti-cavalry infantry. They shred horsemen and knights but melt to ranged fire and men-at-arms.',
  },
  horseman: {
    role: 'horseman',
    label: 'Horsemen (light cavalry)',
    strongVs: ['archer', 'crossbow', 'handcannon', 'springald', 'mangonel'],
    weakVs: ['spearman', 'manatarms'],
    advice: 'Fast raiders that run down ranged units and siege. Keep them away from spearmen.',
  },
  knight: {
    role: 'knight',
    label: 'Knights / Lancers (heavy cavalry)',
    strongVs: ['archer', 'crossbow', 'handcannon', 'mangonel', 'springald'],
    weakVs: ['spearman', 'camel'],
    advice:
      'Heavy hitters that crash into ranged and siege lines; hard-countered by spearmen and camels.',
  },
  archer: {
    role: 'archer',
    label: 'Archers',
    strongVs: ['spearman'],
    weakVs: ['horseman', 'knight', 'manatarms', 'mangonel'],
    advice:
      'Ranged DPS vs light infantry. Kited by cavalry and out-traded by men-at-arms and mangonels.',
  },
  crossbow: {
    role: 'crossbow',
    label: 'Crossbowmen',
    strongVs: ['knight', 'manatarms', 'elephant', 'camel', 'siege_ram'],
    weakVs: ['horseman', 'archer', 'mangonel'],
    advice:
      'Anti-armor ranged. Punch through knights and men-at-arms; weak to fast light cavalry and mangonels.',
  },
  handcannon: {
    role: 'handcannon',
    label: 'Handcannoneers',
    strongVs: ['manatarms', 'knight', 'elephant'],
    weakVs: ['horseman', 'archer', 'mangonel'],
    advice:
      'High burst against heavy units, but short-ranged and slow — vulnerable to cavalry and archers.',
  },
  manatarms: {
    role: 'manatarms',
    label: 'Men-at-Arms (heavy infantry)',
    strongVs: ['archer', 'spearman'],
    weakVs: ['crossbow', 'handcannon'],
    advice: 'Armored frontline that shrugs off archers; countered by crossbows and handcannoneers.',
  },
  siege_ram: {
    role: 'siege_ram',
    label: 'Battering Rams',
    strongVs: [],
    weakVs: ['horseman', 'knight', 'crossbow'],
    advice: 'For buildings only. Escort them — any cavalry or anti-siege deletes unescorted rams.',
  },
  springald: {
    role: 'springald',
    label: 'Springalds',
    strongVs: ['siege_ram', 'mangonel'],
    weakVs: ['horseman', 'knight', 'archer'],
    advice: 'Anti-siege bolt thrower; useless against infantry and run down by cavalry.',
  },
  mangonel: {
    role: 'mangonel',
    label: 'Mangonels',
    strongVs: ['archer', 'crossbow', 'handcannon', 'spearman', 'manatarms'],
    weakVs: ['horseman', 'knight', 'springald'],
    advice:
      'Devastates clumped ranged and infantry. Killed by cavalry dives — micro your army against it.',
  },
  camel: {
    role: 'camel',
    label: 'Camel Riders',
    strongVs: ['knight', 'horseman'],
    weakVs: ['archer', 'crossbow', 'spearman'],
    advice: 'Anti-cavalry riders that debuff nearby cavalry; weak to ranged units and spears.',
  },
  elephant: {
    role: 'elephant',
    label: 'War Elephants',
    strongVs: ['manatarms', 'spearman', 'archer'],
    weakVs: ['crossbow', 'handcannon', 'camel'],
    advice:
      'Enormous HP that crushes melee; brought down by crossbows, handcannoneers, and camels.',
  },
  scout: {
    role: 'scout',
    label: 'Scouts',
    strongVs: [],
    weakVs: ['archer', 'horseman'],
    advice: 'Recon and hunting, not a combat unit.',
  },
}

export const COUNTER_ROLES = Object.keys(COUNTER_MATRIX) as UnitRole[]

export function counterFor(role: UnitRole): CounterEntry {
  return COUNTER_MATRIX[role]
}

/** Roles that hard-counter `role` (i.e. list `role` in their strongVs). */
export function whatBeats(role: UnitRole): CounterEntry[] {
  return COUNTER_ROLES.filter((r) => COUNTER_MATRIX[r].strongVs.includes(role)).map(
    (r) => COUNTER_MATRIX[r],
  )
}

// Ordered most-specific first; the first matching id keyword wins.
const ROLE_KEYWORDS: { role: UnitRole; match: RegExp }[] = [
  { role: 'siege_ram', match: /(^|-)ram($|-)|battering/ },
  { role: 'springald', match: /springald/ },
  { role: 'mangonel', match: /mangonel|nest-of-bees|catapult/ },
  { role: 'camel', match: /camel/ },
  { role: 'elephant', match: /elephant/ },
  { role: 'spearman', match: /spear|pike|donso|limitanei/ },
  { role: 'handcannon', match: /handcannon|hand-cannon|janissary|streltsy/ },
  { role: 'crossbow', match: /crossbow|arbalet|arbalest|zhuge/ },
  { role: 'archer', match: /archer|longbow|yumi|musofadi-gunner/ },
  {
    role: 'manatarms',
    match: /man-at-arms|palace-guard|sergeant|champion|ghulam|gilded-man|landsknecht/,
  },
  { role: 'knight', match: /knight|lancer|rider|riddari|sipahi|keshik/ },
  { role: 'horseman', match: /horseman|scout-cavalry|yari-cavalry/ },
  { role: 'scout', match: /scout/ },
]

/** Maps a vendored unit onto a counter role (best-effort), or null if unknown. */
export function roleFromUnit(unit: { id: string; displayClasses?: string[] }): UnitRole | null {
  const id = unit.id.toLowerCase()
  // Specific id keywords first (spear/camel/elephant before generic cavalry).
  for (const { role, match } of ROLE_KEYWORDS) {
    if (match.test(id)) return role
  }
  const dc = (unit.displayClasses ?? []).join(' ').toLowerCase()
  if (dc.includes('siege')) return 'mangonel'
  if (dc.includes('cavalry')) return dc.includes('heavy') ? 'knight' : 'horseman'
  if (dc.includes('ranged')) return 'archer'
  if (dc.includes('infantry')) return dc.includes('heavy') ? 'manatarms' : 'spearman'
  return null
}
