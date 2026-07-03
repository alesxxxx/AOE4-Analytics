import type { RtslyticsApi } from '@ipc/contract'

/**
 * The single typed entry point the renderer uses to talk to the main process.
 * Never call `window.rtslytics` or raw `fetch`/`fs` directly elsewhere — import
 * `ipc` from here so the IPC surface stays centralized and typed.
 */
export const ipc: RtslyticsApi = window.rtslytics
