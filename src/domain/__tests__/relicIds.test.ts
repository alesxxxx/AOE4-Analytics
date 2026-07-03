import { describe, it, expect } from 'vitest'
import {
  RELIC_RACE_ID_TO_CIV,
  raceIdToCiv,
  leaderboardLabel,
  isCompetitiveLeaderboard,
  matchTypeLabel,
  relicRankLevelToSlug,
} from '../relicIds'
import { CIV_PROFILES } from '../../data/civProfiles'

describe('relicIds', () => {
  it('maps every race_id to a real CIV_PROFILES slug', () => {
    for (const slug of Object.values(RELIC_RACE_ID_TO_CIV)) {
      expect(CIV_PROFILES[slug], `${slug} is a known civ`).toBeDefined()
    }
  })

  it('resolves known race ids and fails safe on unknown/neutral', () => {
    expect(raceIdToCiv(2121948)).toBe('jeanne_darc')
    expect(raceIdToCiv(106553)).toBe('english')
    expect(raceIdToCiv(9003861)).toBeNull() // Rogue_Neutral / Gaia
    expect(raceIdToCiv(123)).toBeNull()
  })

  it('labels leaderboards and flags the competitive ones', () => {
    expect(leaderboardLabel(1)).toBe('Ranked 1v1')
    expect(leaderboardLabel(17)).toBe('Quick Match 1v1')
    expect(leaderboardLabel(99999)).toBe('Leaderboard 99999')
    expect(isCompetitiveLeaderboard(17)).toBe(true)
    expect(isCompetitiveLeaderboard(51)).toBe(false) // Art of War
  })

  it('labels per-match modes from matchtype + description', () => {
    expect(matchTypeLabel(20, 'AUTOMATCH')).toBe('Ranked 1v1')
    expect(matchTypeLabel(0, 'unnamed_session')).toBe('Custom / AI')
    expect(matchTypeLabel(5, 'AUTOMATCH')).toBe('Quick Match')
  })

  // Relic ranklevel is a coarse ladder level (observed 1–14 on Ranked 1v1),
  // NOT the Bronze I–Conqueror III division index — map to tier-only slugs.
  it('maps Relic ranklevel integers to tier-only rank slugs', () => {
    expect(relicRankLevelToSlug(-1)).toBeNull() // placement / unranked
    expect(relicRankLevelToSlug(0)).toBeNull()
    expect(relicRankLevelToSlug(1)).toBe('bronze')
    expect(relicRankLevelToSlug(2)).toBe('silver')
    expect(relicRankLevelToSlug(3)).toBe('gold')
    expect(relicRankLevelToSlug(4)).toBe('platinum')
    expect(relicRankLevelToSlug(5)).toBe('diamond')
    expect(relicRankLevelToSlug(6)).toBe('conqueror')
    expect(relicRankLevelToSlug(14)).toBe('conqueror') // world #1 observed level
    expect(relicRankLevelToSlug(99)).toBe('conqueror') // future-proof: clamp high
  })
})
