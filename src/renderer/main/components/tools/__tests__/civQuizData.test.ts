import { describe, it, expect } from 'vitest'
import { CIV_PROFILES } from '@data/civProfiles'
import { QUIZ_QUESTIONS, KNOWN_TAGS, scoreQuiz } from '../civQuizData'

describe('civ quiz question bank', () => {
  it('every option tag is either a real CIV_PROFILES tag or a difficulty pseudo-tag', () => {
    for (const q of QUIZ_QUESTIONS) {
      for (const opt of q.options) {
        for (const tag of opt.tags) {
          const isPseudo = tag === '__easy' || tag === '__medium' || tag === '__hard'
          expect(isPseudo || KNOWN_TAGS.has(tag), `${q.id}: "${opt.label}" → ${tag}`).toBe(true)
        }
      }
    }
  })

  it('has a healthy number of questions with at least 2 options each', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(8)
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('scoreQuiz', () => {
  it('ranks every civ and returns them all', () => {
    const results = scoreQuiz(['aggressive', 'cavalry'])
    expect(results.length).toBe(Object.keys(CIV_PROFILES).length)
  })

  it('favors civs whose tags overlap the chosen answers', () => {
    // French: cavalry, mobility, trade, aggressive — should outrank a civ with none of these.
    const results = scoreQuiz(['cavalry', 'mobility', 'aggressive'])
    const french = results.find((r) => r.civ.slug === 'french')!
    const delhi = results.find((r) => r.civ.slug === 'delhi_sultanate')! // religion,tempo,infantry,elephants
    expect(french.score).toBeGreaterThan(delhi.score)
    expect(results[0]!.civ.slug).toBe('french')
  })

  it('applies a difficulty bonus without a real tag match', () => {
    const results = scoreQuiz(['__easy'])
    const easyCiv = results.find((r) => r.civ.difficulty === 'easy')!
    const hardCiv = results.find((r) => r.civ.difficulty === 'hard')!
    expect(easyCiv.score).toBeGreaterThan(hardCiv.score)
  })

  it('returns a stable full ranking for an empty pick (no crash, all scores 0)', () => {
    const results = scoreQuiz([])
    expect(results.every((r) => r.score === 0)).toBe(true)
  })
})
