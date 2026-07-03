import { describe, it, expect } from 'vitest'
import { findChild, findChildren, findDescendant, isRelicChunky, parseChunky } from '../chunky'
import { chunk, chunkyFile, concat } from './chunkyBuild'

describe('chunky container parser', () => {
  it('rejects non-Chunky buffers', () => {
    expect(isRelicChunky(new Uint8Array([1, 2, 3]))).toBe(false)
    expect(parseChunky(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(parseChunky(new TextEncoder().encode('Not a chunky file at all'))).toBeNull()
  })

  it('parses a nested FOLD/DATA tree and finds nodes', () => {
    const file = chunkyFile(
      chunk('FOLD', 'STLI', concat(
        chunk('DATA', 'STLS', new Uint8Array([1, 2, 3]), { version: 2003 }),
        chunk('FOLD', 'STPL', chunk('FOLD', 'STLP', chunk('DATA', 'STPD', new Uint8Array([9]))), { version: 2001 }),
      ), { version: 3006, name: 'StatLoggingInternal' }),
    )
    const tree = parseChunky(file)!
    expect(tree).toHaveLength(1)
    const stli = tree[0]!
    expect(stli.id).toBe('STLI')
    expect(stli.name).toBe('StatLoggingInternal')

    const stls = findChild(stli.children, 'STLS', 'DATA')!
    expect(stls.version).toBe(2003)
    expect(file.subarray(stls.dataStart, stls.dataEnd)).toEqual(new Uint8Array([1, 2, 3]))

    expect(findChildren(stli.children, 'STPL')).toHaveLength(1)
    // deep search reaches STPD nested under STPL→STLP
    expect(findDescendant(tree, 'STPD')).not.toBeNull()
  })

  it('stops cleanly at a truncated chunk instead of throwing', () => {
    const good = chunkyFile(chunk('DATA', 'AAAA', new Uint8Array([1, 2, 3, 4])))
    expect(parseChunky(good.slice(0, good.length - 2))).toEqual([])
  })
})
