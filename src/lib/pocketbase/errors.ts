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

// ⚠️ NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER getBackendErrorMessage
// getBackendErrorMessage é CONSUMIDA por: src/pages/Settings.tsx (foto de perfil WhatsApp),
// src/components/admin/BillingAdminSection.tsx (planos, dados legais, Stripe, setup),
// src/components/admin/ClientSubscriptionDetailsDialog.tsx (extrato do cliente).
// Aridade: getBackendErrorMessage(error, fallback?) — o fallback é o 2º argumento.
// Esta função JÁ foi apagada/acidentalmente deixada de fora em ~12 builds anteriores
// (MISSING_EXPORT recorrente — 13ª ressurgência restaurada em v0.0.156). Qualquer edição
// neste arquivo DEVE preservar este export, SEM EXCEÇÃO.

/**
 * Extrai a mensagem REAL do corpo da resposta do backend (message/error/data),
 * remove prefixos da JSVM ("GoError: ...", "Error: ...") e bloqueia o genérico
 * "Something went wrong" do SDK. Quando não há mensagem útil, usa o fallback em PT.
 */
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  let raw = ''
  if (error instanceof ClientResponseError) {
    const response = (error.response || {}) as Record<string, unknown>
    const candidates: unknown[] = [response.message, response.error, response.data]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        raw = candidate.trim()
        break
      }
      if (candidate && typeof candidate === 'object') {
        const nested =
          (candidate as Record<string, unknown>).message ??
          (candidate as Record<string, unknown>).error
        if (typeof nested === 'string' && nested.trim()) {
          raw = nested.trim()
          break
        }
      }
    }
    if (!raw && typeof error.message === 'string') {
      raw = error.message
    }
  } else if (error instanceof Error && error.message) {
    raw = error.message
  } else if (typeof error === 'string' && error.trim()) {
    raw = error.trim()
  }

  raw = raw
    .replace(/^GoError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()

  if (!raw || /something went wrong/i.test(raw)) {
    return fallback
  }
  return raw
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
