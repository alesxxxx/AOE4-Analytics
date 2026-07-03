/**
 * Global per-landmark pick & win rates (pure), from AoE4World's ageup-analytics
 * dataset (Stats → Analytics, added ~Feb 2026). The response groups games by
 * their full age-up PATH (games ending in Feudal / Castle / Imperial are
 * separate subsets), so a single landmark's true record is the SUM across every
 * path subset that contains it — aggregating only one subset would count only
 * the games that ended in that age.
 *
 * The endpoint is flagged by AoE4World as internal/subject-to-change, so every
 * consumer treats it as best-effort enrichment: failures render nothing.
 */

/** One path row from the analytics response (only the fields we read). */
export interface AgeupPathRow {
  civilization: string | null
  player_games_count: number
  win_count: number | null
  win_rate: number | null
  age2_pbgid?: number | null
  age2_name?: string | null
  age2_finished_at_average?: number | null
  age3_pbgid?: number | null
  age3_name?: string | null
  age3_finished_at_average?: number | null
  age4_pbgid?: number | null
  age4_name?: string | null
  age4_finished_at_average?: number | null
}

export interface AgeupMetadata {
  id: string
  pbgid: number
  civs: string[]
  min_age: number
  new_age: number
  name: string
  icon: string | null
}

export interface AgeupStatsResponse {
  data: Record<string, AgeupPathRow[] | AgeupPathRow | undefined>
  ageups_metadata?: AgeupMetadata[]
}

export interface LandmarkStatRow {
  age: 2 | 3 | 4
  pbgid: number | null
  name: string
  icon: string | null
  games: number
  wins: number
  winRate: number
  /** Share of games among those that picked ANY landmark for this age. */
  pickRate: number
  /** Average completion time of this age-up (seconds), weighted by games. */
  avgAgeUpSec: number | null
}

const AGES: (2 | 3 | 4)[] = [2, 3, 4]

function nameFor(r: AgeupPathRow, age: 2 | 3 | 4): string | null {
  return (age === 2 ? r.age2_name : age === 3 ? r.age3_name : r.age4_name) ?? null
}
function pbgidFor(r: AgeupPathRow, age: 2 | 3 | 4): number | null {
  return (age === 2 ? r.age2_pbgid : age === 3 ? r.age3_pbgid : r.age4_pbgid) ?? null
}
function timeFor(r: AgeupPathRow, age: 2 | 3 | 4): number | null {
  return (
    (age === 2
      ? r.age2_finished_at_average
      : age === 3
        ? r.age3_finished_at_average
        : r.age4_finished_at_average) ?? null
  )
}

/** All path-subset rows (age1, age1-2, age1-3, age1-4 …) flattened. */
function pathRows(resp: AgeupStatsResponse): AgeupPathRow[] {
  const rows: AgeupPathRow[] = []
  for (const [key, value] of Object.entries(resp.data ?? {})) {
    if (!key.startsWith('age')) continue
    if (Array.isArray(value)) rows.push(...value)
    else if (value && typeof value === 'object') rows.push(value)
  }
  return rows
}

/** Per-landmark totals per age, most-picked first within each age. */
export function aggregateLandmarkStats(resp: AgeupStatsResponse): LandmarkStatRow[] {
  const rows = pathRows(resp)
  const iconByPbgid = new Map((resp.ageups_metadata ?? []).map((m) => [m.pbgid, m.icon]))
  const out: LandmarkStatRow[] = []

  for (const age of AGES) {
    const byLandmark = new Map<
      string,
      { pbgid: number | null; name: string; games: number; wins: number; timeWeighted: number; timeGames: number }
    >()
    let ageTotal = 0
    for (const r of rows) {
      const name = nameFor(r, age)
      const pbgid = pbgidFor(r, age)
      if (!name) continue
      const games = r.player_games_count ?? 0
      if (games <= 0) continue
      ageTotal += games
      const entry = byLandmark.get(name) ?? {
        pbgid,
        name,
        games: 0,
        wins: 0,
        timeWeighted: 0,
        timeGames: 0,
      }
      entry.games += games
      entry.wins += r.win_count ?? 0
      const t = timeFor(r, age)
      if (t != null && t > 0) {
        entry.timeWeighted += t * games
        entry.timeGames += games
      }
      byLandmark.set(name, entry)
    }
    for (const e of byLandmark.values()) {
      out.push({
        age,
        pbgid: e.pbgid,
        name: e.name,
        icon: e.pbgid != null ? (iconByPbgid.get(e.pbgid) ?? null) : null,
        games: e.games,
        wins: e.wins,
        winRate: e.games > 0 ? Math.round((e.wins / e.games) * 1000) / 10 : 0,
        pickRate: ageTotal > 0 ? Math.round((e.games / ageTotal) * 1000) / 10 : 0,
        avgAgeUpSec: e.timeGames > 0 ? e.timeWeighted / e.timeGames : null,
      })
    }
  }

  return out.sort((a, b) => a.age - b.age || b.games - a.games)
}
