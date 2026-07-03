/**
 * The live APM counter card. Positioning is handled by OverlayApp's placement
 * wrapper so Ctrl+I can move it independently.
 */
export function ApmWidget({ apm }: { apm: number }) {
  return (
    <div
      className="pointer-events-none select-none"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
    >
      <div className="flex items-baseline gap-1.5 rounded-lg bg-gradient-to-br from-[#0a0e1aF2] to-[#0a0e1a99] px-3 py-1.5 shadow-xl ring-1 ring-white/10">
        <span className="text-2xl font-black tabular-nums text-primary">{apm}</span>
        <span className="text-[10px] font-semibold uppercase text-white/55">APM</span>
      </div>
    </div>
  )
}
