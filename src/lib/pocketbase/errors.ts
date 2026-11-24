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

// NOTA ESTRUTURAL PERMANENTE (a partir de v0.0.122): getBackendErrorMessage
// some recorrentemente a cada build (MISSING_EXPORT v0.0.119/120/122/160).
// NUNCA remover esta export: BillingAdminSection, ClientSubscriptionDetailsDialog
// e Settings importam-na. Extração comprovada em produção: pega a mensagem real
// do corpo de erro do PocketBase, tira o prefixo GoError, e bloqueia a mensagem
// genérica "Something went wrong" (v0.0.87).
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
  }
  const fieldMsgs = Object.values(extractFieldErrors(error))
  if (fieldMsgs.length > 0) return fieldMsgs.join(' ')

  const raw = (error.response && (error.response.message || error.response.error)) || error.message
  const text = String(raw || '')
  const cleaned = text.replace(/GoError:\s*/g, '').trim()
  if (!cleaned || /^something went wrong$/i.test(cleaned)) {
    return fallback || 'Não foi possível concluir a operação. Tente novamente.'
  }
  return cleaned
}
