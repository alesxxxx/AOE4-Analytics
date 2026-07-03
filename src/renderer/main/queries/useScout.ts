import { useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

export function useScout(profileId: number | null) {
  return useQuery({
    queryKey: ['scout', profileId],
    queryFn: () => ipc.scoutPlayer(profileId as number),
    enabled: profileId != null,
    staleTime: 60_000,
  })
}
