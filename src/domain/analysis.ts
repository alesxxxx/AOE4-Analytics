/**
 * Post-game analysis (pure). Honestly tiered per D10:
 *  - Tier-1 fields (result, civ, duration, rating delta, matchup) are always
 *    available from the API and yield observations.
 *  - Real economy "leaks" (low villager production, low activity) need local
 *    AoE4 log stats (A1) and only appear when those are supplied.
 * Calculated targets are framed as benchmarks, never as live readings.
 */

import { allPlayers, normalizeTeams, type Game } from '../api/types'
import { type Bracket, getBenchmarks } from './benchmarks'
import { civDisplayName } from './civ'
import { formatDuration } from './format'
import { playerInGame } from './form'

/** A teammate or opponent's civ + display name, for team-format (2v2+) games. */
export interface RosterPlayer {
  civ: string
  name: string | null
}

/**
 * Per-player end-of-game stats from Relic's `counters` blob — the real numbers
 * behind AoE4World's post-game comparison (production, kills, deaths, tech, APM).
 * Available for EVERY game (ranked/QM/custom) with no auth. Economy (resources,
 * villagers, score) is NOT here — Relic leaves it 0; that needs the stats file.
 */
export interface PerPlayerMatchStats {
  profileId: number
  /** Relic team id — groups allies together (your side vs theirs). */
  teamId: number | null
  civ: string | null
  result: 'win' | 'loss' | null
  /** Military units produced. */
  unitsProduced: number | null
  kills: number | null
  deaths: number | null
  /** kills/deaths, rounded to 2dp; null when deaths is 0/unknown. */
  kd: number | null
  buildingsProduced: number | null
  /** Buildings this player lost, when Relic reports it. */
  buildingsLost?: number | null
  /** Relic `structdmg` counter; useful pressure signal, not the exact post-game razed column. */
  structureDamage?: number | null
  techsResearched: number | null
  apm: number | null
  gameTimeSec: number | null
}

export interface AnalyzedGame {
  result: 'win' | 'loss' | null
  civ: string
  oppCiv?: string | null
  map: string
  durationSec: number | null
  ratingDiff?: number | null
  myRating?: number | null
  oppRating?: number | null
  /** My teammates (excluding me), when the game is a team format. Undefined for 1v1. */
  myTeam?: RosterPlayer[]
  /** Every opponent across all enemy teams (flattened), when there's more than one. */
  oppTeam?: RosterPlayer[]
}

export interface ResourceTotals {
  food: number
  wood: number
  gold: number
  stone: number
}

/** End-of-game aggregates parsed from local AoE4 logs / stat summaries; all optional. */
export interface LocalGameStats {
  villagersProduced?: number
  popMax?: number
  totalCommands?: number
  gameTimeSec?: number
  /** Cumulative resources gathered from the stat summary, excluding starting resources. */
  resourcesGathered?: ResourceTotals
}

/**
 * Villagers produced per minute — an economy-pace metric in the spirit of
 * League's CS/min. Null without usable data (0 villagers = a parse miss, not a
 * real game; see the >0 guard used throughout, D52).
 */
export function villagersPerMinute(local: LocalGameStats | null | undefined): number | null {
  const v = local?.villagersProduced ?? 0
  const t = local?.gameTimeSec ?? 0
  if (v <= 0 || t <= 0) return null
  return Math.round((v / (t / 60)) * 10) / 10
}

export function totalResourcesGathered(local: LocalGameStats | null | undefined): number | null {
  const r = local?.resourcesGathered
  if (!r) return null
  const total = r.food + r.wood + r.gold + r.stone
  return total > 0 ? Math.round(total) : null
}

export function resourcesPerMinute(local: LocalGameStats | null | undefined): number | null {
  const total = totalResourcesGathered(local)
  const t = local?.gameTimeSec ?? 0
  if (total == null || t <= 0) return null
  return Math.round(total / (t / 60))
}

/**
 * 0-100 economy read for profile surfaces. Uses only real local economy data:
 * villager pace when available, resource-gather rate from stats.rgs otherwise.
 */
export function localEconomyScore(local: LocalGameStats | null | undefined): number | null {
  const scores: number[] = []
  const vpm = villagersPerMinute(local)
  if (vpm != null) scores.push(Math.max(0, Math.min(100, Math.round((vpm / 3.2) * 86))))
  const rpm = resourcesPerMinute(local)
  if (rpm != null) scores.push(Math.max(0, Math.min(100, Math.round((rpm / 900) * 86))))
  return scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null
}

