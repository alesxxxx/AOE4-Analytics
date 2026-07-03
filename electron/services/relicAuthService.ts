/**
 * Steam-authenticated Relic access for RANKED economy/build order (D54). AoE4
 * uploads a per-match stat SUMMARY blob to Relic (same Chunky format as the local
 * `stats.rgs`); it's Azure-gated, so we need a Relic session, which needs a Steam
 * app ticket. We get one via a QR login the USER approves in the Steam mobile app
 * — no password ever typed — and persist the refresh token (encrypted via
 * `safeStorage`) so it's zero-touch afterwards. On first run, we try to piggyback
 * the running Steam client's machine token (if present in config.vdf) to skip even
 * the QR step. Credentials never leave the machine and are never in the repo.
 *
 * Chain: piggyback / QR (steam-session) → refresh token → steam-user → encrypted
 * app ticket → `game/login/platformlogin` session → `game/cloud/getTempCredentials`
 * (Azure SAS token) → download the datatype-1 blob → `parseStatsSummary`.
 */
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import SteamUser from 'steam-user'
import { LoginSession, EAuthTokenPlatformType, EAuthSessionGuardType } from 'steam-session'
import { parseStatsSummary, type MatchSummary } from '@domain/statsSummary'
import { parseLoginUsers } from '@domain/steamAccounts'
import type {
  SteamAuthStatus,
  SteamCredentialsLoginResult,
  SteamGuardAction,
  SteamGuardActionKind,
} from '@ipc/contract'
import type { RelicRecentMatchHistoryResponse } from '@api/relicTypes'
import { getRelicClient } from './appContext'
import { findSteamPath } from './steamService'
import {
  hasCachedSummary,
  hasUnavailableSummary,
  markSummaryUnavailable,
  readCachedParsedSummary,
  writeCachedSummary,
} from './summaryCache'

const AOE4_APPID = 1466860
const TITLE = 'age4'
const RELIC = 'https://aoe-api.worldsedgelink.com'
const SESSION_TTL_MS = 3 * 60_000

function tokenPath(): string {
  return join(app.getPath('userData'), 'steam-refresh.bin')
}

// --- persisted refresh token (encrypted at rest, never plaintext) ---
// The UI promises the login is stored encrypted; if OS-level encryption is
// unavailable we keep the session in memory only (re-auth next launch) rather
// than writing a raw refresh credential to disk.
function saveToken(token: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[steam] safeStorage unavailable — not persisting token (session only)')
      return
    }
    writeFileSync(tokenPath(), safeStorage.encryptString(token))
  } catch (e) {
    console.warn('[steam] could not persist token', e)
  }
}
/** A legacy plaintext token is a Steam refresh token, i.e. a JWT — the only
 *  thing older builds ever wrote unencrypted. Encrypted blobs never match. */
function isPlaintextToken(buf: Buffer): boolean {
  return buf.subarray(0, 3).toString('utf8') === 'eyJ' && buf.toString('utf8').split('.').length === 3
}
function loadToken(): string | null {
  try {
    if (!existsSync(tokenPath())) return null
    const buf = readFileSync(tokenPath())
    if (isPlaintextToken(buf)) {
      clearToken() // raw credential from an older build — purge, force a re-login
      return null
    }
    // Transiently-unavailable keystore or a decrypt hiccup: keep the encrypted
    // file (it may decrypt fine next launch); just skip the silent restore.
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}
function clearToken(): void {
  try {
    rmSync(tokenPath(), { force: true })
  } catch {
    /* ignore */
  }
}

// --- in-memory session state ---
let steamClient: SteamUser | null = null
let steamId: string | null = null
let alias: string | null = null
let loggedOn = false
let connecting = false
let lastError: string | null = null
let relicSession: string | null = null
let relicSessionAt = 0
let activeLoginSession: LoginSession | null = null

export function getSteamAuthStatus(): SteamAuthStatus {
  return { connected: loggedOn, connecting, name: alias, error: lastError }
}

/** Log into steam-user with a refresh token; resolves once fully logged on. */
function loginWithToken(refreshToken: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new SteamUser({ dataDirectory: null, autoRelogin: false })
    let settled = false
    client.logOn({ refreshToken })
    client.on('refreshToken', (t: string) => saveToken(t)) // Steam may rotate it
    client.on('accountInfo', (name: string) => {
      alias = name
    })
    client.on('error', (e: Error & { eresult?: number }) => {
      loggedOn = false
      steamClient = null
      if (!settled) {
        settled = true
        reject(new Error(`Steam login failed: ${e.message} (eresult ${e.eresult ?? '?'})`))
      }
    })
    client.on('loggedOn', () => {
      steamClient = client
      steamId = client.steamID?.getSteamID64() ?? null
      alias = client.accountInfo?.name ?? alias
      loggedOn = true
      lastError = null
      if (!settled) {
        settled = true
        resolve()
      }
    })
  })
}

