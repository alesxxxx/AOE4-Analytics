import { describe, it, expect } from 'vitest'
import { civFromToken, parseStatsSummary, prettyName } from '../statsSummary'
import {
  chunk,
  chunkyFile,
  concat,
  corruptHeaderStpdData,
  createdEntity,
  resourceEntry,
  scoreEntry,
  stlsData,
  stpdData,
  type StpdOptions,
} from './chunkyBuild'

const MY_RESOURCES = [
  resourceEntry(0, [200, 200, 100, 0], [0, 0, 0, 0]),
  resourceEntry(20, [150, 120, 100, 0], [90, 40, 0, 0], [270, 120, 0, 0]),
  resourceEntry(40, [80, 60, 120, 0], [260, 130, 20, 0], [510, 270, 60, 0]),
]
const MY_SCORES = [scoreEntry(0, 10, 0, 5, 0, 15), scoreEntry(20, 40, 10, 8, 5, 63)]

/** Build STLI → STLS(build order) + STPL → STLP → STPD(header+timelines) for two players. */
function summaryFile(myStpd?: Uint8Array): Uint8Array {
  const stls = chunk(
    'DATA',
    'STLS',
    stlsData(600, [
      createdEntity(0, 1003, 'building_town_center_capital_tem', 19),
      createdEntity(53, 1003, 'unit_villager_1_tem', 46),
      createdEntity(120, 1003, 'upgrade_wood_gather_1', 52),
      createdEntity(0, 1007, 'building_town_center_capital_eng', 19),
      createdEntity(30, 1007, 'unit_villager_1_eng', 46),
    ]),
    { version: 2003 },
  )
  const player = (id: number, name: string, opts: StpdOptions, data?: Uint8Array) =>
    chunk(
      'FOLD',
      'STLP',
      chunk('DATA', 'STPD', data ?? stpdData(id, name, MY_RESOURCES, MY_SCORES, opts), {
        version: 2034,
      }),
      { version: 2002 },
    )
  const stpl = chunk(
    'FOLD',
    'STPL',
    concat(
      player(
        1003,
        '1.1.1.1.2',
        {
          profileId: 22223074,
          civ: 'templar',
          resourcesGathered: [3501.45, 1650, 1739.09, 0],
          resourcesSpent: [2663.75, 1380, 1357.5, 0],
          unitsProduced: 34,
          unitsKilled: 12,
          unitsLost: 3,
          techResearched: 6,
          relicsCaptured: 3,
          villagerHigh: 30,
          ageMsec: [433974, 829395, 0],
        },
        myStpd,
      ),
      player(1007, 'Opponent', { civ: 'english' }),
    ),
    { version: 2001 },
  )
  return chunkyFile(
    chunk('FOLD', 'STLI', concat(stls, stpl), { version: 3006, name: 'StatLoggingInternal' }),
  )
}