/** Win/loss fallback from the user's own per-player Relic row. */
export function resultFromPerPlayer(
  perPlayer: PerPlayerMatchStats[] | null | undefined,
  profileId: number | null | undefined,
): 'win' | 'loss' | null {
  if (profileId == null) return null
  return perPlayer?.find((p) => p.profileId === profileId)?.result ?? null
}

export interface AnalysisInput {
  game: AnalyzedGame
  bracket: Bracket
  local?: LocalGameStats
  /** Historical win rate of my civ vs the opponent's civ (from /stats), if known. */
  matchupWinRate?: number | null
}

export type Severity = 'good' | 'info' | 'minor' | 'major'

export interface Signal {
  id: string
  severity: Severity
  title: string
  detail: string
}

export interface MatchAnalysis {
  result: 'win' | 'loss' | null
  signals: Signal[]
  /** Actions per minute (from local totalCommands/gameTime), or null. */
  apm: number | null
  /** Economy grade A–F (only when local stats are present), else null. */
  grade: string | null
  summary: string
  hasLocalStats: boolean
}

const SEVERITY_ORDER: Record<Severity, number> = { major: 0, minor: 1, info: 2, good: 3 }

/** The opponent's display name in a 1v1 (the first non-self player), or null. */
export function opponentName(game: Game, profileId: number): string | null {
  return allPlayers(game).find((p) => p.profile_id !== profileId)?.name ?? null
}

/** Maps a raw API game + the user's profile id into the Tier-1 AnalyzedGame, or null. */
export function extractAnalyzedGame(game: Game, profileId: number): AnalyzedGame | null {
  const me = playerInGame(game, profileId)
  if (!me) return null
  const teams = normalizeTeams(game)
  const myTeamIdx = teams.findIndex((t) => t.some((p) => p.profile_id === profileId))
  const myTeammates =
    myTeamIdx >= 0 ? teams[myTeamIdx]!.filter((p) => p.profile_id !== profileId) : []
  const enemyPlayers = teams.filter((_, i) => i !== myTeamIdx).flat()
  // First opponent — kept as the existing convenience field (matchup-winrate
  // lookups, 1v1 rendering) even when there are more enemies in `oppTeam`.
  const opp = enemyPlayers[0] ?? allPlayers(game).find((p) => p.profile_id !== profileId) ?? null
  return {
    result: me.result,
    civ: me.civilization,
    oppCiv: opp?.civilization ?? null,
    map: game.map,
    durationSec: game.duration,
    ratingDiff: me.rating_diff ?? null,
    myRating: me.rating ?? me.mmr ?? null,
    oppRating: opp?.rating ?? opp?.mmr ?? null,
    myTeam:
      myTeammates.length > 0
        ? myTeammates.map((p) => ({ civ: p.civilization, name: p.name }))
        : undefined,
    oppTeam:
      enemyPlayers.length > 1
        ? enemyPlayers.map((p) => ({ civ: p.civilization, name: p.name }))
        : undefined,
  }
}

export function computeApm(local: LocalGameStats | undefined): number | null {
  if (!local || local.totalCommands == null || !local.gameTimeSec || local.gameTimeSec <= 0) {
    return null
  }
  return Math.round(local.totalCommands / (local.gameTimeSec / 60))
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 68) return 'C'
  if (score >= 55) return 'D'
  return 'F'
}

