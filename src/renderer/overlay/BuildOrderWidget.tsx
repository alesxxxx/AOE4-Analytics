// DORMANT (D55): unimported since the overlay redesign — kept as the pattern
// base for the planned overlay micro-coach; do not delete without reading D55.
import { useState } from 'react'
import type { BuildOrder } from '@domain/buildOrderSchema'
import { parseNote } from '@domain/buildOrderSchema'
import { formatDuration } from '@domain/format'
import { AGE_ROMAN, RES_GLYPH, TIME_GLYPH, noteTokenGlyph } from './resourceGlyphs'
import { extractBuildTargets, type BuildTarget } from './buildIcons'

/** A resource entry on the villager-split line: glyph + value, hidden when negative. */
function Res({ glyph, value }: { glyph: string; value: number | undefined }) {
  if (value == null || value < 0) return null
  return (
    <span className="whitespace-nowrap">
      {glyph} {value}
    </span>
  )
}

/** A building/unit thumbnail from the CDN, falling back to its name if the image fails. */
function BuildIcon({ target, size = 30 }: { target: BuildTarget; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <span
        title={target.label}
        className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/85"
      >
        {target.label}
      </span>
    )
  }
  return (
    <img
      src={target.url}
      alt={target.label}
      title={target.label}
      onError={() => setBroken(true)}
      className="rounded bg-black/40 ring-1 ring-white/10"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

function renderNote(note: string) {
  return parseNote(note).map((part, i) =>
    part.type === 'text' ? (
      <span key={i}>{part.text}</span>
    ) : (
      <span key={i}>
        {noteTokenGlyph(part.path) ??
          part.path
            .split('/')
            .pop()
            ?.replace(/\.\w+$/, '')}
      </span>
    ),
  )
}

/** First sentence of a note, trimmed — used for the dim "next" preview. */
function firstClause(s: string | undefined): string {
  if (!s) return ''
  const t = s.split(/[.!]/)[0] ?? s
  return t.length > 44 ? `${t.slice(0, 42).trimEnd()}…` : t
}

/**
 * The build-order centerpiece of the overlay. Shows the build ONE STEP AT A TIME
 * (current + a dim "next" preview) image-first — the buildings/units to make as
 * thumbnails with a single key instruction — instead of dumping the whole list
 * as prose. The build clock auto-advances the step (works in custom games too).
 */
export function BuildOrderWidget({
  bo,
  stepIndex,
  elapsedSec,
  auto,
  noBuildCiv,
}: {
  bo: BuildOrder
  stepIndex: number
  elapsedSec: number | null
  auto: boolean
  /** Player's civ name when no bundled build matches it — the shown build is a reference. */
  noBuildCiv?: string | null
}) {
  const step = bo.build_order[stepIndex]
  const next = bo.build_order[stepIndex + 1]
  const r = step?.resources
  const targets = extractBuildTargets(step?.notes)
  const nextTargets = extractBuildTargets(next?.notes, 3)

  return (
    <div className="flex h-full flex-col justify-center px-2.5 py-1 text-white">
      {/* header */}
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        <span className="max-w-[180px] truncate font-medium text-white/80">{bo.name}</span>
        {elapsedSec != null && (
          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-cyan-300">
            {formatDuration(elapsedSec)}
          </span>
        )}
        {step && AGE_ROMAN[step.age] && (
          <span className="rounded bg-white/10 px-1 text-[10px]">{AGE_ROMAN[step.age]}</span>
        )}
        <span className="ml-auto tabular-nums">
          {stepIndex + 1}/{bo.build_order.length}
        </span>
        <span className={auto ? 'text-win' : 'text-warn'}>{auto ? 'auto' : 'manual'}</span>
      </div>

      {noBuildCiv && (
        <div className="mt-0.5 inline-block w-fit rounded bg-warn/10 px-1.5 py-0.5 text-[10px] text-warn/90">
          reference build — no bundled build for {noBuildCiv}
        </div>
      )}

      {step && (
        <div className="mt-0.5 rounded-md bg-[#0b1530] px-2 py-1 ring-1 ring-cyan-500/25">
          {/* hero: what to build (images) + villager split */}
          <div className="flex items-center gap-2">
            {targets.length > 0 && (
              <div className="flex items-center gap-1.5">
                {targets.map((t) => (
                  <BuildIcon key={t.url} target={t} />
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2 text-[12px] tabular-nums text-white/85">
              <Res glyph={RES_GLYPH.food} value={r?.food} />
              <Res glyph={RES_GLYPH.wood} value={r?.wood} />
              <Res glyph={RES_GLYPH.gold} value={r?.gold} />
              <Res glyph={RES_GLYPH.stone} value={r?.stone} />
              <Res glyph={RES_GLYPH.villager} value={step.villager_count} />
              {step.time && (
                <span className="whitespace-nowrap text-white/45">
                  {TIME_GLYPH} {step.time}
                </span>
              )}
            </div>
          </div>

          {/* the single key instruction for this step */}
          {step.notes[0] && (
            <div className="mt-1 flex items-center gap-[5px] text-sm font-medium leading-snug">
              {renderNote(step.notes[0])}
            </div>
          )}
        </div>
      )}

      {/* dim "next" preview — keeps you one step ahead without the full list */}
      {next && (
        <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-white/45">
          <span className="uppercase tracking-wide">next</span>
          {nextTargets.length > 0 ? (
            nextTargets.map((t) => <BuildIcon key={t.url} target={t} size={18} />)
          ) : (
            <span className="truncate">{firstClause(next.notes[0])}</span>
          )}
        </div>
      )}
    </div>
  )
}