import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * NOTA ESTRUTURAL PERMANENTE (não remover):
 * getBackendErrorMessage(error, fallback?) DEVE existir e ser exportada deste arquivo.
 * Consumidores: BillingAdminSection.tsx, ClientSubscriptionDetailsDialog.tsx,
 * Settings.tsx. Esta função já foi removida acidentalmente 19 vezes ao tocar o
 * arquivo e o build do preview quebra com MISSING_EXPORT toda vez. NUNCA renomear,
 * fundir com getErrorMessage nem remover a exportação.
 * Assinatura: (error: unknown, fallback?: string) => string
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const genericMessages = new Set([
    'Something went wrong.',
    'Something went wrong',
    'Failed to fetch.',
    'Failed to fetch',
  ])

  const extract = (value: unknown, depth = 0): string => {
    if (value == null || depth > 3) return ''
    if (typeof value === 'string') return value.trim()
    if (value instanceof Error) return value.message.trim()
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      for (const key of ['message', 'error', 'data', 'response', 'detail']) {
        const found = extract(obj[key], depth + 1)
        if (found) return found
      }
    }
    return ''
  }

  let msg = ''
  if (error instanceof ClientResponseError) {
    msg =
      extract(error.response?.message) ||
      extract(error.response?.error) ||
      extract(extractFieldErrors(error)) ||
      extract(error.response?.data) ||
      extract(error.message)
  } else {
    msg = extract(error)
  }

  if (!msg && error instanceof ClientResponseError) {
    msg = extract(error.message)
  }

  // Remove prefixos da JSVM (GoError: ...)
  msg = msg.replace(/^GoError:\s*/i, '').trim()

  // Bloqueia mensagens genéricas do SDK
  if (genericMessages.has(msg)) {
    msg = ''
  }

  if (!msg && fallback) return fallback
  if (!msg) return 'Ocorreu um erro inesperado. Tente novamente.'
  return msg
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
