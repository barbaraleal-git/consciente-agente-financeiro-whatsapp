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
 * v0.0.104: extrai a mensagem REAL do corpo da resposta do backend (message /
 * error / data), remove prefixos da JSVM ("GoError: ...") e bloqueia frases
 * genéricas em inglês do SDK ("Something went wrong") — usada em todos os
 * toasts de erro do Backoffice para exibir o erro amigável em português.
 */
export function getBackendErrorMessage(error: unknown, fallback: string): string {
  const collect = (): string => {
    if (error instanceof ClientResponseError) {
      const r = error.response as unknown as Record<string, unknown> | undefined
      if (r && typeof r === 'object') {
        if (typeof r.message === 'string' && r.message.trim()) return r.message
        if (typeof r.error === 'string' && r.error.trim()) return r.error
        const data = r.data
        if (typeof data === 'string' && data.trim()) return data
      }
      return error.message || ''
    }
    if (error instanceof Error) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return ''
  }

  let msg = collect().trim()
  // Remove prefixos da JSVM/Go embutidos na mensagem ("GoError: ...").
  msg = msg.replace(/^GoError:\s*/i, '').trim()

  const GENERIC_PATTERNS = [
    /^something went wrong\.?$/i,
    /^failed to fetch\.?$/i,
    /^network error\.?$/i,
  ]
  if (!msg || GENERIC_PATTERNS.some((p) => p.test(msg))) return fallback
  return msg
}
