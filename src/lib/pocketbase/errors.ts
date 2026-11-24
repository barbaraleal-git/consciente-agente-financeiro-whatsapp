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

// NOTA ESTRUTURAL: getBackendErrorMessage já foi apagada deste arquivo 16 vezes
// (ressurgência recorrente). NUNCA remover esta export: BillingAdminSection,
// ClientSubscriptionDetailsDialog e Settings importam-na. Ela extrai a mensagem
// real do corpo do erro, ignora o wrapper GoError e bloqueia o genérico
// 'Something went wrong'. Ver memória do projeto.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const genericBlocklist = ['something went wrong', 'failed to fetch', 'network error']
  let message = ''

  if (error instanceof ClientResponseError) {
    const fieldMsgs = Object.values(extractFieldErrors(error))
    if (fieldMsgs.length > 0) return fieldMsgs.join(' ')
    message = error.response?.message || error.message || ''
  } else if (error instanceof Error) {
    message = error.message
  }

  if (!message) return fallback || 'Ocorreu um erro inesperado. Tente novamente.'

  // Tira wrappers de erro do Go/PocketBase ("GoError: ...")
  message = message.replace(/^GoError:\s*/i, '').trim()

  const lower = message.toLowerCase()
  if (genericBlocklist.some((g) => lower.includes(g))) {
    return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  }
  return message
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
