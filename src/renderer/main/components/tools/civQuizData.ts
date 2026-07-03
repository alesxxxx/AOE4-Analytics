/**
 * Civ Quiz question bank + scoring (pure, testable). Every answer option is
 * tagged with one or more of the REAL tags used in `CIV_PROFILES` (verified
 * against the actual data — see `src/data/civProfiles.ts` — not invented), so
 * scoring is just tag-overlap counting against each civ's `tags` array.
 */
import { CIV_PROFILES, type CivProfile } from '@data/civProfiles'

export interface QuizOption {
  label: string
  /** Tags from CIV_PROFILES this answer leans toward. */
  tags: string[]
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: QuizOption[]
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'pace',
    prompt: 'How do you want most games to feel?',
    options: [
      { label: 'Hit hard and early, end it fast', tags: ['aggressive', 'tempo'] },
      { label: 'Build up a big economy, win the late game', tags: ['economy', 'boom'] },
      { label: 'Read the opponent and adapt my plan', tags: ['adaptive'] },
      { label: 'Stay safe and grind out an even game', tags: ['defensive'] },
    ],
  },
  {
    id: 'army',
    prompt: 'What army do you want to click on to build?',
    options: [
      { label: 'Horses — knights, raiders, mobile strikes', tags: ['cavalry', 'mobility'] },
      { label: 'Boots on the ground — spearmen, men-at-arms', tags: ['infantry', 'melee'] },
      { label: 'Arrows and crossbows from a distance', tags: ['ranged'] },
      { label: 'Guns and cannons', tags: ['gunpowder'] },
    ],
  },
  {
    id: 'difficulty',
    prompt: 'How much do you want to juggle at once?',
    options: [
      { label: 'Keep it simple while I learn the basics', tags: ['__easy'] },
      { label: "I'm past the basics, give me some depth", tags: ['__medium'] },
      { label: 'I want a civ with a real skill ceiling', tags: ['__hard'] },
    ],
  },
  {
    id: 'economy-style',
    prompt: 'Pick an economic bonus:',
    options: [
      { label: 'Villagers that work faster or cost less', tags: ['economy'] },
      { label: 'Trade routes and gold from caravans', tags: ['trade'] },
      { label: 'A unique resource or mechanic to master', tags: ['dynasty', 'technology'] },
      { label: "I don't care, just let me fight", tags: ['aggressive'] },
    ],
  },
  {
    id: 'map-presence',
    prompt: "How do you like to use the map?",
    options: [
      { label: 'Raid, harass, and deny their economy', tags: ['mobility', 'aggressive'] },
      { label: 'Turtle behind walls and towers', tags: ['defensive'] },
      { label: 'Control key resources and choke points', tags: ['map-control'] },
      { label: 'Rush a big timing attack', tags: ['tempo'] },
    ],
  },
  {
    id: 'unique-mechanic',
    prompt: 'Which unique mechanic sounds the most fun?',
    options: [
      { label: 'A hero unit that levels up', tags: ['hero'] },
      { label: 'War elephants', tags: ['elephants'] },
      { label: 'Camel riders that shred cavalry', tags: ['camels'] },
      { label: 'Hiring mercenaries with gold', tags: ['mercenary'] },
    ],
  },
  {
    id: 'identity',
    prompt: 'Which identity appeals most?',
    options: [
      { label: 'Religious/monastic — monks, relics, faith techs', tags: ['religion'] },
      { label: 'An elite, expensive, high-quality army', tags: ['elite'] },
      { label: 'A flexible all-rounder with no bad matchups', tags: ['adaptive'] },
      { label: 'A tech-focused civ with strong upgrades', tags: ['technology'] },
    ],
  },
  {
    id: 'siege',
    prompt: 'How much do you care about siege weapons?',
    options: [
      { label: 'Love it — I want to smash buildings', tags: ['siege'] },
      { label: "Don't care, I'd rather out-mobility them", tags: ['mobility'] },
      { label: 'Prefer supporting my army instead', tags: ['support'] },
      { label: 'Prefer farming a safe economy instead', tags: ['farms', 'economy'] },
    ],
  },
  {
    id: 'resource',
    prompt: 'Which resource do you want your bonuses tied to?',
    options: [
      { label: 'Gold — a rich, expensive playstyle', tags: ['gold'] },
      { label: 'Food — big population, big armies', tags: ['farms'] },
      { label: 'None in particular — just give me tempo', tags: ['tempo'] },
      { label: 'A boom that snowballs the whole match', tags: ['boom', 'economy'] },
    ],
  },
]

/** Every real tag used across CIV_PROFILES — sanity-checked in tests against the data. */
export const KNOWN_TAGS = new Set(Object.values(CIV_PROFILES).flatMap((c) => c.tags))

export interface QuizResult {
  civ: CivProfile
  score: number
}

/**
 * Score every civ by counting how many of its tags were chosen (weighted by how
 * often each tag was picked), plus a difficulty match bonus from the `__easy` /
 * `__medium` / `__hard` pseudo-tags. Returns civs sorted best-match first.
 */
export function scoreQuiz(chosenTags: string[]): QuizResult[] {
  const tagWeight = new Map<string, number>()
  let difficultyPick: CivProfile['difficulty'] | null = null
  for (const t of chosenTags) {
    if (t === '__easy') difficultyPick = 'easy'
    else if (t === '__medium') difficultyPick = 'medium'
    else if (t === '__hard') difficultyPick = 'hard'
    else tagWeight.set(t, (tagWeight.get(t) ?? 0) + 1)
  }

  const results = Object.values(CIV_PROFILES).map((civ) => {
    const tagScore = civ.tags.reduce((sum, tag) => sum + (tagWeight.get(tag) ?? 0), 0)
    const difficultyBonus = difficultyPick != null && civ.difficulty === difficultyPick ? 0.5 : 0
    return { civ, score: tagScore + difficultyBonus }
  })

  return results.sort((a, b) => b.score - a.score)
}
