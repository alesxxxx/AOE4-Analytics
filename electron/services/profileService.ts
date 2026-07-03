import type { DashboardData, IpcResult, PlayerSearchHit } from '@ipc/contract'
import { summarizeRecentForm } from '@domain/form'
import { pickPrimaryMode, ratedModes } from '@domain/scouting'
import { getClient, getSettings } from './appContext'
import { errFrom, err, ok } from './result'

/** Resolves a name query to a list of player hits for the onboarding/scout picker. */
export async function searchPlayers(query: string): Promise<IpcResult<PlayerSearchHit[]>> {
  const q = query.trim()
  if (q.length < 3) return ok([])
  try {
    const res = await getClient().searchPlayers(q)
    const hits: PlayerSearchHit[] = res.players.slice(0, 15).map((p) => {
      const primary = pickPrimaryMode(p.leaderboards)
      return {
        profileId: p.profile_id,
        name: p.name,
        country: p.country ?? null,
        rankLevel: primary?.rankLevel ?? null,
        rating: primary?.rating ?? null,
        lastGameAt: p.last_game_at ?? null,
      }
    })
    return ok(hits)
  } catch (e) {
    return errFrom(e)
  }
}

/** Builds the dashboard payload for the currently-saved profile. */
export async function getDashboard(): Promise<IpcResult<DashboardData>> {
  const settings = getSettings().getAll()
  if (settings.profileId == null) {
    return err('not_found', 'No profile set. Complete onboarding first.')
  }
  const profileId = settings.profileId
  try {
    const client = getClient()
    const [player, gamesRes] = await Promise.all([
      client.getPlayer(profileId),
      client.getPlayerGames(profileId, {
        leaderboard: settings.leaderboard,
        limit: settings.recentGamesCount,
      }),
    ])
    return ok({
      profileId: player.profile_id,
      name: player.name,
      country: player.country ?? null,
      steamId: player.steam_id ?? null,
      primary: pickPrimaryMode(player.modes),
      modes: ratedModes(player.modes),
      recentForm: summarizeRecentForm(gamesRes.games, profileId),
    })
  } catch (e) {
    return errFrom(e)
  }
}
