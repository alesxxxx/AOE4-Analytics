import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { HistoryStore, StoredMatch } from './historyStore'

/** JSON-file HistoryStore (default, v1 — D5). Holds matches in memory, newest first. */
export class JsonHistoryStore implements HistoryStore {
  private matches: StoredMatch[]

  constructor(private readonly filePath: string) {
    this.matches = this.load()
  }

  private load(): StoredMatch[] {
    try {
      if (!existsSync(this.filePath)) return []
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'))
      return Array.isArray(parsed) ? (parsed as StoredMatch[]) : []
    } catch {
      return []
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.matches, null, 2), 'utf8')
    renameSync(tmp, this.filePath)
  }

  saveMatch(match: StoredMatch): void {
    const idx = this.matches.findIndex((m) => m.id === match.id)
    if (idx >= 0) this.matches[idx] = match
    else this.matches.push(match)
    this.matches.sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
    this.persist()
  }

  getMatch(id: string): StoredMatch | null {
    return this.matches.find((m) => m.id === id) ?? null
  }

  hasMatch(id: string): boolean {
    return this.matches.some((m) => m.id === id)
  }

  deleteMatch(id: string): void {
    const before = this.matches.length
    this.matches = this.matches.filter((m) => m.id !== id)
    if (this.matches.length !== before) this.persist()
  }

  listMatches(limit?: number): StoredMatch[] {
    return limit != null ? this.matches.slice(0, limit) : [...this.matches]
  }

  activeGoals(): StoredMatch['goals'] {
    return this.matches[0]?.goals ?? []
  }

  close(): void {
    /* no-op for JSON */
  }
}
