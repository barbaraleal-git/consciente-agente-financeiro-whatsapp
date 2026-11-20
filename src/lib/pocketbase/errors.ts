import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// NOTA ESTRUTURAL: getBackendErrorMessage (abaixo) já foi perdida 4+ vezes quando
// este arquivo foi editado (MISSING_EXPORT quebra o build). Ela é importada por
// BillingAdminSection, ClientSubscriptionDetailsDialog e outros — NUNCA remover.

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

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const DEFAULT_FALLBACK = 'Ocorreu um erro inesperado. Tente novamente.'
  let raw = ''

  if (error instanceof ClientResponseError) {
    const resp = error.response as Record<string, unknown> | undefined
    const data = resp?.data
    if (typeof data === 'string') {
      raw = data
    } else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (typeof d.message === 'string') raw = d.message
      else if (typeof d.error === 'string') raw = d.error
      else if (typeof d.response === 'string') raw = d.response
      else if (d.response && typeof d.response === 'object') {
        const r = d.response as Record<string, unknown>
        if (typeof r.message === 'string') raw = r.message
        else if (typeof r.error === 'string') raw = r.error
      }
    }
    if (!raw && typeof resp?.message === 'string') raw = resp.message
  } else if (error instanceof Error) {
    raw = error.message
  } else if (typeof error === 'string') {
    raw = error
  }

  raw = (raw || '')
    .replace(/^GoError\s*:?/i, '')
    .replace(/^Error\s*:?/i, '')
    .trim()

  const GENERIC = [
    'something went wrong',
    'unexpected error occurred',
    'an unexpected error occurred',
    'erro inesperado',
  ]
  if (!raw || GENERIC.some((g) => raw.toLowerCase() === g)) {
    return fallback && fallback.trim() ? fallback : DEFAULT_FALLBACK
  }
  return raw
}
