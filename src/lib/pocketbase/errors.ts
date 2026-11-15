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

// v0.0.114: reexportada com o nome histórico do projeto (v0.0.106) — extrai a
// mensagem REAL do corpo de um 400 do backend (error/message/tipo GoError),
// bloqueando o genérico "Something went wrong" nos toasts do Backoffice.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ClientResponseError) {
    const data = error.response as unknown as Record<string, unknown> | undefined
    const candidates = [data?.error, data?.message, error.message]
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      if (typeof c === 'string' && c.trim() !== '' && c.trim() !== 'Something went wrong') {
        return c.trim()
      }
    }
  }
  return fallback || (error instanceof Error ? error.message : 'Erro inesperado. Tente novamente.')
}
