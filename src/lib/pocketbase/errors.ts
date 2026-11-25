// NOTA ESTRUTURAL PERMANENTE (ressurgência nº 21): este arquivo DEVE manter as
// três exportações abaixo. getBackendErrorMessage(error, fallback?) extrai a
// mensagem real do corpo (message/error/data), remove prefixos GoError/Error,
// bloqueia o genérico "Something went wrong" do SDK e aplica o fallback em PT.
// NÃO remover getBackendErrorMessage — consumidores: Settings.tsx,
// BillingAdminSection.tsx, ClientSubscriptionDetailsDialog.tsx,
// ConversationsHistorySection.tsx.
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

/**
 * Extrai a mensagem real do corpo da resposta do backend (response.message,
 * response.error ou response.data), remove prefixos GoError/Error e bloqueia
 * a mensagem genérica "Something went wrong" do SDK, aplicando o fallback
 * informado quando não há mensagem utilizável.
 */
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado.',
): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error && error.message && error.message !== 'Something went wrong') {
      return error.message
    }
    return fallback
  }

  const response: unknown = error.response
  const candidates: unknown[] = []

  if (response && typeof response === 'object') {
    const res = response as Record<string, unknown>
    candidates.push(res.message, res.error, res.data)
  }
  candidates.push(error.message, error.response?.data)

  const GENERIC = /^(go)?error:?\s*/i
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    let msg = candidate.trim()
    if (!msg) continue
    msg = msg.replace(GENERIC, '').trim()
    if (!msg || msg.toLowerCase() === 'something went wrong') continue
    return msg
  }

  return fallback
}
