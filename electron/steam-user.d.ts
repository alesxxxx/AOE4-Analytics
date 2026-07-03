/**
 * Minimal ambient types for `steam-user` (ships no types) — only the surface the
 * ranked-economy helper uses. See DoctorMcKay/node-steam-user for the full API.
 */
declare module 'steam-user' {
  interface SteamUserOptions {
    dataDirectory?: string | null
    autoRelogin?: boolean
  }
  interface SteamID {
    getSteamID64(): string
  }
  interface AccountInfo {
    name: string
  }
  class SteamUser {
    constructor(options?: SteamUserOptions)
    steamID?: SteamID | null
    accountInfo?: AccountInfo | null
    logOn(details: { refreshToken: string }): void
    logOff(): void
    getEncryptedAppTicket(
      appid: number,
      userData: Buffer,
      callback: (err: (Error & { eresult?: number }) | null, ticket: Buffer) => void,
    ): void
    on(event: 'loggedOn', listener: () => void): this
    on(event: 'error', listener: (err: Error & { eresult?: number }) => void): this
    on(event: 'accountInfo', listener: (name: string) => void): this
    on(event: 'refreshToken', listener: (token: string) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }
  export = SteamUser
}
