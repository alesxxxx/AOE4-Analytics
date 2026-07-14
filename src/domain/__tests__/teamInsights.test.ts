import { describe, expect, it } from 'vitest'
import type { PerPlayerMatchStats } from '../analysis'
import {
  buildAdvisoryTeamPlan,
  buildTeamContributionBreakdown,
  type TeamPlanRosterPlayer,
} from '../teamInsights'

function stat(over: Partial<PerPlayerMatchStats>): PerPlayerMatchStats {
  return {
    profileId: 1,
    teamId: 0,
    civ: 'french',
    result: 'win',
    unitsProduced: null,
    kills: null,
    deaths: null,
    kd: null,
    buildingsProduced: null,
    techsResearched: null,
    apm: null,
    gameTimeSec: null,
    ...over,
  }
}

const player = (name: string, civ: string, profileId = 1): TeamPlanRosterPlayer => ({
  profileId,
  name,
  civ,
})

describe('buildAdvisoryTeamPlan', () => {
  it('turns a balanced 2v2 civ roster into an explicitly advisory plan', () => {
    const plan = buildAdvisoryTeamPlan([
      [player('Me', 'french'), player('Ally', 'abbasid_dynasty')],
      [player('Enemy A', 'english'), player('Enemy B', 'mongols')],
    ])

    expect(plan).not.toBeNull()
    expect(plan?.label).toBe('Advisory civ plan')
    expect(plan?.basis).toContain('not detected strategy')
    expect(plan?.headline).toBe('Create space while the team economy scales')
    expect(plan?.assignments.map((assignment) => assignment.role)).toEqual([
      'Pressure / tempo',
      'Economy / scaling',
    ])
    expect(plan?.priorities).toHaveLength(3)
    expect(plan?.priorities.join(' ')).toContain('can support early pressure')
  })

  it('keeps an unknown civilization flexible without inventing traits', () => {
    const plan = buildAdvisoryTeamPlan([
      [player('Me', 'unknown_future_civ'), player('Ally', 'english')],
      [player('Enemy A', 'chinese'), player('Enemy B', 'rus')],
    ])

    expect(plan?.assignments[0]).toMatchObject({
      role: 'Flexible',
      rationale: 'No curated civilization profile is available, so this role stays flexible.',
    })
  })

  it('supports larger balanced team rosters', () => {
    const plan = buildAdvisoryTeamPlan([
      [player('Me', 'french'), player('Ally A', 'abbasid_dynasty'), player('Ally B', 'english')],
      [player('Enemy A', 'mongols'), player('Enemy B', 'chinese'), player('Enemy C', 'rus')],
    ])
    expect(plan?.assignments).toHaveLength(3)
  })

  it('preserves profile IDs when teammates have the same alias and civilization', () => {
    const plan = buildAdvisoryTeamPlan([
      [player('Twin', 'english', 11), player('Twin', 'english', 12)],
      [player('Enemy', 'french', 21), player('Enemy', 'french', 22)],
    ])

    expect(plan?.assignments.map((assignment) => assignment.profileId)).toEqual([11, 12])
  })

  it('does not produce a team plan for 1v1, FFA, or an incomplete roster', () => {
    expect(
      buildAdvisoryTeamPlan([[player('Me', 'french')], [player('Enemy', 'english')]]),
    ).toBeNull()
    expect(
      buildAdvisoryTeamPlan([
        [player('Me', 'french')],
        [player('A', 'english')],
        [player('B', 'mongols')],
      ]),
    ).toBeNull()
    expect(
      buildAdvisoryTeamPlan([
        [player('Me', 'french'), player('Ally', 'english')],
        [player('Enemy', 'mongols')],
      ]),
    ).toBeNull()
  })
})

