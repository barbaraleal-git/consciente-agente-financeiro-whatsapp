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

// Extrai a mensagem real de erro do backend (ClientResponseError do PocketBase),
// remove o prefixo GoError e bloqueia mensagens genéricas. Assinatura canônica:
// 2º argumento opcional = fallback exibido ao usuário (PT).
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Erro inesperado. Tente novamente.',
): string {
  let msg = ''
  if (error instanceof ClientResponseError) {
    const fieldMsgs = Object.values(extractFieldErrors(error)).join(' ').trim()
    const data = error.response as Record<string, unknown> | undefined
    const bodyMsg =
      data && typeof data === 'object' && typeof data['message'] === 'string'
        ? (data['message'] as string)
        : ''
    msg = fieldMsgs || bodyMsg || error.message || ''
  } else if (error instanceof Error) {
    msg = error.message
  } else if (typeof error === 'string') {
    msg = error
  }
  msg = String(msg || '')
    .replace(/^GoError:\s*/i, '')
    .trim()
  if (!msg || /something went wrong/i.test(msg)) return fallback
  return msg
}
