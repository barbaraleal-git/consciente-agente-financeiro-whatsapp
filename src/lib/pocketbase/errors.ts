// ============================================================================
// NOTA ESTRUTURAL PERMANENTE (não remover):
// A export getBackendErrorMessage abaixo JÁ SUMIU 14 VEZES em builds deste
// projeto (v0.0.119/0.0.120/0.0.122 e novamente nesta rodada, v0.0.159 —
// detectada pelo tsc/MISSING_EXPORT no BillingAdminSection, no
// ClientSubscriptionDetailsDialog e no Settings). A verificação de que esta
// export existe deve preceder QUALQUER QA deste projeto. Se sumir de novo,
// restaurá-la IMEDIATAMENTE (é a extração da mensagem real do corpo da resposta
// do backend, com bloqueio do genérico 'Something went wrong' — v0.0.87).
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
 * Extrai a mensagem REAL do corpo da resposta do backend (error.response.data),
 * removendo o prefixo GoError quando presente e BLOQUEANDO mensagens genéricas
 * tipo 'Something went wrong' (decisão v0.0.87 — a dona exige o motivo real).
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const generic = ['something went wrong', 'erro inesperado', 'an unexpected error occurred']
  const defaultMsg =
    fallback && fallback.trim()
      ? fallback
      : 'Não foi possível concluir a operação. Tente novamente ou fale com o suporte.'

  if (error instanceof ClientResponseError) {
    // 1) Mensagem de campo (validation errors do PocketBase)
    const fieldMsgs = Object.values(extractFieldErrors(error))
    if (fieldMsgs.length > 0) return fieldMsgs.join(' ')

    // 2) error.response.message ou error.message — tirar "GoError: "
    const raw =
      (error.response && typeof error.response.message === 'string' && error.response.message) ||
      (typeof error.message === 'string' ? error.message : '')
    let msg = raw.replace(/^GoError:\s*/i, '').trim()

    // 3) Bloqueio do genérico — usa o fallback do chamador quando fornecido
    if (!msg || generic.some((g) => msg.toLowerCase().includes(g))) {
      return defaultMsg
    }
    return msg
  }

  if (error instanceof Error) return error.message
  return defaultMsg
}
