import { ClientResponseError } from 'pocketbase'

// ============================================================
// NOTA ESTRUTURAL PERMANENTE (padrão do projeto — 22ª ressurgência):
// getBackendErrorMessage NUNCA deve ser removida deste arquivo.
// É consumida por Settings.tsx, BillingAdminSection.tsx,
// ClientSubscriptionDetailsDialog.tsx e ConversationsHistorySection.tsx;
// apagá-la quebra o build inteiro (TS2724/MISSING_EXPORT).
// ============================================================

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

/**
 * Extrai a mensagem REAL do corpo de erro do backend (PocketBase/hook),
 * para exibir ao usuário em toasts e estados de erro.
 *
 * Ordem de leitura: error.response?.data (campos message/error/data) e
 * depois error.message. Remove o prefixo GoError que o JSVM adiciona e
 * BLOQUEIA o genérico "Something went wrong" do SDK — nesses casos usa o
 * fallback (em PT) fornecido pelo chamador.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const pick = (val: unknown): string => {
    if (typeof val === 'string' && val.trim()) return val.trim()
    return ''
  }

  let raw = ''
  if (error instanceof ClientResponseError) {
    const body = error.response?.data as Record<string, unknown> | undefined
    if (body && typeof body === 'object') {
      raw =
        pick(body.message) ||
        pick(body.error) ||
        (body.data && typeof body.data === 'object'
          ? pick((body.data as Record<string, unknown>).message)
          : '')
    }
    if (!raw) raw = pick(error.message)
  } else if (error instanceof Error) {
    raw = pick(error.message)
  } else if (typeof error === 'string') {
    raw = pick(error)
  }

  // Remove prefixo GoError (JSVM) — pode aparecer repetido/nested.
  raw = raw.replace(/^(?:GoError:\s*)+/i, '').trim()

  // Mensagens genéricas do SDK não ajudam o usuário: usa o fallback.
  const GENERIC = /^(something went wrong|unexpected error|an unexpected error occurred)\.?$/i
  if (!raw || GENERIC.test(raw)) {
    return fallback || 'Não foi possível concluir a operação. Tente novamente.'
  }
  return raw
}
