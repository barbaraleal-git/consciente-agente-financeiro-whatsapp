// NOTA ESTRUTURAL PERMANENTE: a função getBackendErrorMessage abaixo NUNCA
// deve ser removida deste arquivo. Ela é consumida por BillingAdminSection,
// ClientSubscriptionDetailsDialog e Settings — sua ausência quebra o build do
// preview com MISSING_EXPORT (defeito recorrente, já restaurada 6 vezes).
import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// Extrai a mensagem real do corpo da resposta do backend, remove prefixos da
// JSVM ("GoError: ..."), bloqueia o genérico "Something went wrong" do SDK e
// devolve o fallback em português quando não há mensagem aproveitável.
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado.',
): string {
  if (!error) return fallback
  const response =
    error instanceof ClientResponseError
      ? error.response
      : ((error as { response?: { message?: string; error?: string; data?: { message?: string } } })
          .response ?? {})
  const candidates: Array<unknown> = [
    (response as { message?: unknown })?.message,
    (response as { error?: unknown })?.error,
    (response as { data?: { message?: unknown } })?.data?.message,
    (response as { data?: unknown })?.data,
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    const cleaned = candidate
      .replace(/^GoError:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim()
    if (!cleaned) continue
    if (/something went wrong/i.test(cleaned)) continue
    return cleaned
  }
  return fallback
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
