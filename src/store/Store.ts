/**
 * A minimal key/value document store. Implemented by `JsonStore` (default, v1)
 * and `MemoryStore` (tests). A better-sqlite3-backed implementation may be added
 * later behind this same interface with graceful fallback (D5).
 * Runs in the main process only.
 */
export interface Store {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): void
  has(key: string): boolean
  all(): Record<string, unknown>
}
