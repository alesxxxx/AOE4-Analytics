import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { PostGameSummary } from '@ipc/contract'
import { civDisplayName } from '@domain/civ'
import { formatDuration } from '@domain/format'
import { ipc } from '@shared/ipc'
import { cn } from '@shared/lib/utils'
import { CivFlag } from './CivFlag'
import { panelBg } from './panelBg'

/** Extra hit-slop around the ✕ so the click-through toggle isn't pixel-perfect twitchy. */
const CLOSE_HIT_PAD = 8

/**
 * The post-game results card the overlay pops up after a match: VICTORY / DEFEAT,
 * the matchup, economy grade + APM, and two short coaching columns (what went well
 * vs what to work on) derived from the same analysis the dashboard uses.
 *
 * With `onDismiss` set it renders a ✕ button. The locked overlay window is
 * click-through, so the main process forwards mouse moves while this card is up;
 * we hit-test the ✕ here and toggle real clicks on via `setOverlayInteractive`.
 */
export function PostGameCard({
  summary,
  onDismiss,
}: {
  summary: PostGameSummary
  onDismiss?: () => void
}) {
  const win = summary.result === 'win'
  const loss = summary.result === 'loss'
  const title = win ? 'VICTORY' : loss ? 'DEFEAT' : 'GAME OVER'
  const titleColor = win ? 'hsl(var(--win))' : loss ? 'hsl(var(--loss))' : 'rgba(255,255,255,0.92)'

  const closeRef = useRef<HTMLButtonElement>(null)
  const hoverRef = useRef(false)
  useEffect(() => {
    if (!onDismiss) return
    const report = (hover: boolean) => {
      if (hoverRef.current === hover) return
      hoverRef.current = hover
      void ipc.setOverlayInteractive(hover).catch(() => {})
    }
    // Forwarded (click-through) and real mouse moves both land here.
    const onMove = (e: MouseEvent) => {
      const r = closeRef.current?.getBoundingClientRect()
      report(
        !!r &&
          e.clientX >= r.left - CLOSE_HIT_PAD &&
          e.clientX <= r.right + CLOSE_HIT_PAD &&
          e.clientY >= r.top - CLOSE_HIT_PAD &&
          e.clientY <= r.bottom + CLOSE_HIT_PAD,
      )
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      report(false)
    }
  }, [onDismiss])

  return (
    <div
      className="pointer-events-none select-none"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
    >
      <div
        className="relative w-[460px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
        style={{ background: `linear-gradient(to bottom, ${panelBg(0.97)}, ${panelBg(0.93)})` }}
      >
        {onDismiss && (
          <button
            ref={closeRef}
            onClick={onDismiss}
            aria-label="Dismiss"
            className="pointer-events-auto absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
          <Column
            title="Work on next game"
            tone="warn"
            items={summary.improve}
            empty="Clean game!"
          />
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
    <div className="px-4 py-3" style={{ background: panelBg(1) }}>
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
