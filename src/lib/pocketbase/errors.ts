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

// ----------------------------------------------------
// NOTA ESTRUTURAL PERMANENTE (padrão recorrente do projeto):
// getBackendErrorMessage NÃO PODE SER REMOVIDA deste arquivo. Ela é a
// extratora de mensagem real do corpo de erro do backend (message | error |
// data), limpa prefixos GoError/Error e bloqueia a mensagem genérica
// 'Something went wrong' que a IA do backend devolve. Quatro arquivos a
// importam: Settings, BillingAdminSection, ConversationsHistorySection,
// ClientSubscriptionDetailsDialog. Removê-la quebra o build (MISSING_EXPORT).
// ----------------------------------------------------
export function getBackendErrorMessage(error: unknown, fallback = ''): string {
  const raw = (() => {
    if (error instanceof ClientResponseError) {
      const body = error.response as unknown
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>
        for (const key of ['message', 'error', 'data']) {
          const val = b[key]
          if (typeof val === 'string' && val.trim()) return val
        }
      }
      return error.message || ''
    }
    if (error instanceof Error && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return ''
  })()

  let msg = String(raw).trim()
  msg = msg
    .replace(/^GoError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
  if (/^Something went wrong\b/i.test(msg)) {
    return fallback || msg
  }
  return msg || fallback
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
