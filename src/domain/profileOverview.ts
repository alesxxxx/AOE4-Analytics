/**
 * Mobalytics-style profile overview (pure): per-civ performance rows (the
 * "champion table" analog — games, win rate, avg APM/KD, net rating Δ) and an
 * overall performance-tile strip. Everything derives from REAL stored data:
 * game results + rating deltas from the synced history, APM/KD/units from the
 * Relic per-player counters already attached to each match. Per the honesty
 * guardrail (D10), any stat without backing data is null — never estimated.
 */
import type { LocalGameStats, PerPlayerMatchStats } from './analysis'
import { localEconomyScore, resourcesPerMinute, totalResourcesGathered, villagersPerMinute } from './analysis'
import { civDisplayName } from './civ'
import { round1 } from './form'
import { winRate } from './playerStats'

/** Minimal per-game shape (mapped from StoredMatch). */
export interface ProfileGame {
  civ: string
  result: 'win' | 'loss' | null
  ratingDiff: number | null
  durationSec: number | null
  /** User-local economy counters, when a finished local stats file was matched. */
  local?: LocalGameStats
  /** Relic per-player counters for the match; mine is matched by profileId. */
  perPlayer?: PerPlayerMatchStats[]
}

export interface CivPlaystyleSummary {
  label: string
  detail: string
  tone: 'fight' | 'eco' | 'macro' | 'balanced'
}

export interface CivOverviewRow {
  civ: string
  civName: string
  games: number
  wins: number
  losses: number
  winRate: number | null
  /** Net rating change with this civ over the window; null when never rated. */
  ratingDelta: number | null
  avgApm: number | null
  avgKd: number | null
  avgDurationSec: number | null
  avgUnitsProduced: number | null
  avgKills: number | null
  avgDeaths: number | null
  avgBuildingsProduced: number | null
  avgTechsResearched: number | null
  avgStructureDamage: number | null
  avgVillagersProduced: number | null
  avgVillagersPerMinute: number | null
  avgResourcesGathered: number | null
  avgResourcesPerMinute: number | null
  avgEconomyScore: number | null
  /** Share of recorded games with this civ lasting at least 20 minutes. */
  lateGameShare: number | null
  /** How many games had trustworthy local economy counters. */
  localStatsGames: number
  /** How many games had Relic per-player counters for the user's row. */
  counterGames: number
  style: CivPlaystyleSummary
  strengths: string[]
}

export interface PerformanceTiles {
  /** Games in the window (all, decided or not). */
  games: number
  avgApm: number | null
  avgKd: number | null
  avgUnitsProduced: number | null
  avgKills: number | null
  avgVillagersPerMinute: number | null
  avgResourcesPerMinute: number | null
  avgDurationSec: number | null
  /** Net rating change across the whole window; null when never rated. */
  ratingDelta: number | null
}

export interface ProfileOverview {
  civs: CivOverviewRow[]
  tiles: PerformanceTiles
}

function mean(xs: number[]): number | null {
  return xs.length > 0 ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null
}

function sumOrNull(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) : null
}

function meanSeconds(xs: number[]): number | null {
  return xs.length > 0 ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null
}

interface Bucket {
  games: number
  wins: number
  losses: number
  deltas: number[]
  apms: number[]
  kds: number[]
  durations: number[]
  units: number[]
  kills: number[]
  deaths: number[]
  buildings: number[]
  techs: number[]
  structureDamage: number[]
  villagers: number[]
  villRates: number[]
  resourceTotals: number[]
  resourceRates: number[]
  economyScores: number[]
  localStatsGames: number
  counterGames: number
}

const EMPTY_BUCKET = (): Bucket => ({
  games: 0,
  wins: 0,
  losses: 0,
  deltas: [],
  apms: [],
  kds: [],
  durations: [],
  units: [],
  kills: [],
  deaths: [],
  buildings: [],
  techs: [],
  structureDamage: [],
  villagers: [],
  villRates: [],
  resourceTotals: [],
  resourceRates: [],
  economyScores: [],
  localStatsGames: 0,
  counterGames: 0,
})

function lateGameShare(durations: number[]): number | null {
  if (durations.length === 0) return null
  const late = durations.filter((d) => d >= 20 * 60).length
  return Math.round((late / durations.length) * 100)
}

function styleFor(row: Omit<CivOverviewRow, 'style' | 'strengths'>): CivPlaystyleSummary {
  const lateShare = row.lateGameShare ?? 0
  const avgDuration = row.avgDurationSec ?? 0
  const avgKills = row.avgKills ?? 0
  const avgKd = row.avgKd ?? 0
  const avgUnits = row.avgUnitsProduced ?? 0
  const avgTechs = row.avgTechsResearched ?? 0
  const avgEco = row.avgEconomyScore ?? 0

  if ((avgDuration >= 22 * 60 || lateShare >= 50) && avgTechs >= 18) {
    return { label: 'Late scaler', detail: 'longer games, more tech', tone: 'macro' }
  }
  if (avgEco >= 68 || (row.avgVillagersProduced ?? 0) >= 55) {
    return { label: 'Eco builder', detail: 'strong resource pace', tone: 'eco' }
  }
  if (avgKills >= 35 || avgKd >= 1.4) {
    return { label: 'Fight heavy', detail: 'kills decide the game', tone: 'fight' }
  }
  if (avgUnits >= 120) {
    return { label: 'Army flood', detail: 'wins by production volume', tone: 'fight' }
  }
  if (avgDuration > 0 && avgDuration < 14 * 60) {
    return { label: 'Early pressure', detail: 'games end quickly', tone: 'fight' }
  }
  return { label: 'Balanced', detail: 'no single pattern yet', tone: 'balanced' }
}

