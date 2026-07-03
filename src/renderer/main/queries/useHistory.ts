import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

export function useHistory() {
  return useQuery({ queryKey: ['history'], queryFn: () => ipc.getHistory(100), staleTime: 60_000 })
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history'] }),
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
