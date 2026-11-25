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

// v0.0.177 — restauração permanente (20ª ressurgência): extrai a mensagem real
// do corpo da resposta do backend (inclui pb_hooks), remove prefixos GoError e
// bloqueia o genérico 'Something went wrong' quando existir mensagem melhor.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ClientResponseError) {
    const response = (error as { response?: { message?: string; data?: unknown } }).response
    const body = response as
      | { message?: string; data?: { message?: string } }
      | { data?: { message?: string } }
      | undefined
    const candidates: string[] = []
    if (body && typeof body === 'object') {
      const withData = body as { message?: string; data?: { message?: string } }
      if (typeof withData.message === 'string') candidates.push(withData.message)
      if (withData.data && typeof withData.data.message === 'string') {
        candidates.push(withData.data.message)
      }
    }
    if (typeof error.message === 'string' && error.message) candidates.push(error.message)

    for (const raw of candidates) {
      let msg = raw.trim()
      if (!msg) continue
      // Remove prefixos GoError / wrappers do runtime JSVM
      msg = msg.replace(/^(?:GoError|JSVM Error|Error)\s*:\s*/i, '')
      msg = msg.replace(/^raw:\s*/i, '')
      if (!msg) continue
      if (/^something went wrong\.?$/i.test(msg)) continue
      return msg
    }
  }
  return fallback || 'Não foi possível concluir a operação. Tente novamente em instantes.'
}
