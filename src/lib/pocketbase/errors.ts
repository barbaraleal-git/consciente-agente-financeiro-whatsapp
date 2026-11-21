import {
  ClientResponseError,
  type ClientResponseError as ClientResponseErrorType,
} from 'pocketbase'

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

const GENERIC_MESSAGES = [
  'something went wrong',
  'an unexpected error occurred',
  'ocorreu um erro inesperado',
]

function looksGeneric(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return true
  return GENERIC_MESSAGES.includes(normalized)
}

function cleanMessage(message: string): string {
  let cleaned = message.trim()
  for (;;) {
    const next = cleaned.replace(/^(GoError|Error)\s*:\s*/i, '')
    if (next === cleaned) break
    cleaned = next.trim()
  }
  return cleaned
}

function extractFromBody(error: unknown): string | undefined {
  if (error instanceof ClientResponseError) {
    const response = error.response as Partial<ClientResponseErrorType['response']> | undefined
    const candidates = [response?.message, response?.error, (response as { data?: unknown })?.data]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return cleanMessage(candidate)
      if (candidate && typeof candidate === 'object') {
        const nested = candidate as { message?: unknown; error?: unknown }
        const nestedMsg =
          typeof nested.message === 'string'
            ? nested.message
            : typeof nested.error === 'string'
              ? nested.error
              : undefined
        if (nestedMsg && nestedMsg.trim()) return cleanMessage(nestedMsg)
      }
    }
    return undefined
  }
  if (error instanceof Error) {
    const raw = (error as { raw?: unknown }).raw
    if (raw && typeof raw === 'object') {
      const rawObj = raw as { message?: unknown; error?: unknown }
      const rawMsg =
        typeof rawObj.message === 'string'
          ? rawObj.message
          : typeof rawObj.error === 'string'
            ? rawObj.error
            : undefined
      if (rawMsg && rawMsg.trim()) return cleanMessage(rawMsg)
    }
  }
  return undefined
}

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const extracted = extractFromBody(error)
  if (extracted && !looksGeneric(extracted)) return extracted
  if (error instanceof ClientResponseError && !looksGeneric(error.message)) {
    return cleanMessage(error.message)
  }
  return fallback ?? 'Ocorreu um erro inesperado. Tente novamente.'
}
