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

/**
 * Extrai a mensagem real devolvida pelo backend (corpo 400/500 do pb_hooks)
 * em vez do genérico "Something went wrong" do SDK.
 * O fallback é usado quando o corpo não traz mensagem utilizável.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const genericPhrases = ['something went wrong', 'an unexpected error occurred', 'failed to fetch']
  const tryExtract = (err: unknown): string | undefined => {
    if (typeof err === 'string') {
      const s = err.trim()
      if (!s) return undefined
      const lower = s.toLowerCase()
      if (genericPhrases.some((p) => lower.includes(p))) return undefined
      if (lower.startsWith('goerror')) return s.slice('goerror'.length).trim() || undefined
      return s
    }
    if (err && typeof err === 'object') {
      const obj = err as Record<string, unknown>
      for (const key of ['message', 'error']) {
        const v = obj[key]
        if (typeof v === 'string' && v.trim()) {
          const got = tryExtract(v)
          if (got) return got
        }
      }
      // corpos aninhados do PocketBase: { data: { message } }
      const nested = obj.data
      if (nested) {
        const got = tryExtract(nested)
        if (got) return got
      }
      if (typeof obj.status === 'number' && obj.status >= 400) {
        return undefined // deixa o fallback assumir
      }
    }
    return undefined
  }
  return (
    tryExtract(error) ||
    (typeof fallback === 'string' && fallback.trim()
      ? fallback
      : 'Ocorreu um erro inesperado. Tente novamente.')
  )
}