export function analyzeMatch(input: AnalysisInput): MatchAnalysis {
  const { game, local } = input
  const bench = getBenchmarks(input.bracket)
  const signals: Signal[] = []
  const apm = computeApm(local)

  // --- Tier-1 observations ---
  if (game.durationSec != null) {
    if (game.durationSec < 480) {
      signals.push({
        id: 'short-game',
        severity: 'info',
        title: `Short game (${formatDuration(game.durationSec)})`,
        detail: 'Likely an early all-in or a quick resign. Were you scouting and reacting in time?',
      })
    } else if (game.durationSec > 2100) {
      signals.push({
        id: 'long-game',
        severity: 'info',
        title: `Long macro game (${formatDuration(game.durationSec)})`,
        detail: 'Economy and army composition decided this one — keep producing and re-maxing.',
      })
    }
  }

  if (game.oppCiv && input.matchupWinRate != null) {
    if (input.matchupWinRate < 47) {
      signals.push({
        id: 'tough-matchup',
        severity: 'minor',
        title: `Tough matchup: ${civDisplayName(game.civ)} vs ${civDisplayName(game.oppCiv)}`,
        detail: `Historically ~${input.matchupWinRate.toFixed(0)}% for you. Lean on your civ's strengths and avoid their power spikes.`,
      })
    } else if (input.matchupWinRate > 53) {
      signals.push({
        id: 'good-matchup',
        severity: 'good',
        title: `Favourable matchup vs ${civDisplayName(game.oppCiv)}`,
        detail: `Historically ~${input.matchupWinRate.toFixed(0)}% for you — play to the favourable trades.`,
      })
    }
  }

  if (game.oppRating != null && game.myRating != null && game.oppRating - game.myRating > 75) {
    signals.push({
      id: 'stronger-opp',
      severity: 'info',
      title: `Faced a stronger opponent (+${Math.round(game.oppRating - game.myRating)})`,
      detail: 'A loss here is expected; a win is great progress. Focus on your own benchmarks.',
    })
  }

  // --- Local-stats leaks (real economy signals) ---
  // A real game never produces 0 villagers — a 0 means the local log wasn't
  // parsed for this game (or stats were matched to the wrong game), so treat
  // `villagersProduced <= 0` as "no data" rather than a (bogus) major leak / F.
  if (local) {
    if (
      local.villagersProduced != null &&
      local.villagersProduced > 0 &&
      (local.gameTimeSec ?? 0) >= 600
    ) {
      if (local.villagersProduced < bench.villagersBy10min) {
        signals.push({
          id: 'low-villagers',
          severity: 'major',
          title: `Low villager count (${local.villagersProduced})`,
          detail: `For a game this long, aim for ${bench.villagersBy10min}+ by 10:00. Never let your Town Center sit idle.`,
        })
      } else {
        signals.push({
          id: 'good-villagers',
          severity: 'good',
          title: `Solid villager production (${local.villagersProduced})`,
          detail: 'Your economy kept growing — exactly right.',
        })
      }
    }
    if (apm != null && apm > 0 && apm < bench.targetApm * 0.6) {
      signals.push({
        id: 'low-apm',
        severity: 'minor',
        title: `Low activity (~${apm} APM)`,
        detail:
          'Keep your hands busy between fights: produce, scout, and spend resources continuously.',
      })
    }
  }

  signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  // --- Grade (only with real local economy data; vprod 0 = parse miss, not a grade) ---
  let grade: string | null = null
  if (
    local &&
    local.villagersProduced != null &&
    local.villagersProduced > 0 &&
    (local.gameTimeSec ?? 0) > 0
  ) {
    const vproRatio = Math.min(1.15, local.villagersProduced / bench.villagersBy10min)
    const apmRatio = apm != null ? Math.min(1.15, apm / bench.targetApm) : 0.8
    const score = Math.max(0, Math.min(100, (vproRatio * 0.6 + apmRatio * 0.4) * 100))
    grade = gradeFromScore(score)
  }

  const resultWord = game.result === 'win' ? 'Win' : game.result === 'loss' ? 'Loss' : 'Game'
  const top = signals.find((s) => s.severity === 'major' || s.severity === 'minor')
  const summary = top
    ? `${resultWord} as ${civDisplayName(game.civ)} on ${game.map}. Biggest takeaway: ${top.title}.`
    : `${resultWord} as ${civDisplayName(game.civ)} on ${game.map}.`

  return {
    result: game.result,
    signals,
    apm,
    grade,
    summary,
    hasLocalStats: !!local,
  }
}

/** Matches a rendered parse-miss value: "(0)" villagers or "(~0 APM)". */
const PARSE_MISS_ZERO_RE = /\((?:~?\s*)0(?:\s*APM)?\)/

/**
 * Strips parse-miss artifact signals that pre-D52 stored history may still carry.
 * A "Low/Solid villager count (0)" or "Low activity (~0 APM)" can only come from a
 * local-log parse miss, never a real game — but old games were analyzed and
 * persisted before the `> 0` generation guard existed, so the bogus signal lingers
 * in the history store and re-surfaces (e.g. in the "biggest leak" lens). Pure and
 * idempotent; safe to apply wherever stored signals are read.
 */
export function sanitizeStoredSignals(signals: Signal[]): Signal[] {
  return signals.filter(
    (s) =>
      !(
        (s.id === 'low-villagers' || s.id === 'good-villagers' || s.id === 'low-apm') &&
        PARSE_MISS_ZERO_RE.test(s.title)
      ),
  )
}
