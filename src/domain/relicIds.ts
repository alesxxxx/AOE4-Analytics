/**
 * Relic AoE4 numeric id → our slug/label lookups (pure constants).
 * Source: `getAvailableLeaderboards?title=age4` (races[]/leaderboards[]),
 * verified against the game's racebp pbgids and a real `getRecentMatchHistory`
 * response. These are point-in-time tables — new-civ DLC adds a race_id that maps
 * to null until updated, so `raceIdToCiv` fails safe to null (never throws).
 */
import { BRACKETS } from './benchmarks'

/** Relic race_id (racebp pbgid) → RTSLytics civ slug (keys of CIV_PROFILES). */
export const RELIC_RACE_ID_TO_CIV: Record<number, string> = {
  106553: 'english',
  129267: 'mongols',
  131384: 'french',
  133008: 'rus',
  134522: 'holy_roman_empire',
  136150: 'delhi_sultanate',
  137266: 'chinese',
  199703: 'abbasid_dynasty',
  2039321: 'ottomans',
  2058393: 'malians',
  2101234: 'byzantines',
  2109886: 'japanese',
  2121948: 'jeanne_darc', // French_Ha_01
  2121949: 'ayyubids', // Abbasid_Ha_01
  2121950: 'zhu_xis_legacy', // Chinese_Ha_01
  2121952: 'order_of_the_dragon', // Hre_Ha_01
  5000002: 'knights_templar', // Templar
  5000003: 'house_of_lancaster', // Lancaster
  9000850: 'sengoku_daimyo', // Japanese_Ha_Sen
  9000860: 'tughlaq_dynasty', // Sultanate_Ha_Tug
  9000878: 'golden_horde', // Mongol_Ha_Gol
  9001050: 'macedonian_dynasty', // Byzantine_Ha_Mac
  9003910: 'jin_dynasty', // Jin_Dynasty
}

/** race_id → civ slug, or null for unknown/neutral (e.g. 9003861 Rogue_Neutral). */
export function raceIdToCiv(id: number): string | null {
  return RELIC_RACE_ID_TO_CIV[id] ?? null
}

/** Relic leaderboard_id → human label (getPersonalStat / leaderboard rows). */
export const RELIC_LEADERBOARD_LABEL: Record<number, string> = {
  0: 'Custom',
  1: 'Ranked 1v1',
  2: 'Ranked 2v2',
  3: 'Ranked 3v3',
  4: 'Ranked 4v4',
  17: 'Quick Match 1v1',
  18: 'Quick Match 2v2',
  19: 'Quick Match 3v3',
  20: 'Quick Match 4v4',
  49: 'Skirmish',
  50: 'Campaign',
  51: 'Art of War',
}

export function leaderboardLabel(id: number): string {
  return RELIC_LEADERBOARD_LABEL[id] ?? `Leaderboard ${id}`
}

/** Competitive ladders worth showing as a player's "modes" (ranked + QM). */
const COMPETITIVE_LEADERBOARDS = new Set([1, 2, 3, 4, 17, 18, 19, 20])
export function isCompetitiveLeaderboard(id: number): boolean {
  return COMPETITIVE_LEADERBOARDS.has(id)
}

/** Preferred order when picking a player's representative ("primary") mode. */
export const PREFERRED_LEADERBOARD_ORDER = [1, 2, 3, 4, 17, 18, 19, 20]

/**
 * Relic `ranklevel` → tier-only rank slug ('bronze'…'conqueror'), or null when
 * unranked/placement (≤ 0).
 *
 * Relic's ranklevel is NOT the in-game Bronze I–Conqueror III division index —
 * it's a coarse ladder level. Probed against the live Ranked 1v1 ladder
 * (2026-07-01, correlated per-profile with AoE4World rank_level): world #1 was
 * level 14, ~top-250 were 10–14 (all conqueror_3 on AoE4World), level 5 players
 * were diamond, 4 platinum, 3 gold-ish, down to 2 near the ladder floor. Mapping
 * to a division slug (gold_2) would be fake precision, so we emit the tier only —
 * formatRankLevel/rankColor/bracketFromRankLevel all accept tier-only slugs.
 */
export function relicRankLevelToSlug(ranklevel: number): string | null {
  if (ranklevel <= 0) return null
  // Levels 6+ are all conqueror territory; BRACKETS is the app's one tier list.
  return BRACKETS[Math.min(ranklevel, 6) - 1] ?? null
}

/**
 * Per-match mode label from `matchtype_id` (a DIFFERENT id-space from
 * leaderboard_id). Cross-checked with the match `description`.
 */
export function matchTypeLabel(matchtypeId: number, description: string): string {
  const custom = description === 'unnamed_session'
  switch (matchtypeId) {
    case 1:
    case 20:
      return 'Ranked 1v1'
    case 2:
    case 21:
      return custom ? 'Custom 2v2' : 'Ranked 2v2'
    case 22:
      return 'Ranked 3v3/4v4'
    case 5:
    case 7:
    case 8:
      return 'Quick Match'
    case 0:
      return 'Custom / AI'
    default:
      return description === 'AUTOMATCH' ? 'Quick Match' : 'Custom'
  }
}
