/**
 * Pure team-game guidance and post-game contribution calculations.
 *
 * Live plans are advisory only: they use the civilization identities already in
 * the public match roster plus RTSLytics's curated civilization profiles. They
 * do not claim to detect a player's build or strategy.
 *
 * Contribution rows deliberately remain separate. There is no combined score:
 * every normalized value is shown beside the raw Relic counter it came from.
 */
import { CIV_PROFILES } from '../data/civProfiles'
import type { PerPlayerMatchStats } from './analysis'

export interface TeamPlanRosterPlayer {
  profileId: number
  name: string
  civ: string | null
  isMe?: boolean
}

export interface TeamPlanAssignment {
  profileId: number
  name: string
  civ: string | null
  role: TeamPlanRole
  /** Curated civilization focus, not a detected build. */
  rationale: string
}

export type TeamPlanRole =
  | 'Pressure / tempo'
  | 'Economy / scaling'
  | 'Anchor / defense'
  | 'Map control / support'
  | 'Ranged / siege support'
  | 'Flexible'

export interface AdvisoryTeamPlan {
  label: 'Advisory civ plan'
  headline: string
  assignments: TeamPlanAssignment[]
  priorities: string[]
  basis: 'Civilization traits only — not detected strategy.'
}

const PRESSURE_TAGS = new Set(['aggressive', 'tempo', 'raiding', 'cavalry', 'mobility'])
const ECONOMY_TAGS = new Set(['economy', 'boom', 'trade', 'scaling'])
const DEFENSE_TAGS = new Set(['defensive', 'fortifications', 'turtle'])
const CONTROL_TAGS = new Set(['religion', 'sacred-sites', 'map-control', 'support'])
const RANGED_TAGS = new Set(['siege', 'ranged', 'gunpowder'])

function hasAny(tags: readonly string[], candidates: ReadonlySet<string>): boolean {
  return tags.some((tag) => candidates.has(tag))
}

function roleForCiv(civ: string | null): TeamPlanRole {
  const tags = civ ? (CIV_PROFILES[civ]?.tags ?? []) : []
  if (hasAny(tags, PRESSURE_TAGS)) return 'Pressure / tempo'
  if (hasAny(tags, DEFENSE_TAGS)) return 'Anchor / defense'
  if (hasAny(tags, ECONOMY_TAGS)) return 'Economy / scaling'
  if (hasAny(tags, CONTROL_TAGS)) return 'Map control / support'
  if (hasAny(tags, RANGED_TAGS)) return 'Ranged / siege support'
  return 'Flexible'
}

function roleSubject(player: TeamPlanRosterPlayer): string {
  const profile = player.civ ? CIV_PROFILES[player.civ] : undefined
  return player.name || profile?.name || 'Unknown player'
}

function roleRationale(player: TeamPlanRosterPlayer): string {
  if (!player.civ) return 'Civilization is unavailable, so no specialized role is assumed.'
  return (
    CIV_PROFILES[player.civ]?.focus ??
    'No curated civilization profile is available, so this role stays flexible.'
  )
}

/**
 * Builds a short plan for standard public 2v2+ rosters. `teams[0]` must be the
 * user's team. FFA, 1v1, incomplete, and unbalanced rosters are left alone.
 */
