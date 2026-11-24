// =============================================================================
// NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER
// `getBackendErrorMessage(error, fallback?)` é consumida por:
//   - src/components/admin/BillingAdminSection.tsx
//   - src/components/admin/ClientSubscriptionDetailsDialog.tsx
//   - src/pages/Settings.tsx
// Esta função já sumiu do arquivo 14 vezes em builds anteriores (MISSING_EXPORT
// no QA). Se o build reclamar de export ausente, restaure-a AQUI, com esta nota.
// =============================================================================
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

const GENERIC_SDK_MESSAGES = [
  'something went wrong',
  'failed to fetch',
  'an unexpected error occurred',
  'networkerror',
]

function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/^(GoError|Error):\s*/i, '').trim()
  if (!text) return null
  if (GENERIC_SDK_MESSAGES.some((g) => text.toLowerCase().startsWith(g))) return null
  return text
}

/**
 * Extrai a mensagem real de um erro do backend para exibir ao usuário.
 * Lê message/error/data do corpo da resposta, remove o prefixo "GoError:" da JSVM
 * e bloqueia o genérico "Something went wrong" do SDK. Sem mensagem útil, usa o fallback em PT.
 */
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
): string {
  if (error instanceof ClientResponseError) {
    const data = error.response?.data as Record<string, unknown> | undefined
    if (data && typeof data === 'object') {
      const direct = cleanMessage(data.message) ?? cleanMessage(data.error)
      if (direct) return direct
      const fields = Object.values(extractFieldErrors(error)).map(cleanMessage).filter(Boolean)
      if (fields.length > 0) return fields.join(' ')
    }
    return cleanMessage(error.message) ?? fallback
  }
  if (error instanceof Error) return cleanMessage(error.message) ?? fallback
  return fallback
}
