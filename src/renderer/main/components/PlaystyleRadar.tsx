import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { Sparkles } from 'lucide-react'
import type { PlaystyleProfile } from '@domain/playstyle'
import { cn } from '@shared/lib/utils'

const ACCENT = 'hsl(var(--primary))'
const GRID = 'hsl(var(--border))'
const MUTED = 'hsl(var(--muted-foreground))'

/** Mobalytics-style playstyle radar + auto tags. `showTags={false}` hides the
 *  tag chips when a parent surface (e.g. the profile identity card) owns them. */
export function PlaystyleRadar({
  profile,
  showTags = true,
}: {
  profile: PlaystyleProfile
  showTags?: boolean
}) {
  const data = profile.dimensions.map((d) => ({
    dim: d.label,
    value: d.hasData ? d.value : 0,
  }))
  // Split empty axes by WHY they're empty: some need your local game stats
  // (economy/APM), others just need a few games. Don't lump them together, and
  // don't promise economy "fills in automatically" — it needs recorded stats.
  const LOCAL_STAT_KEYS = new Set(['economy', 'multitask'])
  const noData = profile.dimensions.filter((d) => !d.hasData)
  const localGated = noData.filter((d) => LOCAL_STAT_KEYS.has(d.key))
  const sampleGated = noData.filter((d) => !LOCAL_STAT_KEYS.has(d.key))
  const join = (dims: typeof noData) => dims.map((d) => d.label).join(' & ')

  return (
    <section className="rts-menu-card space-y-3 rounded-md border p-4">
      <h3 className="flex items-center gap-1.5 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        Your playstyle
      </h3>

      <div className="grid items-center gap-4 md:grid-cols-2">
        <div className="h-56 w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke={GRID} />
              <PolarAngleAxis dataKey="dim" tick={{ fill: MUTED, fontSize: 11 }} />
              <Radar
                dataKey="value"
                stroke={ACCENT}
                fill={ACCENT}
                fillOpacity={0.25}
                strokeWidth={2}
                // No tween on resize: the polygon otherwise morphs outside the
                // pentagon while animating old→new coordinates.
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {showTags && (
            <div className="flex flex-wrap gap-1.5">
              {profile.tags.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Play more games to unlock playstyle tags.
                </span>
              ) : (
                profile.tags.map((t) => (
                  <span
                    key={t.label}
                    title={t.hint}
                    className={cn(
                      'cursor-help rounded-sm px-2 py-0.5 text-xs font-medium',
                      t.tone === 'pos'
                        ? 'bg-win/15 text-win'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {t.label}
                  </span>
                ))
              )}
            </div>
          )}

          <div className="space-y-2">
            {/* Axis meanings live in the title tooltip — the panel stays quiet. */}
            {profile.dimensions.map((d) => (
              <div
                key={d.key}
                title={d.hint}
                className={cn('space-y-1', !d.hasData && 'opacity-60')}
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium">{d.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {d.hasData ? d.value : '—'}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-secondary">
                  <div
                    className="h-full bg-primary/60"
                    style={{ width: `${d.hasData ? d.value : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(localGated.length > 0 || sampleGated.length > 0) && (
        <div className="space-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {localGated.length > 0 && (
            <p>
              {join(localGated)} come from your local game stats (villager/resource economy and
              APM) — they appear once the app has recorded a finished game&apos;s stats.
            </p>
          )}
          {sampleGated.length > 0 && <p>{join(sampleGated)} need at least 3 analysed games.</p>}
        </div>
      )}
    </section>
  )
}
