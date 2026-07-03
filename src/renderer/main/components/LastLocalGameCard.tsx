import { Clapperboard, Swords } from 'lucide-react'
import { formatRankLevel, formatRating, rankColor, relativeTime } from '@shared/format'
import { teamFormat } from '@domain/gameFormat'
import { useLatestReplay } from '../queries/useLatestReplay'

/** Only surface a local replay as "your last game" if it's recent (~4h, per D49). */
const RECENT_MS = 4 * 60 * 60 * 1000

/**
 * DORMANT (not currently imported): no screen renders this as of 2026-07. Kept for
 * a possible dashboard "last local game" slot.
 *
 * Shows the most-recent CUSTOM / vs-AI game, read from your local replay file —
 * the games AoE4World can't track. Only renders for a RECENT replay (within
 * ~4h) so a days-old AI game doesn't dominate the dashboard; older custom/AI
 * games still live in History.
 */
export function LastLocalGameCard() {
  const { data } = useLatestReplay()
  if (!data || !data.me) return null
  if (Date.now() - data.recordedAtMs > RECENT_MS) return null

  const humanOpp = data.opponents.find((p) => !p.ai)
  const aiOpps = data.opponents.filter((p) => p.ai)
  const aiCivs = [...new Set(aiOpps.map((p) => p.civName))].join(', ')
  const all = [data.me, ...data.opponents]
  const format = teamFormat([all.filter((p) => !p.ai).length, all.filter((p) => p.ai).length])

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clapperboard className="h-3.5 w-3.5" />
        Last custom / AI game
        {format && <span className="font-normal">· {format}</span>}
        {data.mapName && <span className="font-normal">· {data.mapName}</span>}
        <span className="font-normal">
          · {relativeTime(new Date(data.recordedAtMs).toISOString())}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span>{data.me.civName}</span>
          <Swords className="h-4 w-4 text-muted-foreground" />
          {humanOpp ? (
            <span>{humanOpp.civName}</span>
          ) : (
            <span>{aiOpps.length > 1 ? `${aiOpps.length} AI` : 'AI'}</span>
          )}
        </div>
        {humanOpp ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">vs</span>
            <span className="font-medium">{data.opponent?.name ?? humanOpp.name}</span>
            {data.opponent && (
              <>
                <span style={{ color: rankColor(data.opponent.rankLevel) }}>
                  {formatRankLevel(data.opponent.rankLevel)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatRating(data.opponent.rating)}
                </span>
              </>
            )}
          </div>
        ) : (
          aiCivs && <div className="text-sm text-muted-foreground">vs AI · {aiCivs}</div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Your latest custom/AI game, read from its local replay. All your games are in History.
      </p>
    </div>
  )
}
