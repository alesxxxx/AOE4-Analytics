/**
 * Relic AoE4 community-API (`aoe-api.worldsedgelink.com`, `title=age4`) response
 * types — reverse-engineered + verified against captured fixtures in
 * `src/api/__fixtures__/relic/` (2026-06-29). This is the official backend the
 * in-game ladder uses; it exposes per-match data AoE4World's public API hides
 * (per-player command counts → APM, rating deltas, custom/AI games). Numeric
 * civ/leaderboard ids are decoded via `src/domain/relicIds.ts`.
 */

export interface RelicResult {
  /** 0 = SUCCESS. Relic returns HTTP 200 even for logical errors (2, 9, …). */
  code: number
  message: string
}

export interface RelicProfile {
  profile_id: number
  /** `/steam/<steam64>` — strip the prefix for the Steam id. */
  name: string
  alias: string
  personal_statgroup_id: number
  xp?: number
  level?: number
  leaderboardregion_id?: number
  country?: string | null
  clanlist_name?: string
}

/** One human player's outcome + rating in a match (win/loss lives here). */
export interface RelicMatchMember {
  matchhistory_id: number
  profile_id: number
  /** Civ race PBGID — map via `raceIdToCiv`. */
  civilization_id: number
  statgroup_id: number
  teamid: number
  wins: number
  losses: number
  streak: number
  outcome: number
  oldrating: number
  newrating: number
}

/** Per-player report row carrying the `counters` blob (APM source). */
export interface RelicReportResult {
  matchhistory_id: number
  profile_id: number
  resulttype: number
  teamid: number
  civilization_id: number
  /** JSON STRING; single `JSON.parse` → flat dict with `totalcmds`, `gt`, … */
  counters: string
  matchstartdate: number
}

/**
 * A per-match downloadable file on Relic's storage. `datatype 0` = full replay
 * (~1MB), `datatype 1` = the stat SUMMARY blob (~137KB, economy/build/score). The
 * `url` is an unsigned Azure blob (403 direct); a signed URL is obtained via
 * `game/cloud/getTempCredentials` (returns Azure SAS credentials) with an
 * authenticated Relic session.
 */
export interface RelicMatchUrl {
  profile_id?: number
  datatype?: number
  size?: number
  url?: string
  key?: string
  path?: string
}

export interface RelicMatch {
  id: number
  creator_profile_id: number
  /** Often the useless `generated_map`; the real map is in `options`. */
  mapname: string
  maxplayers: number
  /** Per-match mode (a DIFFERENT id-space from leaderboard_id). */
  matchtype_id: number
  /** base64 → zlib → JSON; carries the real `mapName`/`localizedMapName`. */
  options: string
  slotinfo: string
  /** `AUTOMATCH` = ladder/QM, `unnamed_session` = custom/AI. */
  description: string
  startgametime: number
  completiontime: number
  matchhistorymember: RelicMatchMember[]
  matchhistoryreportresults: RelicReportResult[]
  /** Downloadable replay + summary blobs (present on ranked/QM matches). */
  matchurls?: RelicMatchUrl[]
}

export interface RelicRecentMatchHistoryResponse {
  result: RelicResult
  matchHistoryStats: RelicMatch[]
  profiles: RelicProfile[]
}

export interface RelicMember {
  profile_id: number
  name: string
  alias: string
  personal_statgroup_id: number
  xp?: number
  level?: number
  leaderboardregion_id?: number
  country?: string | null
  clanlist_name?: string
}

export interface RelicStatGroup {
  id: number
  name: string
  type: number
  members: RelicMember[]
}

export interface RelicLeaderboardStat {
  statgroup_id: number
  leaderboard_id: number
  wins: number
  losses: number
  streak: number
  rank: number
  ranktotal: number
  ranklevel: number
  rating: number
  regionrank: number
  regionranktotal: number
  lastmatchdate: number
  highestrating: number
  highestrank: number
  highestranklevel: number
}

export interface RelicPersonalStatResponse {
  result: RelicResult
  statGroups: RelicStatGroup[]
  leaderboardStats: RelicLeaderboardStat[]
}

/**
 * A counters blob after a single `JSON.parse`. Verified exact against AoE4World's
 * post-game "Comparison" table for a real game (e.g. sqprod=328 military produced,
 * ekills=137 kills, sqlost=235 deaths, upg=27 techs). Economy fields (`vprod`,
 * `reqspnt`, `popmax`) exist but Relic leaves them 0 — real economy needs the
 * separate stats file. Only the fields we surface are typed.
 */
export interface RelicCounters {
  /** Total command actions issued (APM numerator). */
  totalcmds?: number
  /** Game time in seconds (APM denominator). */
  gt?: number
  /** Military units (squads) produced. */
  sqprod?: number
  /** All units produced (incl. villagers). */
  unitprod?: number
  /** Enemy units killed. */
  ekills?: number
  /** Own units (squads) lost — i.e. deaths. */
  sqlost?: number
  /** Buildings produced. */
  bprod?: number
  /** Buildings lost. */
  blost?: number
  /** Upgrades / technologies researched. */
  upg?: number
  /** Relic `structdmg` counter; useful pressure signal, not the exact razed column. */
  structdmg?: number
}
