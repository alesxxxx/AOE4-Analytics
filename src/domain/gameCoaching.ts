/**
 * Comparison coaching (pure). Turns the per-player `counters` stats (WS1A) into
 * head-to-head improvement signals — "you traded poorly", "you were out-produced",
 * "fewer upgrades than the enemy" — the way AoE4World's post-game breakdown reads
 * a game back to you. Compares YOU against the enemy team's per-player average, so
 * it's fair in 1v1 and team games alike. No economy here (Relic leaves it 0); this
 * is production/combat/tech/APM only, available for every game with no auth.
 */
import type { PerPlayerMatchStats, Signal } from './analysis'

/** Mean of a numeric field across rows, ignoring nulls; null if none present. */
function avg(rows: PerPlayerMatchStats[], pick: (r: PerPlayerMatchStats) => number | null): number | null {
  const vals = rows.map(pick).filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/** The enemy rows: a different team from mine, or (if team ids are missing) anyone else. */
export function enemiesOf(
  perPlayer: PerPlayerMatchStats[],
  me: PerPlayerMatchStats,
): PerPlayerMatchStats[] {
  if (me.teamId != null && perPlayer.some((p) => p.teamId != null && p.teamId !== me.teamId)) {
    return perPlayer.filter((p) => p.teamId != null && p.teamId !== me.teamId)
  }
  return perPlayer.filter((p) => p.profileId !== me.profileId)
}

/**
 * Head-to-head coaching signals for the user (profile `myProfileId`) in a game,
 * from the per-player counters. Empty when the user isn't in the roster or there
 * are no opponents. Ordered most-actionable first by the caller's severity sort.
 */
export function comparisonSignals(
  perPlayer: PerPlayerMatchStats[] | undefined,
  myProfileId: number,
): Signal[] {
  if (!perPlayer || perPlayer.length === 0) return []
  const me = perPlayer.find((p) => p.profileId === myProfileId)
  if (!me) return []
  const enemies = enemiesOf(perPlayer, me)
  if (enemies.length === 0) return []

  const signals: Signal[] = []

  // --- Fights: your own K/D (self-contained, works in any format) ---
  if (me.kd != null) {
    if (me.kd < 0.7) {
      signals.push({
        id: 'cmp-kd-low',
        severity: 'major',
        title: `You traded poorly (K/D ${me.kd})`,
        detail:
          'You lost more army value than you killed. Fight on your terms — force good engagements, hold a concave, and retreat rather than feeding units piecemeal.',
      })
    } else if (me.kd >= 1.5) {
      signals.push({
        id: 'cmp-kd-high',
        severity: 'good',
        title: `You won your fights (K/D ${me.kd})`,
        detail: 'Strong trades — you got real value out of every engagement.',
      })
    }
  }

  // --- Production: units produced vs the enemy per-player average ---
  const enemyUnits = avg(enemies, (e) => e.unitsProduced)
  if (me.unitsProduced != null && enemyUnits != null && enemyUnits > 0) {
    const ratio = me.unitsProduced / enemyUnits
    if (ratio < 0.75) {
      signals.push({
        id: 'cmp-production-low',
        severity: 'minor',
        title: `Out-produced (${me.unitsProduced} vs ${Math.round(enemyUnits)} units)`,
        detail:
          'Your opponent built a bigger army. Keep every production building working and spend banked resources — idle production loses the unit count.',
      })
    } else if (ratio > 1.25) {
      signals.push({
        id: 'cmp-production-high',
        severity: 'good',
        title: `Strong production (${me.unitsProduced} vs ${Math.round(enemyUnits)} units)`,
        detail: 'You out-produced the enemy — your macro kept the army coming.',
      })
    }
  }

  // --- Tech: upgrades researched vs the enemy per-player average ---
  const enemyTechs = avg(enemies, (e) => e.techsResearched)
  if (me.techsResearched != null && enemyTechs != null && me.techsResearched < enemyTechs - 4) {
    signals.push({
      id: 'cmp-tech-low',
      severity: 'minor',
      title: `Fewer upgrades (${me.techsResearched} vs ${Math.round(enemyTechs)})`,
      detail:
        'The enemy out-teched you. Blacksmith attack/armour and economy upgrades compound — bank them in with your unit production, not instead of it.',
    })
  }

  return signals
}
