import { describe, it, expect } from 'vitest'
import { extractBuildTargets } from '../buildIcons'

describe('extractBuildTargets', () => {
  it('pulls buildings and units from prose notes', () => {
    const labels = extractBuildTargets([
      'Build a Military School and train Spearmen.',
    ]).map((t) => t.label)
    expect(labels).toContain('Military School')
    expect(labels).toContain('Spearman')
  })

  it('does not mistake "Archery Range" for an archer unit', () => {
    expect(extractBuildTargets(['Add an Archery Range.']).map((t) => t.label)).toEqual([
      'Archery Range',
    ])
  })

  it('dedups repeats and caps results', () => {
    const t = extractBuildTargets(['House, house, mill, mill, barracks, stable, dock'], 3)
    expect(t).toHaveLength(3)
  })

  it('returns empty for no matches or no notes', () => {
    expect(extractBuildTargets(['Send all villagers to sheep.'])).toEqual([])
    expect(extractBuildTargets(undefined)).toEqual([])
  })

  it('produces a bundled (vendored) icon url for each known target', () => {
    const t = extractBuildTargets(['Build a Barracks.'])
    // Vendored asset, not a data.aoe4world.com fetch — icons must render
    // offline / instantly at match start.
    expect(t[0]!.url).toMatch(/barracks\.png$/)
    expect(t[0]!.url).not.toMatch(/^https:/)
  })
})
