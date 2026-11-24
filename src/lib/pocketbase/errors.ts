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

// NOTA ESTRUTURAL PERMANENTE (v0.0.119+): getBackendErrorMessage já desapareceu
// 13 vezes durante builds (MISSING_EXPORT). NUNCA remover esta função — vários
// componentes (BillingAdminSection, SubscriptionPlansTab, Settings, etc.) a
// importam e o build quebra sem ela.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ClientResponseError) {
    const msgs = Object.values(extractFieldErrors(error))
    if (msgs.length > 0) return msgs.join(' ')
    const respMsg = (error.response as { message?: string } | undefined)?.message
    if (typeof respMsg === 'string' && respMsg && respMsg !== 'Something went wrong.') {
      return respMsg.replace(/^GoError:\s*/, '')
    }
    if (
      typeof error.message === 'string' &&
      error.message &&
      error.message !== 'Something went wrong.' &&
      !error.message.startsWith('ClientResponseError')
    ) {
      return error.message.replace(/^GoError:\s*/, '')
    }
  } else if (error instanceof Error && error.message) {
    return error.message.replace(/^GoError:\s*/, '')
  }
  return fallback || 'Algo deu errado. Tente novamente.'
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
