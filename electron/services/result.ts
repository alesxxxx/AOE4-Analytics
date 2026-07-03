import { ApiError } from '@api/client'
import type { IpcErr, IpcErrorKind, IpcResult } from '@ipc/contract'

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function err(kind: IpcErrorKind, message: string, status?: number): IpcErr {
  return { ok: false, error: { kind, message, status } }
}

/** Maps a thrown error into a typed IPC error envelope (never re-throws). */
export function errFrom(e: unknown): IpcErr {
  if (e instanceof ApiError) {
    return err(e.status === 404 ? 'not_found' : 'api', e.message, e.status)
  }
  if (e instanceof Error) return err('network', e.message)
  return err('unknown', String(e))
}
