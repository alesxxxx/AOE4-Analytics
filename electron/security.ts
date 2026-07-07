import { shell, type BrowserWindow, type Event, type Session } from 'electron'
import { isDev } from './env'

/**
 * Production CSP. Network calls to AoE4World happen in the MAIN process, so the
 * renderer only needs `img-src` for the data.aoe4world.com CDN (civ/unit icons).
 */
const PROD_CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://data.aoe4world.com https://aoe4world.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

/**
 * Dev CSP — Vite's HMR client and the React Fast Refresh preamble need inline
 * scripts, eval, and a websocket back to the dev server. Strict CSP is enforced
 * only in production builds.
 */
const DEV_CSP = [
  "default-src 'self'",
  "img-src 'self' data: https: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' ws: http: https:",
  "font-src 'self' data:",
].join('; ')

/**
 * Applies a Content-Security-Policy response header to every renderer load.
 * Header-based CSP is preferred over a static `<meta>` tag because it lets us
 * use a relaxed policy in dev (for HMR) and a strict one in production without
 * editing HTML.
 */
export function applySecurityPolicy(session: Session): void {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? DEV_CSP : PROD_CSP],
      },
    })
  })
}

/** Schemes we'll hand to the OS browser; everything else is dropped. */
const ALLOWED_OPEN_PROTOCOLS = new Set(['https:', 'http:'])

/**
 * Whether a navigation target is the document we're already on. `file:` URLs all
 * share the opaque origin "null", so an origin check can never block a `file:`
 * navigation in packaged builds — compare the full normalized URL (pathname)
 * instead. http(s) (the dev server) keeps the origin comparison so HMR-driven
 * reloads of the same localhost origin stay allowed.
 */
function sameDocument(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    if (ua.protocol === 'file:' || ub.protocol === 'file:') {
      return ua.protocol === ub.protocol && ua.pathname === ub.pathname
    }
    return ua.origin === ub.origin
  } catch {
    return false
  }
}

/**
 * Standard Electron hardening applied to every window: open only http(s) links
 * externally (no `file:`/custom-scheme handoff to the OS), and block any
 * top-level navigation/redirect away from the app's own origin. The app is a
 * local SPA (react-router uses the history API, not full document loads), so a
 * real navigation is always unexpected.
 */
export function hardenWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    let protocol = ''
    try {
      protocol = new URL(url).protocol
    } catch {
      // malformed URL — deny
    }
    if (ALLOWED_OPEN_PROTOCOLS.has(protocol)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const guard = (e: Event, url: string): void => {
    if (!sameDocument(url, win.webContents.getURL())) e.preventDefault()
  }
  win.webContents.on('will-navigate', guard)
  win.webContents.on('will-redirect', guard)
}
