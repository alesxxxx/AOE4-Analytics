/**
 * Pure geometry helpers for placing the overlay window safely.
 *
 * DORMANT (2026-07-07): no production caller since the overlay moved to
 * full-display bounds + per-widget positions (overlayController.applyPosition).
 * The `overlay.position` setting these presets served is likewise unused.
 * Kept (tested) in case window-level presets come back.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Do two rectangles overlap by a positive area? */
function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/**
 * Whether a saved window rect is still usable — i.e. it overlaps at least one
 * display's work area. Guards against restoring the overlay fully offscreen (e.g.
 * onto a monitor that has since been disconnected), which for a frameless,
 * click-through, no-taskbar window would otherwise be unrecoverable. When this
 * returns false the caller falls back to the default on-screen position.
 */
export function boundsVisibleOnDisplays(bounds: Rect, workAreas: Rect[]): boolean {
  return workAreas.some((wa) => intersects(bounds, wa))
}

/** A snap position for the overlay window. 'custom' = wherever the user dragged it. */
export type OverlayPosition = 'top-left' | 'top-center' | 'top-right' | 'custom'

/**
 * Top-of-screen x/y for a preset position within a display's work area (pure).
 * Snaps the overlay to the top edge, like aoe4world/overlay. 'custom' returns
 * null (the caller keeps the user's dragged bounds).
 */
export function presetOverlayXY(
  position: OverlayPosition,
  workArea: Rect,
  size: { width: number; height: number },
  margin = 12,
): { x: number; y: number } | null {
  if (position === 'custom') return null
  const y = workArea.y + 8
  if (position === 'top-left') return { x: workArea.x + margin, y }
  if (position === 'top-right') return { x: workArea.x + workArea.width - size.width - margin, y }
  // top-center
  return { x: workArea.x + Math.round((workArea.width - size.width) / 2), y }
}
