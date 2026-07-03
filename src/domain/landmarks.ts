/**
 * Recommended landmark (age-up) picks per civ, for the dashboard/scout landmark
 * plan. Sourced from a per-civ research + adversarial-verification pass
 * (2026-06-30, anchored to live patch 16.2) — see docs. Rosters + picks are
 * beginner-oriented defaults; `dependsOn` flags where the pick is build/matchup
 * dependent, and `special` describes civs that do NOT use a two-landmark choice
 * (Abbasid/Ayyubid wings, Golden Horde tent, Knights Templar commanderies,
 * Chinese/Zhu Xi non-exclusive dynasties).
 *
 * NOTE: AoE4World publishes no per-landmark win-rate data, so these are
 * community/build-order consensus, not statistics. Regenerate when the meta shifts.
 */
export interface LandmarkChoice {
  /** Age this choice is made at: Feudal (2), Castle (3), Imperial (4). */
  age: 2 | 3 | 4
  /** The landmark options available (usually two). */
  options: string[]
  /** The recommended default pick (one of `options`). */
  pick: string
  /** One-line why. */
  reason: string
  /** When the pick flips (build/matchup dependent); null when the default is safe. */
  dependsOn: string | null
}

export interface CivLandmarks {
  /** Set when the civ does NOT use a standard two-landmark age-up (special mechanic). */
  special: string | null
  ages: LandmarkChoice[]
  confidence: "high" | "medium" | "low"
}

