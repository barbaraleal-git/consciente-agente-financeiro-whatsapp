// NOTA ESTRUTURAL PERMANENTE: getBackendErrorMessage(error, fallback?) é export
// obrigatório deste arquivo. Vários consumidores importam esse nome
// (BillingAdminSection, ClientSubscriptionDetailsDialog,
// ConversationsHistorySection, Settings) e o build inteiro quebra com
// MISSING_EXPORT se ele sumir (padrão recorrente — 23ª ressurgência).
// NUNCA remover/renomear este export em refatorações.
import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * Mensagem amigável de um erro do backend, em PT-BR, extraindo a mensagem
 * real do corpo da resposta (e não a genérica do ClientResponseError).
 * 2º argumento opcional = fallback em PT exibido quando o corpo não traz
 * mensagem utilizável. Comportamento da v0.0.140 (ReleaseLog), preservado.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ClientResponseError) {
    const response = (error.response ?? {}) as Record<string, unknown>
    const candidates = [response.message, response.error, response.data]
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue
      const cleaned = candidate
        .replace(/^(GoError|Error):\s*/i, '')
        .replace(/^Something went wrong\.?$/i, '')
        .trim()
      if (cleaned) return cleaned
    }
  }
  if (fallback) return fallback
  return getErrorMessage(error)
}

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
