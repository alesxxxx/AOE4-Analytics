import { rankColor, rankTier } from '@shared/format'

/**
 * A small heraldic crest tinted by rank tier (bronze → conqueror). Gives the
 * ladder its marquee signal an emblem instead of a plain text pill, the way
 * op.gg / aoe4world surface rank.
 */
export function RankCrest({
  rankLevel,
  size = 26,
}: {
  rankLevel: string | null | undefined
  size?: number
}) {
  const color = rankColor(rankLevel)
  const id = `rc-${rankTier(rankLevel)}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* shield */}
      <path
        d="M12 1.5l8 3v6.2c0 5.5-5.4 9.2-8 10.3-2.6-1.1-8-4.8-8-10.3V4.5l8-3z"
        fill={`url(#${id})`}
        stroke={color}
        strokeOpacity="0.9"
        strokeWidth="0.9"
      />
      {/* star */}
      <path
        d="M12 6.1l1.7 3.5 3.8.5-2.8 2.7.7 3.8L12 14.9l-3.4 1.7.7-3.8-2.8-2.7 3.8-.5z"
        fill="#fff"
        fillOpacity="0.9"
      />
    </svg>
  )
}
