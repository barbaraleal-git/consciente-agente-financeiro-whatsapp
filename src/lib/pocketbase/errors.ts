// NOTA ESTRUTURAL PERMANENTE (não remover ao editar este arquivo):
// getBackendErrorMessage já foi perdida acidentalmente 22 vezes quando este
// arquivo era tocado (padrão MISSING_EXPORT). Consumidores dela:
// src/pages/Settings.tsx, src/components/admin/AppAccessLinkSection.tsx,
// src/components/admin/BillingAdminSection.tsx e
// src/components/admin/ConversationsHistorySection.tsx. Se ela sumir, o build
// quebra e nenhuma correção chega ao vivo.
import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

/**
 * Extrai a mensagem real do corpo de erro do backend (PocketBase/JSVM),
 * removendo prefixos GoError/Error e bloqueando o genérico "Something went
 * wrong" do SDK. Usa `fallback` (em PT) quando nada útil é extraído.
 */
export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  let raw = ''
  if (error instanceof ClientResponseError) {
    const body = error.response as unknown
    if (typeof body === 'string') {
      raw = body
    } else if (body && typeof body === 'object') {
      const o = body as { message?: unknown; error?: unknown }
      raw = typeof o.message === 'string' ? o.message : typeof o.error === 'string' ? o.error : ''
      if (!raw) {
        const fieldMsgs = Object.values(extractFieldErrors(error))
        raw = fieldMsgs.join(' ')
      }
    }
    if (!raw) raw = error.message || ''
  } else if (error instanceof Error) {
    raw = error.message
  } else if (typeof error === 'string') {
    raw = error
  }

  const cleaned = raw
    .replace(/^GoError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()

  if (!cleaned || /^something went wrong$/i.test(cleaned)) return fallback
  return cleaned
}

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
