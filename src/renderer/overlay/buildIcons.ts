/**
 * Turns a build step's prose notes into the buildings/units it's telling you to
 * make, with real icon URLs — so the overlay can show IMAGES of what to build
 * (like a League item path) instead of a wall of text. Keyword-matched against
 * the existing note prose, so no build-order data has to be re-authored.
 *
 * Icons are bundled (vendored from data.aoe4world.com — see
 * scripts/vendor-unit-icons.mjs), so they render instantly and offline; the
 * CDN (still CSP-allow-listed) is only the fallback for a slug added here
 * before the next vendoring run. Missing icons fall back to the name text.
 */
import { BUILDING_ICONS } from '@data/vendor/aoe4world-overlay/buildings'
import { UNIT_ICONS } from '@data/vendor/aoe4world-overlay/units'

export interface BuildTarget {
  label: string
  kind: 'building' | 'unit'
  url: string
}

const CDN = 'https://data.aoe4world.com/images'
const b = (slug: string): string => BUILDING_ICONS[slug] ?? `${CDN}/buildings/${slug}-1.png`
const u = (slug: string): string => UNIT_ICONS[slug] ?? `${CDN}/units/${slug}-1.png`

/**
 * Common beginner-relevant buildings + units, matched word-boundary so "Archery
 * Range" doesn't also trip the "archer" unit. Longer/more-specific phrases sit
 * before generic ones. Villagers are intentionally absent — they're the resource
 * line, not a build target.
 */
const DICT: { re: RegExp; target: BuildTarget }[] = [
  // buildings
  { re: /\btown cent(?:er|re)s?\b/i, target: { label: 'Town Center', kind: 'building', url: b('town-center') } },
  { re: /\bhouses?\b/i, target: { label: 'House', kind: 'building', url: b('house') } },
  { re: /\bmills?\b/i, target: { label: 'Mill', kind: 'building', url: b('mill') } },
  { re: /\blumber camps?\b/i, target: { label: 'Lumber Camp', kind: 'building', url: b('lumber-camp') } },
  { re: /\bmining camps?\b/i, target: { label: 'Mining Camp', kind: 'building', url: b('mining-camp') } },
  { re: /\bbarracks\b/i, target: { label: 'Barracks', kind: 'building', url: b('barracks') } },
  { re: /\bstables?\b/i, target: { label: 'Stable', kind: 'building', url: b('stable') } },
  { re: /\barchery ranges?\b/i, target: { label: 'Archery Range', kind: 'building', url: b('archery-range') } },
  { re: /\bblacksmiths?\b/i, target: { label: 'Blacksmith', kind: 'building', url: b('blacksmith') } },
  { re: /\bmarkets?\b/i, target: { label: 'Market', kind: 'building', url: b('market') } },
  { re: /\bmilitary schools?\b/i, target: { label: 'Military School', kind: 'building', url: b('military-school') } },
  { re: /\bsiege workshops?\b/i, target: { label: 'Siege Workshop', kind: 'building', url: b('siege-workshop') } },
  { re: /\bdocks?\b/i, target: { label: 'Dock', kind: 'building', url: b('dock') } },
  // units
  { re: /\bspearm[ae]n\b/i, target: { label: 'Spearman', kind: 'unit', url: u('spearman') } },
  { re: /\bhorsem[ae]n\b/i, target: { label: 'Horseman', kind: 'unit', url: u('horseman') } },
  { re: /\bm[ae]n-at-arms\b/i, target: { label: 'Man-at-Arms', kind: 'unit', url: u('man-at-arms') } },
  { re: /\barchers?\b/i, target: { label: 'Archer', kind: 'unit', url: u('archer') } },
  { re: /\bcrossbow(?:m[ae]n)?\b/i, target: { label: 'Crossbow', kind: 'unit', url: u('crossbowman') } },
  { re: /\bhandcannon(?:eers?)?\b/i, target: { label: 'Handcannoneer', kind: 'unit', url: u('handcannoneer') } },
  { re: /\bknights?\b/i, target: { label: 'Knight', kind: 'unit', url: u('knight') } },
  { re: /\bscouts?\b/i, target: { label: 'Scout', kind: 'unit', url: u('scout') } },
  { re: /\bjanissar(?:y|ies)\b/i, target: { label: 'Janissary', kind: 'unit', url: u('janissary') } },
  { re: /\bcamel(?:\s*riders?)?\b/i, target: { label: 'Camel Rider', kind: 'unit', url: u('camel-rider') } },
]

/** Buildings/units named in a step's notes, de-duplicated, in dictionary order. */
export function extractBuildTargets(notes: string[] | undefined, max = 4): BuildTarget[] {
  if (!notes || notes.length === 0) return []
  const text = notes.join('   ')
  const found: BuildTarget[] = []
  const seen = new Set<string>()
  for (const { re, target } of DICT) {
    if (found.length >= max) break
    if (re.test(text) && !seen.has(target.url)) {
      seen.add(target.url)
      found.push(target)
    }
  }
  return found
}
