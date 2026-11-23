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

/* ⚠️ NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER ⚠️
   getBackendErrorMessage abaixo (assinatura: (error, fallback?)) é usada por
   Settings.tsx, BillingAdminSection.tsx e ClientSubscriptionDetailsDialog.tsx.
   Esta função JÁ SUMIU 10 VEZES deste arquivo a cada build (MISSING_EXPORT) e
   foi restaurada todas elas. Qualquer edição em errors.ts DEVE preservar
   getBackendErrorMessage exportada — sem ela o build quebra. */

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const GENERIC = ['Something went wrong', 'An unexpected error occurred', 'Failed to fetch']
  let raw = ''
  if (error instanceof ClientResponseError) {
    const body = (error.response ?? {}) as Record<string, unknown>
    for (const key of ['message', 'error', 'data']) {
      const v = body[key]
      if (typeof v === 'string' && v.trim()) {
        raw = v.trim()
        break
      }
      if (v && typeof v === 'object' && 'message' in (v as Record<string, unknown>)) {
        const m = (v as { message: unknown }).message
        if (typeof m === 'string' && m.trim()) {
          raw = m.trim()
          break
        }
      }
    }
    if (!raw && error.message) raw = error.message
  } else if (error instanceof Error && error.message) {
    raw = error.message
  } else if (typeof error === 'string' && error.trim()) {
    raw = error.trim()
  }
  raw = raw.replace(/^(GoError|Error)\s*:\s*/i, '').trim()
  if (!raw || GENERIC.some((g) => raw.toLowerCase() === g.toLowerCase())) {
    return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
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
