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

// NOTA ESTRUTURAL (lição v0.0.118/0.0.120/0.0.121/0.0.122): getBackendErrorMessage é
// importada NAMED por vários consumidores (BillingAdminSection, ClientSubscriptionDetailsDialog,
// Settings). NÃO remover esta exportação — o build quebra com MISSING_EXPORT.

export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
): string {
  if (error && typeof error === 'object') {
    const anyErr = error as {
      response?: { message?: unknown; error?: unknown; data?: unknown }
      message?: unknown
    }
    const body = anyErr.response
    if (body && typeof body === 'object') {
      const candidates: unknown[] = [body.message, body.error, body.data]
      for (const cand of candidates) {
        if (typeof cand === 'string' && cand.trim()) {
          let msg = cand.trim()
          msg = msg.replace(/^GoError:\s*/i, '').trim()
          if (msg && !/something went wrong/i.test(msg)) return msg
        }
        if (cand && typeof cand === 'object') {
          const inner = cand as { message?: unknown; error?: unknown }
          const innerMsg =
            typeof inner.message === 'string'
              ? inner.message
              : typeof inner.error === 'string'
                ? inner.error
                : ''
          if (innerMsg.trim()) {
            const cleaned = innerMsg
              .trim()
              .replace(/^GoError:\s*/i, '')
              .trim()
            if (cleaned && !/something went wrong/i.test(cleaned)) return cleaned
          }
        }
      }
    }
    if (typeof anyErr.message === 'string' && anyErr.message.trim()) {
      const cleaned = anyErr.message
        .trim()
        .replace(/^GoError:\s*/i, '')
        .trim()
      if (cleaned && !/something went wrong/i.test(cleaned)) return cleaned
    }
  }
  return fallback
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
