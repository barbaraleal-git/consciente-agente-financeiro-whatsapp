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
 * Extrai a mensagem real do corpo de uma resposta de erro do backend
 * (message / error / data), remove prefixos da JSVM ("GoError: ...") e
 * bloqueia as frases genéricas em inglês do SDK. Usada nos toasts de erro
 * das telas — nunca mostrar erro cru ao usuário.
 */
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado.',
): string {
  // Erros HTTP do fetch com corpo JSON são normalizados pelos services em Error(msg)
  if (error instanceof Error && !(error instanceof ClientResponseError)) {
    const raw = (error.message || '').trim()
    if (raw && !/^(fetch failed|networkerror|failed to fetch)$/i.test(raw)) return raw
    return fallback
  }
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error && error.message ? error.message : fallback
  }
  const resp = (error.response || {}) as Record<string, unknown>
  const candidates = [resp.message, resp.error, resp.data]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      return c.replace(/^GoError:\s*/i, '').trim()
    }
    if (c && typeof c === 'object') {
      const nested = c as Record<string, unknown>
      const msg = nested.message || nested.error
      if (typeof msg === 'string' && msg.trim()) {
        return String(msg)
          .replace(/^GoError:\s*/i, '')
          .trim()
      }
    }
  }
  if (error.message && !/Something went wrong/i.test(error.message)) {
    return error.message.replace(/^GoError:\s*/i, '').trim()
  }
  return fallback
}
