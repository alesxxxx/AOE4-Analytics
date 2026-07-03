/**
 * Glyphs for the build-order resource line. RTS_Overlay uses image assets
 * (resource_food.webp …); we have none vendored, so we use unicode/emoji. Kept
 * in one place so swapping to real SVG/PNG icons later is a single-file change.
 */
export const RES_GLYPH = {
  food: '🍖',
  wood: '🪵',
  gold: '🪙',
  stone: '🪨',
  builder: '🔨',
  villager: '👤',
  pop: '🏠',
} as const

/** Age number → roman numeral chip label (stands in for age_1..4.webp). */
export const AGE_ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

export const TIME_GLYPH = '⏱'

/** Maps an RTS_Overlay note image token (e.g. `resource/resource_wood.webp`) to a glyph. */
export function noteTokenGlyph(path: string): string | null {
  const p = path.toLowerCase()
  if (p.includes('food')) return RES_GLYPH.food
  if (p.includes('wood')) return RES_GLYPH.wood
  if (p.includes('gold')) return RES_GLYPH.gold
  if (p.includes('stone')) return RES_GLYPH.stone
  if (p.includes('villager') || p.includes('worker')) return RES_GLYPH.villager
  if (p.includes('house') || p.includes('population')) return RES_GLYPH.pop
  return null
}
