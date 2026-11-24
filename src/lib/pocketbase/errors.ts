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

// NOTA ESTRUTURAL PERMANENTE (não remover):
// getBackendErrorMessage é IMPORTADA por BillingAdminSection.tsx,
// ClientSubscriptionDetailsDialog.tsx e Settings.tsx. Já desapareceu 17×
// deste arquivo em versões anteriores (v0.0.118 a v0.0.165) e cada sumiço
// quebrou o build. NÃO renomear, NÃO apagar, NÃO fundir com getErrorMessage.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const msg = getErrorMessage(error)
  const generic =
    !msg || msg === 'An unexpected error occurred.' || /^Something went wrong\.?$/i.test(msg)
  if (generic) {
    return fallback || 'Erro no servidor. Tente novamente em instantes.'
  }
  // Remove prefixos de GoError quando o backend repassa o erro cru do Go.
  return msg.replace(/^GoError:\s*/i, '').trim() || fallback || msg
}
