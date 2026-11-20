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

export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  const raw =
    error instanceof ClientResponseError
      ? (() => {
          const r = error.response as unknown as Record<string, unknown> | undefined
          const candidates = [
            r?.message,
            r?.error,
            (r?.data as Record<string, unknown> | undefined)?.message,
            (r?.data as Record<string, unknown> | undefined)?.error,
            error.message,
          ]
          const found = candidates.find((c) => typeof c === 'string' && c.trim().length > 0)
          return typeof found === 'string' ? found : ''
        })()
      : error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : ''

  const cleaned = raw
    .replace(/^GoError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()

  if (!cleaned) return fallback
  // Bloqueia o genérico do SDK/HTTP que não ajuda a usuária.
  if (/^something went wrong$/i.test(cleaned)) return fallback
  return cleaned
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
