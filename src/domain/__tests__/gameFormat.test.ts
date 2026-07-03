import { describe, it, expect } from 'vitest'
import { teamFormat, teamSizesFromTeamIds } from '../gameFormat'

describe('teamFormat', () => {
  it('labels standard team sizes', () => {
    expect(teamFormat([1, 1])).toBe('1v1')
    expect(teamFormat([2, 2])).toBe('2v2')
    expect(teamFormat([3, 3])).toBe('3v3')
    expect(teamFormat([4, 4])).toBe('4v4')
  })

  it('labels multi-team formats', () => {
    expect(teamFormat([3, 3, 3])).toBe('3v3v3')
    expect(teamFormat([2, 2, 2, 2])).toBe('2v2v2v2')
  })

  it('labels free-for-all and lopsided games', () => {
    expect(teamFormat([1, 1, 1, 1])).toBe('FFA (4)')
    expect(teamFormat([1, 1, 1, 1, 1, 1, 1, 1])).toBe('FFA (8)')
    expect(teamFormat([1, 5])).toBe('1v5')
  })

  it('handles edge cases', () => {
    expect(teamFormat([])).toBe('')
    expect(teamFormat([0, 0])).toBe('')
    expect(teamFormat([4])).toBe('4 players')
    expect(teamFormat([1])).toBe('1 player')
  })
})

describe('teamSizesFromTeamIds', () => {
  it('groups players by team id', () => {
    expect(teamSizesFromTeamIds([0, 0, 1, 1])).toEqual([2, 2])
    expect(teamFormat(teamSizesFromTeamIds([0, 0, 1, 1, 2, 2, 3, 3]))).toBe('2v2v2v2')
  })

  it('treats negative / null team ids as solo sides (FFA marker)', () => {
    expect(teamFormat(teamSizesFromTeamIds([-1, -1, -1, -1]))).toBe('FFA (4)')
    expect(teamFormat(teamSizesFromTeamIds([0, 0, -1]))).toBe('2v1')
  })
})
