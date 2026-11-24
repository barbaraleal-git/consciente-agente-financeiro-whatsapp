import { ClientResponseError } from 'pocketbase'

// ⚠️ NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER NADA DESTE ARQUIVO.
// getBackendErrorMessage JÁ FOI APAGADA 15 VEZES por rodadas anteriores e o build
// quebrou com MISSING_EXPORT TODA VEZ (BillingAdminSection, ClientSubscriptionDetailsDialog
// e Settings importam esta função). Se este arquivo for tocado, CONFERIR ANTES DO QA que
// getBackendErrorMessage segue aqui, exportada, com aridade (error, fallback?).

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

// Extrai a mensagem real do corpo da resposta do backend (message/error/data),
// remove prefixos da JSVM ("GoError: ...", "Error: ...") e bloqueia as frases
// genéricas em inglês do SDK — o fallback em PT só é usado quando nada aproveitável
// chega (ex.: falha de rede sem mensagem própria).
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const generic = ['Something went wrong', 'Failed to fetch', 'Network request failed']

  if (error instanceof ClientResponseError) {
    const res = error.response as Record<string, unknown> | undefined
    const candidates: unknown[] = [
      res?.message,
      res?.error,
      (res?.data as Record<string, unknown> | undefined)?.message,
      error.message,
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        let msg = c.trim()
        msg = msg.replace(/^GoError:\s*/i, '').replace(/^Error:\s*/i, '')
        if (!generic.some((g) => msg.toLowerCase() === g.toLowerCase())) {
          return msg
        }
      }
    }
  }
  return fallback || 'Ocorreu um erro inesperado. Tente novamente.'
}
