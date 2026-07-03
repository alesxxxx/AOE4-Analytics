/** Canonical AoE4World civ slugs and their 2-letter data codes (used by aoe4world/data). */

export const CIV_CODE_TO_SLUG: Record<string, string> = {
  ab: 'abbasid_dynasty',
  ay: 'ayyubids',
  by: 'byzantines',
  ch: 'chinese',
  de: 'delhi_sultanate',
  en: 'english',
  fr: 'french',
  gol: 'golden_horde',
  hl: 'house_of_lancaster',
  hr: 'holy_roman_empire',
  ja: 'japanese',
  je: 'jeanne_darc',
  jin: 'jin_dynasty',
  kt: 'knights_templar',
  ma: 'malians',
  mac: 'macedonian_dynasty',
  mo: 'mongols',
  od: 'order_of_the_dragon',
  ot: 'ottomans',
  ru: 'rus',
  sen: 'sengoku_daimyo',
  tug: 'tughlaq_dynasty',
  zx: 'zhu_xis_legacy',
}

export const CIV_SLUG_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CIV_CODE_TO_SLUG).map(([code, slug]) => [slug, code]),
)

/** All civ slugs, alphabetical. */
export const CIV_SLUGS: string[] = Object.values(CIV_CODE_TO_SLUG).sort()

export function civCode(slug: string): string | undefined {
  return CIV_SLUG_TO_CODE[slug]
}

export function civSlugFromCode(code: string): string | undefined {
  return CIV_CODE_TO_SLUG[code]
}
