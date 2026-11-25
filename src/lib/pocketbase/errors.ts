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

// ⚠️ NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER ⚠️
// getBackendErrorMessage é a 22ª+ ressurgência: TODA vez que este arquivo é tocado,
// a função some e o build do preview quebra com MISSING_EXPORT nos consumidores:
//   src/pages/Settings.tsx, src/components/admin/BillingAdminSection.tsx,
//   src/components/admin/ClientSubscriptionDetailsDialog.tsx,
//   src/components/admin/ConversationsHistorySection.tsx (entre outros).
// Qualquer edição aqui DEVE manter esta exportação: getBackendErrorMessage(error, fallback?).
const GENERIC_MESSAGES = [
  'something went wrong',
  'unexpected error',
  'an unexpected error occurred',
]

function stripGoErrorPrefixes(message: string): string {
  let current = message.trim()
  let previous = ''
  while (current && current !== previous) {
    previous = current
    current = current
      .replace(/^GoError:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim()
  }
  return current
}

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const collect = (): string[] => {
    const messages: string[] = []
    if (error instanceof ClientResponseError) {
      const response = error.response as Record<string, unknown> | undefined
      if (response && typeof response === 'object') {
        const candidates = [response.message, response.error, response.data]
        for (const candidate of candidates) {
          if (typeof candidate === 'string' && candidate.trim()) {
            messages.push(candidate)
          } else if (candidate && typeof candidate === 'object') {
            const obj = candidate as Record<string, unknown>
            if (typeof obj.message === 'string' && obj.message.trim()) {
              messages.push(obj.message)
            }
            if (typeof obj.error === 'string' && obj.error.trim()) {
              messages.push(obj.error)
            }
          }
        }
      }
    }
    if (messages.length === 0 && error instanceof Error && error.message.trim()) {
      messages.push(error.message)
    }
    return messages
  }

  for (const raw of collect()) {
    const message = stripGoErrorPrefixes(raw)
    if (!message) continue
    if (GENERIC_MESSAGES.some((generic) => message.toLowerCase().includes(generic))) {
      continue
    }
    return message
  }

  return fallback ?? 'Ocorreu um erro inesperado. Tente novamente.'
}