/** Recommended landmark plans keyed by civ slug. */
export const CIV_LANDMARKS: Record<string, CivLandmarks> = {
  "abbasid_dynasty": {
    special: "The Abbasid Dynasty does NOT choose between two landmarks per age. It begins with a single House of Wisdom and ages up by adding \"Wings of Knowledge\" (Economic, Military, Trade, Culture) to it — each wing advances an age and they can be added in any order, with all four obtainable (the fourth comes after Imperial as a tech-only \"fifth age\"). So there is no exclusive two-option landmark choice at any age. For a beginner the safest default is to take the Economic Wing first (fast, defensive eco/boom), then Military for Castle (Camel Support armor aura), keeping Trade/Culture for later, though pro builds sometimes lead Military first for aggression — wing order is build/matchup-dependent, not an exclusive landmark pick.",
    confidence: "high",
    ages: [

    ],
  },
  "ayyubids": {
    special: "Ayyubids do NOT pick between two landmarks per age. They build a single House of Wisdom and, at each age-up, choose ONE of four wings (Economic, Military, Culture, Trade) to construct — each wing can be used only once across the game, and advancing with a wing locks out that wing's other branch in later ages. Within the chosen wing you then pick one of two bonuses: Economic = Growth (free villagers) vs Industry (wood shipment); Military = Reinforcements (free Desert Raiders) vs Master Smiths (instant blacksmith techs); Culture = Advancement (cheaper/faster age-up) vs Logistics (Dervishes + empowered Mass Heal); Trade = Bazaar (hire units/buy resources from merchants) vs Advisors (Atabeg Advisors that buff military buildings). The beginner default wing order is Economic (Feudal) → Military (Castle) → Culture or Trade (Imperial). The 'ages' below model the two within-wing bonus choices for the wing a beginner builds at each age.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Economic Wing: Growth", "Economic Wing: Industry"], pick: "Economic Wing: Growth", reason: "Growth ships free villagers, the cleanest economic spike for an improving player and the standard Ayyubid Feudal opener.", dependsOn: null },
      { age: 3, options: ["Military Wing: Master Smiths", "Military Wing: Reinforcements"], pick: "Military Wing: Master Smiths", reason: "Master Smiths instantly grants blacksmith upgrades for free, a simple permanent army power boost, while Reinforcements (free Desert Raiders) is the better pick if you intend to apply aggression.", dependsOn: "pick Reinforcements instead for aggressive/raiding openers" },
      { age: 4, options: ["Culture Wing: Advancement", "Culture Wing: Logistics"], pick: "Culture Wing: Advancement", reason: "Advancement makes the age-up cheaper and faster (smoother eco-focused path), whereas Logistics' Dervish Mass-Heal pays off only if you commit to a healing-army composition.", dependsOn: "pick Logistics instead if running a heal-sustained army comp" },
    ],
  },
  "byzantines": {
    special: null,
    confidence: "medium",
    ages: [
      { age: 2, options: ["Grand Winery", "Imperial Hippodrome"], pick: "Grand Winery", reason: "It boosts Olive Oil production (+60%) which fuels the Byzantines' core mercenary/economy engine and gives straightforward value without micro, unlike the cavalry-tempo Imperial Hippodrome.", dependsOn: null },
      { age: 3, options: ["Golden Horn Tower", "Cistern of the First Hill"], pick: "Golden Horn Tower", reason: "Produces free, scaling mercenary batches — the standard Castle-age landmark in most Byzantine builds.", dependsOn: "Cistern of the First Hill for a defensive/eco game with Pilgrim Flask healing" },
      { age: 4, options: ["Foreign Engineering Company", "Palatine School"], pick: "Foreign Engineering Company", reason: "It lets the siege-light Byzantines buy bombards/strong siege with Olive Oil to break defenses and counter walls, covering a key roster gap, whereas Palatine School's free-unit chance is more situational.", dependsOn: "vs heavily walled/defensive opponents; pick Palatine School if you're already massing core unique units in open fights" },
    ],
  },
  "chinese": {
    special: "Chinese are non-exclusive: you can build BOTH landmarks of an age, and building the second triggers that age’s Dynasty (unique bonuses/units). So the pick below is which to build FIRST when advancing — a healthy economy often adds the other soon after.",
    confidence: "high",
    ages: [
      { age: 2, options: ["Imperial Academy", "Barbican of the Sun"], pick: "Imperial Academy", reason: "The eco/tax landmark fuels the Chinese economy snowball and is the standard age-up (and the one to finish to enter Song Dynasty), whereas the Barbican is a defensive tower most useful only when you actually need the wall/vision.", dependsOn: "Build the Barbican first (or both) when going for the Song Dynasty 2-TC build or when you need early defense" },
      { age: 3, options: ["Astronomical Clocktower", "Imperial Palace"], pick: "Astronomical Clocktower", reason: "It acts as a free Siege Workshop producing siege with +50% HP, which beginners convert directly into map pressure and tower/base damage, while the Imperial Palace's scouting/tax value is harder to leverage at low ranks.", dependsOn: "Prefer the Imperial Palace if you want extra map vision/tax income and a safer defensive macro game" },
      { age: 4, options: ["Spirit Way", "Great Wall Gatehouse"], pick: "Spirit Way", reason: "Spirit Way cheaply/quickly upgrades your Dynasty units and gives strong on-death buffs, making it the clear offensive 1v1 choice, while the Great Wall Gatehouse is a defensive wall structure suited to team games.", dependsOn: "Consider the Great Wall Gatehouse only for heavy turtle/defensive or team-game play" },
    ],
  },
  "delhi_sultanate": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Dome of the Faith", "Tower of Victory"], pick: "Dome of the Faith", reason: "Discounted scholars are the backbone of Delhi's economy, fixing their naturally slow research and snowballing every later upgrade.", dependsOn: null },
      { age: 3, options: ["House of Learning", "Compound of the Defender"], pick: "House of Learning", reason: "It unlocks Delhi's strongest unique economic and military techs (which are free) and pairs directly with the scholar tech-speed plan, making it the default Castle pick.", dependsOn: "go Compound of the Defender only if you need to turtle hard vs early aggression and want cheap stone defenses" },
      { age: 4, options: ["Palace of the Sultan", "Hisar Academy"], pick: "Palace of the Sultan", reason: "It auto-produces Tower War Elephants and is scholar-boostable, giving a beginner free army production to close out games.", dependsOn: null },
    ],
  },
  "english": {
    special: null,
    confidence: "medium",
    ages: [
      { age: 2, options: ["Council Hall", "Abbey of Kings"], pick: "Council Hall", reason: "Produces Longbowmen 100% faster with a self-healing Setup Camp — the aggressive early-game default.", dependsOn: "Abbey of Kings for a defensive/turtle game" },
      { age: 3, options: ["White Tower", "King’s Palace"], pick: "White Tower", reason: "A defensive keep that doubles the Network of Castles buff — a forgiving, safe Castle-age pick.", dependsOn: "King’s Palace for a greedy economic boom" },
      { age: 4, options: ["Berkshire Palace", "Wynguard Palace"], pick: "Wynguard Palace", reason: "Spawns a free combined-arms Wynguard Army to offset the English late-game gold reliance.", dependsOn: "Berkshire Palace when turtling/defending heavy siege" },
    ],
  },
  "french": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["School of Cavalry", "Chamber of Commerce"], pick: "School of Cavalry", reason: "Acts as a stable and makes all stables produce units 20% faster, fueling the signature Royal Knight pressure that defines French Feudal play.", dependsOn: null },
      { age: 3, options: ["Royal Institute", "Guild Hall"], pick: "Royal Institute", reason: "Researches French unique techs 20% cheaper while ignoring age requirements and unlocks Royal Bloodlines (+35% cavalry HP), maximizing knight effectiveness.", dependsOn: "Pick Guild Hall instead for a greedy uncontested boom on closed/team maps" },
      { age: 4, options: ["Red Palace", "College of Artillery"], pick: "Red Palace", reason: "Functions as a powerful defensive keep with high-damage arbalest emplacements, making it the safest, hardest-to-punish Imperial choice for an improving player.", dependsOn: "Pick College of Artillery when you are ahead and want to push with cheaper, stronger Royal gunpowder siege" },
    ],
  },
  "golden_horde": {
    special: "The Golden Horde does NOT choose between two named landmarks per age. It has a single landmark, the Golden Tent (available from Dark Age), which is built/upgraded to advance through Feudal, Castle, and Imperial. When aging up you instead pick one of two age-up bonus upgrades (e.g. Feudal: Rotation Grazing vs Over Grazing Ger stockyard upgrades) and separately set Edicts on the Golden Tent (e.g. Production Speed Edict vs Defensive Aura Edict) that change the influence/aura projected by Fortified Outposts. Because there is no two-landmark choice at any age, there are no per-age landmark picks to report; a beginner should focus on the Golden Tent's economic age-up bonus and the Production Speed Edict for faster army production.",
    confidence: "medium",
    ages: [

    ],
  },
  "holy_roman_empire": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Aachen Chapel", "Meinwerk Palace"], pick: "Aachen Chapel", reason: "A garrisoned Prelate's large inspire radius massively buffs your economy, which is the default safe macro choice for an improving player.", dependsOn: null },
      { age: 3, options: ["Burgrave Palace", "Regnitz Cathedral"], pick: "Regnitz Cathedral", reason: "The relic gold income fuels a steady eco/boom and is the more forgiving, all-round pick, whereas Burgrave is an aggressive all-in tool that punishes mistakes.", dependsOn: "pick Burgrave Palace if going for a Castle-Age all-in or against constant aggression/harass" },
      { age: 4, options: ["Palace of Swabia", "Elzbach Palace"], pick: "Palace of Swabia", reason: "Cheaper, 200%-faster villager production gives an immediate economic spike and helps a beginner rebuild after raids and catch up on villager count.", dependsOn: "pick Elzbach Palace if you already have 2+ Town Centers and a full economy and want a defensive bastion instead" },
    ],
  },
  "house_of_lancaster": {
    special: "House of Lancaster is unusual: it has NO landmark choice in Feudal (Age II) or Castle (Age III) — both ages have a single mandatory landmark (Lancaster Castle for Feudal, King's College for Castle). A real two/three-way landmark choice only exists at Imperial (Age IV), between The White Tower, Berkshire Palace, and Wynguard Palace.",
    confidence: "medium",
    ages: [
      { age: 4, options: ["Wynguard Palace", "Berkshire Palace"], pick: "Wynguard Palace", reason: "Wynguard Palace cheaply batch-produces House of Lancaster's strongest units (Wynguard Rangers/Footmen and the Ribauldequin), giving a clear, easy-to-use army power spike for an improving player.", dependsOn: "Pick Berkshire Palace instead when on the defensive or contesting a key location (e.g. a sacred site) under heavy pressure, since it acts as a stronger long-range Keep; avoid The White Tower, which has no Lancaster-specific bonus." },
    ],
  },
  "japanese": {
    special: "Japanese age-up landmark choices are standard (two options per age), but Japanese also have a parallel Town Center mechanic: the TC transforms into a Daimyo Manor/Palace/Shogunate Castle as you age, and Feudal/Castle landmarks spawn Yorishiro-bearing Shinto Priests (Floating Gate) or Buddhist Monks (Temple of Equality) used to enshrine/buff buildings; this does not replace the two-landmark choice.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Koka Township", "Kura Storehouse"], pick: "Kura Storehouse", reason: "Kura Storehouse is a pure economy landmark (universal drop-off plus periodic free farms/wood) that powers the standard beginner fast-castle build, whereas Koka Township only adds micro-heavy raiding Shinobi.", dependsOn: null },
      { age: 3, options: ["Floating Gate", "Temple of Equality"], pick: "Floating Gate", reason: "Floating Gate's auto-spawning Shinto Priests place Yorishiro to buff your buildings (extra LoS/eco/defense value) with no micro tax, while Temple of Equality's Buddhist Monk damage-debuff is a niche, harder-to-pilot tool.", dependsOn: null },
      { age: 4, options: ["Castle of the Crow", "Tanegashima Gunsmith"], pick: "Tanegashima Gunsmith", reason: "Tanegashima Gunsmith is the meta Imperial pick (~75% of the time): free stockpile units and gunpowder access (Ozutsu/Ribauldequin) give a direct power spike, versus Castle of the Crow's slower trade-income economy.", dependsOn: "pick Castle of the Crow instead if the game has stalled into a long economic/booming game where trade-caravan income outweighs an immediate army spike" },
    ],
  },
  "jeanne_darc": {
    special: "Jeanne d'Arc is a hero civilization: the Jeanne d'Arc hero unit levels up (gaining new abilities and transforming into a mounted form) as she gains XP, and the civ has unique companion units. However, she still ages up by choosing between two landmarks per age exactly like the base French (her landmarks are identical to French ones), so the standard two-option landmark choice applies at every age.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["School of Cavalry", "Chamber of Commerce"], pick: "School of Cavalry", reason: "Acts as a Stable and makes all Stables train 20% faster, fueling the Royal Knight aggression that Jeanne's whole game plan is built around, and it is the landmark used in standard Jeanne build orders.", dependsOn: null },
      { age: 3, options: ["Royal Institute", "Guild Hall"], pick: "Royal Institute", reason: "It houses the civ's unique techs at 30% cheaper cost while ignoring age requirements, giving the cheapest, most forgiving all-round power spike for a beginner; pick Guild Hall instead only for a greedy boom.", dependsOn: "pick Guild Hall instead if going for a defensive eco boom rather than continued military pressure" },
      { age: 4, options: ["Red Palace", "College of Artillery"], pick: "Red Palace", reason: "Arguably the strongest defensive landmark in the game (high-damage arbalest emplacements that shred siege and infantry), it is simple and forgiving and protects a beginner from late-game pushes; College of Artillery only pays off with a micro-heavy gunpowder-siege army.", dependsOn: "pick College of Artillery instead if committing to a gunpowder/cannon siege composition" },
    ],
  },
  "jin_dynasty": {
    special: "Jin Dynasty uses standard two-landmark-choices-per-age (it does NOT use the base-Chinese non-exclusive Dynasty mechanic — you pick one of two landmarks each age). The twist: each time you complete an age-up landmark you also get to place a Horse Grassland on the map, and accumulated horses globally buff your cavalry health and let nearby Stables instant-train cavalry; this is separate from the landmark choice and does not replace it.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Flower Pagoda", "Great Pasture"], pick: "Flower Pagoda", reason: "Its Flower Garden blessing (+25% villager gather rate and +25% non-siege attack speed in a ring) is a unique economy and fight-tempo boost you can only get from this landmark, whereas Great Pasture's War Stable/Grassland functions are available from regular buildings anyway.", dependsOn: null },
      { age: 3, options: ["Dragon Pavilion", "Mountain Hall"], pick: "Dragon Pavilion", reason: "It spawns free, self-replenishing Meng'an Mouke defenders that keep a beginner's base safe for no resources while they focus on learning macro, where Mountain Hall's karma payoff is more fiddly to manage.", dependsOn: "Take Mountain Hall instead if you are already safe and want the karma economy/relic snowball vs a passive boom opponent" },
      { age: 4, options: ["Pagoda Forest", "Great Wall Bastion"], pick: "Pagoda Forest", reason: "It provides strong passive wood generation plus a game-swinging garrisoned-monk area conversion, giving more overall value than the purely defensive Great Wall Bastion for most beginners.", dependsOn: "Take Great Wall Bastion if you are under heavy late-game pressure and need the keep-style Bed Crossbow defenses" },
    ],
  },
  "knights_templar": {
    special: "The Knights Templar do NOT choose between two landmarks per age. They use a special \"Commanderie\" age-up mechanic: aging up is researched at the Templar Headquarters, and at each age you ally with ONE of THREE Commanderies, each granting a unique unit plus an economy/military bonus — Feudal (Age II): Knights Hospitaller (Hospitaller Knight, self-healing), France (Chevalier Confrere), or Principality of Antioch (Serjeant); Castle (Age III): Republic of Genoa (Genoese Crossbowman), Kingdom of Castile (Genitour), or Angevin Empire (Heavy Spearman); Imperial (Age IV): Teutonic Order (Teutonic Knight), Republic of Venice (Condottiero), or Kingdom of Poland. Separately, their landmark structure is the Fortress (buildable from Feudal, cheaper than normal landmarks, can be destroyed, does not advance you to the next age) which buffs nearby ranged range and stone walls. Beginner-friendly default Commanderie path: Hospitaller (Feudal) for a forgiving self-healing knight, Genoa (Castle) for safe anti-cavalry crossbows, Teutonic Order (Imperial) for a tanky frontline.",
    confidence: "medium",
    ages: [

    ],
  },
  "macedonian_dynasty": {
    special: "The Macedonian Dynasty is a Byzantines variant that swaps the base civ's Olive Oil/mercenary system for a fifth resource, Silver (gathered as a percentage bonus while mining Gold or Stone), which fuels its landmark abilities and Cataphract/siege training. It still uses the standard two-landmark choice at each age-up, so the normal pick-one-of-two mechanic applies.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Grand Winery", "Imperial Hippodrome"], pick: "Imperial Hippodrome", reason: "It auto-spawns free Champion units and buffs cavalry, giving steady military value and flexibility, while the Grand Winery is a niche food/relic-eco landmark.", dependsOn: "Grand Winery if going a relic/food-economy boom build" },
      { age: 3, options: ["Golden Horn Tower", "Cistern of the First Hill"], pick: "Cistern of the First Hill", reason: "Its villager work-rate aura snowballs the whole economy and is far more forgiving for an improving player than the Golden Horn Tower's slow free crossbows.", dependsOn: "Golden Horn Tower vs heavy aggression when you need a defensive anchor" },
      { age: 4, options: ["Foreign Engineering Company", "Palatine School"], pick: "Foreign Engineering Company", reason: "It is a flexible Silver-fueled siege shop with real battlefield utility, whereas the Palatine School only mass-trains Cataphracts.", dependsOn: "Palatine School if committed to a Cataphract-heavy composition" },
    ],
  },
  "malians": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Mansa Quarry", "Saharan Trade Network"], pick: "Mansa Quarry", reason: "Mansa Quarry passively generates 75 gold/min, giving Malians a reliable second gold income and letting you ignore early gold-camp raids, which is what nearly every standard Mali build opens with.", dependsOn: null },
      { age: 3, options: ["Farimba Garrison", "Grand Fulani Corral"], pick: "Farimba Garrison", reason: "Farimba Garrison unlocks upgraded Donsos/Sofas and lets you mass-produce them with a discount, fueling the aggressive Castle-age timings that define the standard Mali playbook.", dependsOn: "Pick Grand Fulani Corral instead if you want a greedy cattle-economy boom rather than military pressure" },
      { age: 4, options: ["Fort of the Huntress", "Griot Bara"], pick: "Fort of the Huntress", reason: "It acts as a defensive Keep and grants stealth plus First Strike to your Musofadi infantry, reinforcing the Malians' raiding/ambush identity and giving a beginner a safe defensive anchor.", dependsOn: "Pick Griot Bara if you are ahead and want its festival economy/production/siege boons to close out the game" },
    ],
  },
  "mongols": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Deer Stones", "Silver Tree"], pick: "Deer Stones", reason: "Deer Stones gives the Yam speed aura and unlocks Khan's Hunters, powering the mobile-cavalry aggression that defines beginner-friendly Mongol play, whereas Silver Tree is a trade/eco landmark better suited to greedy or team-game styles.", dependsOn: "Pick Silver Tree if you intend to play a trade/boom eco style instead of Feudal aggression" },
      { age: 3, options: ["Kurultai", "Steppe Redoubt"], pick: "Kurultai", reason: "Kurultai's heal plus +25% damage aura near the Khan massively boosts army fights and is the standard military pick, while Steppe Redoubt is a passive gold-eco landmark.", dependsOn: "Pick Steppe Redoubt for a defensive boom/trade game where you already have the Silver Tree eco engine" },
      { age: 4, options: ["White Stupa", "Khaganate Palace"], pick: "White Stupa", reason: "White Stupa generates 240 stone/min, fixing the Mongols' chronic stone dependence (Ovoo techs and landmarks) and giving a reliable economy, whereas Khaganate Palace's free cavalry trickle is a harder-to-leverage aggressive option.", dependsOn: "Pick Khaganate Palace when you are ahead and want to snowball with constant free cavalry pressure" },
    ],
  },
  "order_of_the_dragon": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Aachen Chapel", "Meinwerk Palace"], pick: "Aachen Chapel", reason: "Its +15% gather-rate aura is the strongest all-purpose economic boost and the community-consensus default, snowballing Order of the Dragon's expensive Gilded eco.", dependsOn: null },
      { age: 3, options: ["Regnitz Cathedral", "Burgrave Palace"], pick: "Regnitz Cathedral", reason: "Garrisoned relics generate roughly 160 gold/min of passive income that funds expensive Gilded armies, making it the go-to Castle-age pick unless most relics are already taken.", dependsOn: "Pick Burgrave Palace instead when relics are contested/gone or you want an infantry power spike for Castle-age aggression" },
      { age: 4, options: ["Palace of Swabia", "Elzbach Palace"], pick: "Palace of Swabia", reason: "It acts as a second Town Center pumping villagers 200% faster and 66% cheaper, giving the safer economy-scaling Imperial spike for a beginner.", dependsOn: "Pick Elzbach Palace instead when you are under heavy pressure and need its defensive keep/damage-reduction aura to hold a position" },
    ],
  },
  "ottomans": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Twin Minaret Medrese", "Sultanhani Trade Network"], pick: "Twin Minaret Medrese", reason: "It gives a safe, fast-gathering self-replenishing berry economy with no extra micro, whereas Sultanhani is a trader-dependent gold/boom landmark that is weaker into early aggression.", dependsOn: "Sultanhani is preferred on closed/boom maps or a planned heavy Military School economy; Twin Minaret is the default and is especially correct vs aggressive openers" },
      { age: 3, options: ["Mehmed Imperial Armory", "Istanbul Imperial Palace"], pick: "Mehmed Imperial Armory", reason: "Free siege (springalds/bombards) from the Armory is huge tempo and resource value and is the community-standard pick, while the Imperial Palace's Vizier/XP bonus is widely regarded as weak.", dependsOn: null },
      { age: 4, options: ["Istanbul Observatory", "Sea Gate Castle"], pick: "Istanbul Observatory", reason: "Its empire-wide Blacksmith/University production-speed influence massively accelerates army and tech output, whereas Sea Gate Castle is a situational defensive/trade-protection keep.", dependsOn: "Sea Gate Castle can be taken when you need a strong defensive anchor or to protect a trade economy" },
    ],
  },
  "rus": {
    special: null,
    confidence: "high",
    ages: [
      { age: 2, options: ["Kremlin", "Golden Gate"], pick: "Golden Gate", reason: "The Golden Gate's free resource exchange every minute plus favorable trade rate is a clean, low-micro economic boost that fuels the standard Rus snowball, whereas the Kremlin is a defensive/aggressive landmark better left to experienced players.", dependsOn: "Pick Kremlin instead if going for an early Feudal all-in/wooden-fortress aggression build" },
      { age: 3, options: ["High Trade House", "Abbey of the Trinity"], pick: "Abbey of the Trinity", reason: "The Abbey produces cheap Warrior Monks and heals/buffs your army, giving beginners a reliable military and sacred-site/relic boost, while the High Trade House is a niche economic landmark that demands map control to exploit.", dependsOn: null },
      { age: 4, options: ["High Armory", "Spasskaya Tower"], pick: "High Armory", reason: "The High Armory's -20% siege cost and powerful siege techs (ram, bombard, treb upgrades) suit the Rus army-and-siege win condition in most ladder games, whereas the Spasskaya Tower is mainly a defensive pick for protecting wonders or sacred-site victories.", dependsOn: "Pick Spasskaya Tower instead for a defensive turtle or to protect a wonder/sacred-site win" },
    ],
  },
  "sengoku_daimyo": {
    special: "Sengoku Daimyo is a Japanese variant: each age-up is still a genuine choice between two landmarks (not a single fixed wing/dynasty mechanic). Separately, from the Feudal Age it can build Daimyo Estates (Oda/Takeda/Hojo clans) — a buildable economy/military building you can stack (up to three of one clan, two of a second), but this does NOT replace the per-age landmark choice.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Koka Township", "Ryokan"], pick: "Koka Township", reason: "Koka Township is the signature Sengoku Feudal opener, unlocking the Shinobi plus map reveal/ambush for scouting and pressure, which fits the standard build order.", dependsOn: "vs boom/greedy civs or if you want a safer eco-defensive game, take Ryokan instead for +60 population and out-of-combat healing" },
      { age: 3, options: ["Temple of Equality", "Sake Brewery"], pick: "Sake Brewery", reason: "Sake Brewery gives a forgiving passive gold economy (Toko-Koji mats plus a stone/gold drop-off) that is hard to misuse and keeps a beginner's gold flowing into Castle Age.", dependsOn: "if you are committing to an Ikko-Ikki Monk / relic-religious army, take Temple of Equality for the 25% monk discount and religious techs" },
      { age: 4, options: ["Tanegashima Gunsmith", "Castle of the Crow"], pick: "Tanegashima Gunsmith", reason: "Tanegashima Gunsmith auto-produces a free gunpowder stockpile every 30 seconds for instant unit deployment, giving a beginner a strong, low-micro army and unique units.", dependsOn: "if you are ahead and want to turtle/defend or lean on trade and siege, take Castle of the Crow for a fortress Castle (33% cheaper Castles, +siege near them)" },
    ],
  },
  "tughlaq_dynasty": {
    special: "Tughlaq Dynasty is a Delhi Sultanate variant: it still makes a genuine two-landmark choice at each age (same landmark roster as base Delhi), but layers on the Governor system — the Tughlaqabad Fort replaces the Keep (not the age-up landmark) and can appoint 1 of 6 Governors, and the Castle/Imperial landmark choices interact with that Governor system (Compound of the Defender unlocks a 4th Governor tier; Palace of the Sultan grants a free tier-4 Governor; Hisar Academy generates 50 food + 50 gold per active Governor).",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Dome of the Faith", "Tower of Victory"], pick: "Dome of the Faith", reason: "Scholars/tech-economy are the backbone of Delhi-family civs, and cheap Imam/scholar production keeps your research advantage rolling, which is the safer default for an improving player.", dependsOn: "Pick Tower of Victory instead if you commit to an early Feudal rush (it permanently boosts elephant/unit attack speed for aggression)." },
      { age: 3, options: ["Compound of the Defender", "House of Learning"], pick: "Compound of the Defender", reason: "It cuts building stone cost 20% and unlocks the powerful 4th-tier Governor upgrades that are the whole point of the Tughlaq variant, giving a beginner a flexible, durable economic/defensive payoff.", dependsOn: "Pick House of Learning if you are committing to an elephant-army aggression plan (it adds elephant regen and +30% bonus damage techs)." },
      { age: 4, options: ["Palace of the Sultan", "Hisar Academy"], pick: "Palace of the Sultan", reason: "It immediately grants a tier-4 Governor of your choice and auto-produces strong Tower War Elephants you can boost with scholars, making it the simpler, higher-impact Imperial option for a beginner.", dependsOn: "Consider Hisar Academy only in a heavy multi-fort boom where many Governors are active (it generates 50 food + 50 gold per active Governor)." },
    ],
  },
  "zhu_xis_legacy": {
    special: "Like base Chinese, Zhu Xi's Legacy uses a NON-EXCLUSIVE Dynasty mechanic: you are not limited to one landmark per age. You can build BOTH landmarks of an age, and building the second one unlocks that age's Dynasty bonus (Feudal both = Song Dynasty / unit & eco discounts; Castle both = Yuan Dynasty; Imperial both = Ming Dynasty). So the \"choice\" below is really WHICH landmark to build FIRST/prioritize, not an either/or lock — a player with the economy to afford it typically builds both for the dynasty.",
    confidence: "medium",
    ages: [
      { age: 2, options: ["Meditation Gardens", "Jiangnan Tower"], pick: "Meditation Gardens", reason: "It is the safe economic landmark that boosts nearby resources and dumps a large one-time resource boon, fueling a beginner's whole game; place it near berries.", dependsOn: null },
      { age: 3, options: ["Mount Lu Academy", "Shaolin Monastery"], pick: "Mount Lu Academy", reason: "Its faster tax collection plus bonus food turns Imperial Officials into a snowballing eco engine, the more forgiving default; pick Shaolin Monastery instead if you want Shaolin Monk aggression.", dependsOn: "go Shaolin Monastery if playing aggressive monk/military pressure" },
      { age: 4, options: ["Zhu Xi's Library", "Temple of the Sun"], pick: "Zhu Xi's Library", reason: "It houses the powerful unique techs (including Dynastic Protectors for the Imperial Guard) that define the civ's late game, giving a beginner the strongest payoff.", dependsOn: null },
    ],
  },
}

/** The landmark plan for a civ slug, or null if we have none. */
export function landmarksForCiv(civ: string | null | undefined): CivLandmarks | null {
  return civ ? (CIV_LANDMARKS[civ] ?? null) : null
}

const AGE_NAMES: Record<number, string> = { 2: "Feudal", 3: "Castle", 4: "Imperial" }
/** Human age label, e.g. 2 → "Feudal (II)". */
export function landmarkAgeLabel(age: 2 | 3 | 4): string {
  const roman: Record<number, string> = { 2: "II", 3: "III", 4: "IV" }
  return AGE_NAMES[age] + " (" + roman[age] + ")"
}