interface LoginStartResponse {
  actionRequired: boolean
  validActions?: { type: number; detail?: string }[]
  qrChallengeUrl?: string
}

function guardActionKind(type: number): SteamGuardActionKind {
  switch (type) {
    case EAuthSessionGuardType.EmailCode:
      return 'email-code'
    case EAuthSessionGuardType.DeviceCode:
      return 'device-code'
    case EAuthSessionGuardType.DeviceConfirmation:
      return 'device-confirmation'
    case EAuthSessionGuardType.EmailConfirmation:
      return 'email-confirmation'
    default:
      return 'unknown'
  }
}

function mapGuardActions(response: LoginStartResponse): SteamGuardAction[] {
  return (response.validActions ?? [])
    .map((a) => ({ type: guardActionKind(a.type), detail: a.detail ?? null }))
    .filter((a) => a.type !== 'unknown')
}

function credentialLoginResult(
  response: LoginStartResponse,
  message: string | null = null,
): SteamCredentialsLoginResult {
  return {
    actionRequired: response.actionRequired,
    actions: mapGuardActions(response),
    message,
  }
}

function clearActiveLoginSession(session: LoginSession | null, cancel: boolean): void {
  if (!session) return
  if (activeLoginSession === session) activeLoginSession = null
  if (cancel) {
    try {
      session.cancelLoginAttempt()
    } catch {
      /* ignore */
    }
  }
}

function attachLoginSessionHandlers(session: LoginSession, timeoutMessage: string): void {
  session.on('authenticated', () => {
    const token = session.refreshToken
    saveToken(token)
    loginWithToken(token)
      .catch((e) => {
        lastError = e instanceof Error ? e.message : String(e)
      })
      .finally(() => {
        clearActiveLoginSession(session, false)
        connecting = false
      })
  })
  session.on('timeout', () => {
    lastError = timeoutMessage
    clearActiveLoginSession(session, false)
    connecting = false
  })
  session.on('error', (e: Error) => {
    lastError = e.message
    clearActiveLoginSession(session, false)
    connecting = false
  })
}

function beginActiveLoginSession(session: LoginSession, timeoutMessage: string): void {
  clearActiveLoginSession(activeLoginSession, true)
  activeLoginSession = session
  attachLoginSessionHandlers(session, timeoutMessage)
}

/**
 * Begins a QR login. Returns the challenge URL to render as a QR code; the user
 * approves it in the Steam mobile app. Auth completes in the background — poll
 * `getSteamAuthStatus()` (connecting → connected). Never rejects for a normal
 * timeout; sets `lastError` instead.
 */
export async function steamStartLogin(): Promise<{ challengeUrl: string }> {
  connecting = true
  lastError = null
  const session = new LoginSession(EAuthTokenPlatformType.SteamClient)
  beginActiveLoginSession(session, 'QR code timed out — try again')
  let started: LoginStartResponse
  try {
    started = await session.startWithQR()
  } catch (e) {
    clearActiveLoginSession(session, false)
    connecting = false
    throw e
  }
  if (!started.qrChallengeUrl) {
    clearActiveLoginSession(session, false)
    connecting = false
    throw new Error('Steam did not return a QR challenge')
  }
  return { challengeUrl: started.qrChallengeUrl as string }
}

