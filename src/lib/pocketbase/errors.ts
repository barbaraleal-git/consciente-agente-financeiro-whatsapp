// ============================================================================
// NOTA ESTRUTURAL PERMANENTE (25ª ressurgência — v0.0.189)
//
// getBackendErrorMessage NUNCA deve ser removida deste arquivo.
// Consumidores: BillingAdminSection.tsx, Settings.tsx,
// ClientSubscriptionDetailsDialog.tsx, ConversationsHistorySection.tsx.
// O build quebra com MISSING_EXPORT quando a função é apagada ou renomeada.
// Aridade: getBackendErrorMessage(error: unknown, fallback?: string): string
// ============================================================================

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
 * Extrai a mensagem real do corpo de uma resposta de erro do backend.
 * Comportamento da v0.0.140: lê message/error/data do corpo, remove os
 * prefixos "GoError:"/"Error:" da JSVM, bloqueia o genérico
 * "Something went wrong" do SDK e devolve o fallback (em PT) quando
 * nada aproveitável existe no corpo.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const GENERIC_SDK_MESSAGES = ['Something went wrong', 'An unexpected error occurred']

  const clean = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined
    let msg = raw.trim()
    msg = msg.replace(/^(GoError|Error)\s*:\s*/i, '').trim()
    if (!msg) return undefined
    if (GENERIC_SDK_MESSAGES.some((g) => msg.toLowerCase() === g.toLowerCase())) {
      return undefined
    }
    return msg
  }

  if (error instanceof ClientResponseError) {
    const body: unknown = error.response
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>
      for (const key of ['message', 'error', 'data']) {
        const cleaned = clean(b[key])
        if (cleaned) return cleaned
      }
    }
    const cleanedStatus = clean(error.message)
    if (cleanedStatus) return cleanedStatus
  } else if (error instanceof Error) {
    const cleaned = clean(error.message)
    if (cleaned) return cleaned
  } else if (typeof error === 'string') {
    const cleaned = clean(error)
    if (cleaned) return cleaned
  }

  return fallback ?? 'Ocorreu um erro inesperado.'
}
