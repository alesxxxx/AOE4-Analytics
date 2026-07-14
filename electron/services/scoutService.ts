import type {
  HeadToHeadData,
  IpcResult,
  ScoutHistoryData,
  ScoutMatchPage,
  ScoutMatchRow,
} from '@ipc/contract'
import { normalizeTeams, type Game, type GamesResponse } from '@api/types'
import type { ScoutReport } from '@domain/types'
import { buildScoutReport } from '@domain/scouting'
import { buildScoutReportFromRelic } from '@domain/relic'
import { getClient, getRelicClient, getSettings } from './appContext'
import { err, errFrom, ok } from './result'

const RECENT_MATCH_LIMIT = 10
const HEAD_TO_HEAD_LIMIT = 20

function isProfileId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** Maps an API game without guessing when the requested player is missing. */
function matchRow(game: Game, perspectiveProfileId: number): ScoutMatchRow {
  const teams = normalizeTeams(game)
  const teamIndex = teams.findIndex((team) =>
    team.some((player) => player.profile_id === perspectiveProfileId),
  )
  const player =
    teamIndex >= 0
      ? teams[teamIndex]?.find((candidate) => candidate.profile_id === perspectiveProfileId)
      : undefined
  const opponents = teamIndex >= 0 ? teams.filter((_, index) => index !== teamIndex).flat() : []

  return {
    gameId: game.game_id,
    startedAt: game.started_at,
    durationSec: game.duration ?? null,
    map: game.map || null,
    format: game.leaderboard || game.kind || null,
    result: player?.result === 'win' || player?.result === 'loss' ? player.result : 'unknown',
    civilization: player?.civilization || null,
    opponentCivilizations: opponents
      .map((opponent) => opponent.civilization)
      .filter((civilization): civilization is string => Boolean(civilization)),
    opponentNames: opponents
      .map((opponent) => opponent.name)
      .filter((name): name is string => Boolean(name)),
  }
}

function matchPage(response: GamesResponse, perspectiveProfileId: number): ScoutMatchPage {
  const matches = response.games.map((game) => matchRow(game, perspectiveProfileId))
  const rawTotal = response.total_count
  return {
    matches,
    sampleSize: matches.length,
    totalCount:
      Number.isFinite(rawTotal) && rawTotal >= matches.length
        ? Math.floor(rawTotal)
        : matches.length,
  }
}

function headToHeadPage(response: GamesResponse, perspectiveProfileId: number): HeadToHeadData {
  const page = matchPage(response, perspectiveProfileId)
  const wins = page.matches.filter((match) => match.result === 'win').length
  const losses = page.matches.filter((match) => match.result === 'loss').length
  const decidedGames = wins + losses
  return {
    ...page,
    wins,
    losses,
    decidedGames,
    winRate: decidedGames > 0 ? (wins / decidedGames) * 100 : null,
  }
}

function settledMatchPage(
  result: PromiseSettledResult<GamesResponse>,
  perspectiveProfileId: number,
): IpcResult<ScoutMatchPage> {
  if (result.status === 'rejected') return errFrom(result.reason)
  try {
    return ok(matchPage(result.value, perspectiveProfileId))
  } catch {
    return err('api', 'AoE4World returned malformed match history data.')
  }
}

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

/**
 * Loads a bounded public-history sample for a viewed profile. If a different
 * active account exists, the second request is scoped with opponent_profile_id
 * so the head-to-head list is not inferred from unrelated local history.
 */
export async function getScoutHistory(profileId: unknown): Promise<IpcResult<ScoutHistoryData>> {
  if (!isProfileId(profileId)) {
    return err('validation', 'Player profile id must be a positive integer.')
  }

  // Capture identity before starting account-scoped IO. The renderer also keys
  // this query by the active profile so a switch cannot reuse another account's data.
  const settings = getSettings().getAll()
  const activeProfileId = isProfileId(settings.profileId) ? settings.profileId : null
  const shouldLoadHeadToHead = activeProfileId != null && activeProfileId !== profileId
  const client = getClient()

  const [recentResult, headToHeadResult] = await Promise.allSettled([
    client.getPlayerGames(profileId, { limit: RECENT_MATCH_LIMIT }),
    shouldLoadHeadToHead
      ? client.getPlayerGames(activeProfileId, {
          limit: HEAD_TO_HEAD_LIMIT,
          opponentProfileId: profileId,
        })
      : Promise.resolve(null),
  ])

  const recent = settledMatchPage(recentResult, profileId)

  let headToHead: IpcResult<HeadToHeadData> | null = null
  if (shouldLoadHeadToHead) {
    const currentProfileId = getSettings().getAll().profileId
    if (currentProfileId !== activeProfileId) {
      headToHead = err('validation', 'Active account changed while head-to-head loaded. Retry.')
    } else if (headToHeadResult.status === 'fulfilled' && headToHeadResult.value) {
      try {
        headToHead = ok(headToHeadPage(headToHeadResult.value, activeProfileId))
      } catch {
        headToHead = err('api', 'AoE4World returned malformed head-to-head data.')
      }
    } else if (headToHeadResult.status === 'rejected') {
      headToHead = errFrom(headToHeadResult.reason)
    } else {
      headToHead = err('unknown', 'Head-to-head data was unavailable.')
    }
  }

  return ok({
    viewedProfileId: profileId,
    activeProfile:
      activeProfileId == null
        ? null
        : { profileId: activeProfileId, name: settings.playerName ?? null },
    recent,
    headToHead,
  })
}