function strengthsFor(row: Omit<CivOverviewRow, 'style' | 'strengths'>): string[] {
  const strengths: string[] = []
  if ((row.winRate ?? 0) >= 55 && row.wins + row.losses >= 2) strengths.push('winning')
  if (
    (row.avgEconomyScore ?? 0) >= 64 ||
    (row.avgVillagersPerMinute ?? 0) >= 2.4 ||
    (row.avgVillagersProduced ?? 0) >= 50
  ) {
    strengths.push('economy')
  }
  if ((row.avgKills ?? 0) >= 30 || (row.avgKd ?? 0) >= 1.25) strengths.push('fights')
  if ((row.avgUnitsProduced ?? 0) >= 100) strengths.push('production')
  if ((row.lateGameShare ?? 0) >= 40) strengths.push('scaling')
  if ((row.avgTechsResearched ?? 0) >= 20) strengths.push('tech')
  return strengths.slice(0, 3)
}

export function computeProfileOverview(
  games: ProfileGame[],
  profileId: number | null,
): ProfileOverview {
  const mine = (g: ProfileGame): PerPlayerMatchStats | null =>
    profileId != null ? (g.perPlayer?.find((p) => p.profileId === profileId) ?? null) : null

  const byCiv = new Map<string, Bucket>()
  const all = {
    deltas: [] as number[],
    apms: [] as number[],
    kds: [] as number[],
    units: [] as number[],
    kills: [] as number[],
    villRates: [] as number[],
    resourceRates: [] as number[],
    durations: [] as number[],
  }

  for (const g of games) {
    const b = byCiv.get(g.civ) ?? EMPTY_BUCKET()
    b.games++
    if (g.result === 'win') b.wins++
    if (g.result === 'loss') b.losses++
    if (g.ratingDiff != null) {
      b.deltas.push(g.ratingDiff)
      all.deltas.push(g.ratingDiff)
    }
    if (g.durationSec != null) {
      b.durations.push(g.durationSec)
      all.durations.push(g.durationSec)
    }
    const vpm = villagersPerMinute(g.local)
    if (vpm != null) {
      b.villRates.push(vpm)
      all.villRates.push(vpm)
    }
    const totalResources = totalResourcesGathered(g.local)
    if (totalResources != null) b.resourceTotals.push(totalResources)
    const rpm = resourcesPerMinute(g.local)
    if (rpm != null) {
      b.resourceRates.push(rpm)
      all.resourceRates.push(rpm)
    }
    const eco = localEconomyScore(g.local)
    if (eco != null) b.economyScores.push(eco)
    if ((g.local?.villagersProduced ?? 0) > 0) {
      b.villagers.push(g.local!.villagersProduced!)
      b.localStatsGames++
    } else if (totalResources != null) {
      b.localStatsGames++
    }
    const me = mine(g)
    if (me) b.counterGames++
    if (me?.apm != null) {
      b.apms.push(me.apm)
      all.apms.push(me.apm)
    }
    if (me?.kd != null) {
      b.kds.push(me.kd)
      all.kds.push(me.kd)
    }
    if (me?.unitsProduced != null) {
      b.units.push(me.unitsProduced)
      all.units.push(me.unitsProduced)
    }
    if (me?.kills != null) {
      b.kills.push(me.kills)
      all.kills.push(me.kills)
    }
    if (me?.deaths != null) b.deaths.push(me.deaths)
    if (me?.buildingsProduced != null) b.buildings.push(me.buildingsProduced)
    if (me?.techsResearched != null) b.techs.push(me.techsResearched)
    if (me?.structureDamage != null) b.structureDamage.push(me.structureDamage)
    byCiv.set(g.civ, b)
  }

  const civs: CivOverviewRow[] = [...byCiv.entries()]
    .map(([civ, b]) => {
      const base = {
        civ,
        civName: civDisplayName(civ),
        games: b.games,
        wins: b.wins,
        losses: b.losses,
        winRate: winRate(b.wins, b.wins + b.losses),
        ratingDelta: sumOrNull(b.deltas),
        avgApm: mean(b.apms),
        avgKd: mean(b.kds),
        avgDurationSec: meanSeconds(b.durations),
        avgUnitsProduced: mean(b.units),
        avgKills: mean(b.kills),
        avgDeaths: mean(b.deaths),
        avgBuildingsProduced: mean(b.buildings),
        avgTechsResearched: mean(b.techs),
        avgStructureDamage: mean(b.structureDamage),
        avgVillagersProduced: mean(b.villagers),
        avgVillagersPerMinute: mean(b.villRates),
        avgResourcesGathered: mean(b.resourceTotals),
        avgResourcesPerMinute: mean(b.resourceRates),
        avgEconomyScore: mean(b.economyScores),
        lateGameShare: lateGameShare(b.durations),
        localStatsGames: b.localStatsGames,
        counterGames: b.counterGames,
      }
      return { ...base, style: styleFor(base), strengths: strengthsFor(base) }
    })
    .sort((a, b) => b.games - a.games)

  return {
    civs,
    tiles: {
      games: games.length,
      avgApm: mean(all.apms),
      avgKd: mean(all.kds),
      avgUnitsProduced: mean(all.units),
      avgKills: mean(all.kills),
      avgVillagersPerMinute: mean(all.villRates),
      avgResourcesPerMinute: mean(all.resourceRates),
      avgDurationSec: meanSeconds(all.durations),
      ratingDelta: sumOrNull(all.deltas),
    },
  }
}
