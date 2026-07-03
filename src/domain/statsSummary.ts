/**
 * Decoder for AoE4's post-game stat SUMMARY (a Relic Chunky file, parsed by
 * `chunky.ts`). This is the file behind AoE4World's "Game Summary" — build order,
 * economy over time, and score. It exists in two byte-identical places:
 *   • locally as `matchhistory/<id>/stats.rgs` (custom games), and
 *   • the Relic datatype-1 blob for ranked games (fetched by the backend).
 * One parser serves both.
 *
 * Structure cross-checked against aoe4world/replays-api (docs/replaySummary.bt +
 * AoE4WorldReplaysParser/Models/DataSTPD.cs) and verified field-by-field against
 * real files:
 *   STLI → STLS (createdEntities = timed build order, all players)
 *        → STPL → STLP(per player) → STPD (per-player fixed header + timelines)
 *
 * The STPD fixed header carries the AUTHORITATIVE end-of-game stats — the exact
 * numbers the game's own match-history screens show (total resources gathered,
 * age-up timings, relics, villager high, kills/losses, profile id, civ). We parse
 * it strictly by chunk version (2029–2034 layouts, same conditionals as
 * AoE4World's parser, D56). If a future patch breaks the strict read, we fall
 * back to the old signature-scan for the timelines — the totals become null and
 * the UI degrades to timeline-derived numbers instead of showing nothing.
 */
import { findChild, findChildren, parseChunky, type ChunkyNode } from './chunky'
import { resolveReplayCiv } from './replay'

export type BuildCategory = 'unit' | 'building' | 'upgrade' | 'other'

export interface BuildEvent {
  timeSec: number
  playerId: number
  category: BuildCategory
  /** Raw blueprint token, e.g. "unit_villager_1_tem". */
  blueprint: string
  /** Friendly name, e.g. "Villager". */
  name: string
}

export interface ResourceAmounts {
  food: number
  wood: number
  gold: number
  stone: number
}

export interface ResourcePoint {
  timeSec: number
  /** Current resource bank. */
  bank: ResourceAmounts
  /**
   * Resources gathered so far ≈ bank + cumulative SPENT. The timeline's own
   * cumulative dict is cumulative SPENT (verified: its final point equals the
   * header's totalResourcesSpent exactly), so the gathered curve is derived.
   */
  gathered: ResourceAmounts
  /** Cumulative resources spent so far (the timeline's own dict). */
  spent: ResourceAmounts | null
  /** Resources gained in the last minute — the game's own gather-rate series. */
  perMinute: ResourceAmounts | null
}

export interface ScorePoint {
  timeSec: number
  economy: number
  military: number
  society: number
  technology: number
  total: number
}

/**
 * End-of-game totals from the STPD fixed header — the same numbers the game's
 * post-match screens display. Null when the header didn't decode (fallback path).
 */
export interface PlayerTotals {
  /** Exact total resources gathered (the game's Economy screen numbers). */
  resourcesGathered: ResourceAmounts
  resourcesSpent: ResourceAmounts
  unitsProduced: number
  unitsLost: number
  unitsKilled: number
  buildingsLost: number
  buildingsRazed: number
  techResearched: number
  largestArmy: number
  sacredCaptured: number
  sacredLost: number
  sacredNeutralized: number
  /** Tail-of-record stats; null when the post-timeline block didn't decode. */
  relicsCaptured: number | null
  /** The game's "Villager High" — peak villagers alive at once. */
  villagerHigh: number | null
  /**
   * Age-up timestamps in seconds — when the age-up became AVAILABLE (enough
   * resources), per aoe4world semantics; what AoE4World displays as age timings.
   * Null when that age was never reached (raw 0 / <500ms guard).
   */
  age2Sec: number | null
  age3Sec: number | null
  age4Sec: number | null
}