/**
 * Begins a conventional Steam username/password login. The password is only
 * passed to Steam for this one request; we persist only Steam's refresh token
 * after successful authentication, using the same encrypted storage as QR.
 */
export async function steamStartCredentialsLogin(
  accountName: string,
  password: string,
): Promise<SteamCredentialsLoginResult> {
  const trimmedAccount = accountName.trim()
  if (!trimmedAccount || !password) throw new Error('Steam account name and password are required')
  connecting = true
  lastError = null
  const session = new LoginSession(EAuthTokenPlatformType.SteamClient)
  beginActiveLoginSession(session, 'Steam login timed out — try again')
  try {
    const started = await session.startWithCredentials({
      accountName: trimmedAccount,
      password,
    })
    return credentialLoginResult(started)
  } catch (e) {
    clearActiveLoginSession(session, false)
    connecting = false
    lastError = e instanceof Error ? e.message : String(e)
    throw e
  }
}

export async function steamSubmitSteamGuardCode(
  code: string,
): Promise<SteamCredentialsLoginResult> {
  const trimmed = code.trim()
  if (!trimmed) throw new Error('Steam Guard code is required')
  if (!activeLoginSession) throw new Error('No Steam login is waiting for a Steam Guard code')
  connecting = true
  lastError = null
  try {
    await activeLoginSession.submitSteamGuardCode(trimmed)
    return {
      actionRequired: false,
      actions: [],
      message: 'Steam Guard code accepted. Waiting for Steam to finish sign-in.',
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
    throw e
  }
}

export async function steamLogout(): Promise<void> {
  try {
    steamClient?.logOff()
  } catch {
    /* ignore */
  }
  clearActiveLoginSession(activeLoginSession, true)
  steamClient = null
  steamId = null
  alias = null
  loggedOn = false
  connecting = false
  relicSession = null
  lastError = null
  clearToken()
}

function getEncryptedTicket(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!steamClient || !loggedOn) return reject(new Error('Steam not connected'))
    steamClient.getEncryptedAppTicket(AOE4_APPID, Buffer.from('RLINK'), (err, ticket) => {
      if (err) return reject(new Error(`app ticket failed: ${err.message}`))
      resolve(ticket.toString('base64'))
    })
  })
}

async function ensureRelicSession(): Promise<string> {
  if (relicSession && Date.now() - relicSessionAt < SESSION_TTL_MS) return relicSession
  if (!steamId || !loggedOn) throw new Error('Steam not connected')
  const ticketB64 = await getEncryptedTicket()
  const body = new URLSearchParams({
    accountType: 'STEAM', activeMatchId: '-1', alias: alias ?? 'player', appID: String(AOE4_APPID),
    auth: ticketB64, callNum: '0', clientLibVersion: '169', connect_id: '', country: 'US',
    installationType: 'windows', language: 'en', lastCallTime: '0', macAddress: '57-4F-4C-4F-4C-4F',
    majorVersion: '4.0.0', minorVersion: '0', platformUserID: steamId, startGameToken: '',
    syncHash: '[3705476802, 2905248376]', timeoutOverride: '0', title: TITLE,
  })
  const res = await fetch(`${RELIC}/game/login/platformlogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  if (!text.includes(`/steam/${steamId}`)) {
    throw new Error(`Relic platformlogin failed (HTTP ${res.status})`)
  }
  relicSession = String(JSON.parse(text)[1])
  relicSessionAt = Date.now()
  return relicSession
}

// ---------------------------------------------------------------------------
// Azure SAS signing via /game/cloud/getTempCredentials
// ---------------------------------------------------------------------------

/**
 * Extracts the blob path from a Relic matchurl Azure URL (strips the host AND
 * the `cloudfiles/` container prefix — the key must be the blob name only).
 * `https://rl0…blob.core.windows.net/cloudfiles/47032222/aoelive_/…`
 * → `47032222/aoelive_/…`
 */
function blobKeyFromUrl(rawUrl: string): string {
  return rawUrl.replace(/^https?:\/\/[^/]+\//, '').replace(/^cloudfiles\//, '')
}

/**
 * Asks Relic for temporary Azure SAS credentials for a blob. Returns a signed
 * URL ready for download, or null on failure.
 */
async function requestTempCredentials(
  sessionID: string,
  rawBlobUrl: string,
  blobPath: string,
): Promise<string | null> {
  const qs = new URLSearchParams({
    title: TITLE,
    callNum: String(1 + Math.floor(Math.random() * 300)),
    connect_id: sessionID,
    key: blobPath,
    sessionID,
  })
  const res = await fetch(`${RELIC}/game/cloud/getTempCredentials?${qs}`)
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data) || data[0] !== 0) return null
    const base = rawBlobUrl.split('?')[0]!

    // Relic returns [0, <expiry_ts>, "<SAS query string>"] — the SAS params
    // can be at any index after the result code; scan for the first string
    // that looks like SAS credentials or a full signed URL.
    for (let i = 1; i < data.length; i++) {
      const el = data[i]
      if (typeof el === 'string') {
        if (el.startsWith('http')) return el
        if (el.includes('sig=') || el.includes('sv=')) return `${base}?${el}`
      }
      if (typeof el === 'object' && el != null && !Array.isArray(el)) {
        const parts = new URLSearchParams()
        for (const [k, v] of Object.entries(el as Record<string, unknown>)) {
          if (v != null) parts.set(k, String(v))
        }
        return `${base}?${parts}`
      }
    }
  } catch {
    /* not JSON */
  }
  return null
}

