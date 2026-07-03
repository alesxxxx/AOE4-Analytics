/**
 * Parser for the local `matchhistory/<id>/match_history.jsn` file (DECISIONS D30)
 * — the one structured local source for CUSTOM/private games, which AoE4World's
 * API never sees. ToS-safe (your own file). Pure + fixture-tested.
 *
 * Verified field shape (from real files): top-level `matchHistoryID`,
 * `creatorProfileID`, `mapName`, `matchTypeID`, `startGameTime`,
 * `completionTime`, `matchHistoryReportResults[] { profileID, resultType,
 * teamID, raceID }`, `matchUrls[] { profileID }`.
 *
 * Honest limits: vs-AI/skirmish records the opponent as `profileID: -1`; for a
 * human opponent the real id *should* appear here (unverified — needs a real
 * human-custom sample). `raceID` is a Relic-internal civ id with no public
 * name mapping, so `civForRaceId` is best-effort and seeded incrementally.
 */

export interface LocalMatchPlayer {
  profileId: number
  raceId: number | null
  civ: string | null
  resultType: number | null
  teamId: number | null
}

export interface LocalMatch {
  matchHistoryId: number | null
  map: string | null
  matchTypeId: number | null
  startedAtMs: number | null
  completedAtMs: number | null
  myProfileId: number | null
  players: LocalMatchPlayer[]
  /** Real opponent profile ids (≠ me, ≠ -1, ≠ 0). Empty for AI/unidentified. */
  opponentProfileIds: number[]
}

/** Extracts the first complete JSON object from a string that may have trailing data. */
export function firstJsonObject(text: string): unknown | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// Relic-internal civ raceID → AoE4World slug. Seeded incrementally as ids are
// confirmed; unknown ids fall back to `Civ #<id>` in the UI.
const RACE_ID_TO_CIV: Record<number, string> = {}

export function civForRaceId(raceId: number | null | undefined): string | null {
  if (raceId == null) return null
  return RACE_ID_TO_CIV[raceId] ?? null
}

function toMs(unixSeconds: unknown): number | null {
  return typeof unixSeconds === 'number' && unixSeconds > 0 ? unixSeconds * 1000 : null
}

/**
 * Parses a `match_history.jsn` text into a `LocalMatch`. `myProfileId` (your
 * AoE4World id) lets us pick out the opponent; falls back to `creatorProfileID`.
 */
export function parseMatchHistory(
  text: string,
  opts: { myProfileId?: number } = {},
): LocalMatch | null {
  const root = firstJsonObject(text) as Record<string, unknown> | null
  if (!root) return null

  const report = Array.isArray(root['matchHistoryReportResults'])
    ? (root['matchHistoryReportResults'] as Record<string, unknown>[])
    : []
  const urls = Array.isArray(root['matchUrls'])
    ? (root['matchUrls'] as Record<string, unknown>[])
    : []

  const players: LocalMatchPlayer[] = report.map((r) => {
    const raceId = typeof r['raceID'] === 'number' ? (r['raceID'] as number) : null
    return {
      profileId: typeof r['profileID'] === 'number' ? (r['profileID'] as number) : -1,
      raceId,
      civ: civForRaceId(raceId),
      resultType: typeof r['resultType'] === 'number' ? (r['resultType'] as number) : null,
      teamId: typeof r['teamID'] === 'number' ? (r['teamID'] as number) : null,
    }
  })

  const creator =
    typeof root['creatorProfileID'] === 'number' ? (root['creatorProfileID'] as number) : null
  const myProfileId = opts.myProfileId ?? creator

  // Candidate opponent ids from both the report rows and the match urls.
  const candidates = new Set<number>()
  for (const p of players) candidates.add(p.profileId)
  for (const u of urls)
    if (typeof u['profileID'] === 'number') candidates.add(u['profileID'] as number)

  const opponentProfileIds = [...candidates].filter(
    (id) => id > 0 && id !== myProfileId && id !== creator,
  )

  return {
    matchHistoryId:
      typeof root['matchHistoryID'] === 'number' ? (root['matchHistoryID'] as number) : null,
    map: typeof root['mapName'] === 'string' ? (root['mapName'] as string) : null,
    matchTypeId: typeof root['matchTypeID'] === 'number' ? (root['matchTypeID'] as number) : null,
    startedAtMs: toMs(root['startGameTime']),
    completedAtMs: toMs(root['completionTime']),
    myProfileId,
    players,
    opponentProfileIds,
  }
}
