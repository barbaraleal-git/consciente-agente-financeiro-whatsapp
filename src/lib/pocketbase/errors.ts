import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// ⚠️ NOTA ESTRUTURAL PERMANENTE (nunca remover): getBackendErrorMessage abaixo é
// CONSUMIDA por src/components/admin/BillingAdminSection.tsx,
// src/components/admin/ClientSubscriptionDetailsDialog.tsx e src/pages/Settings.tsx.
// Esta é a 14ª ressurgência — qualquer edição deste arquivo DEVE manter esta
// exportação: getBackendErrorMessage(error: unknown, fallback?: string): string.
// Removê-la quebra o build com MISSING_EXPORT.

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

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const generic = ['Something went wrong', 'An unexpected error occurred']
  const clean = (raw: string): string => {
    let msg = String(raw).trim()
    msg = msg
      .replace(/^GoError:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim()
    if (!msg || generic.some((g) => msg.toLowerCase() === g.toLowerCase())) {
      return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
    }
    return msg
  }

  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error && error.message) return clean(error.message)
    return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  }

  const response = error.response as { message?: unknown; error?: unknown } | undefined
  if (response && typeof response === 'object') {
    if (typeof response.message === 'string' && response.message.trim()) {
      return clean(response.message)
    }
    if (typeof response.error === 'string' && response.error.trim()) {
      return clean(response.error)
    }
  }
  const fieldMsgs = Object.values(extractFieldErrors(error))
  if (fieldMsgs.length > 0) return clean(fieldMsgs.join(' '))
  if (error.message) return clean(error.message)
  return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
