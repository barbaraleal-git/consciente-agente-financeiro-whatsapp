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
 * Extrai a mensagem amigável REAL do corpo da resposta de erro do backend
 * (message / error / data), removendo o prefixo "GoError:" quando presente.
 * Bloqueia os textos genéricos do SDK ("Something went wrong..."), caindo no
 * fallback em português. Usar em todo toast de erro do Backoffice (v0.0.104).
 */
export function getBackendErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientResponseError) {
    const candidates: unknown[] = [
      error.response?.message,
      (error.response as Record<string, unknown> | undefined)?.error,
      error.response?.data,
    ]
    for (const candidate of candidates) {
      let text = ''
      if (typeof candidate === 'string') {
        text = candidate
      } else if (candidate && typeof candidate === 'object') {
        const obj = candidate as Record<string, unknown>
        const inner = obj.message ?? obj.error
        if (typeof inner === 'string') text = inner
      }
      text = text.trim()
      if (!text) continue
      if (text.startsWith('GoError: ')) text = text.slice('GoError: '.length).trim()
      if (/^something went wrong\b/i.test(text)) continue
      return text
    }
  } else if (error instanceof Error && error.message) {
    const text = error.message.replace(/^GoError: /, '').trim()
    if (text && !/^something went wrong\b/i.test(text)) return text
  }
  return fallback
}
