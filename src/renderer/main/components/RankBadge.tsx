import type { RankInfo } from '@domain/types'
import { formatRankLevel, rankColor, formatRating } from '@shared/format'
import { RankCrest } from './RankCrest'

/** Shows a rank crest, the rank level, and the rating number. */
export function RankBadge({ rank }: { rank: RankInfo | null }) {
  if (!rank) {
    return (
      <span className="inline-flex items-center gap-2">
        <RankCrest rankLevel={null} size={24} />
        <span className="text-xs font-medium text-muted-foreground">Unranked</span>
      </span>
    )
  }
  const color = rankColor(rank.rankLevel)
  return (
    <span className="inline-flex items-center gap-2">
      <RankCrest rankLevel={rank.rankLevel} size={26} />
      <span className="text-xs font-semibold" style={{ color }}>
        {formatRankLevel(rank.rankLevel)}
      </span>
      <span className="text-sm font-semibold tabular-nums">{formatRating(rank.rating)}</span>
    </span>
  )
}
