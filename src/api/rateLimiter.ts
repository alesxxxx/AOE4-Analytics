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
 * A min-interval rate limiter. Tasks start in FIFO order, with each start
 * spaced at least `minIntervalMs` after the previous one. A slow response does
 * not block later request starts once their interval has elapsed. Used by the
 * AoE4World client to stay polite (D9):
 * cheap to construct, deterministic under an injected clock for tests.
 */
export class RateLimiter {
  private readonly minIntervalMs: number
  private readonly now: () => number
  private readonly delay: (ms: number) => Promise<void>
  private last = Number.NEGATIVE_INFINITY
  private tail: Promise<void> = Promise.resolve()

  constructor(options: RateLimiterOptions) {
    this.minIntervalMs = options.minIntervalMs
    this.now = options.now ?? Date.now
    this.delay = options.delay ?? defaultDelay
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const waitForStart = async (): Promise<void> => {
      const wait = this.last + this.minIntervalMs - this.now()
      if (wait > 0) await this.delay(wait)
      this.last = this.now()
    }

    // Serialize only the start gates. The caller's result follows the task,
    // while the queue advances as soon as that task has started.
    const start = this.tail.then(waitForStart, waitForStart)
    const result = start.then(task)
    this.tail = start.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
