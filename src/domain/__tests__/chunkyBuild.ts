/**
 * Byte-builders for hermetic Relic Chunky / summary tests. We construct minimal
 * valid `.rgs`-shaped buffers in code rather than committing a user's personal
 * game binary — same layout the real files use (verified by reverse-engineering
 * + cross-checked against aoe4world/replays-api docs/replaySummary.bt and
 * DataSTPD.cs, and against real v2034 stats.rgs files).
 */

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n >>> 0, true)
  return b
}
function i32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setInt32(0, n, true)
  return b
}
function i16(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setInt16(0, n, true)
  return b
}
function f32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setFloat32(0, n, true)
  return b
}
function ascii(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)))
}
function utf16(s: string): Uint8Array {
  const b = new Uint8Array(s.length * 2)
  const v = new DataView(b.buffer)
  for (let i = 0; i < s.length; i++) v.setUint16(i * 2, s.charCodeAt(i), true)
  return b
}
function str(s: string): Uint8Array {
  return concat(i32(s.length), ascii(s))
}
function ustr(s: string): Uint8Array {
  return concat(i32(s.length), utf16(s))
}
function i32s(...ns: number[]): Uint8Array {
  return concat(...ns.map(i32))
}
function zeros32(n: number): Uint8Array {
  return new Uint8Array(n * 4)
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** One chunk: type(4)·id(4)·version·dataSize·nameLength·name·data. */
export function chunk(
  type: 'FOLD' | 'DATA',
  id: string,
  data: Uint8Array,
  { version = 1, name = '' }: { version?: number; name?: string } = {},
): Uint8Array {
  const nameBytes = name ? concat(ascii(name), new Uint8Array([0])) : new Uint8Array(0)
  return concat(ascii(type), ascii(id.padEnd(4).slice(0, 4)), u32(version), u32(data.length), u32(nameBytes.length), nameBytes, data)
}

/** Wraps chunks in the 24-byte Relic Chunky file header. */
export function chunkyFile(...chunks: Uint8Array[]): Uint8Array {
  const header = concat(ascii('Relic Chunky'), new Uint8Array([0x0d, 0x0a, 0x1a, 0x00]), u32(4), u32(1))
  return concat(header, ...chunks)
}

/** A ResourceDict: i32 count + count×(i32 len, name, f32 value). */
export function resourceDict(entries: Record<string, number>): Uint8Array {
  const keys = Object.keys(entries)
  return concat(i32(keys.length), ...keys.map((k) => concat(i32(k.length), ascii(k), f32(entries[k]!))))
}

/** Standard 8-key resource dict with the given food/wood/gold/stone. */
export function fwgs(food: number, wood: number, gold: number, stone: number): Uint8Array {
  return resourceDict({ action: 0, command: 0, food, gold, militia_hre: 0, popcap: 0, stone, wood })
}

const EMPTY_DICT = () => fwgs(0, 0, 0, 0)

/** One STLS createdEntity record. category: 19=building, 46=unit, 52=upgrade. */
export function createdEntity(
  timeSec: number,
  playerId: number,
  blueprint: string,
  category: number,
): Uint8Array {
  return concat(
    f32(timeSec), i32(playerId), i32(50000), new Uint8Array([1]),
    i32(blueprint.length), ascii(blueprint),
    i16(0), i16(category),
    fwgs(0, 0, 0, 0), fwgs(0, 0, 0, 0),
    f32(0), f32(0),
  )
}

/** A STLS data payload: header + createdEntities. */
export function stlsData(gameLength: number, entities: Uint8Array[]): Uint8Array {
  return concat(
    new Uint8Array([0]), i32(0), i32(0), i32(gameLength), i32(0),
    i32(entities.length), ...entities,
    i32(0), // lostCount = 0
  )
}

type Res4 = [number, number, number, number]

/**
 * One v2034 resource-timeline entry: ts + current + cumulativeSPENT + perMinute +
 * units + trailing i32 (the modern 4-dict layout). The parser derives
 * gathered-so-far as bank + spent.
 */
export function resourceEntry(
  timeSec: number,
  bank: Res4,
  spent: Res4,
  perMinute: Res4 = [0, 0, 0, 0],
): Uint8Array {
  return concat(
    i32(timeSec),
    fwgs(...bank),
    fwgs(...spent),
    fwgs(...perMinute),
    EMPTY_DICT(), // units
    i32(0), // trailing unknown
  )
}

/** One score-timeline entry. */
export function scoreEntry(
  timeSec: number,
  economy: number,
  military: number,
  society: number,
  technology: number,
  total: number,
): Uint8Array {
  return concat(i32(timeSec), f32(economy), f32(military), f32(society), f32(technology), f32(total))
}

export interface StpdOptions {
  profileId?: number
  civ?: string
  outcome?: number
  unitsProduced?: number
  unitsLost?: number
  unitsKilled?: number
  buildingsLost?: number
  buildingsRazed?: number
  techResearched?: number
  largestArmy?: number
  sacred?: [number, number, number]
  resourcesGathered?: Res4
  resourcesSpent?: Res4
  relicsCaptured?: number
  villagerHigh?: number
  /** Raw milliseconds, as the game writes them (0 = never reached). */
  ageMsec?: [number, number, number]
}

/**
 * A REAL v2034 STPD data payload: the full fixed header (per DataSTPD.cs), the
 * resource + score timelines, and the tail through the age-up timestamps.
 */
export function stpdData(
  playerId: number,
  name: string,
  resources: Uint8Array[],
  scores: Uint8Array[],
  o: StpdOptions = {},
): Uint8Array {
  const [g0, g1, g2, g3] = o.resourcesGathered ?? [0, 0, 0, 0]
  const [s0, s1, s2, s3] = o.resourcesSpent ?? [0, 0, 0, 0]
  const [sc, sl, sn] = o.sacred ?? [0, 0, 0]
  const [a2, a3, a4] = o.ageMsec ?? [0, 0, 0]
  return concat(
    // --- fixed header ---
    i32(playerId),
    ustr(name),
    i32s(o.outcome ?? 8, 0, -1), // outcome, unknown3, timestampEliminated
    i32(-1), // unknown4 (v≥2033)
    i32s(0, 0), // unknown5a-b
    i32(o.unitsProduced ?? 0),
    zeros32(9), // unknown5d..5l
    i32(o.largestArmy ?? 0),
    zeros32(9), // unknown5n..5v
    i32s(0, 0), // unknown6, unknown7
    EMPTY_DICT(), // unknownItems1
    i32(o.buildingsLost ?? 0),
    i32(0), // unknown9a
    i32(o.unitsLost ?? 0),
    i32(0), // unitsLostResources
    zeros32(6), // unknown9d..9i
    i32(o.techResearched ?? 0),
    i32(0), // unknown9k
    EMPTY_DICT(), EMPTY_DICT(), EMPTY_DICT(), EMPTY_DICT(),
    i32(o.unitsKilled ?? 0),
    i32(0), // unitsKilledResources
    i32s(0, 0), // unknown10c-d
    i32(o.buildingsRazed ?? 0),
    zeros32(6), // unknown10f..10k
    fwgs(g0, g1, g2, g3), // totalResourcesGathered
    fwgs(s0, s1, s2, s3), // totalResourcesSpent
    EMPTY_DICT(), EMPTY_DICT(), EMPTY_DICT(), EMPTY_DICT(),
    zeros32(6), // unknown11a
    i32s(sc, sl, sn),
    zeros32(9), // unknown11e
    EMPTY_DICT(), // unknownItems4
    zeros32(4), // unknown12
    new Uint8Array([0]), // unknown13
    str(o.civ ?? 'english'),
    i32s(0, 0), // unknown14a-b
    i32(o.profileId ?? -1),
    i32(0), // unknown14d
    // --- timelines ---
    i32(resources.length), ...resources,
    i32(scores.length), ...scores,
    // --- tail ---
    i32(0), // unknown15 count
    zeros32(4), // unknown16a-d
    i32(0), // unitTimeline count
    i32(0), // unknown17 count
    zeros32(8), // unknown18..23
    f32(o.relicsCaptured ?? 0),
    f32(0), // unknown25
    zeros32(6), // unknown26
    new Uint8Array([0]), // unknown27a
    f32(0), // unknown27b
    i32(0), // unknown27c (v≥2034)
    i32(0), f32(0), i32(0), f32(0), f32(0), // unknown28a-e
    i32(o.villagerHigh ?? 0), // unknown28f = villager high
    f32(0), // unknown28g
    zeros32(8), // unknown29a-h
    i32s(a2, a3, a4), // age2/3/4 available msec
    i32s(0, 0), // unknown29l-m
    i32(0), f32(0), i32(0), f32(0), // unknown30a-d
    i32(0), // playerColor
    zeros32(3), // unknown31-33
    zeros32(16), // v2034 extras (unknown34-49)
  )
}

/**
 * An STPD payload whose header is unparseable garbage (0xFF) after the stable
 * playerId + name — exercises the strict-parse → signature-scan fallback.
 */
export function corruptHeaderStpdData(
  playerId: number,
  name: string,
  resources: Uint8Array[],
  scores: Uint8Array[],
): Uint8Array {
  return concat(
    i32(playerId),
    ustr(name),
    new Uint8Array(40).fill(0xff), // implausible header → strict decode throws
    i32(resources.length), ...resources,
    i32(scores.length), ...scores,
    i32(0), // trailing count
  )
}
