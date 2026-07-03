import { describe, it, expect } from 'vitest'
import {
  decodeOutcome,
  ratingDelta,
  parseCounters,
  computeApm,
  perPlayerStatsFromMatch,
  prettyMapName,
  relicLeaderboardStatToRankInfo,
  buildScoutReportFromRelic,
} from '../relic'
import { loadFixture } from '../../api/__tests__/fixtures'
import type {
  RelicPersonalStatResponse,
  RelicRecentMatchHistoryResponse,
} from '../../api/relicTypes'

describe('relic decoders', () => {
  it('decodes outcome and rating delta', () => {
    expect(decodeOutcome(1)).toBe('win')
    expect(decodeOutcome(0)).toBe('loss')
    expect(ratingDelta({ oldrating: 1055, newrating: 1070 })).toBe(15)
  })

  it('computes APM from a real match counters blob (verified 163.4)', () => {
    const h = loadFixture<RelicRecentMatchHistoryResponse>('relic/recentMatchHistory_22223074.json')
    const match = h.matchHistoryStats.find((m) => m.id === 214503295)!
    const rr = match.matchhistoryreportresults.find((r) => r.profile_id === 22223074)!
    const apm = computeApm(parseCounters(rr.counters))
    expect(apm).toBe(163.4)
    const me = match.matchhistorymember.find((m) => m.profile_id === 22223074)!
    expect(decodeOutcome(me.outcome)).toBe('win')
    expect(ratingDelta(me)).toBe(15)
  })

  it('decodes per-player stats from a real match (matches AoE4World comparison)', () => {
    const h = loadFixture<RelicRecentMatchHistoryResponse>('relic/recentMatchHistory_22223074.json')
    const match = h.matchHistoryStats.find((m) => m.id === 214503295)!
    const stats = perPlayerStatsFromMatch(match)
    expect(stats).toHaveLength(2)

    const me = stats.find((s) => s.profileId === 22223074)!
    expect(me.result).toBe('win')
    expect(me.teamId).toBe(0)
    expect(me.civ).not.toBeNull()
    expect(me.unitsProduced).toBe(166)
    expect(me.kills).toBe(135)
    expect(me.deaths).toBe(48)
    expect(me.kd).toBe(2.81) // 135/48, 2dp
    expect(me.buildingsProduced).toBe(61)
    expect(me.buildingsLost).toBe(0)
    expect(me.structureDamage).toBe(67)
    expect(me.techsResearched).toBe(26)
    expect(me.apm).toBe(163.4)
    expect(me.gameTimeSec).toBe(1723)

    const opp = stats.find((s) => s.profileId === 10773757)!
    expect(opp.result).toBe('loss')
    expect(opp.teamId).toBe(1)
    expect(opp.kd).toBe(0.4) // 47/117, 2dp
  })

  it('perPlayerStatsFromMatch tolerates a match with no report rows', () => {
    expect(perPlayerStatsFromMatch({ matchhistoryreportresults: [] } as never)).toEqual([])
  })

  it('parseCounters returns null on garbage', () => {
    expect(parseCounters('not json')).toBeNull()
    expect(parseCounters(undefined)).toBeNull()
    expect(computeApm(null)).toBeNull()
    expect(computeApm({ totalcmds: 100, gt: 0 })).toBeNull()
  })

  it('prettifies map slugs', () => {
    expect(prettyMapName('land_megarandom')).toBe('Megarandom')
    expect(prettyMapName('dry_arabia')).toBe('Dry Arabia')
    expect(prettyMapName('generated_map')).toBe('Random Map')
  })

  it('maps a leaderboard stat to RankInfo', () => {
    const rank = relicLeaderboardStatToRankInfo({
      statgroup_id: 1,
      leaderboard_id: 17,
      wins: 1,
      losses: 3,
      streak: -1,
      rank: -1,
      ranktotal: -1,
      ranklevel: -1,
      rating: 1000,
      regionrank: -1,
      regionranktotal: -1,
      lastmatchdate: 0,
      highestrating: 1050,
      highestrank: 0,
      highestranklevel: 0,
    })
    expect(rank.leaderboard).toBe('Quick Match 1v1')
    expect(rank.gamesCount).toBe(4)
    expect(rank.winRate).toBe(25)
    expect(rank.rank).toBeNull() // -1 → null
    expect(rank.rankLevel).toBeNull() // ranklevel -1 → null, never a raw number
    expect(rank.maxRating).toBe(1050)
  })

  it('maps Relic ranklevel to a tier slug the renderer understands', () => {
    const rank = relicLeaderboardStatToRankInfo({
      statgroup_id: 1,
      leaderboard_id: 1,
      wins: 10,
      losses: 5,
      streak: 2,
      rank: 20000,
      ranktotal: 100000,
      ranklevel: 4,
      rating: 1150,
      regionrank: -1,
      regionranktotal: -1,
      lastmatchdate: 0,
      highestrating: 1200,
      highestrank: 18000,
      highestranklevel: 4,
    })
    expect(rank.rankLevel).toBe('platinum') // tier slug, not "4"
  })

  it('builds a ScoutReport from real Relic fixtures (Swag-Crimelord-OG)', () => {
    const personalStat = loadFixture<RelicPersonalStatResponse>('relic/personalStat_Swag.json')
    const history = loadFixture<RelicRecentMatchHistoryResponse>(
      'relic/recentMatchHistory_23656868.json',
    )
    const report = buildScoutReportFromRelic({
      personalStat,
      matches: history.matchHistoryStats,
      profileId: 23656868,
      mapNames: {},
    })
    expect(report.name).toBe('Swag-Crimelord-OG - IWNL')
    expect(report.hasData).toBe(true)
    expect(report.recentForm.games).toBe(15) // all 15 fixture matches include this player
    expect(report.recentForm.wins + report.recentForm.losses).toBe(15)
    // competitive modes only (QM ladders present in the fixture); no Art of War / Custom
    expect(report.modes.length).toBeGreaterThan(0)
    expect(report.modes.every((m) => m.leaderboard.startsWith('Quick Match'))).toBe(true)
    expect(report.topCivs.length).toBeGreaterThan(0)
  })
})
