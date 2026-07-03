import type { Tier } from '@domain/tierList'

const TIER_VAR: Record<Tier, string> = {
  S: '--tier-s',
  A: '--tier-a',
  B: '--tier-b',
  C: '--tier-c',
  D: '--tier-d',
  Z: '--tier-z',
}

const SIZES = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-11 w-11 text-xl',
} as const

/**
 * A flat, plate-like tier marker (S→D): tinted field, hairline border, the tier
 * letter in the display serif — reads like a rank stamp, not a glowing pill.
 */
export function TierBadge({ tier, size = 'md' }: { tier: Tier; size?: keyof typeof SIZES }) {
  const c = `var(${TIER_VAR[tier]})`
  return (
    <span
      className={`inline-flex ${SIZES[size]} items-center justify-center rounded-sm border font-display font-bold`}
      style={{
        background: `hsl(${c} / 0.14)`,
        borderColor: `hsl(${c} / 0.45)`,
        color: `hsl(${c})`,
      }}
    >
      {tier}
    </span>
  )
}
