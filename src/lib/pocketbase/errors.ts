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

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const DEFAULT_FALLBACK = fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error && error.message && error.message !== 'Something went wrong') {
      return error.message
    }
    return DEFAULT_FALLBACK
  }
  const response = error.response as Record<string, unknown> | undefined
  const candidates: unknown[] = [response?.message, response?.error, response?.data, error.message]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      const cleaned = candidate
        .replace(/^GoError:\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .trim()
      if (cleaned !== '' && cleaned !== 'Something went wrong') {
        return cleaned
      }
    }
  }
  return DEFAULT_FALLBACK
}
