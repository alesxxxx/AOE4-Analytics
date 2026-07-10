import { describe, expect, it } from 'vitest'
import {
  IpcChannels,
  type RtslyticsApi,
} from '../../../../electron/ipc/contract'

describe('overlay placement IPC contract', () => {
  it('exposes a distinct placement-toggle command through the typed renderer API', async () => {
    const api: Pick<RtslyticsApi, 'toggleOverlayPlacement'> = {
      toggleOverlayPlacement: async () => true,
    }

    expect(IpcChannels.overlayTogglePlacement).toBe('overlay:togglePlacement')
    await expect(api.toggleOverlayPlacement()).resolves.toBe(true)
  })
})
