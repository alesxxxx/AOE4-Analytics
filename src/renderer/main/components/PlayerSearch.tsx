import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@shared/components/ui/input'
import { useDebounce } from '@shared/hooks/useDebounce'
import { countryFlag, formatRankLevel, formatRating, rankColor, relativeTime } from '@shared/format'
import type { PlayerSearchHit } from '@ipc/contract'
import { usePlayerSearch } from '../queries/useProfile'

interface PlayerSearchProps {
  onSelect: (hit: PlayerSearchHit) => void
  placeholder?: string
  autoFocus?: boolean
}

/** Reusable debounced player-search box with a results dropdown. */
export function PlayerSearch({ onSelect, placeholder, autoFocus }: PlayerSearchProps) {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 350)
  const { data, isFetching } = usePlayerSearch(debounced)

  const hits = data?.ok ? data.data : []
  const error = data && !data.ok ? data.error.message : null
  const showResults = debounced.trim().length >= 3

  return (
    <div className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search a player by name…'}
          autoFocus={autoFocus}
          className="pl-9"
          spellCheck={false}
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
          {error && <div className="px-3 py-3 text-sm text-destructive">{error}</div>}
          {!error && hits.length === 0 && !isFetching && (
            <div className="px-3 py-3 text-sm text-muted-foreground">No players found.</div>
          )}
          {hits.map((hit) => (
            <button
              key={hit.profileId}
              type="button"
              onClick={() => onSelect(hit)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden>{countryFlag(hit.country)}</span>
                <span className="truncate font-medium">{hit.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <span style={{ color: rankColor(hit.rankLevel) }}>
                  {formatRankLevel(hit.rankLevel)}
                </span>
                <span className="tabular-nums">{formatRating(hit.rating)}</span>
                {hit.lastGameAt && (
                  <span className="hidden sm:inline">{relativeTime(hit.lastGameAt)}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
