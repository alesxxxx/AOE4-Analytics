import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseReplayHeader, replayMatchup, resolveReplayCiv } from '../replay'

// Real .rec headers (first 2.5 KB), with the Steam id redacted to a dummy.
function fixture(name: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url))),
  )
}

describe('parseReplayHeader — real AoE4 replay headers', () => {
  it('parses a vs-AI game (1 human + 5 AI) on a scenario map', () => {
    const info = parseReplayHeader(fixture('replay-ai-ottoman.recbin'))
    expect(info).not.toBeNull()
    expect(info!.mapId).toBe('rogue_coastline')
    expect(info!.mapName).toBe('Contested Coastline')
    expect(info!.players).toHaveLength(6)

    const human = info!.players[0]!
    expect(human.name).toBe('1.1.1.1.2')
    expect(human.civToken).toBe('ottoman')
    expect(human.civSlug).toBe('ottomans')
    expect(human.civName).toBe('Ottomans')
    expect(human.steamId).toBe('76561190000000000') // redacted dummy
    expect(human.ai).toBe(false)

    const ais = info!.players.slice(1)
    expect(ais.every((p) => p.ai && p.steamId === null)).toBe(true)
    expect(ais.map((p) => p.civName)).toEqual([
      'Byzantines',
      'English',
      'Byzantines',
      'Abbasid Dynasty',
      'Ottomans',
    ])
  })

  it('parses a skirmish (1v1 vs AI) with a VARIANT civ on a map_size map', () => {
    const info = parseReplayHeader(fixture('replay-skirmish-tughlaq.recbin'))
    expect(info).not.toBeNull()
    expect(info!.mapId).toBe('atacama')
    expect(info!.players).toHaveLength(2)

    const human = info!.players[0]!
    expect(human.name).toBe('1.1.1.1.2')
    expect(human.civToken).toBe('sultanate_ha_tug')
    expect(human.civSlug).toBe('tughlaq_dynasty') // variant resolved
    expect(human.civName).toBe('Tughlaq Dynasty')
    expect(human.ai).toBe(false)

    expect(info!.players[1]!.ai).toBe(true)
  })

  it('returns null for bytes that are not a replay', () => {
    expect(parseReplayHeader(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull()
    expect(parseReplayHeader(new Uint8Array(4))).toBeNull()
  })
})

describe('resolveReplayCiv', () => {
  it('maps base civ tokens to slug + display name', () => {
    expect(resolveReplayCiv('ottoman')).toEqual({ slug: 'ottomans', name: 'Ottomans' })
    expect(resolveReplayCiv('abbasid')).toEqual({
      slug: 'abbasid_dynasty',
      name: 'Abbasid Dynasty',
    })
    expect(resolveReplayCiv('hre')).toEqual({
      slug: 'holy_roman_empire',
      name: 'Holy Roman Empire',
    })
  })

  it('maps known variant tokens to their variant slug', () => {
    expect(resolveReplayCiv('japanese_ha_sen')).toEqual({
      slug: 'sengoku_daimyo',
      name: 'Sengoku Daimyo',
    })
    expect(resolveReplayCiv('sultanate_ha_tug')).toEqual({
      slug: 'tughlaq_dynasty',
      name: 'Tughlaq Dynasty',
    })
    expect(resolveReplayCiv('french_ha_01')).toEqual({
      slug: 'jeanne_darc',
      name: "Jeanne d'Arc",
    })
  })

  it('falls back an unknown variant to its base civ', () => {
    expect(resolveReplayCiv('french_ha_xyz')).toEqual({ slug: 'french', name: 'French' })
  })

  it('returns null slug + a prettified name for a fully unknown token', () => {
    expect(resolveReplayCiv('mystery_civ')).toEqual({ slug: null, name: 'Mystery Civ' })
  })
})

describe('replayMatchup', () => {
  it('identifies me by Steam id and lists the rest as opponents', () => {
    const info = parseReplayHeader(fixture('replay-ai-ottoman.recbin'))!
    const m = replayMatchup(info, ['76561190000000000'])
    expect(m.me?.civName).toBe('Ottomans')
    expect(m.me?.ai).toBe(false)
    expect(m.opponents).toHaveLength(5)
    expect(m.opponents.every((p) => p.ai)).toBe(true)
    expect(m.mapName).toBe('Contested Coastline')
  })

  it('falls back to the sole human when no Steam id matches (vs-AI)', () => {
    const info = parseReplayHeader(fixture('replay-skirmish-tughlaq.recbin'))!
    const m = replayMatchup(info, ['76561190000000099']) // not our id
    expect(m.me?.civName).toBe('Tughlaq Dynasty')
    expect(m.opponents).toHaveLength(1)
    expect(m.opponents[0]!.ai).toBe(true)
  })
})
