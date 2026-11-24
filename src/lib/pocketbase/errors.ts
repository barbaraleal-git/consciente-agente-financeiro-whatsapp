import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// ─────────────────────────────────────────────────────────────────────────────
// NOTA ESTRUTURAL PERMANENTE (não remover):
// A função getBackendErrorMessage abaixo É exportada deste arquivo e É usada
// por: BillingAdminSection.tsx, ClientSubscriptionDetailsDialog.tsx,
// Settings.tsx (e historicamente por outros consumidores). Ela já desapareceu
// deste arquivo repetidamente (18+ ocorrências registradas no ReleaseLog),
// quebrando o build com MISSING_EXPORT. Qualquer edição neste arquivo DEVE
// preservar getBackendErrorMessage com esta assinatura exata:
//   getBackendErrorMessage(error: unknown, fallback?: string): string
// Comportamento: lê message/error/data do corpo da resposta, remove prefixos
// da JSVM ("GoError: ...", "Error: ..."), bloqueia o genérico
// "Something went wrong" do SDK e usa o fallback em PT quando nada útil há.
// ─────────────────────────────────────────────────────────────────────────────

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (!detail || typeof detail !== 'object' || !('message' in detail)) continue
    const message = (detail as { message: unknown }).message
    if (typeof message === 'string') {
      errors[field] = message
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

export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const GENERIC_PATTERNS = [/^something went wrong\.?$/i]
  const extract = (): string => {
    if (!(error instanceof ClientResponseError)) {
      return error instanceof Error ? error.message : ''
    }
    const response = error.response as { message?: unknown; error?: unknown; data?: unknown }
    const candidates: string[] = []
    if (typeof response?.message === 'string') candidates.push(response.message)
    if (typeof response?.error === 'string') candidates.push(response.error)
    if (typeof response?.data === 'string') candidates.push(response.data)
    if (response?.data && typeof response.data === 'object') {
      for (const value of Object.values(response.data as Record<string, unknown>)) {
        if (value && typeof value === 'object' && 'message' in value) {
          const message = (value as { message: unknown }).message
          if (typeof message === 'string') candidates.push(message)
        }
      }
    }
    if (typeof error.message === 'string') candidates.push(error.message)
    for (const candidate of candidates) {
      let message = candidate.trim()
      message = message.replace(/^GoError:\s*/i, '').replace(/^Error:\s*/, '')
      if (message && !GENERIC_PATTERNS.some((pattern) => pattern.test(message))) {
        return message
      }
    }
    return ''
  }
  const extracted = extract()
  return (
    extracted ||
    fallback ||
    (error instanceof Error ? error.message : 'Ocorreu um erro inesperado.')
  )
}
