export interface Guide {
  slug: string
  title: string
  category: 'fundamentals' | 'economy' | 'military' | 'strategy'
  summary: string
  readMinutes: number
  body: string // markdown
}

export const GUIDES: Guide[] = [
  {
    slug: 'scouting-basics',
    title: 'Scouting Basics',
    category: 'fundamentals',
    summary:
      'Why scouting wins games: find the enemy, read their plan, and react before it hits you.',
    readMinutes: 2,
    body: `## Why scout?

Information is the cheapest advantage in Age of Empires IV. Knowing what your opponent is doing lets you build the right army and avoid nasty surprises.

## When to scout

- Send your starting scout out the moment the game begins.
- Keep scouting throughout the Dark and Feudal Ages, not just once.
- Re-scout after big moments, like when you suspect they aged up.

## How to scout

- Use your scout's vision to circle the map, not just the enemy base.
- Put the scout on patrol or move it manually to dodge enemy units.
- Pick up sheep and deer with your scout to feed your economy.

## What to look for

- **Military buildings** such as Barracks, Archery Ranges, and Stables tell you what army to expect.
- **Gold mines and sacred sites** reveal where they are committing resources.
- **Aggression signs** like forward buildings, walls, or units near your base mean an attack is coming.
- A heavily walled base usually means they are booming, so you have time to grow too.

Scout early, scout often, and let what you see shape every decision you make.`,
  },
  {
    slug: 'economy-fundamentals',
    title: 'Economy Fundamentals',
    category: 'economy',
    summary:
      'A strong economy funds everything else. Keep villagers flowing and resources working.',
    readMinutes: 2,
    body: `## Never stop villager production

The single biggest habit for beginners: keep your Town Center making villagers nonstop. Every second your TC sits idle is lost economy you can never get back.

## Balance your resources

- **Food** powers villagers, most age-ups, and many units.
- **Wood** builds structures, walls, and supports archers.
- **Gold** funds stronger units, upgrades, and ranged troops.
- **Stone** is for defenses, extra Town Centers, and some landmarks.

Match what you gather to what you plan to build. Hoarding one resource while starving another slows you down.

## Add a second Town Center

Once your economy is stable, usually in the Feudal or Castle Age, a second Town Center doubles your villager production and helps you boom safely. Build it near a fresh resource cluster.

## Avoid floating and idle time

- **Floating resources** are piles you are not spending. If you have 800 unused food, queue villagers or units.
- **Idle TC time** means no villager is training. Set a rally point and keep the queue full.
- Idle villagers should be put back to work immediately.

A clean economy quietly wins games long before the fighting decides them.`,
  },
  {
    slug: 'army-composition',
    title: 'Army Composition',
    category: 'military',
    summary:
      'Age of Empires IV is rock-paper-scissors. Counter what you see and keep your army mixed.',
    readMinutes: 2,
    body: `## The counter triangle

Most units have a job and a weakness. Learn the core relationships:

- **Spearmen** beat cavalry and horsemen with their anti-cavalry bonus.
- **Horsemen and cavalry** beat ranged units by closing the gap fast and running them down.
- **Archers** beat infantry, melting spearmen and other foot soldiers.
- **Crossbows and handcannoneers** beat heavy units like knights and men-at-arms.
- **Siege** beats buildings and tightly clumped armies.

## Read and react

Scout the enemy army, then build the counter:

- Facing knights? Add spearmen and crossbows.
- Facing archers? Send horsemen to chase them down.
- Facing massed infantry? Lean on archers.

## Keep your army mixed

No single unit wins every fight. A pure army is easy to hard-counter, so blend types:

- A frontline of infantry or cavalry to absorb damage.
- Ranged units behind to deal damage safely.
- A little siege to break clumps and defenses.

## Don't forget positioning

- Keep ranged units protected behind your melee.
- Focus-fire key targets like enemy siege.

A balanced army that answers what your opponent brings beats a bigger army that doesn't.`,
  },
  {
    slug: 'when-to-attack',
    title: 'When to Attack',
    category: 'strategy',
    summary: 'Timing is everything. Hit when you have an edge, and never charge into a counter.',
    readMinutes: 3,
    body: `## Find your timing window

Attacks work best when you have a temporary advantage:

- Just after an age-up, when your units outclass theirs.
- When you have more army than the enemy can field right now.
- When the enemy is greedy and under-defended.

## Always scout before committing

Never march in blind. Before you attack:

- Check the enemy army size and composition.
- Look for walls, towers, and defensive buildings.
- Confirm you are not walking into a hard counter.

## All-in vs boom

- **All-in** means pouring resources into army for a knockout blow. It wins fast but leaves you behind if it fails.
- **Booming** means investing in economy to overwhelm later. Safer, but vulnerable to early aggression.

Most games sit between these. Apply pressure to keep the enemy honest without bankrupting your economy.

## Punish greed

If scouting shows an opponent skipping defenses to boom, attack. Even light pressure forces them to spend on army and falls behind their plan.

## Don't attack into counters

- Avoid sending cavalry into a wall of spearmen.
- Don't push ranged armies into faster cavalry.
- If the math looks bad, back off and out-economy them instead.

Patience plus the right timing beats reckless aggression nearly every time.`,
  },
  {
    slug: 'age-up-benchmarks',
    title: 'Age-Up Benchmarks',
    category: 'economy',
    summary: 'Rough timing targets to measure your progress. Heuristics, not hard rules.',
    readMinutes: 2,
    body: `## These are heuristics, not laws

The numbers below are loose targets for low-to-mid level players to check their pace. They are **not strict rules**. Real timings depend heavily on your civilization, your build order, and your strategy. A fast aggressive build and a greedy boom will hit very different numbers, and that is fine.

## Age-up timing targets

- **Feudal Age:** roughly 5:00 to 6:30.
- **Castle Age:** roughly 10:00 to 14:00.

Slower than this isn't a failure, but if you are far behind these ranges, look for idle Town Center time or stalled villager production.

## Villager count targets

- About **20 villagers by 5:00**.
- About **40 or more villagers by 10:00**.

These assume a fairly economic build. Aggressive openings trade villagers for early army, so expect lower counts.

## How to use these

- Treat them as a rough mirror, not a scoreboard.
- If you are consistently behind, check for idle TC time and floating resources first.
- As you improve, your own benchmarks matter more than generic ones.

The goal isn't to hit exact numbers. It's to keep producing, keep spending, and keep getting a little faster each game.`,
  },
]
