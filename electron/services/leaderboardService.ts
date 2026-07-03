import type { IpcResult, LeaderboardPage, LeaderboardQuery } from '@ipc/contract'
import { buildLeaderboardRows } from '@domain/leaderboard'
import { getClient, getSettings } from './appContext'
import { errFrom, ok } from './result'

/**
 * Fetches a leaderboard page (optionally country-filtered), marks the current
 * user's row, and resolves the user's own rank for the ladder (best-effort) so
 * the page can show "you're #N" even when off the visible page.
 */
export async function getLeaderboardPage(
  query: LeaderboardQuery,
): Promise<IpcResult<LeaderboardPage>> {
  try {
    const profileId = getSettings().getAll().profileId
    const resp = await getClient().getLeaderboard(query.leaderboard, {
      page: query.page,
      country: query.country,
    })
    const rows = buildLeaderboardRows(resp, profileId)

    let you: LeaderboardPage['you'] = null
    if (profileId != null) {
      try {
        const player = await getClient().getPlayer(profileId)
        const mode = player.modes[query.leaderboard]
        if (mode?.rank != null) {
          you = {
            rank: mode.rank,
            rating: mode.rating ?? null,
            winRate: mode.win_rate ?? null,
            games: mode.games_count ?? 0,
          }
        }
      } catch {
        // best-effort — the page still renders without the "you" banner
      }
    }

    return ok({
      rows,
      page: resp.page ?? query.page ?? 1,
      perPage: resp.per_page ?? 50,
      totalCount: resp.total_count,
      leaderboard: query.leaderboard,
      you,
    })
  } catch (e) {
    return errFrom(e)
  }
}
