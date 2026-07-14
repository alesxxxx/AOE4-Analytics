import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'
import { historyQueryKey, type HistoryQueryScope } from './historyQueryKey'
import { useSettings } from './useProfile'

function useAccountHistory(scope: HistoryQueryScope, limit?: number) {
  const settings = useSettings()
  const profileId = settings.data?.profileId ?? null
  return useQuery({
    queryKey: historyQueryKey(profileId, scope),
    queryFn: () => (limit == null ? ipc.getHistory() : ipc.getHistory(limit)),
    enabled: settings.isSuccess,
    staleTime: 60_000,
  })
}

/** Recent sample used by dashboard and overview screens. */
export function useHistory() {
  return useAccountHistory('recent-100', 100)
}

/** Complete visible local history used by filterable personal analytics. */
export function useFullHistory() {
  return useAccountHistory('all')
}

/** The full stat summary (build order + economy/score) for a game, or null. */
export function useGameSummary(matchId: string | undefined) {
  return useQuery({
    queryKey: ['gameSummary', matchId],
    queryFn: () => ipc.getGameSummary(matchId!),
    enabled: !!matchId,
    // A summary that EXISTS never changes — cache it for the session. But a
    // null result may just mean the upload hasn't landed yet (players upload
    // summaries minutes after a game) — retry on the next visit instead of
    // pinning "no data" until an app restart.
    staleTime: (query) => (query.state.data?.ok && query.state.data.data ? Infinity : 30_000),
  })
}

export function useAnalyzeRecent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (count?: number) => ipc.analyzeRecentGames(count),
    // New games move the dashboard's ladder numbers too, not just the list.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['history'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  })
}

/** Permanently removes one game from history (e.g. a desynced match). */
export function useDeleteMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchId: string) => ipc.deleteMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history'] }),
  })
}
