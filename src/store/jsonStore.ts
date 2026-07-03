import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Store } from './Store'

/**
 * A Store backed by a single JSON file, written atomically (temp file + rename).
 * The whole document is held in memory and re-serialized on each mutation —
 * fine for the small settings/history documents we keep. Corrupt files load as
 * empty rather than throwing. Default persistence for v1 (D5).
 */
export class JsonStore implements Store {
  private data: Record<string, unknown>

  constructor(private readonly filePath: string) {
    this.data = this.load()
  }

  private load(): Record<string, unknown> {
    try {
      if (!existsSync(this.filePath)) return {}
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'))
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(tmp, this.filePath)
  }

  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }
  set<T>(key: string, value: T): void {
    this.data[key] = value
    this.persist()
  }
  delete(key: string): void {
    delete this.data[key]
    this.persist()
  }
  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data, key)
  }
  all(): Record<string, unknown> {
    return { ...this.data }
  }
}
