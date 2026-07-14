export type HistoryQueryScope = 'recent-100' | 'all'

/** Keeps cached history isolated by active account and requested sample scope. */
export function historyQueryKey(profileId: number | null, scope: HistoryQueryScope = 'recent-100') {
  return ['history', profileId, scope] as const
}
