/**
 * Parser/validator and rendering model for the CraftySalamander RTS_Overlay
 * AoE4 build-order JSON format (D14). Pure — used both to validate
 * bundled builds and to import user-pasted builds. Notes may embed icon tokens
 * of the form `@subfolder/image.webp@`, modelled by `parseNote`.
 */

export interface BuildStepResources {
  food: number
  wood: number
  gold: number
  stone: number
  builder?: number
}

export interface BuildStep {
  population_count: number
  villager_count: number
  age: number
  resources: BuildStepResources
  notes: string[]
  time?: string
}

export interface BuildOrder {
  name: string
  civilization: string | string[]
  author?: string
  source?: string
  season?: number
  /** Curation metadata (bundled library): why this build earned its slot. */
  reasoning?: string
  // JSON imports widen literals to string, so accept both.
  difficulty?: 'easy' | 'medium' | 'hard' | (string & {})
  /** e.g. "Feudal aggression", "Economy boom", "Fast Castle", "Timing attack". */
  archetype?: string
  build_order: BuildStep[]
}

import { parseDuration } from './format'
import { civDisplayName } from './civ'

export type NotePart = { type: 'text'; text: string } | { type: 'image'; path: string }

export type ValidationResult = { ok: true; value: BuildOrder } | { ok: false; errors: string[] }

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Splits a note into text and icon-token (`@path@`) parts for rendering. */
export function parseNote(note: string): NotePart[] {
  const segments = note.split('@')
  const parts: NotePart[] = []
  segments.forEach((seg, i) => {
    if (i % 2 === 0) {
      if (seg) parts.push({ type: 'text', text: seg })
    } else if (seg) {
      parts.push({ type: 'image', path: seg })
    }
  })
  return parts
}

/** Validates an unknown value as an RTS_Overlay build order, collecting errors. */
export function validateBuildOrder(input: unknown): ValidationResult {
  const errors: string[] = []
  const o = input as Record<string, unknown>

  if (!o || typeof o !== 'object') return { ok: false, errors: ['Build order must be an object'] }
  if (typeof o['name'] !== 'string' || !o['name']) errors.push('`name` must be a non-empty string')

  const civ = o['civilization']
  const civOk =
    typeof civ === 'string' || (Array.isArray(civ) && civ.every((c) => typeof c === 'string'))
  if (!civOk) errors.push('`civilization` must be a string or array of strings')

  const steps = o['build_order']
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push('`build_order` must be a non-empty array')
  } else {
    steps.forEach((raw, i) => {
      const s = raw as Record<string, unknown>
      const where = `build_order[${i}]`
      if (!isNumber(s['population_count']))
        errors.push(`${where}.population_count must be a number`)
      if (!isNumber(s['villager_count'])) errors.push(`${where}.villager_count must be a number`)
      if (!isNumber(s['age'])) errors.push(`${where}.age must be a number`)
      if (!Array.isArray(s['notes']) || !s['notes'].every((n) => typeof n === 'string')) {
        errors.push(`${where}.notes must be an array of strings`)
      }
      const r = s['resources'] as Record<string, unknown> | undefined
      if (!r || typeof r !== 'object') {
        errors.push(`${where}.resources must be an object`)
      } else {
        for (const key of ['food', 'wood', 'gold', 'stone'] as const) {
          if (!isNumber(r[key])) errors.push(`${where}.resources.${key} must be a number`)
        }
        if (r['builder'] !== undefined && !isNumber(r['builder'])) {
          errors.push(`${where}.resources.builder must be a number when present`)
        }
      }
      if (s['time'] !== undefined && typeof s['time'] !== 'string') {
        errors.push(`${where}.time must be a string when present`)
      }
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: input as BuildOrder }
}

/** Civilization label for display (the format allows a string or array). */
export function buildOrderCivLabel(bo: BuildOrder): string {
  return Array.isArray(bo.civilization) ? bo.civilization.join(', ') : bo.civilization
}

/** Collapse a civ name/slug to a comparison key (lowercase, alphanumerics only). */
function normCiv(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Index of the bundled build whose civilization matches the player's civ, or
 * `null` when the civ is unknown or no bundled build covers it.
 *
 * `civSlug` is an AoE4World slug (`english`, `holy_roman_empire`, `hre`,
 * `house_of_lancaster`…), but build orders store civ **display names**, so we
 * bridge slug→name via `civDisplayName` before comparing. Variant civs
 * (house_of_lancaster, order_of_the_dragon…) have no bundled build of their own
 * and intentionally return `null` — the overlay then leaves the current
 * selection as-is rather than snapping to a wrong/unrelated build.
 */
export function buildIndexForCiv(
  builds: BuildOrder[],
  civSlug: string | null | undefined,
): number | null {
  if (!civSlug) return null
  const want = normCiv(civDisplayName(civSlug))
  if (!want) return null
  const idx = builds.findIndex((b) => {
    const labels = Array.isArray(b.civilization) ? b.civilization : [b.civilization]
    return labels.some((c) => normCiv(c) === want)
  })
  return idx >= 0 ? idx : null
}

/**
 * The build-order step the player should be on at `elapsedSec` of the match —
 * the latest step whose `time` has been reached. Lets the overlay auto-advance
 * the build using the real match clock (we know the live game's start time even
 * though we have no in-game telemetry). Returns 0 before the first timed step.
 */
export function stepIndexForElapsed(steps: BuildStep[], elapsedSec: number): number {
  let idx = 0
  for (let i = 0; i < steps.length; i++) {
    const raw = steps[i]?.time
    const t = raw ? parseDuration(raw) : null
    if (t != null && t <= elapsedSec) idx = i
  }
  return idx
}

/** One row of the condensed "key timings" view: the opening plus each age-up. */
export interface BuildKeyTiming {
  /** The age this checkpoint enters (2–4), or null for the opening step. */
  ageUpTo: 2 | 3 | 4 | null
  /** The step's optional time label (e.g. "5:10"), verbatim. */
  time: string | null
  villagers: number
  population: number
  /** First non-empty note of the step with `@icon@` tokens stripped, or null. */
  note: string | null
}

/**
 * Reduces a full build order (~40 equal-weight steps) to the 1–4 checkpoints a
 * player actually memorizes: the opening step and the first step of each new
 * age. The full step list stays available via BuildOrderViewer.
 */
export function condenseBuildOrder(bo: BuildOrder): BuildKeyTiming[] {
  const out: BuildKeyTiming[] = []
  let maxAge = 1
  bo.build_order.forEach((s, i) => {
    const agedUp = i !== 0 && s.age > maxAge && s.age >= 2
    if (i !== 0 && !agedUp) return
    out.push({
      ageUpTo: agedUp ? (Math.min(s.age, 4) as 2 | 3 | 4) : null,
      time: s.time ?? null,
      villagers: s.villager_count,
      population: s.population_count,
      note: plainNote(s.notes),
    })
    maxAge = Math.max(maxAge, s.age)
  })
  return out
}

function plainNote(notes: string[]): string | null {
  for (const n of notes) {
    const text = parseNote(n)
      .filter((p): p is Extract<NotePart, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) return text
  }
  return null
}
