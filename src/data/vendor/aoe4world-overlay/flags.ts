/**
 * Civilization flag assets for the overlay matchup bar, vendored from
 * aoe4world/overlay (see SOURCE.md). Static imports → Vite resolves each to a
 * hashed asset URL string. Keyed by our civ slugs (CIV_PROFILES keys); colors
 * are the per-civ brand colors used for the flag's 1px outline.
 */
import abbasid from './flags/abbasid.png'
import ayyubids from './flags/ayyubids.png'
import byzantines from './flags/byzantines.png'
import chinese from './flags/chinese.png'
import delhi from './flags/delhi.png'
import english from './flags/english.png'
import french from './flags/french.png'
import goldenhorde from './flags/goldenhorde.png'
import hre from './flags/hre.png'
import japanese from './flags/japanese.png'
import jeannedarc from './flags/jeannedarc.png'
import jinDynasty from './flags/jin_dynasty.png'
import lancaster from './flags/lancaster.png'
import macedonian from './flags/macedonian.png'
import malians from './flags/malians.png'
import mongols from './flags/mongols.png'
import orderofthedragon from './flags/orderofthedragon.png'
import ottomans from './flags/ottomans.png'
import rus from './flags/rus.png'
import sengoku from './flags/sengoku.png'
import templar from './flags/templar.png'
import tughlaq from './flags/tughlaq.png'
import zhuxi from './flags/zhuxi.png'
import unknown from './flags/unknown.png'

export interface CivFlag {
  flag: string
  color: string
}

/** Civ slug → flag image URL + brand color. Covers all 23 API civ slugs. */
export const CIV_FLAGS: Record<string, CivFlag> = {
  abbasid_dynasty: { flag: abbasid, color: '#5D6063' },
  ayyubids: { flag: ayyubids, color: '#C5B537' },
  byzantines: { flag: byzantines, color: '#8038BE' },
  chinese: { flag: chinese, color: '#E15034' },
  delhi_sultanate: { flag: delhi, color: '#00AF63' },
  english: { flag: english, color: '#C3D1DF' },
  french: { flag: french, color: '#0087E7' },
  golden_horde: { flag: goldenhorde, color: '#A60507' },
  holy_roman_empire: { flag: hre, color: '#FFCB2F' },
  hre: { flag: hre, color: '#FFCB2F' },
  house_of_lancaster: { flag: lancaster, color: '#02197E' },
  japanese: { flag: japanese, color: '#B8B594' },
  jeanne_darc: { flag: jeannedarc, color: '#FFD65C' },
  jin_dynasty: { flag: jinDynasty, color: '#D1242E' },
  knights_templar: { flag: templar, color: '#140705' },
  macedonian_dynasty: { flag: macedonian, color: '#D4AF37' },
  malians: { flag: malians, color: '#D61D60' },
  mongols: { flag: mongols, color: '#16A8FF' },
  order_of_the_dragon: { flag: orderofthedragon, color: '#E0D678' },
  ottomans: { flag: ottomans, color: '#0F6F3E' },
  rus: { flag: rus, color: '#F74C43' },
  sengoku_daimyo: { flag: sengoku, color: '#E69B00' },
  tughlaq_dynasty: { flag: tughlaq, color: '#949494' },
  zhu_xis_legacy: { flag: zhuxi, color: '#00A6A7' },
}

export const UNKNOWN_FLAG: CivFlag = { flag: unknown, color: '#000000' }
