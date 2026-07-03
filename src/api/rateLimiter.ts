export interface RateLimiterOptions {
  /** Minimum milliseconds between the START of consecutive tasks. */
  minIntervalMs: number
  /** Injectable clock (defaults to Date.now). */
  now?: () => number
  /** Injectable delay (defaults to setTimeout). */
  delay?: (ms: number) => Promise<void>
}

const defaultDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * A serialized, min-interval rate limiter. Tasks run one at a time in FIFO
 * order, with each task's start spaced at least `minIntervalMs` after the
 * previous one. Used by the AoE4World client to stay polite (D9):
 * cheap to construct, deterministic under an injected clock for tests.
 */
export class RateLimiter {
  private readonly minIntervalMs: number
  private readonly now: () => number
  private readonly delay: (ms: number) => Promise<void>
  private last = Number.NEGATIVE_INFINITY
  private tail: Promise<unknown> = Promise.resolve()

  constructor(options: RateLimiterOptions) {
    this.minIntervalMs = options.minIntervalMs
    this.now = options.now ?? Date.now
    this.delay = options.delay ?? defaultDelay
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const wait = this.last + this.minIntervalMs - this.now()
      if (wait > 0) await this.delay(wait)
      this.last = this.now()
      return task()
    }
    // Chain on the tail so tasks serialize; swallow errors on the tail copy so
    // one failure never stalls subsequent tasks, but propagate to the caller.
    const result = this.tail.then(run, run)
    this.tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