export function buildAdvisoryTeamPlan(
  teams: readonly (readonly TeamPlanRosterPlayer[])[],
): AdvisoryTeamPlan | null {
  if (teams.length !== 2) return null
  const mine = teams[0]
  const enemy = teams[1]
  if (!mine || !enemy || mine.length < 2 || enemy.length < 2 || mine.length !== enemy.length) {
    return null
  }

  const assignments = mine.map((player): TeamPlanAssignment => ({
    profileId: player.profileId,
    name: roleSubject(player),
    civ: player.civ,
    role: roleForCiv(player.civ),
    rationale: roleRationale(player),
  }))
  const roles = new Set(assignments.map((assignment) => assignment.role))
  const allyTags = mine.flatMap((player) =>
    player.civ ? (CIV_PROFILES[player.civ]?.tags ?? []) : [],
  )
  const enemyTags = enemy.flatMap((player) =>
    player.civ ? (CIV_PROFILES[player.civ]?.tags ?? []) : [],
  )

  let headline = 'Coordinate one shared timing'
  const priorities: string[] = []
  if (roles.has('Pressure / tempo') && roles.has('Economy / scaling')) {
    headline = 'Create space while the team economy scales'
    priorities.push(
      'Let the pressure-oriented civ create space while the scaling civ protects its economy.',
    )
  } else if (roles.has('Anchor / defense')) {
    headline = 'Fight around a stable defensive anchor'
    priorities.push('Use the defensive civ as an anchor instead of taking separate fights.')
  } else if (roles.has('Pressure / tempo')) {
    headline = 'Combine pressure into one timing'
    priorities.push('Coordinate the first pressure window so mobile units do not attack alone.')
  } else {
    priorities.push('Agree on one attack or defense timing before armies split across the map.')
  }

  if (hasAny(allyTags, CONTROL_TAGS)) {
    priorities.push('Secure shared vision before committing to relics or sacred-site control.')
  } else if (hasAny(allyTags, RANGED_TAGS)) {
    priorities.push('Keep a frontline between enemy units and the ranged or siege-oriented civ.')
  } else if (hasAny(allyTags, ECONOMY_TAGS)) {
    priorities.push('Call out who is covering defense before either player invests in scaling.')
  }

  if (hasAny(enemyTags, PRESSURE_TAGS)) {
    priorities.push(
      'Enemy civilization traits can support early pressure; coordinate vision and first defenses.',
    )
  } else if (hasAny(enemyTags, ECONOMY_TAGS)) {
    priorities.push(
      'Enemy civilization traits can support scaling; agree whether to pressure or outscale together.',
    )
  } else {
    priorities.push('Confirm the enemy unit mix before committing both players to hard counters.')
  }

  return {
    label: 'Advisory civ plan',
    headline,
    assignments,
    priorities: priorities.slice(0, 3),
    basis: 'Civilization traits only — not detected strategy.',
  }
}

export interface MetricCoverage {
  reported: number
  teamSize: number
}

export interface NormalizedTeamMetric {
  /** Raw Relic counter. */
  value: number | null
  /** Player's share of the sum of reported values for the known team. */
  teamSharePct: number | null
  /** Percent above/below the mean of reported values for the known team. */
  vsTeamAveragePct: number | null
}

export interface MilitaryEfficiencyMetric {
  kills: number | null
  deaths: number | null
  /** Finite K/D only. A zero-death row is represented explicitly below. */
  kd: number | null
  zeroDeaths: boolean
  /** Player's share of reported team kills; this does not pretend K/D is additive. */
  teamKillSharePct: number | null
}

export interface TeamContributionPlayer {
  profileId: number
  civ: string | null
  isMe: boolean
  production: NormalizedTeamMetric
  military: MilitaryEfficiencyMetric
  technology: NormalizedTeamMetric
  activity: NormalizedTeamMetric
  pressure: NormalizedTeamMetric
}

export interface TeamContributionCoverage {
  production: MetricCoverage
  military: MetricCoverage
  technology: MetricCoverage
  activity: MetricCoverage
  pressure: MetricCoverage
}

export interface TeamContributionBreakdown {
  available: true
  teamId: number
  teamSize: number
  /** Rows whose team could not be identified are excluded, and counted here. */
  excludedUnknownTeamRows: number
  players: TeamContributionPlayer[]
  coverage: TeamContributionCoverage
  basis: 'Compared with known teammates using reported Relic counters only.'
}

export type TeamContributionUnavailableReason =
  'missing-player' | 'missing-team-ids' | 'not-team-game' | 'ffa' | 'missing-opponents'

export interface TeamContributionUnavailable {
  available: false
  reason: TeamContributionUnavailableReason
}

export type TeamContributionResult = TeamContributionBreakdown | TeamContributionUnavailable

function statValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function validTeamId(teamId: number | null): teamId is number {
  return teamId != null && Number.isFinite(teamId) && teamId >= 0
}

function roundPct(value: number): number {
  return Math.round(value)
}

