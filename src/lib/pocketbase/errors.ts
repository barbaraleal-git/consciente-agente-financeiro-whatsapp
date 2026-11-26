// ⚠️ NOTA ESTRUTURAL PERMANENTE (24ª ressurgência do padrão — v0.0.189):
// `getBackendErrorMessage` DEVE continuar exportada deste arquivo. Vários
// componentes (Settings, BillingAdminSection, ConversationsHistorySection,
// ClientSubscriptionDetailsDialog) a importam. Toda vez que este arquivo é
// reescrito sem ela, o build quebra com MISSING_EXPORT. Ao editar, PRESERVE
// as duas funções originais abaixo e esta terceira.
//
// Comportamento (restaurado conforme a v0.0.140, validada pela dona no vivo):
// extrai a mensagem real do corpo do erro ({ message | error | data }), tira
// prefixos GoError/Error, e BLOQUEIA mensagens genéricas
// ('Something went wrong', etc.) para não vazar texto técnico ao cliente.
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

const GENERIC_MESSAGES = [
  'something went wrong',
  'internal server error',
  'unexpected error',
  'an error occurred',
  'failed to fetch',
  'network error',
]

function normalizeBackendMessage(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let msg = raw.trim()
  if (!msg) return ''
  msg = msg.replace(/^GoError:\s*/i, '')
  msg = msg.replace(/^Error:\s*/i, '')
  return msg.trim()
}

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  let candidate = ''

  if (error instanceof ClientResponseError) {
    const data = error.response as Record<string, unknown> | undefined
    if (data && typeof data === 'object') {
      for (const key of ['message', 'error', 'data']) {
        const val = data[key]
        if (typeof val === 'string' && val.trim()) {
          candidate = normalizeBackendMessage(val)
          if (candidate) break
        }
      }
      if (!candidate && data.data && typeof data.data === 'object') {
        const nested = data.data as Record<string, unknown>
        for (const key of ['message', 'error']) {
          const val = nested[key]
          if (typeof val === 'string' && val.trim()) {
            candidate = normalizeBackendMessage(val)
            if (candidate) break
          }
        }
      }
    }
    if (!candidate && error.message) {
      candidate = normalizeBackendMessage(error.message)
    }
  } else if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    for (const key of ['message', 'error']) {
      const val = obj[key]
      if (typeof val === 'string' && val.trim()) {
        candidate = normalizeBackendMessage(val)
        if (candidate) break
      }
    }
  } else if (typeof error === 'string') {
    candidate = normalizeBackendMessage(error)
  }

  const low = candidate.toLowerCase()
  if (!candidate || GENERIC_MESSAGES.some((g) => low.indexOf(g) !== -1)) {
    return fallback || 'Ocorreu um erro inesperado. Tente novamente em alguns instantes.'
  }
  return candidate
}
