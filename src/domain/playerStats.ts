/**
 * Personal performance breakdowns (pure) — the DPM "profile / Data Studio for
 * your own games": win rate sliced by civ, opponent civ, map, team format, game
 * length, and time of day, plus longest streaks and a recent-form rollup. All
 * computed from data History already stores; no API or local-file access.
 */

/** Minimal per-game shape these stats need (mapped from StoredMatch). */
export interface StatGame {
  result: 'win' | 'loss' | null
  civ: string
  oppCiv: string | null
  map: string
  durationSec: number | null
  ratingDiff: number | null
  format?: string
  /** ISO timestamp of when the game was played. */
  playedAt: string
}

/** One sliced bucket of games with its win rate. */
export interface Breakdown {
  /** Raw grouping key (civ slug, map name, format label, bucket id). */
  key: string
  /** Display label. */
  label: string
  games: number
  wins: number
  losses: number
  /** Win rate (%) over decided games, or null when none were decided. */
  winRate: number | null
}

export interface RecentRollup {
  games: number
  wins: number
  losses: number
  /** Total hours played in the window (from game durations). */
  hours: number
}

export interface PlayerStats {
  totalGames: number
  decided: number
  wins: number
  losses: number
  winRate: number | null
  longestWinStreak: number
  longestLossStreak: number
  byCiv: Breakdown[]
  byOppCiv: Breakdown[]
  byMap: Breakdown[]
  byFormat: Breakdown[]
  byGameLength: Breakdown[]
  byTimeOfDay: Breakdown[]
  recent2w: RecentRollup
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Win rate as a rounded percentage, or null when no games were decided. */
export function winRate(wins: number, decided: number): number | null {
  return decided > 0 ? Math.round((wins / decided) * 100) : null
}

/** Coarse part-of-day from a local hour (0–23). */
export function partOfDay(hour: number): { key: string; label: string } {
  if (hour >= 5 && hour < 12) return { key: 'morning', label: 'Morning (5–12)' }
  if (hour >= 12 && hour < 17) return { key: 'afternoon', label: 'Afternoon (12–17)' }
  if (hour >= 17 && hour < 22) return { key: 'evening', label: 'Evening (17–22)' }
  return { key: 'night', label: 'Night (22–5)' }
}

/** Game-length bucket from a duration in seconds. */
function lengthBucket(durationSec: number): { key: string; label: string; order: number } {
  const min = durationSec / 60
  if (min < 10) return { key: 'len0', label: 'Under 10 min', order: 0 }
  if (min < 20) return { key: 'len10', label: '10–20 min', order: 1 }
  if (min < 30) return { key: 'len20', label: '20–30 min', order: 2 }
  if (min < 40) return { key: 'len30', label: '30–40 min', order: 3 }
  return { key: 'len40', label: '40+ min', order: 4 }
}

interface Acc {
  key: string
  label: string
  games: number
  wins: number
  losses: number
}

function tally(map: Map<string, Acc>, key: string, label: string, result: StatGame['result']) {
  let acc = map.get(key)
  if (!acc) {
    acc = { key, label, games: 0, wins: 0, losses: 0 }
    map.set(key, acc)
  }
  acc.games++
  if (result === 'win') acc.wins++
  else if (result === 'loss') acc.losses++
}

function finalize(map: Map<string, Acc>): Breakdown[] {
  return [...map.values()].map((a) => ({
    key: a.key,
    label: a.label,
    games: a.games,
    wins: a.wins,
    losses: a.losses,
    winRate: winRate(a.wins, a.wins + a.losses),
  }))
}

/** Sort breakdowns by games played (desc), then win rate (desc), then label. */
function byGamesDesc(a: Breakdown, b: Breakdown): number {
  if (b.games !== a.games) return b.games - a.games
  if ((b.winRate ?? -1) !== (a.winRate ?? -1)) return (b.winRate ?? -1) - (a.winRate ?? -1)
  return a.label.localeCompare(b.label)
}

/** Display label for a civ slug — kept local so this module stays dependency-light. */
function defaultCivLabel(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export interface PlayerStatsOptions {
  /** Current time (ms) for the recent-form window. Defaults to now. */
  now?: number
  /** Recent-form window length in days. */
  recentDays?: number
  /** Civ slug → display name (inject civDisplayName from the renderer). */
  civLabel?: (slug: string) => string
}

/**
 * @param games newest-first (as History returns them).
 */
export function computePlayerStats(games: StatGame[], opts: PlayerStatsOptions = {}): PlayerStats {
  const now = opts.now ?? Date.now()
  const recentDays = opts.recentDays ?? 14
  const civLabel = opts.civLabel ?? defaultCivLabel

  const decidedGames = games.filter((g) => g.result === 'win' || g.result === 'loss')
  const wins = decidedGames.filter((g) => g.result === 'win').length
  const losses = decidedGames.length - wins

  // Longest streaks over the full history, walked oldest → newest.
  let longestWin = 0
  let longestLoss = 0
  let runWin = 0
  let runLoss = 0
  for (let i = games.length - 1; i >= 0; i--) {
    const r = games[i]!.result
    if (r === 'win') {
      runWin++
      runLoss = 0
      if (runWin > longestWin) longestWin = runWin
    } else if (r === 'loss') {
      runLoss++
      runWin = 0
      if (runLoss > longestLoss) longestLoss = runLoss
    }
  }

  const civ = new Map<string, Acc>()
  const oppCiv = new Map<string, Acc>()
  const map = new Map<string, Acc>()
  const format = new Map<string, Acc>()
  const length = new Map<string, Acc>()
  const timeOfDay = new Map<string, Acc>()

  const lengthOrder = new Map<string, number>()
  const recent: RecentRollup = { games: 0, wins: 0, losses: 0, hours: 0 }
  const cutoff = now - recentDays * DAY_MS

  for (const g of games) {
    tally(civ, g.civ, civLabel(g.civ), g.result)
    if (g.oppCiv) tally(oppCiv, g.oppCiv, civLabel(g.oppCiv), g.result)
    if (g.map) tally(map, g.map, g.map, g.result)
    if (g.format) tally(format, g.format, g.format, g.result)
    if (g.durationSec != null) {
      const b = lengthBucket(g.durationSec)
      lengthOrder.set(b.key, b.order)
      tally(length, b.key, b.label, g.result)
    }
    const ts = Date.parse(g.playedAt)
    if (!Number.isNaN(ts)) {
      const p = partOfDay(new Date(ts).getHours())
      tally(timeOfDay, p.key, p.label, g.result)
      if (ts >= cutoff) {
        recent.games++
        if (g.result === 'win') recent.wins++
        else if (g.result === 'loss') recent.losses++
        if (g.durationSec != null) recent.hours += g.durationSec / 3600
      }
    }
  }

  recent.hours = Math.round(recent.hours * 10) / 10

  const byGameLength = finalize(length).sort(
    (a, b) => (lengthOrder.get(a.key) ?? 0) - (lengthOrder.get(b.key) ?? 0),
  )
  const todOrder = ['morning', 'afternoon', 'evening', 'night']
  const byTimeOfDay = finalize(timeOfDay).sort(
    (a, b) => todOrder.indexOf(a.key) - todOrder.indexOf(b.key),
  )

  return {
    totalGames: games.length,
    decided: decidedGames.length,
    wins,
    losses,
    winRate: winRate(wins, decidedGames.length),
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    byCiv: finalize(civ).sort(byGamesDesc),
    byOppCiv: finalize(oppCiv).sort(byGamesDesc),
    byMap: finalize(map).sort(byGamesDesc),
    byFormat: finalize(format).sort(byGamesDesc),
    byGameLength,
    byTimeOfDay,
    recent2w: recent,
  }
}