// ---------------------------------------------------------------------------
// Steam client piggybacking (zero-touch auth from config.vdf machine tokens)
// ---------------------------------------------------------------------------

/**
 * Extracts JWT machine-auth tokens from Steam's `config.vdf`
 * (`Authentication/RememberedMachineID` section).
 */
function extractMachineTokens(configText: string): string[] {
  const match = configText.match(/"RememberedMachineID"\s*\{([\s\S]*?)\}/i)
  if (!match?.[1]) return []
  const tokens: string[] = []
  const jwtPattern = /"[^"]*"\s+"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)"/g
  for (const [, token] of match[1].matchAll(jwtPattern)) {
    if (token) tokens.push(token)
  }
  return tokens
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Finds a valid (non-expired) machine-auth token for the given SteamID from
 * Steam's local `config.vdf`. Returns the JWT string or null.
 */
async function findMachineToken(targetSteamId: string): Promise<string | null> {
  const steamDir = await findSteamPath()
  if (!steamDir) return null
  const configPath = join(steamDir, 'config', 'config.vdf')
  if (!existsSync(configPath)) return null
  try {
    const tokens = extractMachineTokens(readFileSync(configPath, 'utf8'))
    const now = Math.floor(Date.now() / 1000)
    for (const jwt of tokens) {
      const claims = decodeJwtPayload(jwt)
      if (!claims) continue
      if (String(claims.sub ?? '') === targetSteamId && Number(claims.exp ?? 0) > now) return jwt
    }
  } catch (e) {
    console.warn('[steam] could not read config.vdf for piggybacking:', e)
  }
  return null
}

/**
 * Piggyback auth: find the most-recent Steam user, look for their machine
 * token in config.vdf, and try to log in with it. Returns true on success.
 */
