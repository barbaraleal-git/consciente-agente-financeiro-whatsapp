import { ClientResponseError } from 'pocketbase'

// NOTA ESTRUTURAL: getBackendErrorMessage DEVE permanecer exportada deste arquivo.
// Ela já desapareceu 4 vezes em builds anteriores (MISSING_EXPORT) sempre que este
// arquivo era tocado — ao editar, verifique que ela continua aqui.
export type FieldErrors = Record<string, string>

/**
 * Extrai a mensagem REAL do corpo de uma resposta de erro do backend
 * (lê response.message / response.error / response.data), remove prefixos
 * da JSVM ("GoError: ...", "Error: ..."), bloqueia o genérico
 * "Something went wrong" do SDK e usa `fallback` (PT) quando não há mensagem útil.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const defaultMsg = fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error && error.message && !/something went wrong/i.test(error.message)) {
      return error.message
    }
    return defaultMsg
  }
  const resp = error.response as Record<string, unknown> | undefined
  const candidates: unknown[] = [resp?.message, resp?.error, resp?.data, error.message]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      let msg = c.trim()
      msg = msg.replace(/^GoError:\s*/i, '').replace(/^Error:\s*/i, '')
      if (msg && !/something went wrong/i.test(msg)) return msg
      continue
    }
    if (c && typeof c === 'object') {
      const obj = c as Record<string, unknown>
      const inner = (obj.message ?? obj.error) as unknown
      if (typeof inner === 'string' && inner.trim()) {
        let msg = inner
          .trim()
          .replace(/^GoError:\s*/i, '')
          .replace(/^Error:\s*/i, '')
        if (msg && !/something went wrong/i.test(msg)) return msg
      }
    }
  }
  return defaultMsg
}

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
