import type { IpcResult } from '@ipc/contract'
import type { ScoutReport } from '@domain/types'
import { buildScoutReport } from '@domain/scouting'
import { buildScoutReportFromRelic } from '@domain/relic'
import { getClient, getRelicClient } from './appContext'
import { errFrom, ok } from './result'

/**
 * Assembles a ScoutReport, PREFERRING Relic's official API (real per-mode
 * rank/rating + recent form across ranked/QM/custom — what AoE4World's public
 * API filters out) and FALLING BACK to AoE4World on any Relic error (TLS,
 * network, non-zero result code). Same ScoutReport shape either way (D49).
 */
export async function scoutPlayer(profileId: number): Promise<IpcResult<ScoutReport>> {
  const relic = getRelicClient()
  // Run the two Relic calls independently: a recent-history hiccup must not wipe the
  // rank, nor a stats hiccup the recent form. (The old `Promise.all` discarded BOTH
  // on either failure and silently demoted to AoE4World — which has no data for
  // QM/custom-only players, producing a bogus "Unranked / no recent games" report.)
  const [statRes, histRes] = await Promise.allSettled([
    relic.getPersonalStat([profileId]),
    relic.getRecentMatchHistory(profileId),
  ])

  if (statRes.status === 'fulfilled' || histRes.status === 'fulfilled') {
    const personalStat =
      statRes.status === 'fulfilled'
        ? statRes.value
        : { result: { code: 0, message: '' }, statGroups: [], leaderboardStats: [] }
    const matches = histRes.status === 'fulfilled' ? histRes.value.matchHistoryStats : []
    const mapNames = relic.mapNamesFor(matches)
    return ok(buildScoutReportFromRelic({ personalStat, matches, profileId, mapNames }))
  }

  // Both Relic calls failed — log why (was silently swallowed), then try AoE4World
  // as a last resort (blind to QM/custom-only players, but better than nothing).
  console.warn(
    '[scout] Relic unavailable for',
    profileId,
    statRes.status === 'rejected' ? statRes.reason : '',
    histRes.status === 'rejected' ? histRes.reason : '',
  )
  try {
    const client = getClient()
    const [player, gamesRes] = await Promise.all([
      client.getPlayer(profileId),
      client.getPlayerGames(profileId, { limit: 20 }),
    ])
    return ok(buildScoutReport({ player, games: gamesRes.games }))
  } catch (e) {
    return errFrom(e)
  }
}
