import { describe, it, expect } from 'vitest'
import { RateLimiter } from '../rateLimiter'

/** A deterministic virtual clock: delay() advances the clock and resolves. */
function virtualClock() {
  let t = 0
  return {
    now: () => t,
    delay: (ms: number) => {
      t += ms
      return Promise.resolve()
    },
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('RateLimiter', () => {
  it('serializes tasks and spaces their starts by at least minIntervalMs', async () => {
    const clock = virtualClock()
    const limiter = new RateLimiter({ minIntervalMs: 250, now: clock.now, delay: clock.delay })
    const startTimes: number[] = []

    const tasks = [0, 1, 2].map((i) =>
      limiter.schedule(async () => {
        startTimes.push(clock.now())
        return i
      }),
    )

    const results = await Promise.all(tasks)
    expect(results).toEqual([0, 1, 2])
    expect(startTimes).toEqual([0, 250, 500])
  })

  it('runs tasks in FIFO order', async () => {
    const clock = virtualClock()
    const limiter = new RateLimiter({ minIntervalMs: 0, now: clock.now, delay: clock.delay })
    const order: string[] = []
    await Promise.all([
      limiter.schedule(async () => order.push('a')),
      limiter.schedule(async () => order.push('b')),
      limiter.schedule(async () => order.push('c')),
    ])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('a failing task rejects but does not stall the queue', async () => {
    const clock = virtualClock()
    const limiter = new RateLimiter({ minIntervalMs: 10, now: clock.now, delay: clock.delay })
    const boom = limiter.schedule(async () => {
      throw new Error('boom')
    })
    const after = limiter.schedule(async () => 'ok')

    await expect(boom).rejects.toThrow('boom')
    await expect(after).resolves.toBe('ok')
  })
})
