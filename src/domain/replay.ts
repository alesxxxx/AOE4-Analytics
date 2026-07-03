/**
 * Parser for the header of an AoE4 `.rec` replay file (pure).
 *
 * `.rec` files are the **Relic Chunky** format with an UNCOMPRESSED header that
 * lists the map and every player (name, civilization, Steam id). This is the one
 * ToS-safe local source that covers CUSTOM and vs-AI games — which AoE4World's
 * API never indexes — and it gives civ by name (no raceID mapping needed) plus
 * the human opponent's Steam id (which `match_history.jsn` records as `-1`).
 * See docs/RESEARCH-custom-game-tracking.md.
 *
 * We parse only the header (everything before the command stream): map +
 * players. We do NOT read the command/economy stream — that's a much larger,
 * patch-fragile body and is out of scope here.
 *
 * Layout (reverse-engineered from real replays): after the `FOLDINFO` chunk each
 * player is a UTF-16 name, then an ASCII civ token (e.g. `ottoman`,
 * `japanese_ha_sen`), then an ASCII personality string starting with `default`
 * (`default` / `default_campaign` / `default_skirmish`); a human additionally
 * has a UTF-16 17-digit Steam id, AI players do not. Rather than walk the exact
 * (variable, version-shifting) framing, we scan printable string runs and anchor
 * on the stable `default*` personality token — robust to player count and minor
 * format drift.
 */
import { civDisplayName } from './civ'

const MAGIC = 'AOE4_RE'
/** Players + map always live in the first couple of KB; never scan the body. */
const SCAN_LIMIT = 16384

export interface ReplayPlayer {
  name: string
  /** Raw `.rec` civ token, e.g. `ottoman`, `japanese_ha_sen`. */
  civToken: string
  /** Our civ slug if known (e.g. `ottomans`, `sengoku_daimyo`), else null. */
  civSlug: string | null
  /** Display name, e.g. `Ottomans`, `Sengoku Daimyo`. */
  civName: string
  /** 17-digit Steam id for human players; null for AI. */
  steamId: string | null
  ai: boolean
}

export interface ReplayInfo {
  mapId: string | null
  mapName: string | null
  players: ReplayPlayer[]
}

/** `.rec` civ token → our civ slug. Base civs + the variant tokens seen so far. */
const REC_CIV_TO_SLUG: Record<string, string> = {
  english: 'english',
  french: 'french',
  rus: 'rus',
  mongol: 'mongols',
  mongols: 'mongols',
  hre: 'holy_roman_empire',
  chinese: 'chinese',
  abbasid: 'abbasid_dynasty',
  delhi: 'delhi_sultanate',
  sultanate: 'delhi_sultanate',
  ottoman: 'ottomans',
  malian: 'malians',
  malians: 'malians',
  byzantine: 'byzantines',
  japanese: 'japanese',
  ayyubid: 'ayyubids',
  ayyubids: 'ayyubids',
  templar: 'knights_templar',
  // variants (token → variant slug) — confirmed from real replays
  japanese_ha_sen: 'sengoku_daimyo',
  sultanate_ha_tug: 'tughlaq_dynasty',
  french_ha_01: 'jeanne_darc',
}

