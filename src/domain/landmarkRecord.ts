/**
 * Personal per-landmark results (pure). No public dataset tracks landmark win
 * rates (AoE4World aggregates at civ level only — verified), so this computes
 * the honest alternative: YOUR record with each landmark, from the landmark
 * build events decoded out of your own games' stat summaries.
 */
import { landmarksForCiv } from './landmarks'
import type { PlayerSummary } from './statsSummary'

export interface LandmarkBuilt {
  name: string
  age: 2 | 3 | 4
}

export interface LandmarkRecordRow {
  landmark: string
  age: 2 | 3 | 4
  wins: number
  losses: number
  games: number
  winRate: number
}

function normName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** The landmarks this player built, matched against the civ's landmark options. */
export function landmarksBuilt(player: PlayerSummary, civ: string | null): LandmarkBuilt[] {
  const plan = landmarksForCiv(civ)
  if (!plan) return []
  const built: LandmarkBuilt[] = []
  for (const choice of plan.ages) {
    const names = new Map(choice.options.map((o) => [normName(o), o]))
    for (const e of player.buildOrder) {
      if (e.category !== 'building') continue
      const match = names.get(normName(e.name))
      if (match && !built.some((b) => b.name === match)) {
        built.push({ name: match, age: choice.age })
      }
    }
  }
  return built
}

/** W/L per landmark across games, most-played first. */
export function tallyLandmarkRecord(
  games: { result: 'win' | 'loss'; built: LandmarkBuilt[] }[],
): LandmarkRecordRow[] {
  const rows = new Map<string, LandmarkRecordRow>()
  for (const g of games) {
    for (const b of g.built) {
      const row = rows.get(b.name) ?? {
        landmark: b.name,
        age: b.age,
        wins: 0,
        losses: 0,
        games: 0,
        winRate: 0,
      }
      row.games++
      if (g.result === 'win') row.wins++
      else row.losses++
      rows.set(b.name, row)
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, winRate: Math.round((r.wins / r.games) * 100) }))
    .sort((a, b) => a.age - b.age || b.games - a.games)
}