export interface PlayerSummary {
  playerId: number
  name: string | null
  /** Relic profile id from the header (exact "me" matching), null for AI/legacy. */
  profileId: number | null
  /** Civ token — the header's own string (e.g. "templar", "french_ha_01") when
   *  decoded, else inferred from this player's build blueprints (e.g. "tem"). */
  civToken: string | null
  /** Authoritative end-of-game totals, or null on the fallback path. */
  totals: PlayerTotals | null
  /**
   * How many of this player's lost units were villagers (from the STLS lost-
   * entities list) — splits Relic's villager-inclusive "deaths" counter. Null
   * when the lost list didn't decode.
   */
  villagersLost: number | null
  buildOrder: BuildEvent[]
  resources: ResourcePoint[]
  scores: ScorePoint[]
}

export interface MatchSummary {
  gameLengthSec: number | null
  players: PlayerSummary[]
}

const latin1 = new TextDecoder('latin1')
const utf16 = new TextDecoder('utf-16le')

class Reader {
  pos: number
  private view: DataView
  constructor(
    private bytes: Uint8Array,
    start: number,
    readonly end: number,
  ) {
    this.pos = start
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  get remaining(): number {
    return this.end - this.pos
  }
  private need(n: number): void {
    if (this.pos + n > this.end) throw new RangeError('stpd: read past chunk end')
  }
  i32(): number {
    this.need(4)
    const v = this.view.getInt32(this.pos, true)
    this.pos += 4
    return v
  }
  u8(): number {
    this.need(1)
    return this.bytes[this.pos++]!
  }
  i16(): number {
    this.need(2)
    const v = this.view.getInt16(this.pos, true)
    this.pos += 2
    return v
  }
  f32(): number {
    this.need(4)
    const v = this.view.getFloat32(this.pos, true)
    this.pos += 4
    return v
  }
  peekI32(at = this.pos): number {
    return this.view.getInt32(at, true)
  }
  ascii(n: number): string {
    this.need(n)
    const s = latin1.decode(this.bytes.subarray(this.pos, this.pos + n))
    this.pos += n
    return s
  }
  /** i32 length-prefixed ASCII string. */
  str(): string {
    const n = this.i32()
    if (n < 0 || n > 4096) throw new RangeError('stpd: implausible string length')
    return this.ascii(n)
  }
  /** i32 length-prefixed UTF-16LE string (length is in code units). */
  ustr(): string {
    const n = this.i32()
    if (n < 0 || n > 4096) throw new RangeError('stpd: implausible string length')
    this.need(n * 2)
    const s = utf16.decode(this.bytes.subarray(this.pos, this.pos + n * 2))
    this.pos += n * 2
    return s
  }
  /** A Relic ResourceDict: i32 count + count×(i32len, name, f32 value). */
  resourceDict(): ResourceAmounts {
    const count = this.i32()
    if (count < 0 || count > 64) throw new RangeError('stpd: implausible dict size')
    const out: ResourceAmounts = { food: 0, wood: 0, gold: 0, stone: 0 }
    for (let i = 0; i < count; i++) {
      const len = this.i32()
      if (len < 0 || len > 64) throw new RangeError('stpd: implausible dict key')
      const key = this.ascii(len)
      const val = this.f32()
      if (key === 'food') out.food = val
      else if (key === 'wood') out.wood = val
      else if (key === 'gold') out.gold = val
      else if (key === 'stone') out.stone = val
    }
    return out
  }
  skipI32(n: number): void {
    this.need(n * 4)
    this.pos += n * 4
  }
}

const CATEGORY: Record<number, BuildCategory> = { 19: 'building', 46: 'unit', 52: 'upgrade' }

/** Parses a summary buffer into per-player totals + build order + timelines. */
export function parseStatsSummary(bytes: Uint8Array): MatchSummary | null {
  const tree = parseChunky(bytes)
  if (!tree) return null
  const stli = findChild(tree, 'STLI', 'FOLD')
  if (!stli) return null

  const stls = findChild(stli.children, 'STLS', 'DATA')
  const { gameLengthSec, buildByPlayer, villagersLostByPlayer } = stls
    ? decodeBuildOrder(bytes, stls)
    : {
        gameLengthSec: null,
        buildByPlayer: new Map<number, BuildEvent[]>(),
        villagersLostByPlayer: null,
      }

  const stpl = findChild(stli.children, 'STPL', 'FOLD')
  const playerFolds = findChildren(stpl?.children, 'STLP', 'FOLD')

  const players: PlayerSummary[] = playerFolds.map((pl) => {
    const stpd = findChild(pl.children, 'STPD', 'DATA')

    // Preferred path: the strict versioned decode (header totals + timelines).
    let strict: StrictStpd | null = null
    if (stpd) {
      try {
        strict = decodeStpdStrict(bytes, stpd)
      } catch {
        strict = null // unknown layout → scan fallback below
      }
    }

    const identity = strict ?? (stpd ? readStpdIdentity(bytes, stpd) : { playerId: -1, name: null })
    const timelines = strict ?? (stpd ? decodeTimelines(bytes, stpd) : { resources: [], scores: [] })
    const buildOrder = buildByPlayer.get(identity.playerId) ?? []
    return {
      playerId: identity.playerId,
      name: identity.name,
      profileId: strict != null && strict.profileId > 0 ? strict.profileId : null,
      civToken: strict?.civ || inferCivToken(buildOrder),
      totals: strict?.totals ?? null,
      villagersLost: villagersLostByPlayer ? (villagersLostByPlayer.get(identity.playerId) ?? 0) : null,
      buildOrder,
      resources: timelines.resources,
      scores: timelines.scores,
    }
  })

  return { gameLengthSec, players }
}

/** STLS: header (byte + 4×i32 incl. gameLength), createdCount × createdEntity,
 *  then lostCount × lostEntity (deaths with unit types — the villager split). */
function decodeBuildOrder(
  bytes: Uint8Array,
  stls: ChunkyNode,
): {
  gameLengthSec: number | null
  buildByPlayer: Map<number, BuildEvent[]>
  villagersLostByPlayer: Map<number, number> | null
} {
  const r = new Reader(bytes, stls.dataStart, stls.dataEnd)
  const byPlayer = new Map<number, BuildEvent[]>()
  let gameLengthSec: number | null
  try {
    r.u8() // unknown1
    r.i32() // unknown2
    r.i32() // unknown3
    const len = r.i32()
    gameLengthSec = len > 0 ? len : null
    r.i32() // unknown5
    const createdCount = r.i32()
    for (let i = 0; i < createdCount; i++) {
      const timeSec = r.f32()
      const playerId = r.i32()
      r.i32() // entityId
      r.u8() // unknown2 (==1)
      const blueprint = r.str()
      r.i16() // unknown4 (==0)
      const category = CATEGORY[r.i16()] ?? 'other'
      r.resourceDict() // items1
      r.resourceDict() // items2
      r.f32() // x
      r.f32() // y
      const list = byPlayer.get(playerId) ?? []
      list.push({ timeSec, playerId, category, blueprint, name: prettyName(blueprint) })
      byPlayer.set(playerId, list)
    }
  } catch {
    return { gameLengthSec: null, buildByPlayer: byPlayer, villagersLostByPlayer: null }
  }

  // Lost entities (per replaySummary.bt DataSTLSLostEntity) — decoded separately
  // so a drift here never costs the build order above.
  const villagersLost = new Map<number, number>()
  try {
    const lostCount = r.i32()
    if (lostCount < 0 || lostCount > 200000) throw new RangeError('stls: implausible lost count')
    for (let i = 0; i < lostCount; i++) {
      r.f32() // timestamp
      const targetPlayerId = r.i32()
      r.i32() // targetEntityId
      r.u8() // hasTarget (==1)
      const targetUnitType = r.str()
      r.i16()
      r.i16()
      r.i32() // attackerPlayerId
      r.i32() // attackerEntityId
      const hasAttacker = r.u8()
      r.str() // attackerUnitType
      if (hasAttacker) {
        r.i16()
        r.i16()
        r.str() // weaponType
      }
      r.f32() // targetX
      r.f32() // targetY
      r.f32() // attackerX
      r.f32() // attackerY
      if (/villager/i.test(targetUnitType)) {
        villagersLost.set(targetPlayerId, (villagersLost.get(targetPlayerId) ?? 0) + 1)
      }
    }
    return { gameLengthSec, buildByPlayer: byPlayer, villagersLostByPlayer: villagersLost }
  } catch {
    return { gameLengthSec, buildByPlayer: byPlayer, villagersLostByPlayer: null }
  }
}

interface StrictStpd {
  playerId: number
  name: string | null
  profileId: number
  civ: string
  totals: PlayerTotals
  resources: ResourcePoint[]
  scores: ScorePoint[]
}

/**
 * The strict, versioned STPD decode — field-for-field the same walk as
 * AoE4World's DataSTPD.cs (versions 2029/2030/2033/2034; ≥2035 is attempted with
 * the 2034 layout). Throws on anything implausible so the caller can fall back.
 */
function decodeStpdStrict(bytes: Uint8Array, stpd: ChunkyNode): StrictStpd {
  const v = stpd.version
  if (v < 2029) throw new RangeError('stpd: pre-2029 layout unknown')
  const r = new Reader(bytes, stpd.dataStart, stpd.dataEnd)

  const playerId = r.i32()
  const name = r.ustr()
  r.i32() // outcome (5/6/8)
  r.i32() // unknown3
  r.i32() // timestampEliminated
  if (v >= 2033) r.i32() // unknown4
  r.skipI32(2) // unknown5a-b
  const unitsProduced = r.i32()
  r.skipI32(9) // unknown5d..5l (incl. infantry counters)
  const largestArmy = r.i32()
  r.skipI32(9) // unknown5n..5v
  r.skipI32(2) // unknown6, unknown7
  r.resourceDict() // unknownItems1
  const buildingsLost = r.i32()
  r.i32() // unknown9a
  const unitsLost = r.i32()
  r.i32() // unitsLostResources
  r.skipI32(6) // unknown9d..9i
  const techResearched = r.i32()
  r.i32() // unknown9k
  r.resourceDict() // unknownItems2a
  r.resourceDict() // spentForUpgrades
  r.resourceDict() // unknownItems2c
  r.resourceDict() // unknownItems2d
  const unitsKilled = r.i32()
  r.i32() // unitsKilledResources
  r.skipI32(2) // unknown10c-d
  const buildingsRazed = r.i32()
  r.skipI32(6) // unknown10f..10k
  const resourcesGathered = r.resourceDict()
  const resourcesSpent = r.resourceDict()
  r.resourceDict() // unknownItems3b
  r.resourceDict() // unknownItems3c
  r.resourceDict() // unknownItems3d
  r.resourceDict() // unknownItems3e
  r.skipI32(6) // unknown11a
  const sacredCaptured = r.i32()
  const sacredLost = r.i32()
  const sacredNeutralized = r.i32()
  r.skipI32(9) // unknown11e
  r.resourceDict() // unknownItems4
  r.skipI32(4) // unknown12
  r.u8() // unknown13
  const civ = r.str()
  if (!/^[a-z0-9_]{2,40}$/.test(civ)) throw new RangeError('stpd: implausible civ token')
  r.skipI32(2) // unknown14a-b
  const profileId = r.i32()
  r.i32() // unknown14d

  // --- resource timeline ---
  const resources: ResourcePoint[] = []
  const rtCount = r.i32()
  if (rtCount < 0 || rtCount > 100000) throw new RangeError('stpd: implausible timeline size')
  for (let i = 0; i < rtCount; i++) {
    const timeSec = r.i32()
    const p = readResourcePoint(r, timeSec, v)
    resources.push(p)
  }

  // --- score timeline ---
  const scores: ScorePoint[] = []
  const stCount = r.i32()
  if (stCount < 0 || stCount > 100000) throw new RangeError('stpd: implausible timeline size')
  for (let i = 0; i < stCount; i++) {
    const timeSec = r.i32()
    const economy = r.f32()
    const military = r.f32()
    const society = r.f32()
    const technology = r.f32()
    const total = r.f32()
    scores.push({ timeSec, economy, military, society, technology, total })
  }

  const totals: PlayerTotals = {
    resourcesGathered,
    resourcesSpent,
    unitsProduced,
    unitsLost,
    unitsKilled,
    buildingsLost,
    buildingsRazed,
    techResearched,
    largestArmy,
    sacredCaptured,
    sacredLost,
    sacredNeutralized,
    relicsCaptured: null,
    villagerHigh: null,
    age2Sec: null,
    age3Sec: null,
    age4Sec: null,
  }

  // --- tail (unit timeline → relics / villager high / age-up times) ---
  // Decoded separately: a tail-layout drift shouldn't cost us the header totals.
  try {
    decodeStpdTail(r, v, totals)
  } catch {
    /* keep header totals; tail stats stay null */
  }

  return { playerId, name: name || null, profileId, civ, totals, resources, scores }
}

/**
 * One resource-timeline entry. Old layout (pre-12.0.1974): current + perMinute +
 * units + i32. New layout (v2034, or v2033 with a 4th dict — detected by peeking
 * the next i32 ≥ 9, same trick as AoE4World): current + cumulativeSPENT +
 * perMinute + units + i32. The chunk version stayed 2033 across that change,
 * hence the peek. The cumulative dict is SPENT (its final point == the header's
 * totalResourcesSpent, byte-exact) — gathered-so-far is derived as bank + spent.
 */
function readResourcePoint(r: Reader, timeSec: number, version: number): ResourcePoint {
  const d1 = r.resourceDict()
  const d2 = r.resourceDict()
  const d3 = r.resourceDict()
  if (version >= 2034 || (version === 2033 && r.peekI32() >= 9)) {
    const _units = r.resourceDict()
    r.i32() // trailing unknown
    return { timeSec, bank: d1, gathered: addResources(d1, d2), spent: d2, perMinute: d3 }
  }
  r.i32() // trailing unknown
  // Old layout has no cumulative-spent series to derive gathered from.
  return {
    timeSec,
    bank: d1,
    gathered: { food: 0, wood: 0, gold: 0, stone: 0 },
    spent: null,
    perMinute: d2,
  }
}

function addResources(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  return { food: a.food + b.food, wood: a.wood + b.wood, gold: a.gold + b.gold, stone: a.stone + b.stone }
}

/** Post-timeline STPD fields, through the age-up timestamps. */
function decodeStpdTail(r: Reader, v: number, totals: PlayerTotals): void {
  // unknown15: entries of 3 or 4 i32s. On v<2034, detect by reading ahead as
  // 3-field and checking the -1 sentinel that always follows (per aoe4world).
  let fourField = v >= 2034
  if (!fourField) {
    const save = r.pos
    const count = r.i32()
    if (count < 0 || count > 100000) throw new RangeError('stpd: implausible array size')
    r.skipI32(count * 3)
    r.i32() // unknown16a
    const unknown16b = r.i32()
    r.pos = save
    fourField = unknown16b !== -1
  }
  const c15 = r.i32()
  if (c15 < 0 || c15 > 100000) throw new RangeError('stpd: implausible array size')
  r.skipI32(c15 * (fourField ? 4 : 3))
  r.skipI32(4) // unknown16a-d

  const unitCount = r.i32()
  if (unitCount < 0 || unitCount > 200000) throw new RangeError('stpd: implausible array size')
  for (let i = 0; i < unitCount; i++) {
    const idType = r.u8()
    if (idType === 1) r.i32() // pbgid
    else if (idType === 2) r.ascii(20) // mod hash
    r.i16()
    r.i16()
    r.i32() // timestamp
    r.str() // unitIcon
    r.ustr() // unitLabel
    r.ustr() // unknown4
    r.resourceDict()
    r.ustr() // unknown5
    r.i32() // unknown6
  }

  const c17 = r.i32()
  if (c17 < 0 || c17 > 100000) throw new RangeError('stpd: implausible array size')
  r.skipI32(c17 * 4)

  r.skipI32(8) // unknown18..23
  const relics = r.f32()
  r.f32() // unknown25
  r.skipI32(6) // unknown26
  r.u8() // unknown27a
  r.f32() // unknown27b
  if (v >= 2034) r.i32() // unknown27c
  r.i32() // unknown28a
  r.f32() // unknown28b
  r.i32() // unknown28c
  r.f32() // unknown28d
  r.f32() // unknown28e
  const villagerHigh = r.i32() // unknown28f — matches the game's "Villager High" (verified on real files)
  r.f32() // unknown28g
  r.skipI32(8) // unknown29a-h
  const age2Msec = r.i32()
  const age3Msec = r.i32()
  const age4Msec = r.i32()

  totals.relicsCaptured = relics >= 0 ? Math.round(relics) : null
  totals.villagerHigh = villagerHigh > 0 ? villagerHigh : null
  // >500ms guard per aoe4world: abandoned games write near-zero sentinels.
  totals.age2Sec = age2Msec > 500 ? age2Msec / 1000 : null
  totals.age3Sec = age3Msec > 500 ? age3Msec / 1000 : null
  totals.age4Sec = age4Msec > 500 ? age4Msec / 1000 : null
}

/** STPD begins with a stable i32 playerId + UString playerName, before the drifting header. */
function readStpdIdentity(
  bytes: Uint8Array,
  stpd: ChunkyNode,
): { playerId: number; name: string | null } {
  try {
    const r = new Reader(bytes, stpd.dataStart, stpd.dataEnd)
    const playerId = r.i32()
    const name = r.ustr()
    return { playerId, name: name || null }
  } catch {
    return { playerId: -1, name: null }
  }
}

/**
 * Fallback timeline decode when the strict header walk fails (unknown future
 * layout): scan for the self-describing resourceTimeline, which is version-
 * stable, then the score timeline follows.
 */
function decodeTimelines(
  bytes: Uint8Array,
  stpd: ChunkyNode,
): { resources: ResourcePoint[]; scores: ScorePoint[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const { dataStart, dataEnd } = stpd
  // Locate a resourceTimeline entry start: i32 ts, then ResourceDict {len 8|9, "action"...}.
  const start = findResourceTimelineStart(bytes, view, dataStart, dataEnd)
  if (start == null) return { resources: [], scores: [] }

  const r = new Reader(bytes, start - 4, dataEnd) // include the count i32
  const resources: ResourcePoint[] = []
  const scores: ScorePoint[] = []
  try {
    const count = r.i32()
    if (count <= 0 || count > 100000) return { resources: [], scores: [] }
    for (let i = 0; i < count; i++) {
      const timeSec = r.i32()
      resources.push(readScannedResourcePoint(r, timeSec))
    }
    const scoreCount = r.i32()
    if (scoreCount > 0 && scoreCount <= 100000) {
      for (let i = 0; i < scoreCount; i++) {
        const timeSec = r.i32()
        const economy = r.f32()
        const military = r.f32()
        const society = r.f32()
        const technology = r.f32()
        const total = r.f32()
        scores.push({ timeSec, economy, military, society, technology, total })
      }
    }
  } catch {
    // return whatever decoded cleanly
  }
  return { resources, scores }
}

/** Scan-path resource entry: same 3-vs-4-dict detection, but version-blind. */
function readScannedResourcePoint(r: Reader, timeSec: number): ResourcePoint {
  const d1 = r.resourceDict()
  const d2 = r.resourceDict()
  const d3 = r.resourceDict()
  if (r.peekI32() === 8 || r.peekI32() === 9) {
    r.resourceDict() // units
    r.i32() // trailing unknown
    return { timeSec, bank: d1, gathered: addResources(d1, d2), spent: d2, perMinute: d3 }
  }
  r.i32() // trailing unknown
  return {
    timeSec,
    bank: d1,
    gathered: { food: 0, wood: 0, gold: 0, stone: 0 },
    spent: null,
    perMinute: d2,
  }
}

/** Scan for a valid resourceTimeline start: a small increasing-timestamp run of "action" dicts. */
function findResourceTimelineStart(
  bytes: Uint8Array,
  view: DataView,
  start: number,
  end: number,
): number | null {
  const isActionDict = (p: number): boolean => {
    if (p + 18 > end) return false
    const len = view.getInt32(p + 4, true)
    if (len !== 8 && len !== 9) return false
    if (view.getInt32(p + 8, true) !== 6) return false
    return latin1.decode(bytes.subarray(p + 12, p + 18)) === 'action'
  }
  for (let p = start; p < end - 18; p++) {
    if (!isActionDict(p)) continue
    const ts = view.getInt32(p, true)
    if (ts !== 0) continue // the timeline starts at t=0
    // Confirm it's a run: decode two entries and check the timestamp step is sane.
    try {
      const r = new Reader(bytes, p, end)
      const t0 = readResourceTimestampStep(r)
      const t1 = readResourceTimestampStep(r)
      if (t1 - t0 >= 1 && t1 - t0 <= 60) return p
    } catch {
      /* keep scanning */
    }
  }
  return null
}

/** Reads one resource entry and returns its timestamp (advances the reader past the entry). */
function readResourceTimestampStep(r: Reader): number {
  const ts = r.i32()
  readScannedResourcePoint(r, ts)
  return ts
}

/** Civ/variant/qualifier tokens to strip from the tail of a blueprint token. */
const SUFFIX_JUNK = new Set([
  'control', 'capital', 'ha', 'cw', 'jd', 'od', 'zx', 'summon',
  'abb', 'ayy', 'byz', 'chi', 'del', 'eng', 'fre', 'hre', 'jap', 'mal', 'mon', 'ott', 'rus', 'tem',
])

/** "unit_villager_1_tem" → "Villager"; "building_town_center_capital_tem" → "Town Center". */
export function prettyName(blueprint: string): string {
  const stripped = blueprint.replace(/^(?:unit|building|upgrade|tech|ability)_/, '')
  const parts = stripped.split('_').filter(Boolean)
  // Drop trailing civ codes, variant markers, and age digits, keeping the real name.
  while (parts.length > 1) {
    const last = parts[parts.length - 1]!
    if (/^\d+$/.test(last) || SUFFIX_JUNK.has(last)) parts.pop()
    else break
  }
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Blueprint-suffix civ tokens → AoE4World civ slugs (fallback identification). */
const CIV_TOKEN_TO_SLUG: Record<string, string> = {
  abb: 'abbasid_dynasty',
  ayy: 'ayyubids',
  byz: 'byzantines',
  chi: 'chinese',
  del: 'delhi_sultanate',
  eng: 'english',
  fre: 'french',
  hre: 'holy_roman_empire',
  jap: 'japanese',
  mal: 'malians',
  mon: 'mongols',
  ott: 'ottomans',
  rus: 'rus',
  tem: 'knights_templar',
  jd: 'jeanne_darc',
  od: 'order_of_the_dragon',
  zx: 'zhu_xis_legacy',
  fre_ha_01: 'jeanne_darc',
  japanese_ha_sen: 'sengoku_daimyo',
  sultanate_ha_tug: 'tughlaq_dynasty',
}

/**
 * Civ token → slug. Handles both the STPD header's full tokens ("templar",
 * "byzantine", "french_ha_01" — same vocabulary as `.rec`/warnings.log, resolved
 * via replay.ts) and the blueprint-suffix tokens ("tem", "fre_ha_01").
 */
export function civFromToken(token: string | null): string | null {
  if (!token) return null
  const exact = CIV_TOKEN_TO_SLUG[token]
  if (exact) return exact
  const viaReplay = resolveReplayCiv(token).slug
  if (viaReplay) return viaReplay
  const base = token.split('_')[0]!
  return CIV_TOKEN_TO_SLUG[base] ?? null
}

/** The civ suffix token after the age digit, e.g. "tem" / "fre_ha_01" — the modal one. */
function inferCivToken(events: BuildEvent[]): string | null {
  const tally = new Map<string, number>()
  for (const e of events) {
    const m = e.blueprint.match(/_\d+_([a-z0-9_]+)$/)
    if (m) tally.set(m[1]!, (tally.get(m[1]!) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [tok, n] of tally) {
    if (n > bestN) {
      best = tok
      bestN = n
    }
  }
  return best
}
