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

// NOTA ESTRUTURAL PERMANENTE: getBackendErrorMessage é consumida por
// BillingAdminSection.tsx, ClientSubscriptionDetailsDialog.tsx, Settings.tsx e
// AdminBackoffice.tsx — NUNCA remover, renomear ou fundir com getErrorMessage.
// Contagem de ressurgências restauradas: 20 (v0.0.176).

/**
 * Extrai a mensagem real do corpo de um erro do backend (message/error/data),
 * remove prefixos da JSVM ("GoError: ...", "Error: ...") e bloqueia o genérico
 * "Something went wrong" do SDK. `fallback` (opcional, em PT) é usado quando
 * nada útil está presente.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const GENERIC_PATTERNS = ['Something went wrong', 'Failed to fetch', 'Network Error']

  let raw = ''
  if (error instanceof ClientResponseError) {
    const res: any = (error as any).response || {}
    raw =
      (typeof res.message === 'string' && res.message) ||
      (typeof res.error === 'string' && res.error) ||
      (res.data && typeof res.data.message === 'string' && res.data.message) ||
      error.message ||
      ''
  } else if (error instanceof Error) {
    raw = error.message || ''
  } else if (typeof error === 'string') {
    raw = error
  }

  let msg = String(raw || '').trim()
  msg = msg.replace(/^(GoError|Error)\s*:\s*/i, '').trim()

  if (!msg || GENERIC_PATTERNS.some((g) => msg.toLowerCase().includes(g.toLowerCase()))) {
    return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  }
  return msg
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
