import type { PostGameSummary } from '@ipc/contract'
import { civDisplayName } from '@domain/civ'
import { formatDuration } from '@domain/format'
import { cn } from '@shared/lib/utils'
import { CivFlag } from './CivFlag'

/**
 * The post-game results card the overlay pops up after a match: VICTORY / DEFEAT,
 * the matchup, economy grade + APM, and two short coaching columns (what went well
 * vs what to work on) derived from the same analysis the dashboard uses.
 */
export function PostGameCard({ summary }: { summary: PostGameSummary }) {
  const win = summary.result === 'win'
  const loss = summary.result === 'loss'
  const title = win ? 'VICTORY' : loss ? 'DEFEAT' : 'GAME OVER'
  const titleColor = win ? 'hsl(var(--win))' : loss ? 'hsl(var(--loss))' : 'rgba(255,255,255,0.92)'

  return (
    <div className="pointer-events-none select-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}>
      <div className="w-[460px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#0a0e1aF7] to-[#0a0e1aED] shadow-2xl ring-1 ring-white/10">
        <div className="flex flex-col items-center gap-1.5 px-5 pb-3 pt-4">
          <span className="text-3xl font-black tracking-[0.08em]" style={{ color: titleColor }}>
            {title}
          </span>
          <div className="flex items-center gap-2 text-[13px] text-white/90">
            <CivFlag civ={summary.civ} compact />
            <span className="font-semibold">
              {summary.civ ? civDisplayName(summary.civ) : 'You'}
            </span>
            <span className="text-white/40">vs</span>
            <span className="font-semibold">
              {summary.oppCiv ? civDisplayName(summary.oppCiv) : 'Opponent'}
            </span>
            <CivFlag civ={summary.oppCiv} compact />
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[12px] text-white/65">
            {summary.map && <span>{summary.map}</span>}
            {summary.durationSec != null && (
              <span className="tabular-nums">{formatDuration(summary.durationSec)}</span>
            )}
            {summary.grade && (
              <span>
                Grade <span className="font-bold text-white">{summary.grade}</span>
              </span>
            )}
            {summary.apm != null && <span className="tabular-nums">{summary.apm} APM</span>}
            {summary.vsAI && <span className="text-white/40">vs AI</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10">
          <Column title="What went well" tone="win" items={summary.didWell} empty="—" />
          <Column title="Work on next game" tone="warn" items={summary.improve} empty="Clean game!" />
        </div>
      </div>
    </div>
  )
}

function Column({
  title,
  tone,
  items,
  empty,
}: {
  title: string
  tone: 'win' | 'warn'
  items: string[]
  empty: string
}) {
  const accent = tone === 'win' ? 'text-win' : 'text-warn'
  return (
    <div className="bg-[#0a0e1a] px-4 py-3">
      <div className={cn('mb-1.5 text-[11px] font-semibold uppercase tracking-wide', accent)}>
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1 text-[12px] leading-snug text-white/85">
          {items.map((t, i) => (
            <li key={i} className="flex gap-1.5">
              <span className={accent}>{tone === 'win' ? '✓' : '➤'}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-white/40">{empty}</p>
      )}
    </div>
  )
}
