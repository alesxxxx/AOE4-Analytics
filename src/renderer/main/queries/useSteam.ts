import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'

/**
 * Steam connection state for ranked economy. While a QR login is pending
 * (`connecting`), poll briefly so the card flips to "connected" on approval.
 */
export function useSteamAuthStatus() {
  return useQuery({
    queryKey: ['steamAuth'],
    queryFn: () => ipc.getSteamAuthStatus(),
    refetchInterval: (query) => (query.state.data?.connecting ? 2000 : false),
    staleTime: 0,
  })
}

export function useSteamStartLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => ipc.steamStartLogin(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steamAuth'] }),
  })
}

export function useSteamStartCredentialsLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountName, password }: { accountName: string; password: string }) =>
      ipc.steamStartCredentialsLogin(accountName, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steamAuth'] }),
  })
}

export function useSteamSubmitSteamGuardCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => ipc.steamSubmitSteamGuardCode(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steamAuth'] }),
  })
}

export function useSteamLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => ipc.steamLogout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steamAuth'] }),
  })
}
