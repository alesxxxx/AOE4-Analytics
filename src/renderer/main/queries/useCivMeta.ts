import { useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'
import type { CivMetaQuery, MatchupLabQuery } from '@ipc/contract'

export function useCivMeta(query: CivMetaQuery) {
  return useQuery({
    queryKey: ['civMeta', query.leaderboard ?? 'rm_solo', query.rankLevel ?? 'all'],
    queryFn: () => ipc.getCivMeta(query),
    staleTime: 6 * 60 * 60_000,
  })
}

export function useMatchupLab(query: MatchupLabQuery) {
  return useQuery({
    queryKey: [
      'matchupLab',
      query.leaderboard ?? 'rm_solo',
      query.rankLevel ?? 'all',
      query.civilization,
      query.opponentCivilization,
    ],
    queryFn: () => ipc.getMatchupLab(query),
    staleTime: 6 * 60 * 60 * 1000,
  })
}
