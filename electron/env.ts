import { app } from 'electron'

/**
 * True only for a genuine dev run. We additionally require `!app.isPackaged` so a
 * leaked/misconfigured `ELECTRON_RENDERER_URL` in a packaged build can never flip
 * the app into the relaxed dev CSP or the remote-loading code path.
 */
export const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']
