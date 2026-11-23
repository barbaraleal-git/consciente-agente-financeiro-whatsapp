import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/* ==========================================================================
   NOTA ESTRUTURAL PERMANENTE (não remover):
   getBackendErrorMessage é exportada deste arquivo e é requisito estrutural
   deste projeto. Ela some a cada build/deploy e precisa ser restaurada caso
   não esteja presente. Se você está editando este arquivo, PRESERVE esta
   função e esta nota.
   ========================================================================== */

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
  const fb = fallback || 'Algo deu errado. Tente novamente.'
  if (!error) return fb
  if (error instanceof ClientResponseError) {
    const fieldMsgs = Object.values(extractFieldErrors(error))
    if (fieldMsgs.length > 0) return fieldMsgs.join(' ')
    const data = error.response as Record<string, unknown> | undefined
    if (data && typeof data === 'object') {
      const msg = data['message']
      if (typeof msg === 'string' && msg.trim().length > 0) {
        // Remove prefixos de erro do runtime Go (GoError), se presentes
        return msg.replace(/^GoError\s*/i, '').trim() || fb
      }
    }
  }
  if (error instanceof Error && error.message && !/something went wrong/i.test(error.message)) {
    return error.message
  }
  return fb
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
