import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StoredMatch } from '@store/historyStore'

const ACCENT = 'hsl(190, 95%, 50%)'
const GRID = 'hsl(220, 16%, 17%)'
const MUTED = 'hsl(217, 12%, 58%)'

/** Rating over time, oldest → newest. */
export function RatingChart({ matches }: { matches: StoredMatch[] }) {
  const data = [...matches]
    .filter((m) => m.rating != null)
    .reverse()
    .map((m, i) => ({ i: i + 1, rating: m.rating as number, result: m.result }))

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Not enough rated games yet to chart a trend.
      </div>
    )
  }

  return (
    <div className="h-56 w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="i" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke={MUTED}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 25', 'dataMax + 25']}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(222, 26%, 8%)',
              border: `1px solid ${GRID}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: MUTED }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke={ACCENT}
            strokeWidth={2}
            dot={{ r: 2, fill: ACCENT }}
            activeDot={{ r: 4 }}
            // No tween on resize: Recharts animates old→new geometry, which
            // paints the line outside the plot area mid-transition.
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
