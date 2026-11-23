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

// ---------------------------------------------------------------------------
// NOTA ESTRUTURAL PERMANENTE (não remover em nenhuma edição deste arquivo):
// getBackendErrorMessage abaixo é usada por Settings.tsx,
// BillingAdminSection.tsx e ClientSubscriptionDetailsDialog.tsx e JÁ FOI
// PERDIDA repetidas vezes (v0.0.119/0.0.120/0.0.122 e depois novamente em
// v0.0.147) por builds que reescrevem este arquivo. Qualquer alteração aqui
// DEVE preservar esta exportação intacta, com esta assinatura exata.
// ---------------------------------------------------------------------------

/**
 * Extrai a mensagem de erro real devolvida pelo backend PocketBase.
 * - extrai `response.message` do corpo da resposta;
 * - remove o prefixo "GoError: " quando presente;
 * - bloqueia a mensagem genérica "Something went wrong" (devolve fallback).
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const fb = fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      const raw = error.message || ''
      const cleaned = raw.replace(/^GoError:\s*/i, '').trim()
      return cleaned && cleaned.toLowerCase() !== 'something went wrong' ? cleaned : fb
    }
    return fb
  }
  const fieldMsgs = Object.values(extractFieldErrors(error))
  if (fieldMsgs.length > 0) return fieldMsgs.join(' ')

  const raw = error.response?.message || error.message || ''
  const cleaned = String(raw)
    .replace(/^GoError:\s*/i, '')
    .trim()
  if (!cleaned) return fb
  if (cleaned.toLowerCase() === 'something went wrong') return fb
  return cleaned
}
