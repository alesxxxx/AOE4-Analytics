import type { Store } from './Store'

/** In-memory Store for tests and ephemeral use. */
export class MemoryStore implements Store {
  private data = new Map<string, unknown>()

  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined
  }
  set<T>(key: string, value: T): void {
    this.data.set(key, value)
  }
  delete(key: string): void {
    this.data.delete(key)
  }
  has(key: string): boolean {
    return this.data.has(key)
  }
  all(): Record<string, unknown> {
    return Object.fromEntries(this.data.entries())
  }
}