describe('parseStatsSummary', () => {
  it('returns null for a non-Chunky buffer', () => {
    expect(parseStatsSummary(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('decodes build order + economy + score for each player', () => {
    const s = parseStatsSummary(summaryFile())
    expect(s).not.toBeNull()
    expect(s!.gameLengthSec).toBe(600)
    expect(s!.players).toHaveLength(2)

    const me = s!.players.find((p) => p.playerId === 1003)!
    expect(me.name).toBe('1.1.1.1.2')
    expect(me.civToken).toBe('templar') // from the header, not blueprint inference

    // build order (timed, categorized, prettified)
    expect(me.buildOrder.map((e) => [Math.round(e.timeSec), e.category, e.name])).toEqual([
      [0, 'building', 'Town Center'],
      [53, 'unit', 'Villager'],
      [120, 'upgrade', 'Wood Gather'],
    ])

    // economy timeline: bank + cumulative spent (gathered derived as bank+spent)
    expect(me.resources).toHaveLength(3)
    expect(me.resources[0]).toEqual({
      timeSec: 0,
      bank: { food: 200, wood: 200, gold: 100, stone: 0 },
      gathered: { food: 200, wood: 200, gold: 100, stone: 0 },
      spent: { food: 0, wood: 0, gold: 0, stone: 0 },
      perMinute: { food: 0, wood: 0, gold: 0, stone: 0 },
    })
    // bank [80,60,120,0] + spent [260,130,20,0]
    expect(me.resources[2]!.gathered).toEqual({ food: 340, wood: 190, gold: 140, stone: 0 })
    expect(me.resources[2]!.spent).toEqual({ food: 260, wood: 130, gold: 20, stone: 0 })
    expect(me.resources[2]!.perMinute).toEqual({ food: 510, wood: 270, gold: 60, stone: 0 })

    // score timeline
    expect(me.scores).toHaveLength(2)
    expect(me.scores[1]).toEqual({
      timeSec: 20,
      economy: 40,
      military: 10,
      society: 8,
      technology: 5,
      total: 63,
    })

    const opp = s!.players.find((p) => p.playerId === 1007)!
    expect(opp.civToken).toBe('english')
    expect(opp.buildOrder.map((e) => e.name)).toEqual(['Town Center', 'Villager'])
  })

  it('decodes the authoritative header totals (the game’s own end-game numbers)', () => {
    const s = parseStatsSummary(summaryFile())!
    const me = s.players.find((p) => p.playerId === 1003)!

    expect(me.profileId).toBe(22223074)
    expect(me.totals).not.toBeNull()
    const t = me.totals!
    expect(t.resourcesGathered.food).toBeCloseTo(3501.45, 1)
    expect(t.resourcesGathered.wood).toBe(1650)
    expect(t.resourcesGathered.gold).toBeCloseTo(1739.09, 1)
    expect(t.resourcesSpent.food).toBeCloseTo(2663.75, 1)
    expect(t.unitsProduced).toBe(34)
    expect(t.unitsKilled).toBe(12)
    expect(t.unitsLost).toBe(3)
    expect(t.techResearched).toBe(6)
    expect(t.relicsCaptured).toBe(3)
    expect(t.villagerHigh).toBe(30)
    expect(t.age2Sec).toBeCloseTo(433.974, 2)
    expect(t.age3Sec).toBeCloseTo(829.395, 2)
    expect(t.age4Sec).toBeNull() // raw 0 = never reached

    // AI opponent: profileId -1 → null, villagerHigh 0 → null
    const opp = s.players.find((p) => p.playerId === 1007)!
    expect(opp.profileId).toBeNull()
    expect(opp.totals!.villagerHigh).toBeNull()
    expect(opp.totals!.age2Sec).toBeNull()
  })

  it('falls back to the signature scan when the header is unparseable', () => {
    const corrupt = corruptHeaderStpdData(1003, '1.1.1.1.2', MY_RESOURCES, MY_SCORES)
    const s = parseStatsSummary(summaryFile(corrupt))!
    const me = s.players.find((p) => p.playerId === 1003)!

    // No header data on the fallback path…
    expect(me.totals).toBeNull()
    expect(me.profileId).toBeNull()
    expect(me.civToken).toBe('tem') // blueprint inference fallback
    // …but the timelines still decode via the scan (gathered = bank + spent).
    expect(me.resources).toHaveLength(3)
    expect(me.resources[2]!.gathered).toEqual({ food: 340, wood: 190, gold: 140, stone: 0 })
    expect(me.scores).toHaveLength(2)
  })
})

describe('prettyName', () => {
  it('strips age digits, civ codes, and qualifiers', () => {
    expect(prettyName('unit_villager_1_tem')).toBe('Villager')
    expect(prettyName('unit_knight_2_fre')).toBe('Knight')
    expect(prettyName('building_town_center_capital_tem')).toBe('Town Center')
    expect(prettyName('building_house_control_eng')).toBe('House')
    expect(prettyName('upgrade_wood_gather_1')).toBe('Wood Gather')
  })
})

describe('civFromToken', () => {
  it('keeps variant civ tokens instead of collapsing them to the base civ', () => {
    expect(civFromToken('fre_ha_01')).toBe('jeanne_darc')
    expect(civFromToken('japanese_ha_sen')).toBe('sengoku_daimyo')
    expect(civFromToken('sultanate_ha_tug')).toBe('tughlaq_dynasty')
    expect(civFromToken('fre')).toBe('french')
  })

  it('resolves the header’s full civ tokens (same vocabulary as .rec/logs)', () => {
    expect(civFromToken('templar')).toBe('knights_templar')
    expect(civFromToken('byzantine')).toBe('byzantines')
    expect(civFromToken('french_ha_01')).toBe('jeanne_darc')
    expect(civFromToken('english')).toBe('english')
  })
})
