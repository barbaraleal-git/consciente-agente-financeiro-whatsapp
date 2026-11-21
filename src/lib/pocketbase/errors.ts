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

// NOTA ESTRUTURAL (permanente): a exportação getBackendErrorMessage abaixo
// é OBRIGATÓRIA neste arquivo — já sumiu 5 vezes (MISSING_EXPORT em build).
// NÃO remover ao editar este arquivo.

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const defaultFallback = 'Ocorreu um erro inesperado. Tente novamente.'
  if (!(error instanceof ClientResponseError)) {
    return fallback || (error instanceof Error ? error.message : defaultFallback)
  }
  const raw =
    error.response?.message ||
    (error.response as unknown as { error?: string } | undefined)?.error ||
    error.message ||
    ''
  let msg = String(raw || '').trim()
  msg = msg.replace(/^(GoError|Error)\s*[:-]\s*/i, '').trim()
  const lowered = msg.toLowerCase()
  if (
    !msg ||
    lowered === 'something went wrong' ||
    lowered.startsWith('failed to fetch') ||
    lowered.startsWith('network')
  ) {
    return fallback || defaultFallback
  }
  return msg
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
