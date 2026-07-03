import { CIV_FLAGS } from '@data/vendor/aoe4world-overlay/flags'
import { civDisplayName } from '@domain/civ'
import { cn } from '@shared/lib/utils'

/**
 * A civilization flag for the matchup bar. Renders the vendored flag image with
 * the civ's brand-color outline; falls back to a 3-letter abbreviation chip when
 * a slug isn't vendored (e.g. a future civ) — never a wrong/placeholder flag.
 */
export function CivFlag({ civ, compact }: { civ: string | null; compact: boolean }) {
  const dims = compact ? 'h-5 w-9' : 'h-9 w-[60px]'
  const entry = civ ? CIV_FLAGS[civ] : undefined
  if (!entry) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-sm bg-white/10 font-bold uppercase text-white/70 outline outline-1 outline-black/40',
          dims,
          compact ? 'text-[8px]' : 'text-[10px]',
        )}
      >
        {civ ? civDisplayName(civ).slice(0, 3) : '—'}
      </span>
    )
  }
  return (
    <img
      src={entry.flag}
      alt={civ ? civDisplayName(civ) : 'civ'}
      style={{ outlineColor: entry.color }}
      className={cn('shrink-0 rounded-sm object-cover outline outline-1', dims)}
    />
  )
}
