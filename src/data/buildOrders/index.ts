/**
 * The bundled build-order library. Two tiers:
 *  • CURATED — hand-picked from aoe4guides.com's top-scored community builds
 *    (research pass 2026-07-02), converted to our schema with the author +
 *    source credited and a `reasoning` line explaining why the build earned its
 *    slot. Raw aoe4guides is uneven, so only builds matching known meta
 *    archetypes (Beasty / Valdemar / MarineLord-derived where possible) made it.
 *  • HOUSE — RTSLytics-written beginner builds with full step timings.
 *
 * ORDER MATTERS: `buildIndexForCiv` picks the FIRST build matching a civ, and
 * Match Prep / the build trainer take their key timings from it — so for each
 * civ the best-TIMED build is listed first (curated when it carries timings,
 * the house build otherwise). aoe4guides has no Knights Templar or Golden
 * Horde category yet, so those civs keep house/absent coverage for now.
 */
// Curated (timed) — listed first for their civs.
import english2tcLongbow from './english-2tc-longbow.json'
import hreFastCastle from './hre-fast-castle.json'
import rusProScouts from './rus-pro-scouts.json'
import chineseTaxAggro from './chinese-tax-aggro.json'
import abbasidEcoWing2tc from './abbasid-eco-wing-2tc.json'
import delhiFastGhazi from './delhi-fast-ghazi.json'
import maliansClassicOpener from './malians-classic-opener.json'
import byzantines5Cistern from './byzantines-5-cistern.json'
import japaneseMlordFastCastle from './japanese-mlord-fast-castle.json'
import jeanneDarcAggression from './jeanne-darc-aggression.json'
import ootd2tcBoom from './ootd-2tc-boom.json'
import zhuxiZhugeNuTiming from './zhuxi-zhuge-nu-timing.json'
import lancaster2tc2manor from './lancaster-2tc-2manor.json'
import jinSwaggyStandard from './jin-swaggy-standard.json'
import macedonianBeasty from './macedonian-beasty.json'
import sengokuBeasty from './sengoku-beasty.json'
import tughlaqBeastyStandard from './tughlaq-beasty-standard.json'
// House builds (timed) — primary where the curated pick lacks timings.
import english2tc from './english-2tc-boom.json'
import frenchKnights from './french-knights-rush.json'
import jeanneDarcKnights from './jeanne-darc-knights-rush.json'
import mongolsFastCastle from './mongols-fast-castle.json'
import rusScoutFeudal from './rus-scout-feudal.json'
import hreFastFeudalMaa from './hre-fast-feudal-maa.json'
import abbasid2tc from './abbasid-2tc-boom.json'
import ottomansMilitarySchool from './ottomans-military-school.json'
import delhiSacredSites from './delhi-sacred-sites.json'
import japaneseSamurai from './japanese-samurai-eco.json'
import chineseDynasty from './chinese-dynasty-eco.json'
import byzantinesCistern from './byzantines-cistern-eco.json'
import maliansPitMine from './malians-pitmine-eco.json'
// Curated (untimed) — great step lists, but the timed build stays primary.
import frenchFastFeudalKnights from './french-fast-feudal-knights.json'
import mongolsNewPlayer from './mongols-new-player.json'
import ottomans1311 from './ottomans-1311.json'
import ayyubidsFast2tc from './ayyubids-fast-2tc.json'

export const BUNDLED_BUILD_ORDERS = [
  // Primary (best-timed) build per civ, curated first where timed:
  english2tcLongbow,
  frenchKnights, // house build keeps full timings; curated French below
  hreFastCastle,
  rusProScouts,
  mongolsFastCastle, // house — the curated Mongol guide is untimed
  chineseTaxAggro,
  abbasidEcoWing2tc,
  delhiFastGhazi,
  ottomansMilitarySchool, // house — the curated 1-3-1-1 below is untimed
  maliansClassicOpener,
  byzantines5Cistern,
  japaneseMlordFastCastle,
  jeanneDarcAggression,
  ootd2tcBoom,
  zhuxiZhugeNuTiming,
  lancaster2tc2manor,
  jinSwaggyStandard,
  macedonianBeasty,
  sengokuBeasty,
  tughlaqBeastyStandard,
  // Alternates (house + curated-untimed):
  english2tc,
  frenchFastFeudalKnights,
  jeanneDarcKnights,
  rusScoutFeudal,
  hreFastFeudalMaa,
  mongolsNewPlayer,
  abbasid2tc,
  ayyubidsFast2tc,
  ottomans1311,
  delhiSacredSites,
  japaneseSamurai,
  chineseDynasty,
  byzantinesCistern,
  maliansPitMine,
]
