// NOTA ESTRUTURAL PERMANENTE (não remover): getBackendErrorMessage(error, fallback?)
// é o extrator de mensagens reais do backend usado pelos toasts do Backoffice e do
// app (BillingAdminSection.tsx, ClientSubscriptionDetailsDialog.tsx, Settings.tsx).
// Ele JÁ FOI apagado acidentalmente 18 vezes em rodadas anteriores — sempre que este
// arquivo for editado, confirme que getBackendErrorMessage permanece exportada aqui.
// Remove prefixos GoError/Error da JSVM e bloqueia o genérico "Something went wrong"
// do SDK, usando o fallback em PT quando não há mensagem útil.
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
  const GENERIC = ['something went wrong', 'falha inesperada']
  let raw = ''
  if (error && typeof error === 'object') {
    const anyErr = error as { response?: { message?: unknown; error?: unknown; data?: unknown } }
    const body = anyErr.response
    if (body) {
      if (typeof body.message === 'string') raw = body.message
      else if (typeof body.error === 'string') raw = body.error
      else if (body.data && typeof body.data === 'object') {
        const d = body.data as Record<string, unknown>
        if (typeof d.message === 'string') raw = d.message
      }
    }
  }
  if (!raw && error instanceof Error) raw = error.message
  if (raw) {
    raw = String(raw)
      .replace(/^(GoError:\s*)+/, '')
      .replace(/^Error:\s*/, '')
      .trim()
  }
  if (!raw || GENERIC.includes(raw.toLowerCase())) {
    return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  }
  return raw
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