function normalizedMetric(
  player: PerPlayerMatchStats,
  team: readonly PerPlayerMatchStats[],
  getValue: (row: PerPlayerMatchStats) => number | null | undefined,
): NormalizedTeamMetric {
  const value = statValue(getValue(player))
  const reported = team.map((row) => statValue(getValue(row))).filter((v): v is number => v != null)
  const total = reported.reduce((sum, v) => sum + v, 0)
  const average = reported.length > 0 ? total / reported.length : 0
  return {
    value,
    teamSharePct: value != null && total > 0 ? roundPct((value / total) * 100) : null,
    vsTeamAveragePct:
      value != null && average > 0 ? roundPct(((value - average) / average) * 100) : null,
  }
}

function coverage(
  team: readonly PerPlayerMatchStats[],
  isReported: (row: PerPlayerMatchStats) => boolean,
): MetricCoverage {
  return { reported: team.filter(isReported).length, teamSize: team.length }
}

function unavailable(reason: TeamContributionUnavailableReason): TeamContributionUnavailable {
  return { available: false, reason }
}

/**
 * Builds a transparent contribution table for the user's known team. It returns
 * no result for 1v1/FFA or when the user's side cannot be established. Missing
 * individual counters remain null and are reflected in per-metric coverage.
 */
export function buildTeamContributionBreakdown(
  rows: readonly PerPlayerMatchStats[],
  myProfileId: number | null | undefined,
): TeamContributionResult {
  if (myProfileId == null) return unavailable('missing-player')
  const me = rows.find((row) => row.profileId === myProfileId)
  if (!me) return unavailable('missing-player')
  if (!validTeamId(me.teamId)) return unavailable('missing-team-ids')

  const team = rows.filter((row) => row.teamId === me.teamId)
  const unknownTeamRows = rows.filter((row) => !validTeamId(row.teamId)).length
  const teamSizes = new Map<number, number>()
  for (const row of rows) {
    if (!validTeamId(row.teamId)) continue
    teamSizes.set(row.teamId, (teamSizes.get(row.teamId) ?? 0) + 1)
  }

  if (team.length < 2) {
    if (unknownTeamRows > 0) return unavailable('missing-team-ids')
    const allSolo = teamSizes.size >= 3 && [...teamSizes.values()].every((size) => size === 1)
    return unavailable(allSolo ? 'ffa' : 'not-team-game')
  }
  if (![...teamSizes.keys()].some((teamId) => teamId !== me.teamId)) {
    return unavailable('missing-opponents')
  }

  const killMetric = (row: PerPlayerMatchStats) => normalizedMetric(row, team, (p) => p.kills)
  const players = team
    .map((row): TeamContributionPlayer => {
      const kills = statValue(row.kills)
      const deaths = statValue(row.deaths)
      return {
        profileId: row.profileId,
        civ: row.civ,
        isMe: row.profileId === myProfileId,
        production: normalizedMetric(row, team, (p) => p.unitsProduced),
        military: {
          kills,
          deaths,
          kd:
            kills != null && deaths != null && deaths > 0
              ? Math.round((kills / deaths) * 100) / 100
              : null,
          zeroDeaths: deaths === 0,
          teamKillSharePct: killMetric(row).teamSharePct,
        },
        technology: normalizedMetric(row, team, (p) => p.techsResearched),
        activity: normalizedMetric(row, team, (p) => p.apm),
        pressure: normalizedMetric(row, team, (p) => p.structureDamage),
      }
    })
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))

  return {
    available: true,
    teamId: me.teamId,
    teamSize: team.length,
    excludedUnknownTeamRows: unknownTeamRows,
    players,
    coverage: {
      production: coverage(team, (row) => statValue(row.unitsProduced) != null),
      military: coverage(
        team,
        (row) => statValue(row.kills) != null && statValue(row.deaths) != null,
      ),
      technology: coverage(team, (row) => statValue(row.techsResearched) != null),
      activity: coverage(team, (row) => statValue(row.apm) != null),
      pressure: coverage(team, (row) => statValue(row.structureDamage) != null),
    },
    basis: 'Compared with known teammates using reported Relic counters only.',
  }
}
