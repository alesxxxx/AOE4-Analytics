import Database from 'better-sqlite3'
import type { HistoryStore, StoredMatch } from './historyStore'

type DB = InstanceType<typeof Database>

interface Row {
  data: string
}

/**
 * better-sqlite3-backed HistoryStore. Imported lazily by the factory via dynamic
 * `import()` so a missing/ABI-mismatched native binary surfaces as a rejected
 * import the factory can catch and fall back to JSON (D5). Each
 * match is stored as a JSON blob keyed by id, with `played_at` indexed.
 */
export class SqliteHistoryStore implements HistoryStore {
  private readonly db: DB

  constructor(filePath: string) {
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        played_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC);`,
    )
  }

  saveMatch(match: StoredMatch): void {
    this.db
      .prepare('INSERT OR REPLACE INTO matches (id, played_at, data) VALUES (?, ?, ?)')
      .run(match.id, match.playedAt, JSON.stringify(match))
  }

  getMatch(id: string): StoredMatch | null {
    const row = this.db.prepare('SELECT data FROM matches WHERE id = ?').get(id) as Row | undefined
    return row ? (JSON.parse(row.data) as StoredMatch) : null
  }

  hasMatch(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM matches WHERE id = ?').get(id) !== undefined
  }

  deleteMatch(id: string): void {
    this.db.prepare('DELETE FROM matches WHERE id = ?').run(id)
  }

  listMatches(limit?: number): StoredMatch[] {
    const sql =
      'SELECT data FROM matches ORDER BY played_at DESC' + (limit != null ? ' LIMIT ?' : '')
    const rows = (
      limit != null ? this.db.prepare(sql).all(limit) : this.db.prepare(sql).all()
    ) as Row[]
    return rows.map((r) => JSON.parse(r.data) as StoredMatch)
  }

  activeGoals(): StoredMatch['goals'] {
    return this.listMatches(1)[0]?.goals ?? []
  }

  close(): void {
    this.db.close()
  }
}
