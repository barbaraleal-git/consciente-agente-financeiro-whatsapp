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

// NOTA ESTRUTURAL PERMANENTE (não remover): getBackendErrorMessage é exportada
// deste arquivo e é usada por Settings.tsx, BillingAdminSection.tsx e
// ClientSubscriptionDetailsDialog.tsx. Este export JÁ SUMIU 8 VEZES
// (MISSING_EXPORT a cada build) — causa raiz desconhecida. Qualquer edição
// neste arquivo DEVE manter esta função exportada, senão o build quebra.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  let message = ''
  if (error instanceof ClientResponseError) {
    const response = error.response as Record<string, unknown> | undefined
    const candidates = [response?.message, response?.error, response?.data]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        message = candidate.trim()
        break
      }
      if (candidate && typeof candidate === 'object') {
        const nested = candidate as Record<string, unknown>
        if (typeof nested.message === 'string' && nested.message.trim()) {
          message = nested.message.trim()
          break
        }
        if (typeof nested.error === 'string' && nested.error.trim()) {
          message = nested.error.trim()
          break
        }
      }
    }
  } else if (error instanceof Error && error.message) {
    message = error.message
  }
  if (message.startsWith('GoError: ')) message = message.slice('GoError: '.length).trim()
  if (message.startsWith('Error: ')) message = message.slice('Error: '.length).trim()
  const generic =
    !message ||
    message === 'Something went wrong.' ||
    message === 'Something went wrong' ||
    /unexpected error occurred/i.test(message)
  return generic ? fallback || 'Ocorreu um erro inesperado. Tente novamente.' : message
}
