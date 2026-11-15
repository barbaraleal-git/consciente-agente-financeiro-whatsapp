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

// v0.0.115 — RESTAURADA (existia até a v0.0.114 e o Backoffice → Planos e
// Preços importa esta função; a extração indevida na rodada anterior quebrou
// o build do preview com MISSING_EXPORT). Diferença para getErrorMessage:
// extrai a mensagem AMIGÁVEL do corpo da resposta do backend (error/message/
// data em qualquer forma), rejeita o genérico "Something went wrong" e usa o
// fallback em português quando nada útil chega — para que o toast da dona
// nunca mostre erro cru da JSVM/GoError.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const GENERIC_MESSAGES = [
    'something went wrong',
    'an unexpected error occurred',
    'failed to fetch',
    'network error',
  ]
  const isGeneric = (msg: string) => {
    const normalized = (msg || '').trim().toLowerCase()
    return normalized === '' || GENERIC_MESSAGES.includes(normalized)
  }

  const readMessage = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      for (const key of ['message', 'error', 'detail']) {
        const candidate = record[key]
        if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
      }
    }
    return ''
  }

  let best = ''
  if (error instanceof ClientResponseError) {
    const response = error.response as unknown
    if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>
      for (const key of ['message', 'error', 'detail']) {
        const candidate = body[key]
        if (typeof candidate === 'string' && candidate.trim() !== '') {
          best = candidate
          break
        }
      }
      if (best === '' && body.data && typeof body.data === 'object') {
        const data = body.data as Record<string, unknown>
        for (const key of ['message', 'error', 'detail']) {
          const candidate = data[key]
          if (typeof candidate === 'string' && candidate.trim() !== '') {
            best = candidate
            break
          }
        }
      }
    }
  }
  if (best === '') best = readMessage(error)

  // GoError / erro cru da JSVM: nunca deve vazar para o toast.
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if ((best === '' || isGeneric(best)) && raw && !isGeneric(raw)) {
    const goErrorMatch = raw.match(/GoError\]\s*([^:]+):/)
    if (goErrorMatch && goErrorMatch[1]) {
      best = goErrorMatch[1].trim()
    }
  }

  if (best !== '' && !isGeneric(best)) return best
  return fallback || (error instanceof ClientResponseError ? error.message : 'Ocorreu um erro.')
}
