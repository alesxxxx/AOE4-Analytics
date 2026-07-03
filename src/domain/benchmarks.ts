/**
 * Beginner benchmark engine (pure). All numbers are HEURISTIC coaching targets
 * (sourced in the research, see PROGRESS/DECISIONS) — not official, and they
 * vary by civ, map, and strategy. The UI always labels them as such. Tighter
 * targets at higher brackets. Stored as plain data so they're easy to tune.
 */

export type Bracket = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'conqueror'
export const BRACKETS: Bracket[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'conqueror']

export interface Benchmarks {
  bracket: Bracket
  /** Target time (seconds) to reach each age. */
  feudalSec: number
  castleSec: number
  imperialSec: number
  /** Target villager counts by wall-clock time. */
  villagersBy5min: number
  villagersBy10min: number
  /** Soft ceilings — above these is a "leak". */
  maxIdleTcSec: number
  maxFloat: number
  /** Rough activity target (actions per minute) as a proxy for multitasking. */
  targetApm: number
}

export const BENCHMARKS: Record<Bracket, Benchmarks> = {
  bronze: {
    bracket: 'bronze',
    feudalSec: 420,
    castleSec: 900,
    imperialSec: 1560,
    villagersBy5min: 18,
    villagersBy10min: 36,
    maxIdleTcSec: 60,
    maxFloat: 1200,
    targetApm: 40,
  },
  silver: {
    bracket: 'silver',
    feudalSec: 390,
    castleSec: 840,
    imperialSec: 1500,
    villagersBy5min: 19,
    villagersBy10min: 40,
    maxIdleTcSec: 45,
    maxFloat: 1100,
    targetApm: 50,
  },
  gold: {
    bracket: 'gold',
    feudalSec: 360,
    castleSec: 780,
    imperialSec: 1440,
    villagersBy5min: 20,
    villagersBy10min: 44,
    maxIdleTcSec: 35,
    maxFloat: 1000,
    targetApm: 60,
  },
  platinum: {
    bracket: 'platinum',
    feudalSec: 330,
    castleSec: 720,
    imperialSec: 1380,
    villagersBy5min: 21,
    villagersBy10min: 48,
    maxIdleTcSec: 25,
    maxFloat: 900,
    targetApm: 75,
  },
  diamond: {
    bracket: 'diamond',
    feudalSec: 300,
    castleSec: 660,
    imperialSec: 1320,
    villagersBy5min: 22,
    villagersBy10min: 52,
    maxIdleTcSec: 15,
    maxFloat: 800,
    targetApm: 90,
  },
  conqueror: {
    bracket: 'conqueror',
    feudalSec: 285,
    castleSec: 630,
    imperialSec: 1260,
    villagersBy5min: 23,
    villagersBy10min: 55,
    maxIdleTcSec: 10,
    maxFloat: 700,
    targetApm: 110,
  },
}

export function getBenchmarks(bracket: Bracket): Benchmarks {
  return BENCHMARKS[bracket]
}

/** Maps an AoE4World rank_level (e.g. 'gold_2') to a benchmark bracket. */
export function bracketFromRankLevel(rankLevel: string | null | undefined): Bracket {
  if (!rankLevel) return 'gold'
  const base = rankLevel.split('_')[0] ?? ''
  return (BRACKETS as string[]).includes(base) ? (base as Bracket) : 'gold'
}

/**
 * The "benchmark coach" villager target at a given elapsed time:
 * 6 starting villagers + one roughly every 20s of continuous TC production,
 * softly clamped. This is a CALCULATED target, never a live reading (D10).
 */
export function targetVillagers(elapsedSec: number, maxVillagers = 80): number {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) return 6
  return Math.min(maxVillagers, 6 + Math.floor(elapsedSec / 20))
}
