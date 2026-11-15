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

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const FALLBACKS = ['Something went wrong', 'Ocorreu um erro inesperado']

  const collect = (value: unknown, depth = 0): string[] => {
    if (depth > 4 || value === null || value === undefined) return []
    if (typeof value === 'string') return value.trim() ? [value.trim()] : []
    if (typeof value !== 'object') return []
    const out: string[] = []
    const obj = value as Record<string, unknown>
    for (const key of ['message', 'error', 'data', 'response']) {
      if (key in obj) out.push(...collect(obj[key], depth + 1))
    }
    return out
  }

  const candidates: string[] = []
  if (error instanceof ClientResponseError) {
    candidates.push(...collect(error.response))
    candidates.push(error.message)
  } else {
    candidates.push(...collect(error))
    candidates.push(error instanceof Error ? error.message : String(error ?? ''))
  }

  for (const msg of candidates) {
    if (msg && !FALLBACKS.some((f) => msg.toLowerCase() === f.toLowerCase())) return msg
  }
  return candidates.find(Boolean) || fallback || 'Erro inesperado. Tente novamente.'
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