function prettify(token: string): string {
  return token
    .replace(/_ha_.*$/, '') // drop variant suffix for the fallback label
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Resolve a `.rec` civ token to a slug (if known) + a display name. */
export function resolveReplayCiv(token: string): { slug: string | null; name: string } {
  const t = token.toLowerCase()
  const exact = REC_CIV_TO_SLUG[t]
  if (exact) return { slug: exact, name: civDisplayName(exact) }
  // Unknown variant (`<base>_ha_xxx`) → fall back to its base civ.
  const base = t.replace(/_ha_.*$/, '')
  const baseSlug = REC_CIV_TO_SLUG[base]
  if (baseSlug) return { slug: baseSlug, name: civDisplayName(baseSlug) }
  return { slug: null, name: prettify(t) || token }
}

export interface ReplayMatchup {
  mapId: string | null
  mapName: string | null
  /** The local user's player, if identifiable. */
  me: ReplayPlayer | null
  /** Everyone else (human opponents and/or AI). */
  opponents: ReplayPlayer[]
}

/**
 * Split a parsed replay into "me vs opponents". `me` is the player whose Steam id
 * is one of the local user's; failing that, the sole human (the common vs-AI /
 * skirmish case). Returns `me: null` only when neither rule resolves a player.
 */
export function replayMatchup(info: ReplayInfo, mySteamIds: string[] = []): ReplayMatchup {
  const mine = new Set(mySteamIds.filter(Boolean))
  let meIdx = info.players.findIndex((p) => p.steamId != null && mine.has(p.steamId))
  if (meIdx < 0) {
    const humanIdxs = info.players.map((p, i) => (p.ai ? -1 : i)).filter((i) => i >= 0)
    if (humanIdxs.length === 1) meIdx = humanIdxs[0]!
  }
  return {
    mapId: info.mapId,
    mapName: info.mapName,
    me: meIdx >= 0 ? info.players[meIdx]! : null,
    opponents: info.players.filter((_, i) => i !== meIdx),
  }
}

interface Tok {
  off: number
  enc: 'u16' | 'asc'
  v: string
}

/** Scan printable UTF-16LE and ASCII runs in the header, ordered by offset. */
function scanTokens(b: Uint8Array): Tok[] {
  const limit = Math.min(b.length, SCAN_LIMIT)
  const toks: Tok[] = []
  // UTF-16LE runs, min 2 chars. Accept ASCII + Latin-1 (0x20–0xFF, high byte 0)
  // so accented names like "José"/"Müller" parse — while still requiring the high
  // byte to be 0, which keeps binary noise out. (CJK/Cyrillic names, high byte
  // non-zero, aren't captured to avoid false tokens from the binary body.)
  let i = 0
  while (i + 1 < limit) {
    const start = i
    let s = ''
    while (i + 1 < limit && b[i]! >= 0x20 && b[i]! !== 0x7f && b[i + 1] === 0) {
      s += String.fromCharCode(b[i]!)
      i += 2
    }
    if (s.length >= 2) toks.push({ off: start, enc: 'u16', v: s })
    else i = start + 1
  }
  // ASCII runs, min 3 chars.
  let j = 0
  while (j < limit) {
    const start = j
    let s = ''
    while (j < limit && b[j]! >= 0x20 && b[j]! < 0x7f) {
      s += String.fromCharCode(b[j]!)
      j++
    }
    if (s.length >= 3) toks.push({ off: start, enc: 'asc', v: s })
    else j = start + 1
  }
  return toks.sort((a, c) => a.off - c.off)
}

function indexOfAscii(b: Uint8Array, needle: string, from = 0): number {
  const n = needle.length
  for (let i = from; i + n <= b.length && i < SCAN_LIMIT; i++) {
    let ok = true
    for (let k = 0; k < n; k++) {
      if (b[i + k] !== needle.charCodeAt(k)) {
        ok = false
        break
      }
    }
    if (ok) return i
  }
  return -1
}

const CIV_TOKEN_RE = /^[a-z][a-z0-9_]{2,}$/
const STEAM_ID_RE = /^7656\d{13}$/

/** Parse the map + players from a `.rec` header, or null if it isn't a replay. */
export function parseReplayHeader(input: Uint8Array): ReplayInfo | null {
  const b = input
  if (b.length < 12) return null
  let magic = ''
  for (let k = 0; k < MAGIC.length; k++) magic += String.fromCharCode(b[4 + k]!)
  if (magic !== MAGIC) return null

  const toks = scanTokens(b)
  const foldInfo = indexOfAscii(b, 'FOLDINFO')

  // --- Map ---
  let mapId: string | null = null
  let mapName: string | null = null
  const scenarioTok = toks.find(
    (t) => t.enc === 'asc' && /scenarios[\\/]/i.test(t.v) && (foldInfo < 0 || t.off < foldInfo),
  )
  if (scenarioTok) {
    const m = /[\\/]([a-z0-9_]+)\s*$/i.exec(scenarioTok.v)
    mapId = m ? m[1]! : null
    const disp = toks.find((t) => t.enc === 'u16' && t.off > scenarioTok.off)
    mapName = disp ? disp.v : null
  } else {
    const sizeTok = toks.find((t) => t.enc === 'asc' && /^map_size_\d+$/.test(t.v))
    if (sizeTok) {
      const idTok = toks.find(
        (t) => t.enc === 'asc' && t.off > sizeTok.off && CIV_TOKEN_RE.test(t.v),
      )
      if (idTok) mapId = idTok.v
    }
  }
  if (mapId && !mapName) mapName = prettify(mapId)

  // --- Players --- anchored on the `default*` personality token, which lives in
  // the FOLDINFO block. Without FOLDINFO we can't trust the layout, so don't guess.
  if (foldInfo < 0) return { mapId, mapName, players: [] }

  const after = foldInfo
  const anchors = toks.filter((t) => t.enc === 'asc' && t.off > after && t.v.startsWith('default'))
  const reversed = [...toks].reverse()
  const players: ReplayPlayer[] = []
  for (let a = 0; a < anchors.length; a++) {
    const anchor = anchors[a]!
    // Bound each player to its own window — (previous personality, this one) — so
    // an empty/unparsed name can't reach back and grab the prior player's name.
    const lowerOff = a > 0 ? anchors[a - 1]!.off : after
    const nextAnchorOff = a + 1 < anchors.length ? anchors[a + 1]!.off : Number.POSITIVE_INFINITY
    // civ = last civ-shaped ASCII token before the personality, within the window
    const civTok = reversed.find(
      (t) => t.enc === 'asc' && t.off < anchor.off && t.off > lowerOff && CIV_TOKEN_RE.test(t.v),
    )
    if (!civTok) continue
    // name = last UTF-16 token before the civ, within the window
    const nameTok = reversed.find((t) => t.enc === 'u16' && t.off < civTok.off && t.off > lowerOff)
    const steamTok = toks.find(
      (t) =>
        t.enc === 'u16' && t.off > anchor.off && t.off < nextAnchorOff && STEAM_ID_RE.test(t.v),
    )
    const civ = resolveReplayCiv(civTok.v)
    players.push({
      name: nameTok ? nameTok.v : '',
      civToken: civTok.v,
      civSlug: civ.slug,
      civName: civ.name,
      steamId: steamTok ? steamTok.v : null,
      ai: !steamTok,
    })
  }

  return { mapId, mapName, players }
}
