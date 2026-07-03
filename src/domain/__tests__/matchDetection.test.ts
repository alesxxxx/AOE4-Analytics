import { describe, it, expect } from 'vitest'
import { loadFixture } from '../../api/__tests__/fixtures'
import type { Game } from '../../api/types'
import { detect, INITIAL_DETECTOR_STATE } from '../matchDetection'

const ongoing = loadFixture<Game>('game-ongoing_synthetic.json')
const finished = loadFixture<Game>('games-last-10240693.json') // ongoing:false, just_finished:false

describe('detect', () => {
  it('emits match-started when an ongoing game first appears', () => {
    const out = detect(INITIAL_DETECTOR_STATE, ongoing)
    expect(out.event).toBe('match-started')
    expect(out.state).toEqual({ lastGameId: ongoing.game_id, lastOngoing: true })
  })

  it('emits none while the same game stays ongoing', () => {
    const first = detect(INITIAL_DETECTOR_STATE, ongoing)
    const second = detect(first.state, ongoing)
    expect(second.event).toBe('none')
  })

  it('emits match-ended when the tracked ongoing game finishes', () => {
    const started = detect(INITIAL_DETECTOR_STATE, ongoing)
    const endedGame: Game = { ...ongoing, ongoing: false }
    const out = detect(started.state, endedGame)
    expect(out.event).toBe('match-ended')
    expect(out.state.lastOngoing).toBe(false)
  })

  it('emits match-ended for a brand-new just_finished game (missed start)', () => {
    const justFinished: Game = { ...finished, game_id: 555, ongoing: false, just_finished: true }
    const out = detect(INITIAL_DETECTOR_STATE, justFinished)
    expect(out.event).toBe('match-ended')
  })

  it('emits none for an already-seen finished game', () => {
    const seen = { lastGameId: finished.game_id, lastOngoing: false }
    expect(detect(seen, finished).event).toBe('none')
  })

  it('emits none when there is no game', () => {
    expect(detect(INITIAL_DETECTOR_STATE, null).event).toBe('none')
  })
})
