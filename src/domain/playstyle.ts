/**
 * Playstyle profile (pure) — a Mobalytics-style "how you play" read: a handful
 * of 0–100 dimensions plus auto-generated tags, computed from your game history
 * and (where available) your local-game economy stats. Dimensions that need
 * local data (consent-gated) report hasData=false rather than faking a number.
 */
import { civDisplayName } from './civ'
import { localEconomyScore, villagersPerMinute, type LocalGameStats } from './analysis'

/** Minimal per-game shape (mapped from StoredMatch + its analysis/local stats). */
export interface PlaystyleGame {
  result: 'win' | 'loss' | null
  civ: string
  durationSec: number | null
  /** Actions per minute (from local stats), or null. */
  apm: number | null
  /** Economy grade 'A'..'F' (only when local stats present), or null. */
  grade: string | null
  /** Local economy counters from warnings.log / stats.rgs, when available. */
  local?: LocalGameStats
  /** The player's own Relic counters for this game, when available. */
  kd?: number | null
  deaths?: number | null
  unitsProduced?: number | null
  techsResearched?: number | null
}

export interface PlaystyleDimension {
  key: string
  label: string
  /** 0–100. */
  value: number
  /** False when there's no data for it (e.g. no local stats) — UI dims it. */
  hasData: boolean
  /** One-line plain-English meaning. */
  hint: string
}

export interface PlaystyleTag {
  label: string
  tone: 'pos' | 'info'
  /** Plain-English explanation of what earned the tag - shown on hover. */
  hint: string
}

export interface PlaystyleProfile {
  dimensions: PlaystyleDimension[]
  tags: PlaystyleTag[]
  sampleSize: number
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round = (n: number) => Math.round(n)

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null
}

const GRADE_SCORE: Record<string, number> = { A: 92, B: 78, C: 62, D: 48, F: 32 }

/** APM that maps to 100/100 multitasking — a high-Diamond/Conq pace. */
const APM_CEILING = 150

export function computePlaystyle(games: PlaystyleGame[]): PlaystyleProfile {
  const decided = games.filter((g) => g.result === 'win' || g.result === 'loss')

  // --- Aggression: shorter games → more aggressive. ---
  const minutes = games
    .map((g) => g.durationSec)
    .filter((d): d is number => d != null)
    .map((d) => d / 60)
  const avgMin = avg(minutes)
  const aggression = avgMin == null ? 50 : clamp(round(100 - (avgMin - 8) * 3), 10, 95)

  // --- Economy: average real local economy read. Prefer stat-summary resources,
  // fall back to the older grade for stored games that only have warnings.log data.
  const economyScores = games
    .map((g) => localEconomyScore(g.local) ?? (g.grade ? GRADE_SCORE[g.grade.charAt(0).toUpperCase()] : undefined))
    .filter((s): s is number => s != null)
  const economyAvg = avg(economyScores)
  const economy = economyAvg == null ? null : round(economyAvg)

  // --- Multitasking: APM on an absolute ladder-wide scale (150+ APM = 100).
  // Scaling against a bracket "target" inflated low-rank spam clicking into
  // 90+ scores; an absolute scale keeps the axis honest for beginners. ---
  const apms = games.map((g) => g.apm).filter((a): a is number => a != null && a > 0)
  const avgApm = avg(apms)
  const multitask = avgApm == null ? 0 : clamp(round((avgApm / APM_CEILING) * 100), 5, 100)

  // --- Consistency: fewer W/L flips → more consistent. ---
  let flips = 0
  for (let i = 1; i < decided.length; i++) {
    if (decided[i]!.result !== decided[i - 1]!.result) flips++
  }
  const consistency =
    decided.length >= 3 ? clamp(round((1 - flips / (decided.length - 1)) * 100), 0, 100) : 50

  // --- Civ versatility: spread across civs (low top-civ share + variety). ---
  const civCounts = countBy(games.map((g) => g.civ))
  const topCivShare = share(civCounts, games.length)
  const distinctCivs = Object.keys(civCounts).length
  const versatility =
    games.length >= 3
      ? clamp(round((1 - topCivShare) * 70 + (Math.min(distinctCivs, 6) / 6) * 30), 5, 100)
      : 50

  const dimensions: PlaystyleDimension[] = [
    {
      key: 'aggression',
      label: 'Aggression',
      value: aggression,
      hasData: avgMin != null,
      hint: 'How early your games end — high means you fight fast.',
    },
    {
      key: 'economy',
      label: 'Economy',
      value: economy ?? 0,
      hasData: economy != null,
      hint: 'Economy pace from resources gathered or villager production.',
    },
    {
      key: 'multitask',
      label: 'Multitasking',
      value: multitask,
      hasData: avgApm != null,
      hint: 'Actions per minute on a ladder-wide scale (150+ APM = 100).',
    },
    {
      key: 'consistency',
      label: 'Consistency',
      value: consistency,
      hasData: decided.length >= 3,
      hint: 'Fewer win/loss swings means steadier results.',
    },
    {
      key: 'versatility',
      label: 'Civ variety',
      value: versatility,
      hasData: games.length >= 3,
      hint: 'How many different civs you play.',
    },
  ]

  return {
    dimensions,
    tags: buildTags({
      games,
      decided,
      aggression,
      consistency,
      multitask,
      economy,
      topCivShare,
      distinctCivs,
      civCounts,
      avgApm,
      hasGrade: economy != null,
    }),
    sampleSize: games.length,
  }
}

