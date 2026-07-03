/**
 * Post-game coaching from the game's OWN stat summary (pure). Where
 * `gameCoaching.ts` reads the Relic counters (kills/production/tech),
 * this reads the decoded summary — exact age-up times, TC idle gaps,
 * villager high, gather rate, army peak, relics — and turns them into
 * specific, numbered findings a beginner can act on. Every number here
 * matches the game's post-match screens (D56).
 */
import type { Signal } from './analysis'
import type { MatchSummary, PlayerSummary } from './statsSummary'
import { civFromToken } from './statsSummary'

function fmtTime(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const VILLAGER_IDLE_GAP_SEC = 35

/** The user's row: profile id first (exact), then civ, then never guess. */
export function summaryPlayerForMe(
  summary: MatchSummary,
  myProfileId: number | null,
  myCiv: string | null,
): PlayerSummary | null {
  if (myProfileId != null) {
    const byId = summary.players.find((p) => p.profileId === myProfileId)
    if (byId) return byId
  }
  if (myCiv) {
    const byCiv = summary.players.filter((p) => civFromToken(p.civToken) === myCiv)
    if (byCiv.length === 1) return byCiv[0]!
  }
  return null
}

export interface VillagerProductionRhythm {
  villagersMade: number
  idleWindows: number
  count: number
  longestSec: number
  longestGapSec: number
  /** Villagers that COULD have been made during the idle time (~25s each). */
  lostVillagers: number
}

/** Villager production gaps from the timed build log (TC idle read). */
export function villagerGaps(p: PlayerSummary): VillagerProductionRhythm | null {
  const times = p.buildOrder
    .filter(
      (e) =>
        e.category === 'unit' &&
        (e.blueprint.startsWith('unit_villager') || e.name === 'Villager'),
    )
    .map((e) => e.timeSec)
    .sort((a, b) => a - b)
  if (times.length === 0) return null
  let idleWindows = 0
  let longestGapSec = 0
  let idleSec = 0
  for (let i = 1; i < times.length; i++) {
    const gap = times[i]! - times[i - 1]!
    longestGapSec = Math.max(longestGapSec, gap)
    if (gap > VILLAGER_IDLE_GAP_SEC) {
      idleWindows++
      idleSec += gap - 25 // a villager takes ~20-25s; the rest was idle TC
    }
  }
  return {
    villagersMade: times.length,
    idleWindows,
    count: idleWindows,
    longestSec: longestGapSec,
    longestGapSec,
    lostVillagers: Math.floor(idleSec / 25),
  }
}

export interface SummaryCoachingInput {
  summary: MatchSummary
  myProfileId: number | null
  myCiv: string | null
  /** The Feudal age-up target (seconds) from the user's chosen build, if any. */
  feudalTargetSec?: number | null
}

/**
 * Coaching signals from the decoded summary. 1v1-focused: compares the user
 * against the FIRST other player (team games get self-contained reads only).
 */
export function summarySignals(input: SummaryCoachingInput): Signal[] {
  const me = summaryPlayerForMe(input.summary, input.myProfileId, input.myCiv)
  if (!me) return []
  const enemy = input.summary.players.find((p) => p.playerId !== me.playerId) ?? null
  const is1v1 = input.summary.players.length === 2

  const signals: Signal[] = []
  const gameLen = input.summary.gameLengthSec

  // --- Economy pace: total gathered per minute, vs the enemy (the beginner metric). ---
  if (is1v1 && me.totals && enemy?.totals && gameLen && gameLen > 300) {
    const mine = resourceSum(me) / (gameLen / 60)
    const theirs = resourceSum(enemy) / (gameLen / 60)
    if (theirs > 0) {
      const ratio = mine / theirs
      if (ratio < 0.8) {
        signals.push({
          id: 'sum-eco-behind',
          severity: 'major',
          title: `Out-gathered (${Math.round(mine)}/min vs their ${Math.round(theirs)}/min)`,
          detail:
            'The enemy economy simply produced more than yours. More villagers, always working — that gap decides most games at every rank below Diamond.',
        })
      } else if (ratio > 1.2) {
        signals.push({
          id: 'sum-eco-ahead',
          severity: 'good',
          title: `Out-gathered them (${Math.round(mine)}/min vs ${Math.round(theirs)}/min)`,
          detail: 'Your economy out-produced theirs — keep converting that into army and upgrades.',
        })
      }
    }
  }

  // --- Town Center discipline: gaps in villager production. ---
  const gaps = villagerGaps(me)
  if (gaps && gaps.count >= 3 && gaps.lostVillagers >= 3) {
    signals.push({
      id: 'sum-tc-idle',
      severity: gaps.lostVillagers >= 8 ? 'major' : 'minor',
      title: `Town Center sat idle (~${gaps.lostVillagers} villagers never made)`,
      detail: `${gaps.count} production gaps, the longest ${fmtTime(gaps.longestSec)}. Queue 2-3 villagers whenever you check the base — especially while fighting.`,
    })
  }

  // --- Age-up: vs your build's target, then vs the enemy. ---
  const myAge2 = me.totals?.age2Sec ?? null
  if (myAge2 != null && input.feudalTargetSec != null && input.feudalTargetSec > 0) {
    const lateBy = myAge2 - input.feudalTargetSec
    if (lateBy > 45) {
      signals.push({
        id: 'sum-age2-late',
        severity: lateBy > 120 ? 'major' : 'minor',
        title: `Feudal at ${fmtTime(myAge2)} — your build targets ${fmtTime(input.feudalTargetSec)}`,
        detail:
          'Late age-ups usually trace back to villager gaps or floating food. Practice the opening in a custom game until the timing is automatic.',
      })
    }
  }
  const enemyAge2 = is1v1 ? (enemy?.totals?.age2Sec ?? null) : null
  if (myAge2 != null && enemyAge2 != null) {
    if (myAge2 - enemyAge2 > 60) {
      signals.push({
        id: 'sum-age2-behind',
        severity: 'minor',
        title: `They reached Feudal first (${fmtTime(enemyAge2)} vs your ${fmtTime(myAge2)})`,
        detail:
          'A minute of age lead is a window to hit you with better units. If you age slower, expect pressure — wall, and keep your army home until you catch up.',
      })
    } else if (enemyAge2 - myAge2 > 60) {
      signals.push({
        id: 'sum-age2-ahead',
        severity: 'good',
        title: `You aged up first (${fmtTime(myAge2)} vs their ${fmtTime(enemyAge2)})`,
        detail: 'Use that window — an age lead is only worth what you do with it.',
      })
    }
  }

  // --- Villager high: the size of the engine, vs theirs. ---
  const myVills = me.totals?.villagerHigh ?? null
  const enemyVills = is1v1 ? (enemy?.totals?.villagerHigh ?? null) : null
  if (myVills != null && enemyVills != null && enemyVills > 0) {
    if (myVills < enemyVills * 0.8) {
      signals.push({
        id: 'sum-vills-behind',
        severity: 'minor',
        title: `Out-boomed (${myVills} vs their ${enemyVills} villagers)`,
        detail:
          'They peaked with a much bigger workforce. Most games want villager production non-stop until at least 60-80 supply of economy.',
      })
    }
  }

  // --- Army peak: how big your force ever got, vs theirs. ---
  const myArmy = me.totals?.largestArmy ?? null
  const enemyArmy = is1v1 ? (enemy?.totals?.largestArmy ?? null) : null
  if (myArmy != null && enemyArmy != null && enemyArmy > 0 && myArmy < enemyArmy * 0.7) {
    signals.push({
      id: 'sum-army-peak',
      severity: 'minor',
      title: `Their army peaked far bigger (${enemyArmy} vs your ${myArmy})`,
      detail:
        'A bigger peak army wins the decisive fight. That comes from production buildings working AND not feeding units away before the fight.',
    })
  }

  // --- Relics: passive gold the enemy took uncontested. ---
  const myRelics = me.totals?.relicsCaptured ?? null
  const enemyRelics = is1v1 ? (enemy?.totals?.relicsCaptured ?? null) : null
  if (myRelics != null && enemyRelics != null && enemyRelics >= 2 && myRelics === 0) {
    signals.push({
      id: 'sum-relics',
      severity: 'info',
      title: `They took the relics (${enemyRelics} vs 0)`,
      detail:
        'Each relic pays 100 gold/min forever. Grab a monk when you hit Castle Age — even one contested relic denies them income.',
    })
  }

  return signals
}

function resourceSum(p: PlayerSummary): number {
  const r = p.totals!.resourcesGathered
  return r.food + r.wood + r.gold + r.stone
}
