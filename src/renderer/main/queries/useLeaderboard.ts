import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ipc } from '@shared/ipc'
import type { LeaderboardQuery } from '@ipc/contract'

export function useLeaderboard(query: LeaderboardQuery) {
  return useQuery({
    queryKey: ['leaderboard', query.leaderboard, query.page ?? 1, query.country ?? 'all'],
    queryFn: () => ipc.getLeaderboard(query),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  })
}
