import { useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

export function useCivDetailStats(civ: string) {
  return useQuery({
    queryKey: ['civDetailStats', civ],
    queryFn: () => ipc.getCivDetailStats(civ),
    staleTime: 6 * 60 * 60_000,
    enabled: civ.length > 0,
  })
}
