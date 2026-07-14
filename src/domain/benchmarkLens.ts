export const RECENT_BENCHMARK_WINDOW = 20
export const MIN_BENCHMARK_SAMPLES = 3

export type BenchmarkDimension = 'recent' | 'civ' | 'map' | 'format'

export interface BenchmarkGame {
  playedAt: string
  result: 'win' | 'loss' | null
  civ: string | null
  map: string | null
  format: string | null
  apm: number | null
  resourcesPerMinute: number | null
  villagersPerMinute: number | null
}

export type BenchmarkSelection =
  | { kind: 'recent' }
  | { kind: Exclude<BenchmarkDimension, 'recent'>; value: string; label?: string }

export interface BenchmarkOption {
  value: string
  games: number
}

export interface BenchmarkOptions {
  civ: BenchmarkOption[]
  map: BenchmarkOption[]
  format: BenchmarkOption[]
}

export type BenchmarkMetricKey = 'winRate' | 'apm' | 'resourcesPerMinute' | 'villagersPerMinute'

export interface BenchmarkMetricValue {
  value: number | null
  samples: number
}

export interface BenchmarkMetric {
  key: BenchmarkMetricKey
  label: string
  detail: string
  decimals: number
  left: BenchmarkMetricValue
  right: BenchmarkMetricValue
  /** Left cohort minus right cohort, in the metric's displayed unit. */
  delta: number | null
  comparable: boolean
}

export interface BenchmarkComparison {
  title: string
  leftLabel: string
  rightLabel: string
  leftGames: number
  rightGames: number
  metrics: BenchmarkMetric[]
}

type SegmentDimension = Exclude<BenchmarkDimension, 'recent'>

interface MetricDefinition {
  key: BenchmarkMetricKey
  label: string
  detail: string
  decimals: number
  value: (game: BenchmarkGame) => number | null
}

const METRICS: MetricDefinition[] = [
  {
    key: 'winRate',
    label: 'Win rate',
    detail: 'Resolved wins and losses only',
    decimals: 1,
    value: (game) => (game.result === 'win' ? 100 : game.result === 'loss' ? 0 : null),
  },
  {
    key: 'apm',
    label: 'APM',
    detail: 'Relic counter or local analysis when recorded',
    decimals: 1,
    value: (game) => positiveFinite(game.apm),
  },
  {
    key: 'resourcesPerMinute',
    label: 'Resources / min',
    detail: 'Gathered resources divided by game time',
    decimals: 0,
    value: (game) => positiveFinite(game.resourcesPerMinute),
  },
  {
    key: 'villagersPerMinute',
    label: 'Villagers / min',
    detail: 'Villagers produced divided by game time',
    decimals: 1,
    value: (game) => positiveFinite(game.villagersPerMinute),
  },
]

/** Values available for segment comparisons, sorted by games then name. */
export function benchmarkOptions(games: BenchmarkGame[]): BenchmarkOptions {
  return {
    civ: optionsFor(games, 'civ'),
    map: optionsFor(games, 'map'),
    format: optionsFor(games, 'format'),
  }
}

/**
 * Compare two non-overlapping cohorts from local history.
 *
 * Recent uses the newest 20 games and the 20 immediately before them. Segment
 * lenses compare the selected value with games that have another known value
 * for the same dimension. No global or rank population is inferred.
 */
export function computeBenchmarkLens(
  games: BenchmarkGame[],
  selection: BenchmarkSelection,
): BenchmarkComparison {
  const { left, right, title, leftLabel, rightLabel } = cohorts(games, selection)

  return {
    title,
    leftLabel,
    rightLabel,
    leftGames: left.length,
    rightGames: right.length,
    metrics: METRICS.map((definition) => metric(definition, left, right)),
  }
}

function cohorts(
  games: BenchmarkGame[],
  selection: BenchmarkSelection,
): {
  left: BenchmarkGame[]
  right: BenchmarkGame[]
  title: string
  leftLabel: string
  rightLabel: string
} {
  if (selection.kind === 'recent') {
    const sorted = [...games].sort((a, b) => timestamp(b.playedAt) - timestamp(a.playedAt))
    const left = sorted.slice(0, RECENT_BENCHMARK_WINDOW)
    const right = sorted.slice(RECENT_BENCHMARK_WINDOW, RECENT_BENCHMARK_WINDOW * 2)
    return {
      left,
      right,
      title: 'Recent form',
      leftLabel: `Recent ${left.length}`,
      rightLabel: `Previous ${right.length}`,
    }
  }

  const known = games.filter((game) => segmentValue(game, selection.kind) != null)
  const left = known.filter((game) => segmentValue(game, selection.kind) === selection.value)
  const right = known.filter((game) => segmentValue(game, selection.kind) !== selection.value)
  const otherLabel =
    selection.kind === 'civ'
      ? 'Other civs'
      : selection.kind === 'map'
        ? 'Other maps'
        : 'Other formats'

  return {
    left,
    right,
    title: `${dimensionLabel(selection.kind)} comparison`,
    leftLabel: selection.label ?? selection.value,
    rightLabel: otherLabel,
  }
}

function optionsFor(games: BenchmarkGame[], dimension: SegmentDimension): BenchmarkOption[] {
  const counts = new Map<string, number>()
  for (const game of games) {
    const value = segmentValue(game, dimension)
    if (value == null) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, games: count }))
    .sort((a, b) => b.games - a.games || a.value.localeCompare(b.value))
}

function segmentValue(game: BenchmarkGame, dimension: SegmentDimension): string | null {
  const raw = game[dimension]
  const value = raw?.trim()
  return value ? value : null
}

function metric(
  definition: MetricDefinition,
  leftGames: BenchmarkGame[],
  rightGames: BenchmarkGame[],
): BenchmarkMetric {
  const left = summarize(leftGames, definition.value, definition.decimals)
  const right = summarize(rightGames, definition.value, definition.decimals)
  const comparable = left.samples >= MIN_BENCHMARK_SAMPLES && right.samples >= MIN_BENCHMARK_SAMPLES
  return {
    key: definition.key,
    label: definition.label,
    detail: definition.detail,
    decimals: definition.decimals,
    left,
    right,
    delta:
      left.value == null || right.value == null
        ? null
        : round(left.value - right.value, definition.decimals),
    comparable,
  }
}

function summarize(
  games: BenchmarkGame[],
  read: (game: BenchmarkGame) => number | null,
  decimals: number,
): BenchmarkMetricValue {
  const values = games.map(read).filter((value): value is number => value != null)
  if (values.length === 0) return { value: null, samples: 0 }
  return {
    value: round(values.reduce((sum, value) => sum + value, 0) / values.length, decimals),
    samples: values.length,
  }
}

function positiveFinite(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

function timestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function dimensionLabel(dimension: SegmentDimension): string {
  switch (dimension) {
    case 'civ':
      return 'Civilization'
    case 'map':
      return 'Map'
    case 'format':
      return 'Team format'
  }
}
