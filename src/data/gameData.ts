import unitsJson from './vendor/aoe4world-data/units.json'
import { civCode } from './civs'

export interface VendoredUnit {
  id: string
  name: string
  displayClasses: string[]
  classes: string[]
  minAge: number
  civs: string[]
  unique: boolean
  icon: string | null
  hitpoints: number | null
  costs: {
    food: number
    wood: number
    gold: number
    stone: number
    total: number
    popcap: number
    time: number
  } | null
  attack: { type: string; damage: number } | null
  armor: { melee: number; ranged: number }
  producedBy: string[]
}

/** All vendored combat units (slim, from aoe4world/data — see vendor/SOURCE.md). */
export const UNITS: VendoredUnit[] = unitsJson as VendoredUnit[]

const BY_ID = new Map(UNITS.map((u) => [u.id, u]))

export function unitById(id: string): VendoredUnit | undefined {
  return BY_ID.get(id)
}

/** Units available to a civ (by slug), age-sorted. */
export function unitsForCiv(slug: string): VendoredUnit[] {
  const code = civCode(slug)
  if (!code) return []
  return UNITS.filter((u) => u.civs.includes(code)).sort(
    (a, b) => a.minAge - b.minAge || a.name.localeCompare(b.name),
  )
}
