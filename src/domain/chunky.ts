/**
 * A pure reader for Relic's "Relic Chunky" container format (FOLD/DATA chunk
 * tree). AoE4 writes its post-game stat SUMMARY in this format — `stats.rgs`
 * beside each custom game's replay, and the byte-identical datatype-1 blob Relic
 * serves for ranked games (fetched by the backend). One parser, both sources.
 * Operates on a Uint8Array so it's safe in the renderer too (no Node Buffer).
 *
 * Layout (little-endian), reverse-engineered + cross-checked against
 * aoe4world/replays-api docs/replaySummary.bt:
 *   file:  "Relic Chunky\r\n\x1a\0" (16) · version u32 · platform u32   → 24-byte header
 *   chunk: type[4] "FOLD"|"DATA" · id[4] (e.g. "STLI") · version u32 ·
 *          dataSize u32 · nameLength u32 · name[nameLength] · data[dataSize]
 *   FOLD data is itself a sequence of chunks; DATA data is opaque.
 */

const MAGIC = 'Relic Chunky'
const FILE_HEADER_SIZE = 24
const CHUNK_HEADER_SIZE = 20 // type+id+version+dataSize+nameLength, before the name

export interface ChunkyNode {
  kind: 'FOLD' | 'DATA'
  /** The 4-char chunk id, e.g. "STLI", "STLS", "STPD". */
  id: string
  version: number
  /** The optional in-file name (usually "" except the root "StatLoggingInternal"). */
  name: string
  /** Byte range of this chunk's data within the source buffer. */
  dataStart: number
  dataEnd: number
  /** Present for FOLD chunks; the parsed sub-chunks. */
  children?: ChunkyNode[]
}

const latin1 = new TextDecoder('latin1')

function ascii(bytes: Uint8Array, start: number, len: number): string {
  return latin1.decode(bytes.subarray(start, start + len))
}

/** True if the buffer starts with the Relic Chunky magic. */
export function isRelicChunky(bytes: Uint8Array): boolean {
  return bytes.length >= 16 && ascii(bytes, 0, MAGIC.length) === MAGIC
}

/**
 * Parses the whole Chunky file into a chunk tree, or null if it isn't a valid
 * Relic Chunky (wrong magic / truncated). Never throws on malformed input — it
 * stops at the first inconsistent chunk and returns what it has.
 */
export function parseChunky(bytes: Uint8Array): ChunkyNode[] | null {
  if (!isRelicChunky(bytes)) return null
  return parseChunkList(bytes, FILE_HEADER_SIZE, bytes.length)
}

function parseChunkList(bytes: Uint8Array, start: number, end: number): ChunkyNode[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: ChunkyNode[] = []
  let p = start
  while (p + CHUNK_HEADER_SIZE <= end) {
    const type = ascii(bytes, p, 4)
    if (type !== 'FOLD' && type !== 'DATA') break // not a chunk boundary — stop cleanly
    const id = ascii(bytes, p + 4, 4)
    const version = view.getUint32(p + 8, true)
    const dataSize = view.getUint32(p + 12, true)
    const nameLength = view.getUint32(p + 16, true)
    let q = p + CHUNK_HEADER_SIZE
    if (q + nameLength > end) break
    const name = nameLength > 0 ? ascii(bytes, q, nameLength).replace(/\0+$/, '') : ''
    q += nameLength
    const dataStart = q
    const dataEnd = dataStart + dataSize
    if (dataEnd > end) break // truncated chunk — bail rather than read past the buffer
    const node: ChunkyNode = { kind: type, id, version, name, dataStart, dataEnd }
    if (type === 'FOLD') node.children = parseChunkList(bytes, dataStart, dataEnd)
    out.push(node)
    p = dataEnd
  }
  return out
}

/** First direct child with this id (optionally constrained to FOLD/DATA), or null. */
export function findChild(
  nodes: ChunkyNode[] | undefined,
  id: string,
  kind?: 'FOLD' | 'DATA',
): ChunkyNode | null {
  if (!nodes) return null
  return nodes.find((n) => n.id === id && (kind == null || n.kind === kind)) ?? null
}

/** All direct children with this id (optionally constrained to FOLD/DATA). */
export function findChildren(
  nodes: ChunkyNode[] | undefined,
  id: string,
  kind?: 'FOLD' | 'DATA',
): ChunkyNode[] {
  if (!nodes) return []
  return nodes.filter((n) => n.id === id && (kind == null || n.kind === kind))
}

/**
 * Depth-first search for the first descendant with this id — the summary tree
 * nests players under STLI→STPL→STLP, so callers often want a deep lookup.
 */
export function findDescendant(nodes: ChunkyNode[] | undefined, id: string): ChunkyNode | null {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findDescendant(n.children, id)
    if (found) return found
  }
  return null
}
