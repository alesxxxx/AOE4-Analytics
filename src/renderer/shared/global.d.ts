import type { RtslyticsApi } from '@ipc/contract'

declare global {
  interface Window {
    /** The typed bridge exposed by the preload (see electron/preload.ts). */
    rtslytics: RtslyticsApi
  }
}

export {}
