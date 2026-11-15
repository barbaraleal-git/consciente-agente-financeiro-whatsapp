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

// v0.0.104: extrai a mensagem amigável do corpo da resposta (ex.: BadRequestError
// do hook de vigência: "Já existe um plano mensal válido no período ...") —
// tira o prefixo "GoError: " e bloqueia o genérico "Something went wrong" do SDK.
// Usar em TODO toast de erro do Backoffice.
export function getBackendErrorMessage(error: unknown, fallback: string): string {
  let candidate = ''
  if (error instanceof ClientResponseError) {
    const res = (error.response || {}) as Record<string, unknown>
    const dataBlock = res.data
    if (dataBlock && typeof dataBlock === 'object') {
      const d = dataBlock as Record<string, unknown>
      if (typeof d.message === 'string') candidate = d.message
      else if (typeof d.error === 'string') candidate = d.error
      else if (typeof dataBlock === 'string') candidate = dataBlock
    } else if (typeof res.message === 'string') {
      candidate = res.message
    } else if (typeof res.error === 'string') {
      candidate = res.error
    }
  }
  if (!candidate && error instanceof Error) candidate = error.message
  if (!candidate) return fallback

  let msg = candidate.replace(/^GoError:\s*/i, '').trim()
  if (
    !msg ||
    /something went wrong/i.test(msg) ||
    /Failed to fetch/i.test(msg) ||
    /^unexpected end of json/i.test(msg) ||
    /^malformed/i.test(msg)
  ) {
    return fallback
  }
  return msg
}
