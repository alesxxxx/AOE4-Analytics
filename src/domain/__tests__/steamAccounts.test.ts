import { describe, it, expect } from 'vitest'
import { matchSteamAccount, parseLoginUsers } from '../steamAccounts'

const vdf = `"users"
{
  "76561198441946739"
  {
    "AccountName"   "alt"
    "PersonaName"   "Alt Account"
    "MostRecent"    "0"
    "Timestamp"     "1700000000"
  }
  "76561198346316064"
  {
    "AccountName"   "main"
    "PersonaName"   "1.1.1.1.2"
    "MostRecent"    "1"
    "Timestamp"     "1782000000"
  }
}`

describe('parseLoginUsers', () => {
  it('extracts accounts with persona + most-recent flag', () => {
    const accounts = parseLoginUsers(vdf)
    expect(accounts).toHaveLength(2)
    // most-recent sorts first
    expect(accounts[0]!.steamId).toBe('76561198346316064')
    expect(accounts[0]!.personaName).toBe('1.1.1.1.2')
    expect(accounts[0]!.mostRecent).toBe(true)
    expect(accounts[1]!.mostRecent).toBe(false)
  })

  it('returns [] for empty / non-vdf input', () => {
    expect(parseLoginUsers('')).toEqual([])
    expect(parseLoginUsers('garbage')).toEqual([])
  })
})

describe('matchSteamAccount', () => {
  const accounts = parseLoginUsers(vdf) // [main "1.1.1.1.2", alt "Alt Account"]

  it('matches by exact SteamID64 first (even when a name would mislead)', () => {
    const m = matchSteamAccount(accounts, { steamId: '76561198346316064', name: 'Alt Account' })
    expect(m?.steamId).toBe('76561198346316064')
  })

  it('falls back to a case-insensitive name match when there is no steam id', () => {
    const m = matchSteamAccount(accounts, { steamId: null, name: 'alt account' })
    expect(m?.steamId).toBe('76561198441946739')
  })

  it('returns null when neither id nor name matches', () => {
    expect(matchSteamAccount(accounts, { steamId: '76561190000000000', name: 'Nobody' })).toBeNull()
  })
})