async function piggybackSteamClient(): Promise<boolean> {
  const steamDir = await findSteamPath()
  if (!steamDir) return false
  const loginUsersPath = join(steamDir, 'config', 'loginusers.vdf')
  if (!existsSync(loginUsersPath)) return false
  const accounts = parseLoginUsers(readFileSync(loginUsersPath, 'utf8'))
  const active = accounts.find((a) => a.mostRecent)
  if (!active) return false
  console.log(
    `[steam] piggyback: looking for machine token for ${active.steamId} (${active.personaName ?? active.accountName ?? '?'})`,
  )
  const token = await findMachineToken(active.steamId)
  if (!token) {
    console.log('[steam] piggyback: no valid machine token found')
    return false
  }
  try {
    await loginWithToken(token)
    saveToken(token)
    console.log(`[steam] piggyback succeeded for ${alias}`)
    return true
  } catch (e) {
    console.warn(
      '[steam] piggyback login failed (token may be machine-only):',
      e instanceof Error ? e.message : e,
    )
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Silently restore a saved session at app startup (best-effort). */
export async function restoreSteamSession(): Promise<void> {
  const token = loadToken()
  if (token) {
    try {
      await loginWithToken(token)
      console.log('[steam] session restored for', alias)
      return
    } catch (e) {
      console.warn('[steam] stored token failed; trying piggyback', e)
      clearToken()
    }
  }
  await piggybackSteamClient()
}

/**
 * Runs the ranked-summary fetch with a step-by-step trace, for the user's most
 * recent ranked game — surfaced by a "Test" button so we can see exactly where it
 * breaks without a terminal. Returns a human-readable multi-line report.
 */
export async function diagnoseRankedFetch(profileId: number): Promise<string> {
  const out: string[] = []
  const add = (s: string) => out.push(s)
  try {
    add(`connected: ${loggedOn} (${alias ?? '—'})`)
    if (!loggedOn) return out.join('\n') + '\n→ connect Steam first.'
    const session = await ensureRelicSession()
    add('relic session: ok')
    const res = await getRelicClient().getRecentMatchHistory(profileId)
    const matches = [...res.matchHistoryStats].sort(
      (a, b) => (b.completiontime ?? 0) - (a.completiontime ?? 0),
    )
    add(`recent matches: ${matches.length}`)
    const match = matches[0]
    if (!match) return out.join('\n') + '\n→ no recent matches for this profile.'
    add(`newest match: ${match.id} (type ${match.matchtype_id})`)
    for (const u of match.matchurls ?? []) {
      const state = (u.size ?? -1) > 0 ? 'uploaded' : 'EMPTY (this player never uploaded)'
      add(`  slot: datatype ${u.datatype}, ${u.size} bytes — ${state}`)
    }
    // Same selection as fetchRankedSummary: uploaded datatype-1 slots, biggest first.
    const summary = (match.matchurls ?? [])
      .filter((u) => u.datatype === 1 && u.url && (u.size ?? -1) > 0)
      .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0]
    if (!summary) {
      return (
        out.join('\n') +
        '\n→ no UPLOADED summary on this match (all slots empty — common for games with AI players).'
      )
    }
    const rawUrl = summary.url ?? ''
    const key = blobKeyFromUrl(rawUrl)
    add(`summary url: ${rawUrl.slice(0, 90)}… (${summary.size} bytes)`)
    add(`blob key: ${key.slice(0, 60)}…`)

    const qs = new URLSearchParams({
      title: TITLE,
      callNum: String(1 + Math.floor(Math.random() * 300)),
      connect_id: session,
      key,
      sessionID: session,
    })
    const credRes = await fetch(`${RELIC}/game/cloud/getTempCredentials?${qs}`)
    const credText = await credRes.text()
    // Don't echo the body — it contains live Azure SAS credentials.
    add(`getTempCredentials: HTTP ${credRes.status}, ${credText.length}B`)

    try {
      const credData = JSON.parse(credText)
      if (!Array.isArray(credData) || credData[0] !== 0) {
        add(`→ non-zero result code: ${credData[0]}`)
        return out.join('\n') + '\n→ getTempCredentials returned an error.'
      }
      const base = rawUrl.split('?')[0]!
      let signedUrl: string | null = null

      // Scan for the SAS string (index varies; typically [0, expiry, "sig=…"])
      for (let i = 1; i < credData.length; i++) {
        const el = credData[i]
        if (typeof el === 'string') {
          if (el.startsWith('http')) { signedUrl = el; break }
          if (el.includes('sig=') || el.includes('sv=')) { signedUrl = `${base}?${el}`; break }
        }
        if (typeof el === 'object' && el != null && !Array.isArray(el)) {
          const parts = new URLSearchParams()
          for (const [k, v] of Object.entries(el as Record<string, unknown>)) {
            if (v != null) parts.set(k, String(v))
          }
          signedUrl = `${base}?${parts}`
          break
        }
      }
      if (!signedUrl) {
        return out.join('\n') + '\n→ no SAS string found in getTempCredentials response.'
      }

      add(`signed URL: ${signedUrl.split('?')[0]} (query withheld — contains SAS signature)`)
      const dlRes = await fetch(signedUrl)
      add(`download HTTP ${dlRes.status}`)
      const raw = Buffer.from(await dlRes.arrayBuffer())
      if (raw.length < 1000) {
        add(`body (small — likely Azure error): ${raw.toString('utf8').slice(0, 300)}`)
      }
      const bytes = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw
      const parsed = parseStatsSummary(new Uint8Array(bytes))
      add(
        `  ✓ downloaded ${raw.length}B → inflated ${bytes.length}B → parsed players: ${parsed?.players.length ?? 'null'}`,
      )
      return (
        out.join('\n') +
        (parsed ? '\n✅ WORKS.' : '\n⚠️ downloaded but parse returned null.')
      )
    } catch (e) {
      add(`→ credential/download error: ${e instanceof Error ? e.message : String(e)}`)
      return out.join('\n') + '\n→ getTempCredentials parse or download failed.'
    }
  } catch (e) {
    return out.join('\n') + `\n✗ error: ${e instanceof Error ? e.message : String(e)}`
  }
}

/**
 * Fetches + parses the ranked stat summary for a game, or null when unavailable
 * (not connected, game outside Relic's recent window, or no summary blob). Uses
 * the same parser as the local `stats.rgs`. Cache-first: every downloaded blob is
 * persisted to disk (Relic drops summaries once a game leaves its recent window,
 * so a fetched blob must never be thrown away), and cached reads work offline.
 */
export async function fetchRankedSummary(
  gameId: string,
  profileId: number,
  recentHistory?: RelicRecentMatchHistoryResponse | null,
): Promise<MatchSummary | null> {
  const cached = readCachedParsedSummary(gameId)
  if (cached || hasCachedSummary(gameId)) return cached
  if (hasUnavailableSummary(gameId)) return null

  if (recentHistory === null) return null
  if (!loggedOn) return null
  const res = recentHistory ?? (await getRelicClient().getRecentMatchHistory(profileId))
  const match = res.matchHistoryStats.find((m) => String(m.id) === String(gameId))
  if (!match) {
    markSummaryUnavailable(gameId)
    return null
  }
  // A multiplayer match carries one upload slot PER PLAYER. Some slots are
  // empty (size -1 = that player never uploaded — verified live: a 2v2 vs AI
  // had the first slot empty but a real 266KB summary in the second), so try
  // every uploaded candidate, biggest first, instead of the first entry.
  const candidates = (match.matchurls ?? [])
    .filter((u) => u.datatype === 1 && u.url && (u.size ?? -1) > 0)
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
  if (candidates.length === 0) {
    // No player uploaded a summary (common for games with AI players).
    markSummaryUnavailable(gameId)
    return null
  }

  const session = await ensureRelicSession()
  for (const cand of candidates) {
    try {
      const rawUrl = cand.url!
      const key = blobKeyFromUrl(rawUrl)
      const signed = await requestTempCredentials(session, rawUrl, key)
      if (!signed) continue
      const resp = await fetch(signed)
      if (!resp.ok) continue // BlobNotFound etc — try the next player's upload
      const raw = Buffer.from(await resp.arrayBuffer())
      const bytes = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw
      const parsed = parseStatsSummary(new Uint8Array(bytes))
      if (parsed) {
        writeCachedSummary(gameId, new Uint8Array(bytes)) // only cache blobs that decode
        return parsed
      }
    } catch {
      /* next candidate */
    }
  }
  // Candidates existed but none worked — DON'T tombstone: an upload can still
  // land shortly after a game; the next sync/open retries.
  return null
}
