import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

export function useLocalDataStatus() {
  return useQuery({
    queryKey: ['localDataStatus'],
    queryFn: () => ipc.getLocalDataStatus(),
    staleTime: 30_000,
  })
}

export function useInvalidateLocalData() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['localDataStatus'] })
}
