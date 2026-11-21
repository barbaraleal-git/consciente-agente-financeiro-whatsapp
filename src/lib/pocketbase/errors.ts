import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getBackendErrorMessage(error: unknown, fallbackMessage?: string): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }

  const resp = error.response as { data?: unknown; message?: string } | undefined
  const data = resp?.data
  let msg = ''
  if (data && typeof data === 'object') {
    const entries = Object.values(data as Record<string, unknown>)
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && 'message' in (entry as object)) {
        const m = (entry as { message: unknown }).message
        if (typeof m === 'string' && m) {
          msg = m
          break
        }
      } else if (typeof entry === 'string' && entry) {
        msg = entry
        break
      }
    }
    if (!msg && typeof (data as Record<string, unknown>).message === 'string') {
      msg = (data as { message: string }).message
    }
  }
  if (!msg) msg = resp?.message || error.message || ''

  // Remove prefixos internos do PocketBase (GoError) e bloqueia mensagens genéricas
  msg = msg.replace(/GoError[:\s]*/gi, '').trim()
  if (!msg || /^something went wrong$/i.test(msg)) {
    msg = fallbackMessage || 'Não foi possível concluir a operação. Tente novamente em instantes.'
  }
  return msg
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
