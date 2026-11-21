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

const GENERIC_MESSAGES = [
  'something went wrong',
  'unexpected error',
  'erro inesperado',
  'failed to fetch',
  'network error',
]

/**
 * Extrai a mensagem de erro REAL do corpo da resposta (ClientResponseError.response.message
 * ou response.data), remove prefixos técnicos como 'GoError: ' e nunca devolve uma
 * mensagem genérica do tipo "Something went wrong".
 */
export function getBackendErrorMessage(error: unknown, fallback = 'Erro inesperado.'): string {
  let message = ''

  if (error instanceof ClientResponseError) {
    const response = error.response as Record<string, unknown> | undefined
    if (response) {
      if (typeof response.message === 'string' && response.message.trim()) {
        message = response.message
      } else if (response.data && typeof response.data === 'object') {
        const data = response.data as Record<string, unknown>
        const candidates = [
          data.message,
          data.error,
          typeof data.detail === 'string' ? data.detail : '',
        ]
        for (const candidate of candidates) {
          if (typeof candidate === 'string' && candidate.trim()) {
            message = candidate
            break
          }
        }
      }
    }
  } else if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string' && error.trim()) {
    message = error
  }

  message = (message || '')
    .replace(/^GoError:\s*/i, '')
    .replace(/^(Error|Exception):\s*/i, '')
    .trim()

  const lower = message.toLowerCase()
  if (!message || GENERIC_MESSAGES.some((g) => lower === g || lower.startsWith(g + '.'))) {
    return fallback
  }

  return message
}
