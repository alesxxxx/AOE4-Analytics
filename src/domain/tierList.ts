import type { CivStatsResponse } from '../api/types'
import { civDisplayName } from './civ'
import { round1 } from './form'

export type Tier = 'Z' | 'S' | 'A' | 'B' | 'C' | 'D'
export const TIERS: Tier[] = ['Z', 'S', 'A', 'B', 'C', 'D']

export interface CivTier {
  civ: string
  civName: string
  tier: Tier
  winRate: number
  pickRate: number
  games: number
  lowSample: boolean
}

export interface TierListResult {
  civs: CivTier[]
  byTier: Record<Tier, CivTier[]>
  methodology: string
  leaderboard: string
  rankLevel: string | null
  totalGames: number
}

/** Win-rate cut points (inclusive lower bound) for each tier. */
export const TIER_BANDS: { tier: Tier; minWinRate: number }[] = [
  { tier: 'Z', minWinRate: 54 },
  { tier: 'S', minWinRate: 52.5 },
  { tier: 'A', minWinRate: 51 },
  { tier: 'B', minWinRate: 49 },
  { tier: 'C', minWinRate: 47.5 },
  { tier: 'D', minWinRate: Number.NEGATIVE_INFINITY },
]

export function tierForWinRate(winRate: number): Tier {
  for (const band of TIER_BANDS) {
    if (winRate >= band.minWinRate) return band.tier
  }
  return 'D'
}

const METHODOLOGY =
  'Tiers are assigned from live win rate at the selected rank bracket — the clearest single ' +
  'signal of how effective a civ is right now. Bands: Z ≥ 54% (dominant), S ≥ 52.5%, A ≥ 51%, ' +
  'B ≥ 49%, C ≥ 47.5%, D below. Pick rate is shown for meta context but does not change the ' +
  'tier. Civs with a small ' +
  'sample are flagged — their win rate is noisier. This is descriptive of the current meta, not ' +
  'a statement about a civ’s ceiling; at beginner level, fundamentals matter far more than civ choice.'

export interface TierListOptions {
  /** Below this many games a civ is flagged as low-sample. */
  minGames?: number
}

/** Builds a tier list from the AoE4World civ-stats response. */
export function buildTierList(
  stats: CivStatsResponse,
  options: TierListOptions = {},
): TierListResult {
  const minGames = options.minGames ?? 150
  const civs: CivTier[] = stats.data
    .map((d) => ({
      civ: d.civilization,
      civName: civDisplayName(d.civilization),
      // Tier from the ROUNDED win rate so it agrees with the % shown (a raw
      // 50.99% civ displays "51%" and belongs in A, not B).
      tier: tierForWinRate(round1(d.win_rate)),
      winRate: round1(d.win_rate),
      pickRate: round1(d.pick_rate),
      games: d.games_count,
      lowSample: d.games_count < minGames,
    }))
    .sort((a, b) => b.winRate - a.winRate || a.civName.localeCompare(b.civName))

  const byTier = Object.fromEntries(TIERS.map((t) => [t, [] as CivTier[]])) as Record<
    Tier,
    CivTier[]
  >
  for (const civ of civs) byTier[civ.tier].push(civ)

  return {
    civs,
    byTier,
    methodology: METHODOLOGY,
    leaderboard: stats.leaderboard,
    rankLevel: stats.rank_level,
    totalGames: stats.data.reduce((s, d) => s + d.games_count, 0),
  }
}
