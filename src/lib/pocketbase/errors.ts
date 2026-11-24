import { ClientResponseError } from 'pocketbase'

// ⚠️ NOTA ESTRUTURAL PERMANENTE (não remover):
// getBackendErrorMessage(error, fallback?) é EXPORT OBRIGATÓRIO deste arquivo.
// Consumidores: BillingAdminSection.tsx, ClientSubscriptionDetailsDialog.tsx,
// Settings.tsx (e históricamente Dashboard/SubscriptionPlansTab). Esta função
// JÁ SUMIU 14 VEZES do arquivo (MISSING_EXPORT recorrente a cada build —
// v0.0.119/120/122/124/140/160/164). NUNCA removê-la nem renomeá-la.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const generic = /Something went wrong/i
  let raw = ''
  if (error instanceof ClientResponseError) {
    const r = error.response as Record<string, unknown> | undefined
    if (r) {
      if (typeof r.message === 'string' && r.message.trim()) raw = r.message
      else if (typeof r.error === 'string' && r.error.trim()) raw = r.error
      else if (r.data && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>
        if (typeof d.message === 'string' && d.message.trim()) raw = d.message
        else if (typeof d.error === 'string' && d.error.trim()) raw = d.error
      }
    } else if (error.message) {
      raw = error.message
    }
  } else if (error instanceof Error && error.message) {
    raw = error.message
  } else if (typeof error === 'string' && error.trim()) {
    raw = error
  }
  if (!raw || generic.test(raw)) return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  // tira prefixos GoError/Error 400:/etc antes de devolver
  const cleaned = raw
    .replace(/^(GoError|Error)\s*\d*[:\s]*/i, '')
    .replace(/\.$/, '')
    .trim()
  return cleaned || fallback || 'Ocorreu um erro inesperado. Tente novamente.'
}

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
