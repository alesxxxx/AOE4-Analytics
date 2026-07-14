import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'
import type { AppSettings, AppSettingsPatch } from '@store/settings'

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => ipc.getSettings(), staleTime: Infinity })
}

/** Invalidate everything that's scoped to the active account after a switch. */
function refetchForAccount(qc: ReturnType<typeof useQueryClient>, settings: AppSettings) {
  qc.setQueryData(['settings'], settings)
  // The active account changed — every account-scoped query must refetch.
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['history'] })
  qc.invalidateQueries({ queryKey: ['liveMatch'] })
  qc.invalidateQueries({ queryKey: ['latestReplay'] })
  qc.invalidateQueries({ queryKey: ['scoutHistory'] })
}

/** Adds an account (if new) and makes it active. */
export function useSetProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, name }: { profileId: number; name: string }) =>
      ipc.setCurrentProfile(profileId, name),
    onSuccess: (settings) => refetchForAccount(qc, settings),
  })
}

/** Switches the active account to an already-linked one. */
export function useSetActiveAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: number) => ipc.setActiveProfile(profileId),
    onSuccess: (settings) => refetchForAccount(qc, settings),
  })
}

/** Unlinks an account. */
export function useRemoveAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: number) => ipc.removeAccount(profileId),
    onSuccess: (settings) => refetchForAccount(qc, settings),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: AppSettingsPatch) => ipc.updateSettings(patch),
    onSuccess: (settings) => qc.setQueryData(['settings'], settings),
  })
}

export function useDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => ipc.getDashboard(),
    enabled,
    staleTime: 60_000,
  })
}

/**
 * The active account's Steam avatar as a data URL. Resolves the SteamID64 from
 * the pinned Settings id, falling back to the AoE4World profile's linked id.
 */
export function useSteamAvatar() {
  const { data: settings } = useSettings()
  const needsDashboardFallback = settings?.profileId != null && settings.steamId == null
  const { data: dash } = useDashboard(needsDashboardFallback)
  const fallbackSteamId =
    dash?.ok && dash.data.profileId === settings?.profileId ? dash.data.steamId : null
  const steamId = settings?.steamId ?? fallbackSteamId
  return useQuery({
    queryKey: ['steamAvatar', steamId],
    queryFn: () => ipc.getSteamAvatar(steamId!),
    enabled: steamId != null,
    staleTime: Infinity,
  })
}

export function usePlayerSearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => ipc.searchPlayers(q),
    enabled: q.length >= 3,
    staleTime: 5 * 60_000,
  })
}

/** Public recent matches plus head-to-head scoped to the active account. */
export function useScoutHistory(profileId: number | null) {
  const settings = useSettings()
  const activeProfileId = settings.data?.profileId ?? null
  return useQuery({
    queryKey: ['scoutHistory', profileId, activeProfileId],
    queryFn: () => ipc.getScoutHistory(profileId as number),
    enabled: profileId != null && settings.isSuccess,
    staleTime: 5 * 60_000,
  })
}