interface TagCtx {
  games: PlaystyleGame[]
  decided: PlaystyleGame[]
  aggression: number
  consistency: number
  multitask: number
  economy: number | null
  topCivShare: number
  distinctCivs: number
  civCounts: Record<string, number>
  avgApm: number | null
  hasGrade: boolean
}

function buildTags(c: TagCtx): PlaystyleTag[] {
  const tags: PlaystyleTag[] = []
  // No tags from an empty / tiny sample — they'd be pure noise.
  if (c.games.length < 3) return tags

  if (c.aggression >= 70)
    tags.push({ label: 'Aggressive', tone: 'pos', hint: 'Your games end early - you look for fights fast.' })
  else if (c.aggression <= 35)
    tags.push({ label: 'Macro / boom', tone: 'info', hint: 'Your games run long - you build up before committing to fights.' })

  if (c.games.length >= 5 && c.topCivShare >= 0.6) {
    const topCiv = Object.entries(c.civCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (topCiv)
      tags.push({
        label: `One-trick: ${civDisplayName(topCiv)}`,
        tone: 'info',
        hint: `${Math.round(c.topCivShare * 100)}% of your games are on ${civDisplayName(topCiv)} - deep familiarity, little variety.`,
      })
  } else if (c.distinctCivs >= 6) {
    tags.push({ label: 'Versatile', tone: 'pos', hint: `You play ${c.distinctCivs} different civs.` })
  }

  // Late bloomer vs fast closer: win rate in long vs short games. Split at a
  // single 20-minute point so no game falls into a dead band between the buckets.
  const longWr = winRateFor(c.decided, (g) => (g.durationSec ?? 0) >= 20 * 60)
  const shortWr = winRateFor(
    c.decided,
    (g) => (g.durationSec ?? 0) > 0 && (g.durationSec ?? 0) < 20 * 60,
  )
  if (longWr != null && shortWr != null) {
    if (longWr - shortWr >= 12)
      tags.push({ label: 'Late bloomer', tone: 'info', hint: 'You win clearly more of your LONG games than your short ones - reaching the late game favors you.' })
    else if (shortWr - longWr >= 12)
      tags.push({ label: 'Fast closer', tone: 'pos', hint: 'You win clearly more of your SHORT games - your early aggression converts.' })
  }

  if (c.decided.length >= 5) {
    if (c.consistency >= 70)
      tags.push({ label: 'Consistent', tone: 'pos', hint: 'Few win/loss swings - your results are steady game to game.' })
    else if (c.consistency <= 40)
      tags.push({ label: 'Streaky', tone: 'info', hint: 'Your wins and losses come in runs - tilt check after two losses.' })
  }

  if (c.avgApm != null && c.avgApm >= 100)
    tags.push({ label: 'High APM', tone: 'pos', hint: `You average ${Math.round(c.avgApm)} actions per minute.` })
  if (c.hasGrade && (c.economy ?? 0) >= 80)
    tags.push({ label: 'Strong macro', tone: 'pos', hint: 'Your economy scores average 80+ - resources keep flowing.' })

  tags.push(...combatTags(c.games))

  return tags
}

/**
 * Deeper, league-flavored reads from the player's own per-game counters.
 * Every tag needs 3+ games with the relevant stat — no noise from one game.
 */
function combatTags(games: PlaystyleGame[]): PlaystyleTag[] {
  const tags: PlaystyleTag[] = []

  // Villager pace — the AoE4 "CS/min".
  const vpms = games
    .map((g) => villagersPerMinute(g.local))
    .filter((v): v is number => v != null)
  const avgVpm = avg(vpms)
  if (vpms.length >= 3 && avgVpm != null) {
    if (avgVpm < 1.5)
      tags.push({
        label: 'Villagerphobia',
        tone: 'info',
        hint: `You average ${avgVpm.toFixed(1)} villagers per minute - your economy starves. Keep the Town Center producing non-stop.`,
      })
    else if (avgVpm >= 2.2)
      tags.push({
        label: 'Boom economy',
        tone: 'pos',
        hint: `You average ${avgVpm.toFixed(1)} villagers per minute - a strong economic engine.`,
      })
  }

  // Fight efficiency — do your engagements trade up or down?
  const kds = games.map((g) => g.kd).filter((k): k is number => k != null)
  const avgKd = avg(kds)
  if (kds.length >= 3 && avgKd != null) {
    if (avgKd >= 1.3)
      tags.push({
        label: 'Wins the fights',
        tone: 'pos',
        hint: `Your average K/D is ${avgKd.toFixed(1)} - your engagements trade up.`,
      })
    else if (avgKd <= 0.7)
      tags.push({
        label: 'Donates armies',
        tone: 'info',
        hint: `Your average K/D is ${avgKd.toFixed(1)} - you lose more than you kill. Pick fights you can win, retreat from the rest.`,
      })
  }

  // Upgrade discipline — measured only on games long enough to research.
  const longGames = games.filter((g) => (g.durationSec ?? 0) >= 15 * 60)
  const techs = longGames
    .map((g) => g.techsResearched)
    .filter((t): t is number => t != null)
  const avgTechs = avg(techs)
  if (techs.length >= 3 && avgTechs != null) {
    if (avgTechs >= 18)
      tags.push({
        label: 'Upgrade enjoyer',
        tone: 'pos',
        hint: `${Math.round(avgTechs)} techs per long game - your army stays upgraded.`,
      })
    else if (avgTechs <= 8)
      tags.push({
        label: 'Skips upgrades',
        tone: 'info',
        hint: `Only ${Math.round(avgTechs)} techs in your 15min+ games - blacksmith upgrades win equal fights.`,
      })
  }

  // Production tempo — units out per minute of play.
  const upms = games
    .map((g) =>
      g.unitsProduced != null && g.durationSec != null && g.durationSec > 300
        ? g.unitsProduced / (g.durationSec / 60)
        : null,
    )
    .filter((u): u is number => u != null)
  const avgUpm = avg(upms)
  if (upms.length >= 3 && avgUpm != null && avgUpm >= 5.5) {
    tags.push({
      label: 'War machine',
      tone: 'pos',
      hint: `${avgUpm.toFixed(1)} units produced per minute - your production never idles.`,
    })
  }

  return tags
}

function winRateFor(games: PlaystyleGame[], pred: (g: PlaystyleGame) => boolean): number | null {
  const sub = games.filter(pred)
  if (sub.length < 3) return null
  const wins = sub.filter((g) => g.result === 'win').length
  return (wins / sub.length) * 100
}

function countBy(items: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of items) out[it] = (out[it] ?? 0) + 1
  return out
}

function share(counts: Record<string, number>, total: number): number {
  if (total === 0) return 0
  const top = Math.max(0, ...Object.values(counts))
  return top / total
}
