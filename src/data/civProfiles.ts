export interface CivProfile {
  slug: string
  name: string
  difficulty: 'easy' | 'medium' | 'hard'
  focus: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  opening: string
  gamePlan: string
  watchFor: string[]
  tags: string[]
}

/** A one-glance "you're facing X" tip, composed from the curated profile. */
export interface MatchupTip {
  name: string
  focus: string
  /** The threat to expect first (their signature pressure). */
  watch: string | null
  /** The weakness to play toward. */
  exploit: string | null
}

export function matchupTipForCiv(oppCiv: string | null | undefined): MatchupTip | null {
  const p = oppCiv ? CIV_PROFILES[oppCiv] : undefined
  if (!p) return null
  return {
    name: p.name,
    focus: p.focus,
    watch: p.watchFor[0] ?? null,
    exploit: p.weaknesses[0] ?? null,
  }
}

export const CIV_PROFILES: Record<string, CivProfile> = {
  abbasid_dynasty: {
    slug: 'abbasid_dynasty',
    name: 'Abbasid Dynasty',
    difficulty: 'easy',
    focus: 'Adaptive economy + House of Wisdom tech and camels',
    summary:
      'A flexible economic civ that ages up by adding wings to the House of Wisdom, letting you adapt your tech to the matchup. Great for beginners who want a safe, scaling game.',
    strengths: [
      'Strong, flexible economy that scales into the late game',
      'House of Wisdom wings adapt tech to any matchup',
      'Camels counter enemy cavalry effectively',
      'Golden Age bonuses speed up production and gathering',
    ],
    weaknesses: [
      'Slow, reactive openings can be punished by fast aggression',
      'Limited early military identity until the economy rolls',
    ],
    opening:
      'Open with scouting and early eco tech, then build a stable or archery range depending on the enemy opener.',
    gamePlan:
      'Use Fresh Foodstuffs and Golden Age momentum to reach a strong 2 TC boom or a Feudal pressure setup. Add camel support, crossbows, and siege once the economy is rolling.',
    watchFor: [
      'A safe economic boom you must punish before it snowballs',
      'Camels that hard-counter your cavalry',
      'A second TC timing you can delay with pressure',
    ],
    tags: ['economy', 'camels', 'boom', 'adaptive'],
  },
  ayyubids: {
    slug: 'ayyubids',
    name: 'Ayyubids',
    difficulty: 'medium',
    focus: 'Abbasid variant with flexible House of Wisdom age-up wings',
    summary:
      'An Abbasid variant built around choosing a House of Wisdom wing at each age-up to commit to military tempo, economy, or fast tech. Rewards reading your opponent and hitting timing attacks.',
    strengths: [
      'Age-up wing choices adapt your whole game plan to the matchup',
      'Fast, flexible timing attacks before opponents know your plan',
      'Camels give a reliable answer to enemy cavalry',
      'Trade and economy wings scale into the late game',
    ],
    weaknesses: [
      'A greedy wing choice can be punished by early aggression',
      'Committing to the wrong wing wastes your tempo window',
    ],
    opening:
      'Pick the age-up wing that matches your scout read: military tempo, eco safety, or fast tech.',
    gamePlan:
      'Use fast timing choices to hit before the opponent knows which plan you committed to. Transition with camel support, ghulams, crossbows, and siege once the timing window is spent.',
    watchFor: [
      'Unpredictable timing attacks based on the chosen wing',
      'Camels punishing cavalry-heavy plans',
      'Greedy eco wings you can punish with a Feudal all-in',
    ],
    tags: ['adaptive', 'tempo', 'camels', 'economy'],
  },
  byzantines: {
    slug: 'byzantines',
    name: 'Byzantines',
    difficulty: 'hard',
    focus: 'Cistern economy + mercenaries and Cataphract power',
    summary:
      'A complex defensive civ that boosts buildings with Cisterns and hires mercenaries on demand to patch matchup weaknesses. Strong economy and powerful Cataphracts, but rewards experienced play.',
    strengths: [
      'Cistern aura boosts economy and production around it',
      'Mercenary contracts cover almost any matchup weakness',
      'Cataphracts are powerful, durable cavalry',
      'Strong defensive units like Limitanei hold ground well',
    ],
    weaknesses: [
      'Broken cisterns and exposed olive groves slow the whole civ',
      'High micro and decision complexity for newer players',
    ],
    opening:
      'Build a clean cistern network and use mercenary contracts to cover the first matchup weakness.',
    gamePlan:
      'Defend efficiently, then use mercenary tempo or Cataphract pressure to take the map. Scale into Varangian Guards, Cataphracts, mercenary mixes, and strong siege.',
    watchFor: [
      'Mercenary units that change their army composition mid-game',
      'Cisterns and olive groves that are key targets to raid',
      'Powerful Cataphract pushes you must counter with spears',
    ],
    tags: ['economy', 'cavalry', 'mercenary', 'defensive'],
  },
  chinese: {
    slug: 'chinese',
    name: 'Chinese',
    difficulty: 'hard',
    focus: 'Dynasty economy + taxes, defensive landmarks, and siege',
    summary:
      'An economic powerhouse that collects taxes via Imperial Officials and unlocks Dynasties for new units and bonuses. Strong siege and defense, but managing officials and dynasties is demanding.',
    strengths: [
      'Tax income from officials fuels a large economy',
      'Dynasty timings unlock strong units and power spikes',
      'Defensive landmarks make all-ins hard to land',
      'Excellent siege and gunpowder in the late game',
    ],
    weaknesses: [
      'Floating tax gold or losing officials wastes the bonus',
      'Officials are vulnerable to raids and need protection',
    ],
    opening:
      'Scout for early pressure, protect Imperial Officials, and choose Song/Feudal pressure or a safer boom.',
    gamePlan:
      'Use tax income and dynasty timings to build a larger economy while keeping a compact defensive army. Scale into Palace Guard, crossbows, gunpowder, and siege when the game stabilizes.',
    watchFor: [
      'A booming economy you must punish before dynasties spike',
      'Exposed Imperial Officials worth raiding',
      'Strong defensive landmarks that resist all-ins',
    ],
    tags: ['economy', 'dynasty', 'siege', 'defensive'],
  },
  delhi_sultanate: {
    slug: 'delhi_sultanate',
    name: 'Delhi Sultanate',
    difficulty: 'hard',
    focus: 'Scholars + free technologies, sacred sites, and elephants',
    summary:
      'A tech-driven civ that researches technologies for free (but slowly) using Scholars, and gains gold from holding sacred sites. Powerful infantry and elephants, but the early game is fragile.',
    strengths: [
      'All technologies are free, enabling huge upgrade leads',
      'Scholars accelerate research and boost production',
      'Sacred site gold fuels strong timings',
      'Hard-hitting infantry and elephants in the mid-game',
    ],
    weaknesses: [
      'Losing Scholars or sacred sites removes the biggest advantage',
      'Slow free research leaves early timings exposed',
    ],
    opening:
      'Prioritize mosque production and early map control so sacred sites come online quickly.',
    gamePlan:
      'Turn free tech and Scholar tempo into Feudal pressure before slower economies catch up. Use Castle timing for compound upgrades, armored units, and elephants when the front is secure.',
    watchFor: [
      'Free-tech upgrade leads that outscale you over time',
      'Sacred sites you should contest to deny gold',
      'Scholars and elephants as priority targets',
    ],
    tags: ['religion', 'tempo', 'infantry', 'elephants'],
  },
  english: {
    slug: 'english',
    name: 'English',
    difficulty: 'easy',
    focus: 'Longbows + defensive networks, farms, and reliable infantry',
    summary:
      'A straightforward defensive civ built around longbow range and the Network of Castles defensive buff. Easy to learn with a strong farm economy and forgiving, value-oriented fights.',
    strengths: [
      'Longbows out-range most early ranged units',
      'Network of Castles buffs units defending near towers',
      'Cheap early farms give a stable food economy',
      'Reliable man-at-arms and crossbows scale well',
    ],
    weaknesses: [
      'Longbows are fragile and get run down by cavalry dives',
      'Low mobility makes it hard to punish a spread map',
    ],
    opening:
      'Open with Council Hall longbow pressure, early farms, or a stable response when cavalry is expected.',
    gamePlan:
      'Use longbow range and Network of Castles to take efficient fights while building a safe economy. Transition to man-at-arms, crossbows, trebuchets, and a late-game farm economy.',
    watchFor: [
      'Longbow lines you must close on with cavalry',
      'The Network of Castles buff when fighting near their towers',
      'A defensive style you must out-expand to break',
    ],
    tags: ['ranged', 'defensive', 'farms', 'infantry'],
  },
  french: {
    slug: 'french',
    name: 'French',
    difficulty: 'easy',
    focus: 'Royal Knights + strong economy, map control, and trade',
    summary:
      'An aggressive yet beginner-friendly civ with cheaper, faster production and powerful Royal Knights that charge for bonus damage. Great for learning cavalry pressure and map control.',
    strengths: [
      'Royal Knights charge for strong burst damage',
      'Production buildings give discounts and faster units',
      'Excellent map control and raiding mobility',
      'Trade and crossbows give a smooth late-game transition',
    ],
    weaknesses: [
      'Knights donate into spears, walls, and TC fire',
      'Falls off if early pressure achieves nothing',
    ],
    opening:
      'Open stable, pressure with knights, and use the threat of charge damage to force defensive spending.',
    gamePlan:
      'Keep raids active while adding archers or economy behind the pressure. Transition into crossbows, arbaletriers, traders, and siege if the first pressure does not end it.',
    watchFor: [
      'Constant knight raids on your economy',
      'Charge damage when your units are out of position',
      'Early aggression you must wall and spear against',
    ],
    tags: ['cavalry', 'mobility', 'trade', 'aggressive'],
  },
  golden_horde: {
    slug: 'golden_horde',
    name: 'Golden Horde',
    difficulty: 'hard',
    focus: 'Mongol variant with centralized Khan power and mass cavalry',
    summary:
      'A Mongol variant that centers its army and production around the Khan and a Golden Tent power base, building large cavalry forces for relentless map pressure. Mobile and aggressive.',
    strengths: [
      'Boosted production batches strong cavalry armies fast',
      'Khan provides a powerful mobile command presence',
      'High mobility takes map control before walls finish',
      'Aggressive tempo forces opponents onto the defensive',
    ],
    weaknesses: [
      'Losing the Khan or the power base cripples the army',
      'Overcommitting away from home leaves you exposed',
    ],
    opening:
      'Use the Khan and early production to take map control before the opponent can fully wall.',
    gamePlan:
      'Batch strong cavalry and infantry from boosted production while forcing the opponent to defend. Transition into mass cavalry, improved upgrades, and siege once the economy is secured.',
    watchFor: [
      'Early cavalry pressure across the map',
      'The Khan leading aggressive pushes',
      'Mass cavalry that demands spears and walls',
    ],
    tags: ['cavalry', 'mobility', 'aggressive', 'tempo'],
  },
  holy_roman_empire: {
    slug: 'holy_roman_empire',
    name: 'Holy Roman Empire',
    difficulty: 'medium',
    focus: 'Prelate economy + relics, infantry, and defensive scaling',
    summary:
      'An economic and defensive civ that uses Prelates to inspire villagers and gathers relics for steady gold. Strong infantry and emergency repairs make it resilient and forgiving.',
    strengths: [
      'Prelates boost villager gather rates for a strong economy',
      'Relics provide reliable passive gold income',
      'Sturdy man-at-arms and Landsknechte anchor fights',
      'Emergency repairs make defenses very hard to break',
    ],
    weaknesses: [
      'Greeding relics while exposed invites Feudal all-ins',
      'Limited early mobility against fast cavalry raids',
    ],
    opening:
      'Use Aachen Chapel or early Prelates to accelerate the economy while scouting for pressure.',
    gamePlan:
      'Reach Castle with enough army to secure relics and start a strong infantry or Burgrave timing. Scale with man-at-arms, Landsknechte, emergency repairs, and siege-backed pushes.',
    watchFor: [
      'A fast Prelate economy you must pressure early',
      'Relics worth contesting to deny gold',
      'Tanky infinite-repair defenses that are hard to crack',
    ],
    tags: ['religion', 'infantry', 'economy', 'defensive'],
  },
  house_of_lancaster: {
    slug: 'house_of_lancaster',
    name: 'House of Lancaster',
    difficulty: 'medium',
    focus: 'English variant with Manors, sheep economy, and ranged control',
    summary:
      'An English variant that builds Manors which spawn sheep for a passive food economy and trains Yeomen and the Earl’s Guard for ranged control. Defensive and economy-focused.',
    strengths: [
      'Manors generate sheep for a strong passive food economy',
      'Yeomen and Earl’s Guard form a sturdy ranged army',
      'Defensive structures hold ground efficiently',
      'Scales smoothly into upgraded ranged and heavy infantry',
    ],
    weaknesses: [
      'Manors are raid targets without walls or coverage',
      'Limited mobility to punish a spread-out opponent',
    ],
    opening: 'Build around early Manors and sheep tempo while scouting for cavalry pressure.',
    gamePlan:
      'Use Yeomen and Earl’s Guard to create a sturdy ranged army that trades well in tight spaces. Transition to upgraded ranged infantry, heavy infantry, and trebuchet pressure.',
    watchFor: [
      'Manors and sheep economy worth raiding',
      'Strong defensive ranged lines near their base',
      'An economy lead you must punish before it snowballs',
    ],
    tags: ['ranged', 'economy', 'defensive', 'infantry'],
  },
  japanese: {
    slug: 'japanese',
    name: 'Japanese',
    difficulty: 'medium',
    focus: 'Samurai + bannermen, farm economy, and flexible melee',
    summary:
      'A flexible melee civ with durable Samurai and bannermen that buff nearby units. A strong farm economy and multiple opening paths make it adaptable but micro-intensive.',
    strengths: [
      'Samurai are durable, hard-hitting melee units',
      'Bannermen provide combat auras to nearby units',
      'Strong farm economy supports a big army',
      'Flexible openings: economy, infantry, or mounted harass',
    ],
    weaknesses: [
      'Vulnerable to being kited by mass ranged units',
      'Bannermen and unit micro raise the skill floor',
    ],
    opening:
      'Use early scouting to decide between safe economy, infantry pressure, or mounted harassment.',
    gamePlan:
      'Take efficient fights around Samurai durability and bannerman bonuses while expanding food income. Transition to mixed infantry, mounted samurai, handcannons, and siege-backed pushes.',
    watchFor: [
      'Tanky Samurai you should kite with ranged units',
      'Bannerman auras buffing their army',
      'Flexible openings you must scout to read',
    ],
    tags: ['infantry', 'melee', 'economy', 'aggressive'],
  },
  jeanne_darc: {
    slug: 'jeanne_darc',
    name: "Jeanne d'Arc",
    difficulty: 'hard',
    focus: 'French variant built around a leveling hero unit',
    summary:
      'A French variant centered on the hero Jeanne d’Arc, who levels up by gaining experience in fights and unlocks powerful abilities. Snowballs hard if she survives and stays fed.',
    strengths: [
      'Jeanne levels into a powerful, game-warping hero',
      'Strong knights and burst fights around the hero',
      'Inspired pushes snowball map control quickly',
      'Smooth French-style cavalry and crossbow transitions',
    ],
    weaknesses: [
      'Losing Jeanne can flip the entire matchup',
      'Feeding free experience into bad fights backfires',
    ],
    opening:
      'Use Jeanne safely with early army support so she gains experience without being surrounded.',
    gamePlan:
      'Force small fights, pick off units, and turn level spikes into map control. Transition to knights, arbaletriers, inspired pushes, and siege once Jeanne is leveled.',
    watchFor: [
      'The hero leveling up into a major threat',
      'Avoid feeding Jeanne free experience in skirmishes',
      'Burst knight fights once she has spiked',
    ],
    tags: ['hero', 'cavalry', 'aggressive', 'mobility'],
  },
  jin_dynasty: {
    slug: 'jin_dynasty',
    name: 'Jin Dynasty',
    difficulty: 'medium',
    focus: 'Horse Grasslands + mounted villagers, cavalry, and gunpowder',
    summary:
      'A mobile, map-controlling civ that uses mounted villagers to expand fast and Horse Grasslands to fuel cavalry production. Adds gunpowder as the game opens up.',
    strengths: [
      'Mounted villagers expand and relocate the economy quickly',
      'Horse Grasslands drive a strong cavalry engine',
      'Tributaries provide bonus resources for map control',
      'Late-game gunpowder and Iron Pagoda are powerful',
    ],
    weaknesses: [
      'Spreading too wide exposes villagers and Tributaries to raids',
      'Thin map presence can be punished by focused aggression',
    ],
    opening:
      'Use mounted villagers to expand quickly and secure Tributaries before the enemy can contest them.',
    gamePlan:
      'Build a cavalry engine from Horse Grasslands, then add gunpowder pressure as the game opens up. Transition into Iron Pagoda, Mounted Grenadiers, Eruptors, keeps, and siege pressure.',
    watchFor: [
      'A wide economy with Tributaries worth raiding',
      'Strong cavalry pressure from Horse Grasslands',
      'Late-game gunpowder you must flank or hit early',
    ],
    tags: ['cavalry', 'gunpowder', 'map-control', 'economy'],
  },
  knights_templar: {
    slug: 'knights_templar',
    name: 'Knights Templar',
    difficulty: 'hard',
    focus: 'English variant with Commanderies, pilgrims, and heavy cavalry',
    summary:
      'An English variant that builds Commanderies and earns gold from pilgrims at sacred sites, leaning into armored heavy cavalry timings. Rewards map control and route protection.',
    strengths: [
      'Pilgrim and sacred-site income fuels strong timings',
      'Commandery bonuses enable flexible power spikes',
      'Heavy armored cavalry hits hard at the right timing',
      'Adapts its plan around the chosen commandery',
    ],
    weaknesses: [
      'Pilgrims and age-up Town Centers are vulnerable',
      'Complex setup punishes unprotected commitments',
    ],
    opening:
      'Scout sacred sites early and plan the Town Center age-up around the safest commandery choice.',
    gamePlan:
      'Use commandery bonuses and pilgrim income to hit a strong armored timing. Transition through commandery power spikes into heavy cavalry, infantry support, and siege.',
    watchFor: [
      'Pilgrim and sacred-site gold worth contesting',
      'Exposed pilgrim routes and age-up TCs to raid',
      'Strong armored cavalry timing attacks',
    ],
    tags: ['cavalry', 'religion', 'adaptive', 'aggressive'],
  },
  macedonian_dynasty: {
    slug: 'macedonian_dynasty',
    name: 'Macedonian Dynasty',
    difficulty: 'hard',
    focus: 'Byzantine variant with a Silver economy and conquest timings',
    summary:
      'A Byzantine variant that builds a Silver economy to accelerate production and technology, converting that lead into faster army spikes and aggressive conquest timings.',
    strengths: [
      'Silver income speeds up production and technology',
      'Faster army spikes than slower civilizations',
      'Powerful Varangian-led infantry compositions',
      'Aggressive conquest timings force early fights',
    ],
    weaknesses: [
      'Silver infrastructure is a raid target if left exposed',
      'Inherits the Byzantine civ’s decision complexity',
    ],
    opening: 'Set up Silver income early and use it to accelerate production or technology.',
    gamePlan:
      'Turn the Silver economy into a faster army spike and force fights before slower civs stabilize. Transition into Varangian-led infantry, cavalry support, and siege for fortified positions.',
    watchFor: [
      'A tech or production lead from Silver income',
      'Silver infrastructure worth raiding',
      'Early conquest timings you must survive',
    ],
    tags: ['economy', 'infantry', 'tempo', 'aggressive'],
  },
  malians: {
    slug: 'malians',
    name: 'Malians',
    difficulty: 'medium',
    focus: 'Pit mines + cattle, stealth infantry, and a flexible gold economy',
    summary:
      'A unique economic civ that mines passive gold from Pit Mines and grows cattle for food, fielding mobile stealth infantry and javelin throwers. Greedy but snowballs if left alone.',
    strengths: [
      'Pit Mines give strong passive gold income',
      'Cattle provide a flexible, mobile food economy',
      'Stealth infantry enable surprise raids and ambushes',
      'Javelin throwers fight cost-efficiently',
    ],
    weaknesses: [
      'Greedy economy can be punished by early aggression',
      'Losing pit mines or cattle removes the snowball',
    ],
    opening:
      'Secure pit mines and cattle while scouting whether the enemy can punish the greedy economy.',
    gamePlan:
      'Use mobile infantry and javelin throwers to fight efficiently while the passive economy grows. Transition to Farimba or cow boom power spikes with Musofadi, sofa, and siege support.',
    watchFor: [
      'A greedy economy you must punish early',
      'Stealth infantry sneaking into your base',
      'Pit mines and cattle ranches worth raiding',
    ],
    tags: ['economy', 'infantry', 'mobility', 'gold'],
  },
  mongols: {
    slug: 'mongols',
    name: 'Mongols',
    difficulty: 'hard',
    focus: 'Ovoo tempo + mobility, trade, and early pressure',
    summary:
      'A hyper-mobile civ that can pack and move buildings, uses Ovoos for stone and double-production windows, and thrives on relentless early pressure and trade. High skill ceiling.',
    strengths: [
      'Buildings can be packed up and relocated freely',
      'Ovoo enables stone income and double-production windows',
      'Exceptional mobility and early map pressure',
      'Strong trade and raiding economy',
    ],
    weaknesses: [
      'Unprotected trade or Ovoo is a major liability',
      'Demanding micro and multitasking for new players',
    ],
    opening:
      'Scout aggressively, decide between tower pressure, Keshik tempo, or trade, and keep units moving.',
    gamePlan:
      'Use double-production windows to force fights before static defenses are ready. Scale with trade, cavalry mobility, Mangudai utility, and springald-backed siege control.',
    watchFor: [
      'Constant early pressure and raids',
      'Trade routes and the Ovoo worth attacking',
      'High mobility that demands you wall key paths',
    ],
    tags: ['mobility', 'trade', 'aggressive', 'cavalry'],
  },
  order_of_the_dragon: {
    slug: 'order_of_the_dragon',
    name: 'Order of the Dragon',
    difficulty: 'hard',
    focus: 'HRE variant with few but elite, expensive units',
    summary:
      'A Holy Roman Empire variant that fields fewer units that are stronger and far more expensive than normal, plus gilded upgrades. Every unit matters, so trades must be efficient.',
    strengths: [
      'Gilded units have superior stats unit-for-unit',
      'Wins small, high-quality engagements',
      'Inherits HRE Prelate economy and relics',
      'Strong infantry and cavalry that break fortifications',
    ],
    weaknesses: [
      'Every elite unit is expensive and costly to lose',
      'Outnumbered and surrounded on multiple fronts',
    ],
    opening:
      'Open safely and avoid losing early elite units; every unit is expensive and important.',
    gamePlan:
      'Take smaller, high-quality fights where superior unit stats matter more than raw numbers. Transition into gilded infantry, knights, prelate support, and siege to break fortified positions.',
    watchFor: [
      'Elite units that win straight-up fights',
      'Force multi-front pressure they cannot cover',
      'Their small army that struggles when surrounded',
    ],
    tags: ['elite', 'infantry', 'cavalry', 'defensive'],
  },
  ottomans: {
    slug: 'ottomans',
    name: 'Ottomans',
    difficulty: 'medium',
    focus: 'Military Schools + Vizier bonuses, Mehter support, and siege',
    summary:
      'A tempo and gunpowder civ that trains free units from Military Schools and supports its army with Mehter drum auras. Strong Janissaries and siege, with Vizier-point flexibility.',
    strengths: [
      'Military Schools produce free units over time',
      'Mehter auras buff the army in combat',
      'Strong gunpowder Janissaries and Great Bombards',
      'Vizier points add flexible economic and military bonuses',
    ],
    weaknesses: [
      'Weak when support pieces are picked off first',
      'Unsupported fights expose the army’s fragility',
    ],
    opening:
      'Open around Military School tempo and scout whether horsemen or archers answer the matchup best.',
    gamePlan:
      'Use free unit momentum with Mehter auras to pressure before the enemy economy stabilizes. Transition into Janissaries, Great Bombards, and layered siege positions.',
    watchFor: [
      'A steady stream of free units from Military Schools',
      'Mehter and support units worth focusing first',
      'Gunpowder and siege you should flank or rush',
    ],
    tags: ['tempo', 'gunpowder', 'siege', 'support'],
  },
  rus: {
    slug: 'rus',
    name: 'Rus',
    difficulty: 'medium',
    focus: 'Bounty hunting economy + knights and wooden fortresses',
    summary:
      'A civ that earns bounty gold from hunting animals, building a strong food and gold lead, then converts it into knights, horse archers, and mobile play behind wooden fortresses.',
    strengths: [
      'Bounty gold from hunting fuels a strong early economy',
      'Knights and horse archers give mobile, raiding power',
      'Wooden fortresses provide cheap, strong defense',
      'Warrior monks and map food keep you ahead',
    ],
    weaknesses: [
      'Skipping walls or detection invites stealth and raids',
      'Reliant on map food that can be contested',
    ],
    opening:
      'Open multiple scouts for bounty, then choose Kremlin safety, 2 TC, or Feudal knight pressure.',
    gamePlan:
      'Use bounty and map food to stay ahead while forcing the enemy to defend raids. Transition to horse archers, warrior monks, crossbows, and siege depending on enemy armor.',
    watchFor: [
      'An economy lead from bounty hunting',
      'Knight and horse archer raids',
      'Wooden fortresses anchoring their defense',
    ],
    tags: ['cavalry', 'mobility', 'economy', 'map-control'],
  },
  sengoku_daimyo: {
    slug: 'sengoku_daimyo',
    name: 'Sengoku Daimyo',
    difficulty: 'hard',
    focus: 'Japanese variant with Daimyo Estates and faction pledges',
    summary:
      'A Japanese variant that builds Daimyo Estates for agriculture and chooses faction pledges to customize its tech and power spikes. Highly adaptive but demands planning.',
    strengths: [
      'Faction pledges tailor bonuses to the matchup',
      'Daimyo Estates provide strong agricultural value',
      'Focused timing spikes from the chosen banner',
      'Flexible infantry, cavalry, and siege transitions',
    ],
    weaknesses: [
      'Delaying the pledge plan lets enemies spike first',
      'Drifting into mixed upgrades wastes the focus',
    ],
    opening:
      'Choose the faction pledge that answers the matchup and build Daimyo Estate value early.',
    gamePlan:
      'Use faction bonuses to create a focused timing instead of drifting into mixed upgrades. Transition into faction-enhanced infantry, cavalry, and siege based on the chosen banner.',
    watchFor: [
      'A faction pledge that defines their power spike',
      'Daimyo Estate economy worth pressuring',
      'A focused timing attack you must scout for',
    ],
    tags: ['adaptive', 'economy', 'melee', 'technology'],
  },
  tughlaq_dynasty: {
    slug: 'tughlaq_dynasty',
    name: 'Tughlaq Dynasty',
    difficulty: 'hard',
    focus: 'Delhi variant with Governors, forts, and elephant tools',
    summary:
      'A Delhi Sultanate variant that assigns Governors to forts for bonuses and leans on defensive play, Scholar support, and powerful elephant units to reach fortified timings.',
    strengths: [
      'Governors grant strong fort-based bonuses',
      'Defensive forts keep the economy alive',
      'Scholar support continues the Delhi free-tech identity',
      'Powerful elephants like the Ballista Elephant',
    ],
    weaknesses: [
      'Expensive elephants need anti-spear and siege support',
      'Inherits Delhi’s fragile, slow early game',
    ],
    opening: 'Assign governors with a clear plan and use early defenses to keep the economy alive.',
    gamePlan:
      'Use governorship bonuses to reach a strong fortified timing with efficient elephant support. Transition into Ballista Elephants, fortified pushes, infantry screens, and siege.',
    watchFor: [
      'Fortified positions backed by Governors',
      'Expensive elephants you can counter with spears',
      'A defensive economy you must out-expand',
    ],
    tags: ['elephants', 'defensive', 'religion', 'technology'],
  },
  zhu_xis_legacy: {
    slug: 'zhu_xis_legacy',
    name: "Zhu Xi's Legacy",
    difficulty: 'hard',
    focus: 'Chinese variant with dynasty tempo and meditation economy',
    summary:
      'A Chinese variant with strong early dynasty options and a meditation-based economy, offering flexible tech paths and efficient Feudal units alongside the usual Chinese siege strength.',
    strengths: [
      'Early landmark and dynasty choices enable fast pressure',
      'Meditation economy and bonuses keep production smooth',
      'Efficient Feudal units for early fights',
      'Strong palace infantry, crossbows, and siege late',
    ],
    weaknesses: [
      'Overbooming without scouting invites cavalry or rams',
      'Inherits Chinese complexity in managing dynasties',
    ],
    opening:
      'Use the early landmark and dynasty choices to set up pressure or a protected economy.',
    gamePlan:
      'Pressure with efficient Feudal units while using dynasty bonuses to keep production smooth. Transition into palace-style infantry, crossbows, siege, and dynasty-enhanced late-game tech.',
    watchFor: [
      'Early dynasty pressure or a protected boom',
      'Landmark choices that signal their plan',
      'Strong late-game siege and infantry',
    ],
    tags: ['dynasty', 'tempo', 'economy', 'adaptive'],
  },
}
