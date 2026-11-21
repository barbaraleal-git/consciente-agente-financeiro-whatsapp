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

// NOTA ESTRUTURAL: getBackendErrorMessage DEVE permanecer exportada aqui —
// ela some recorrentemente quando o arquivo é tocado (MISSING_EXPORT em builds).

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  let raw = ''
  if (error instanceof ClientResponseError) {
    const res = error.response as { message?: unknown; error?: unknown; data?: unknown } | undefined
    const candidates: unknown[] = [res?.message, res?.error]
    if (res?.data && typeof res.data === 'object' && 'message' in (res.data as object)) {
      candidates.push((res.data as { message: unknown }).message)
    }
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) {
        raw = c
        break
      }
    }
  } else if (error instanceof Error && error.message) {
    raw = error.message
  }

  if (raw) {
    raw = raw
      .replace(/^GoError:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim()
  }

  const GENERIC = ['something went wrong', 'an unexpected error occurred']
  if (raw && !GENERIC.includes(raw.toLowerCase())) {
    return raw
  }
  return fallback ?? raw ?? 'Ocorreu um erro inesperado.'
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
