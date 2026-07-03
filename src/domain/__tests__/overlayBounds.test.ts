import { describe, it, expect } from 'vitest'
import { boundsVisibleOnDisplays, presetOverlayXY, type Rect } from '../overlayBounds'

const primary: Rect = { x: 0, y: 0, width: 1920, height: 1040 }

describe('boundsVisibleOnDisplays', () => {
  it('true when the overlay overlaps the primary work area', () => {
    expect(boundsVisibleOnDisplays({ x: 1456, y: 24, width: 440, height: 320 }, [primary])).toBe(
      true,
    )
  })

  it('false when fully offscreen (e.g. a disconnected second monitor)', () => {
    expect(boundsVisibleOnDisplays({ x: 3000, y: 0, width: 440, height: 320 }, [primary])).toBe(
      false,
    )
  })

  it('true when it overlaps a secondary display', () => {
    const second: Rect = { x: 1920, y: 0, width: 1920, height: 1040 }
    expect(
      boundsVisibleOnDisplays({ x: 3000, y: 100, width: 440, height: 320 }, [primary, second]),
    ).toBe(true)
  })

  it('false for an empty display list', () => {
    expect(boundsVisibleOnDisplays({ x: 0, y: 0, width: 440, height: 320 }, [])).toBe(false)
  })

  it('false when only touching edges (no positive overlap area)', () => {
    // window sits exactly to the right of the work area, sharing only the x=1920 edge
    expect(boundsVisibleOnDisplays({ x: 1920, y: 0, width: 440, height: 320 }, [primary])).toBe(
      false,
    )
  })
})

describe('presetOverlayXY', () => {
  const size = { width: 350, height: 290 }

  it('snaps to the top edge for each preset', () => {
    expect(presetOverlayXY('top-left', primary, size)).toEqual({ x: 12, y: 8 })
    expect(presetOverlayXY('top-right', primary, size)).toEqual({ x: 1920 - 350 - 12, y: 8 })
    expect(presetOverlayXY('top-center', primary, size)).toEqual({
      x: Math.round((1920 - 350) / 2),
      y: 8,
    })
  })

  it('respects a non-zero display origin (second monitor)', () => {
    const second: Rect = { x: 1920, y: 0, width: 2560, height: 1400 }
    expect(presetOverlayXY('top-left', second, size)).toEqual({ x: 1932, y: 8 })
    expect(presetOverlayXY('top-center', second, size)).toEqual({
      x: 1920 + Math.round((2560 - 350) / 2),
      y: 8,
    })
  })

  it('returns null for custom (keep the dragged bounds)', () => {
    expect(presetOverlayXY('custom', primary, size)).toBeNull()
  })
})
