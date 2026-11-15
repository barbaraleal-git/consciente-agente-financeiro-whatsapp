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

/**
 * Mensagens genéricas (do SDK PocketBase ou de rede) que NUNCA devem ser
 * exibidas ao usuário quando a resposta do backend traz mensagem própria.
 */
const GENERIC_EN_MESSAGES = [
  'something went wrong',
  'an unexpected error occurred',
  'network error',
  'failed to fetch',
]

/**
 * v0.0.104: extrai a mensagem amigável que o backend retornou no corpo da
 * resposta (response.message / response.error / response.data.message) e
 * remove prefixos da JSVM (ex.: "GoError: ..."). Nunca devolve as frases
 * genéricas em inglês do SDK — nesses casos usa o fallback em português.
 */
export function getBackendErrorMessage(error: unknown, fallback: string): string {
  const candidates: unknown[] = []
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const response = e.response
    if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>
      candidates.push(body.message, body.error)
      const data = body.data
      if (data && typeof data === 'object') {
        const dataObj = data as Record<string, unknown>
        candidates.push(dataObj.message, dataObj.error)
      } else if (typeof data === 'string') {
        candidates.push(data)
      }
    }
    if (e.data && typeof e.data === 'object') {
      const eData = e.data as Record<string, unknown>
      candidates.push(eData.message, eData.error)
    }
    candidates.push(e.message)
  } else if (typeof error === 'string') {
    candidates.push(error)
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const clean = candidate.replace(/^GoError:\s*/i, '').trim()
      if (clean && !GENERIC_EN_MESSAGES.includes(clean.toLowerCase())) {
        return clean
      }
    }
  }
  return fallback
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