describe('buildTeamContributionBreakdown', () => {
  const teamGame = [
    stat({
      profileId: 1,
      teamId: 10,
      unitsProduced: 120,
      kills: 30,
      deaths: 0,
      kd: null,
      techsResearched: 24,
      apm: 90,
      structureDamage: 6000,
    }),
    stat({
      profileId: 2,
      teamId: 10,
      civ: 'abbasid_dynasty',
      unitsProduced: 80,
      kills: 10,
      deaths: 20,
      kd: 0.5,
      techsResearched: 16,
      apm: 60,
      structureDamage: 2000,
    }),
    stat({ profileId: 3, teamId: 20, result: 'loss' }),
    stat({ profileId: 4, teamId: 20, result: 'loss' }),
  ]

  it('keeps raw counters separate and explains normalization within the team', () => {
    const result = buildTeamContributionBreakdown(teamGame, 1)
    expect(result.available).toBe(true)
    if (!result.available) return

    expect(result.players).toHaveLength(2)
    expect(result.players[0]?.isMe).toBe(true)
    expect(result.players[0]?.production).toEqual({
      value: 120,
      teamSharePct: 60,
      vsTeamAveragePct: 20,
    })
    expect(result.players[0]?.technology.teamSharePct).toBe(60)
    expect(result.players[0]?.activity.vsTeamAveragePct).toBe(20)
    expect(result.players[0]?.pressure.teamSharePct).toBe(75)
    expect(result.coverage.production).toEqual({ reported: 2, teamSize: 2 })
    expect(result.basis).toContain('reported Relic counters only')
    expect(result).not.toHaveProperty('score')
  })

  it('reports zero deaths honestly instead of inventing an infinite K/D', () => {
    const result = buildTeamContributionBreakdown(teamGame, 1)
    expect(result.available).toBe(true)
    if (!result.available) return

    expect(result.players[0]?.military).toEqual({
      kills: 30,
      deaths: 0,
      kd: null,
      zeroDeaths: true,
      teamKillSharePct: 75,
    })
    expect(result.players[1]?.military.kd).toBe(0.5)
  })

  it('preserves missing counters and exposes per-metric sample availability', () => {
    const rows = [
      stat({ profileId: 1, teamId: 0, unitsProduced: 50, kills: 4, deaths: null }),
      stat({ profileId: 2, teamId: 0, unitsProduced: null, kills: null, deaths: null }),
      stat({ profileId: 3, teamId: 1 }),
      stat({ profileId: 4, teamId: null }),
    ]
    const result = buildTeamContributionBreakdown(rows, 1)
    expect(result.available).toBe(true)
    if (!result.available) return

    expect(result.players[1]?.production.value).toBeNull()
    expect(result.coverage.production).toEqual({ reported: 1, teamSize: 2 })
    expect(result.coverage.military).toEqual({ reported: 0, teamSize: 2 })
    expect(result.coverage.pressure).toEqual({ reported: 0, teamSize: 2 })
    expect(result.excludedUnknownTeamRows).toBe(1)
  })

  it('declines FFA, 1v1, and rows with missing team identity', () => {
    const ffa = [
      stat({ profileId: 1, teamId: 0 }),
      stat({ profileId: 2, teamId: 1 }),
      stat({ profileId: 3, teamId: 2 }),
    ]
    expect(buildTeamContributionBreakdown(ffa, 1)).toEqual({ available: false, reason: 'ffa' })
    expect(buildTeamContributionBreakdown(ffa.slice(0, 2), 1)).toEqual({
      available: false,
      reason: 'not-team-game',
    })
    expect(
      buildTeamContributionBreakdown(
        [stat({ profileId: 1, teamId: null }), stat({ profileId: 2, teamId: 1 })],
        1,
      ),
    ).toEqual({ available: false, reason: 'missing-team-ids' })
  })

  it('declines when the configured player or an opposing team is missing', () => {
    expect(buildTeamContributionBreakdown(teamGame, 999)).toEqual({
      available: false,
      reason: 'missing-player',
    })
    expect(
      buildTeamContributionBreakdown(
        [stat({ profileId: 1, teamId: 0 }), stat({ profileId: 2, teamId: 0 })],
        1,
      ),
    ).toEqual({ available: false, reason: 'missing-opponents' })
  })
})
