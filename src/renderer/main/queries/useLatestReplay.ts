import { useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

/** The most-recent local replay (custom/AI games included); null without consent. */
export function useLatestReplay(enabled = true) {
  return useQuery({
    queryKey: ['latestReplay'],
    queryFn: () => ipc.getLatestReplay(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
