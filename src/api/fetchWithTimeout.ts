/**
 * fetch wrapped in an AbortController timeout. Without this, a hung request (TLS
 * stall, dead mirror, captive portal) never settles — and because the rate
 * limiter serializes tasks on a single chain, one stuck request would deadlock
 * every later request until the app restarts. Aborting guarantees the scheduled
 * task rejects so the queue advances.
 */
export async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchFn(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}
