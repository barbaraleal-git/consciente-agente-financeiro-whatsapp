import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// ---------------------------------------------------------------------------
// NOTA ESTRUTURAL PERMANENTE (v0.0.152 — 12ª restauração):
// getBackendErrorMessage NUNCA deve ser removida deste arquivo. Consumidores:
//   - src/components/admin/BillingAdminSection.tsx
//   - src/components/admin/ClientSubscriptionDetailsDialog.tsx
//   - src/pages/Settings.tsx
// Assinatura: getBackendErrorMessage(error: unknown, fallback?: string): string
// ---------------------------------------------------------------------------
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const genericSdkMessages = [
    'Something went wrong',
    'Failed to fetch',
    'Network Error',
    'request failed',
  ]
  const stripGoError = (msg: string) => msg.replace(/^(GoError|Error):\s*/i, '')
  const pickFromBody = (body: unknown): string => {
    if (!body || typeof body !== 'object') return ''
    const b = body as Record<string, unknown>
    const candidates = [b.message, b.error, b.detail]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return stripGoError(c.trim())
      if (c && typeof c === 'object' && 'message' in (c as Record<string, unknown>)) {
        const m = (c as Record<string, unknown>).message
        if (typeof m === 'string' && m.trim()) return stripGoError(m.trim())
      }
    }
    if (typeof b.data === 'string' && b.data.trim()) return stripGoError(b.data.trim())
    return ''
  }

  if (error instanceof ClientResponseError) {
    const fromResponse =
      pickFromBody(error.response as unknown) ||
      (typeof error.response?.message === 'string' ? stripGoError(error.response.message) : '')
    const cleaned = fromResponse.trim()
    const isGeneric = genericSdkMessages.some((g) =>
      cleaned.toLowerCase().includes(g.toLowerCase()),
    )
    if (cleaned && !isGeneric) return cleaned
    return fallback || cleaned || 'Ocorreu um erro inesperado. Tente novamente.'
  }

  if (error instanceof Error && error.message && error.message !== 'Something went wrong') {
    return stripGoError(error.message)
  }
  return fallback || (error instanceof Error ? error.message : 'Ocorreu um erro inesperado.')
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
