import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '..', '__fixtures__')

/** Loads a captured/synthetic API fixture by filename and parses it as JSON. */
export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T
}
