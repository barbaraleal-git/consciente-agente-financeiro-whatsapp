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

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}

// ---------------------------------------------------------------------------
// getBackendErrorMessage (restaurada — MISSING_EXPORT recorrente v0.0.119/0.0.120/0.0.122)
// Extrai a mensagem REAL do corpo de erro do backend PocketBase (message/error/data),
// remove prefixos GoError/Error, bloqueia a mensagem genérica "Something went wrong"
// e faz fallback em PT. NÃO remover este export: ele alimenta toda a UI de erro do app.
// ---------------------------------------------------------------------------
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  let raw = ''

  if (error instanceof ClientResponseError) {
    const res = error.response as unknown as Record<string, unknown> | undefined
    if (res) {
      if (typeof res.message === 'string' && res.message.trim()) raw = res.message
      else if (typeof res.error === 'string' && res.error.trim()) raw = res.error
      else if (res.data && typeof res.data === 'object') {
        const d = res.data as Record<string, unknown>
        const fieldMsgs = extractFieldErrors(error)
        if (Object.keys(fieldMsgs).length > 0) {
          raw = Object.values(fieldMsgs).join(' ')
        } else if (typeof d.message === 'string' && d.message.trim()) {
          raw = d.message
        } else if (typeof d.error === 'string' && d.error.trim()) {
          raw = d.error
        }
      }
    }
    if (!raw && error.message && error.message.trim()) raw = error.message
  } else if (error instanceof Error) {
    raw = error.message
  } else if (typeof error === 'string' && error.trim()) {
    raw = error
  }

  let msg = String(raw || '').trim()
  msg = msg
    .replace(/^GoError[:\s]*/i, '')
    .replace(/^Error[:\s]*/i, '')
    .trim()

  if (!msg || /^something went wrong\.?$/i.test(msg)) {
    return fallback && fallback.trim()
      ? fallback
      : 'Ocorreu um erro inesperado. Por favor, tente novamente em alguns instantes.'
  }
  return msg
}
