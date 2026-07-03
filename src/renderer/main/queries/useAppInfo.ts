import { useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

export interface AppInfo {
  version: string
  platform: string
  connected: boolean
}

/**
 * Demonstrates the renderer → IPC → main round-trip (and the TanStack Query
 * setup) by fetching app metadata over the typed bridge.
 */
export function useAppInfo() {
  return useQuery<AppInfo>({
    queryKey: ['app-info'],
    queryFn: async () => {
      const [version, platform, pong] = await Promise.all([
        ipc.getVersion(),
        ipc.getPlatform(),
        ipc.ping(),
      ])
      return { version, platform, connected: pong === 'pong' }
    },
    staleTime: Infinity,
  })
}
