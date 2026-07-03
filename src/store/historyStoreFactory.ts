import type { HistoryStore } from './historyStore'

export interface HistoryStoreOptions {
  sqlitePath: string
  jsonPath: string
  /** Force a backend (mainly for tests); defaults to auto (SQLite → JSON). */
  prefer?: 'sqlite' | 'json'
}

export interface CreatedHistoryStore {
  store: HistoryStore
  backend: 'sqlite' | 'json'
}

/**
 * Creates the history store, preferring SQLite but falling back to the JSON
 * store if the native better-sqlite3 binary can't be loaded (e.g. an ABI
 * mismatch after an Electron upgrade) — D5. Uses dynamic import so
 * a native-load failure is a catchable rejection rather than a crash at module
 * load. Async because it's created once at startup.
 */
export async function createHistoryStore(
  options: HistoryStoreOptions,
): Promise<CreatedHistoryStore> {
  if (options.prefer !== 'json') {
    try {
      const { SqliteHistoryStore } = await import('./sqliteHistoryStore')
      return { store: new SqliteHistoryStore(options.sqlitePath), backend: 'sqlite' }
    } catch (e) {
      console.warn(
        '[history] SQLite unavailable, falling back to JSON store:',
        e instanceof Error ? e.message : String(e),
      )
    }
  }
  const { JsonHistoryStore } = await import('./jsonHistoryStore')
  return { store: new JsonHistoryStore(options.jsonPath), backend: 'json' }
}
