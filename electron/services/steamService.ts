import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { parseLoginUsers, type SteamAccount } from '@domain/steamAccounts'

const execFileAsync = promisify(execFile)

/** Reads the Steam install path from the registry (Windows), best-effort. */
async function steamPathFromRegistry(): Promise<string | null> {
  if (process.platform !== 'win32') return null
  try {
    const { stdout } = await execFileAsync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { windowsHide: true },
    )
    const m = /SteamPath\s+REG_SZ\s+(.+)/i.exec(stdout)
    return m ? m[1]!.trim() : null
  } catch {
    return null
  }
}

/** Locates the Steam install dir (registry → common defaults). */
export async function findSteamPath(): Promise<string | null> {
  const candidates = [
    await steamPathFromRegistry(),
    process.env['ProgramFiles(x86)'] ? join(process.env['ProgramFiles(x86)']!, 'Steam') : null,
    process.env['ProgramFiles'] ? join(process.env['ProgramFiles']!, 'Steam') : null,
    'C:\\Program Files (x86)\\Steam',
  ].filter((p): p is string => !!p)

  for (const p of candidates) {
    if (existsSync(join(p, 'config', 'loginusers.vdf'))) return p
  }
  return null
}

/**
 * Discovers Steam accounts that have signed in on this machine (most-recent
 * first). Reads only Steam's own `loginusers.vdf` — not game memory.
 */
export async function getSteamAccounts(): Promise<SteamAccount[]> {
  try {
    const steamPath = await findSteamPath()
    if (!steamPath) return []
    const vdf = join(steamPath, 'config', 'loginusers.vdf')
    if (!existsSync(vdf)) return []
    return parseLoginUsers(readFileSync(vdf, 'utf8'))
  } catch {
    return []
  }
}

// --- Steam community avatar (public profile picture, no API key) ---

const avatarMemo = new Map<string, Promise<string | null>>()

function avatarCachePath(steamId: string): string {
  return join(app.getPath('userData'), 'avatars', `${steamId}.jpg`)
}

/**
 * The Steam community avatar for a SteamID64 as a `data:` URL. Public data —
 * `steamcommunity.com/profiles/<id>?xml=1` exposes `avatarFull` without auth.
 * Disk-cached per id (renders offline, no re-fetch every launch); memoized per
 * session. Null for invalid ids, fetch failures, or profiles without an avatar.
 */
export function getSteamAvatar(steamId: string): Promise<string | null> {
  if (!/^\d{17}$/.test(steamId)) return Promise.resolve(null)
  let p = avatarMemo.get(steamId)
  if (!p) {
    p = fetchAvatar(steamId).catch(() => readCachedAvatar(steamId))
    avatarMemo.set(steamId, p)
    // Don't memoize a failure for the whole session — let the next call retry.
    void p.then((url) => {
      if (url == null) avatarMemo.delete(steamId)
    })
  }
  return p
}

async function fetchAvatar(steamId: string): Promise<string | null> {
  const cached = readCachedAvatar(steamId)
  if (cached) return cached
  const res = await fetch(`https://steamcommunity.com/profiles/${steamId}?xml=1`)
  if (!res.ok) return null
  const xml = await res.text()
  const m = /<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/.exec(xml)
  if (!m?.[1]) return null
  const img = await fetch(m[1])
  if (!img.ok) return null
  const bytes = Buffer.from(await img.arrayBuffer())
  try {
    mkdirSync(join(app.getPath('userData'), 'avatars'), { recursive: true })
    writeFileSync(avatarCachePath(steamId), bytes)
  } catch {
    /* cache is best-effort */
  }
  return `data:image/jpeg;base64,${bytes.toString('base64')}`
}

function readCachedAvatar(steamId: string): string | null {
  try {
    const file = avatarCachePath(steamId)
    if (!existsSync(file)) return null
    return `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`
  } catch {
    return null
  }
}
