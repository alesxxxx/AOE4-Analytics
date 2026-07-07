/**
 * Widget panel background: the overlay's dark navy at `alpha`, scaled by the
 * user's overlay-opacity setting (the `--panel-alpha` CSS variable OverlayApp
 * sets on the overlay root). The opacity setting is applied to panel
 * BACKGROUNDS only — the window itself stays at full opacity so text and icons
 * never dim (`win.setOpacity` would dim everything).
 */
export function panelBg(alpha: number): string {
  return `rgba(10, 14, 26, calc(${alpha} * var(--panel-alpha, 1)))`
}
