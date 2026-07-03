import { exec } from 'node:child_process'
import { shell } from 'electron'

/** AoE4's running process (Relic Essence engine). */
const PROCESS_NAME = 'RelicCardinal.exe'
/** Age of Empires IV: Anniversary Edition — Steam app id 1466860. */
const STEAM_RUN_URL = 'steam://rungameid/1466860'

/**
 * Whether the AoE4 process is currently running. Uses `tasklist` on Windows
 * (a benign process listing — not reading game files or memory, so no consent
 * gate needed). Returns null on non-Windows / when undetectable.
 */
export function isGameRunning(): Promise<boolean | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  return new Promise((resolve) => {
    exec(
      `tasklist /FI "IMAGENAME eq ${PROCESS_NAME}" /NH`,
      { windowsHide: true, timeout: 4000 },
      (err, stdout) => {
        if (err) return resolve(null)
        resolve(new RegExp(PROCESS_NAME.replace('.', '\\.'), 'i').test(stdout))
      },
    )
  })
}

export interface LaunchResult {
  ok: boolean
  message?: string
}

/** Launches Age of Empires IV via the Steam protocol. */
export async function launchGame(): Promise<LaunchResult> {
  try {
    await shell.openExternal(STEAM_RUN_URL)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
