/**
 * DORMANT (not currently wired): pure + tested, but no overlay widget renders
 * these today. Kept for a future overlay micro-coach.
 *
 * Clock-driven macro reminders for the in-game overlay (pure). Universal
 * beginner habits keyed to the match clock — independent of civ/build, ToS-safe
 * (driven by elapsed time we already track, never live game state). Inspired by
 * DPM's in-game timers/reminders.
 */

export interface Reminder {
  /** Seconds into the game this reminder becomes relevant. */
  atSec: number
  text: string
}

/** Ordered by time. The overlay shows whichever is current for the match clock. */
export const MACRO_REMINDERS: Reminder[] = [
  { atSec: 15, text: 'Send all villagers to food — never stop making villagers.' },
  { atSec: 90, text: 'Build a house before you get supply-blocked.' },
  { atSec: 150, text: 'Scout — find your opponent and your next food source.' },
  { atSec: 240, text: "Don't float resources — keep spending on villagers & buildings." },
  { atSec: 330, text: 'Commit to your age-up — don’t idle in one age.' },
  { atSec: 450, text: 'Add farms as your sheep/berries run out.' },
  { atSec: 600, text: 'Produce from every military building you own.' },
  { atSec: 780, text: 'Take map control — relics, sacred sites, and the center.' },
  { atSec: 960, text: 'Keep your economy growing while you trade armies.' },
]

/** The reminder relevant at `elapsedSec` (the latest one reached), or null. */
export function currentReminder(
  elapsedSec: number | null,
  reminders: Reminder[] = MACRO_REMINDERS,
): Reminder | null {
  if (elapsedSec == null) return null
  let current: Reminder | null = null
  for (const r of reminders) {
    if (r.atSec <= elapsedSec) current = r
    else break
  }
  return current
}
