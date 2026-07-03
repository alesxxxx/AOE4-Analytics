/**
 * Parses Steam's `config/loginusers.vdf` to discover the Steam accounts that
 * have signed in on this machine (DECISIONS D31). Pure + testable. Reading your
 * own Steam config is ToS-safe (not game memory). Used to offer a one-click
 * "Connect with Steam" instead of typing your name — AoE4 is also on Xbox, so
 * it's an option, not the only path.
 */

export interface SteamAccount {
  steamId: string
  accountName: string | null
  personaName: string | null
  mostRecent: boolean
}

const USER_BLOCK = /"(7656\d{13})"\s*\{([\s\S]*?)\}/g

function field(body: string, key: string): string | null {
  const m = new RegExp(`"${key}"\\s*"([^"]*)"`, 'i').exec(body)
  return m ? (m[1] ?? null) : null
}

/** Extracts accounts from loginusers.vdf text, most-recent first. */
export function parseLoginUsers(text: string): SteamAccount[] {
  const accounts: SteamAccount[] = []
  for (const [, steamId, body] of text.matchAll(USER_BLOCK)) {
    accounts.push({
      steamId: steamId!,
      accountName: field(body!, 'AccountName'),
      personaName: field(body!, 'PersonaName'),
      mostRecent: field(body!, 'MostRecent') === '1',
    })
  }
  return accounts.sort((a, b) => Number(b.mostRecent) - Number(a.mostRecent))
}

/**
 * Cross-references an AoE4 profile to one of this PC's Steam accounts. Matches on
 * the **SteamID64** first — the exact id shared by the AoE4World profile, the
 * replay header, and the local Steam login — then falls back to a case-insensitive
 * **name** match (persona or account name == the AoE4 name) for profiles with no
 * linked Steam id (e.g. Xbox players). Returns null when nothing matches.
 */
export function matchSteamAccount(
  accounts: SteamAccount[],
  profile: { steamId?: string | null; name?: string | null },
): SteamAccount | null {
  if (profile.steamId) {
    const byId = accounts.find((a) => a.steamId === profile.steamId)
    if (byId) return byId
  }
  const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase()
  const target = norm(profile.name)
  if (target) {
    const byName = accounts.find(
      (a) => norm(a.personaName) === target || norm(a.accountName) === target,
    )
    if (byName) return byName
  }
  return null
}
