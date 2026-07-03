import { useMutation, useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

/** Polls the fused live-match state (process + AoE4World + local logs). */
export function useLiveMatch() {
  return useQuery({
    queryKey: ['liveMatch'],
    queryFn: () => ipc.getLiveMatch(),
    refetchInterval: 8000,
    staleTime: 0,
  })
}

export function useLaunchGame() {
  return useMutation({ mutationFn: () => ipc.launchGame() })
}
