import { describe, it, expect } from 'vitest'
import { buildLocalAnalyzedGame, resultTypeToOutcome } from '../localGame'
import type { LocalMatch } from '../localMatch'
import type { ReplayMatchup } from '../replay'

describe('resultTypeToOutcome', () => {
  it('maps Relic result codes', () => {
    expect(resultTypeToOutcome(1)).toBe('win')
    expect(resultTypeToOutcome(0)).toBe('loss')
    expect(resultTypeToOutcome(null)).toBeNull()
    expect(resultTypeToOutcome(7)).toBeNull()
  })
})

const match: LocalMatch = {
  matchHistoryId: 1658073569512246500,
  map: 'atacama',
  matchTypeId: 52,
  startedAtMs: 1782435383_000,
  completedAtMs: 1782437201_000,
  myProfileId: 22223074,
  players: [{ profileId: 22223074, raceId: 9000860, civ: null, resultType: 1, teamId: -1 }],
  opponentProfileIds: [],
}

const matchup: ReplayMatchup = {
  mapId: 'atacama',
  mapName: 'Atacama',
  me: {
    name: '1.1.1.1.2',
    civToken: 'sultanate_ha_tug',
    civSlug: 'tughlaq_dynasty',
    civName: 'Tughlaq Dynasty',
    steamId: '7656119...',
    ai: false,
  },
  opponents: [
    {
      name: '2 A.I. Intermediate',
      civToken: 'sultanate_ha_tug',
      civSlug: 'tughlaq_dynasty',
      civName: 'Tughlaq Dynasty',
      steamId: null,
      ai: true,
    },
  ],
}

describe('buildLocalAnalyzedGame', () => {
  it('combines match result + replay matchup into an AnalyzedGame', () => {
    const r = buildLocalAnalyzedGame(match, matchup)!
    expect(r.game.civ).toBe('tughlaq_dynasty')
    expect(r.game.oppCiv).toBe('tughlaq_dynasty')
    expect(r.game.map).toBe('Atacama')
    expect(r.game.result).toBe('win') // resultType 1
    expect(r.game.durationSec).toBe(1818)
    expect(r.isVsAI).toBe(true)
    expect(r.oppName).toBe('2 A.I. Intermediate')
    expect(r.format).toBe('1v1') // 1 human vs 1 AI
  })

  it('returns null when our civ is unknown (no usable replay)', () => {
    expect(buildLocalAnalyzedGame(match, null)).toBeNull()
  })

  it('1v1 vs a single AI: myTeam/oppTeam stay undefined (no regression)', () => {
    const r = buildLocalAnalyzedGame(match, matchup)!
    expect(r.game.myTeam).toBeUndefined()
    expect(r.game.oppTeam).toBeUndefined()
  })

  it('me vs 2 AI: oppTeam captures both, myTeam stays undefined', () => {
    const vs2AI: ReplayMatchup = {
      ...matchup,
      opponents: [
        { ...matchup.opponents[0]!, name: 'AI One' },
        { ...matchup.opponents[0]!, name: 'AI Two', civSlug: 'mongols', civName: 'Mongols' },
      ],
    }
    const r = buildLocalAnalyzedGame(match, vs2AI)!
    expect(r.game.myTeam).toBeUndefined()
    expect(r.game.oppTeam).toEqual([
      { civ: 'tughlaq_dynasty', name: 'AI One' },
      { civ: 'mongols', name: 'AI Two' },
    ])
    expect(r.format).toBe('1v2')
  })

  it('me + a human ally vs AI: myTeam captures the ally via the human/AI split', () => {
    const withAlly: ReplayMatchup = {
      ...matchup,
      opponents: [
        {
          name: 'Human Ally',
          civToken: 'english',
          civSlug: 'english',
          civName: 'English',
          steamId: '76561198000000001',
          ai: false,
        },
        matchup.opponents[0]!, // the original AI opponent
      ],
    }
    const r = buildLocalAnalyzedGame(match, withAlly)!
    expect(r.game.myTeam).toEqual([{ civ: 'english', name: 'Human Ally' }])
    expect(r.game.oppTeam).toBeUndefined() // only 1 AI enemy
  })

  it('human custom 1v1 treats the other human as the opponent', () => {
    const humanMatch: LocalMatch = {
      ...match,
      players: [
        { profileId: 22223074, raceId: null, civ: null, resultType: 1, teamId: 0 },
        { profileId: 33333333, raceId: null, civ: null, resultType: 0, teamId: 1 },
      ],
      opponentProfileIds: [33333333],
    }
    const humanReplay: ReplayMatchup = {
      ...matchup,
      opponents: [
        {
          name: 'Practice Friend',
          civToken: 'french',
          civSlug: 'french',
          civName: 'French',
          steamId: '76561198000000002',
          ai: false,
        },
      ],
    }
    const r = buildLocalAnalyzedGame(humanMatch, humanReplay)!
    expect(r.isVsAI).toBe(false)
    expect(r.oppName).toBe('Practice Friend')
    expect(r.game.oppCiv).toBe('french')
    expect(r.game.myTeam).toBeUndefined()
    expect(r.game.oppTeam).toBeUndefined()
    expect(r.format).toBe('1v1')
  })
})
