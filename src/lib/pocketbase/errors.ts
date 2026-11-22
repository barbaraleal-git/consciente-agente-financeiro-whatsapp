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

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : fallback || 'An unexpected error occurred.'
  }
  const data = error.response?.data
  let realMsg = ''
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.message === 'string') realMsg = d.message
    else if (typeof d.error === 'string') realMsg = d.error
    const fieldMsgs = Object.values(extractFieldErrors(error))
    if (!realMsg && fieldMsgs.length > 0) realMsg = fieldMsgs.join(' ')
  }
  if (
    !realMsg ||
    realMsg === 'Something went wrong' ||
    realMsg.startsWith('GoError') ||
    realMsg.startsWith('Error:')
  ) {
    realMsg = error.message || 'An unexpected error occurred.'
  }
  return realMsg || fallback || 'An unexpected error occurred.'
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
