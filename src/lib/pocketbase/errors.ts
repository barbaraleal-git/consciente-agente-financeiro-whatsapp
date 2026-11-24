// ⚠️ NOTA ESTRUTURAL PERMANENTE — LEIA ANTES DE EDITAR ESTE ARQUIVO ⚠️
//
// `getBackendErrorMessage` JÁ SUMIU DESTE ARQUIVO 13 VEZES (v0.0.105 → v0.0.159)
// — sempre que o arquivo é tocado, a exportação some e o build quebra com
// MISSING_EXPORT em BillingAdminSection.tsx / ClientSubscriptionDetailsDialog.tsx
// / Settings.tsx. NÃO REMOVER NUNCA. Consumidores (todos importam daqui):
//   - src/components/admin/BillingAdminSection.tsx (4 chamadas com fallback PT)
//   - src/components/admin/ClientSubscriptionDetailsDialog.tsx
//   - src/pages/Settings.tsx (toast da foto de perfil do WhatsApp)
//
// Comportamento esperado (nunca mudar a assinatura):
//   getBackendErrorMessage(error: unknown, fallback?: string): string
//   - extrai a mensagem REAL do corpo (message / error / data),
//   - remove prefixos da JSVM ("GoError: ...", "Error: ..."),
//   - bloqueia o genérico "Something went wrong" do SDK,
//   - devolve `fallback` (PT) quando nada útil for extraído.

export interface FieldErrors {
  [field: string]: { message?: string; code?: string }
}

export function extractFieldErrors(error: unknown): FieldErrors {
  const out: FieldErrors = {}
  if (error && typeof error === 'object') {
    const anyErr = error as { response?: { data?: Record<string, unknown> } }
    const data = anyErr?.response?.data
    if (data && typeof data === 'object') {
      for (const [field, value] of Object.entries(data)) {
        if (value && typeof value === 'object') {
          const v = value as { message?: string; code?: string }
          out[field] = { message: v.message, code: v.code }
        }
      }
    }
  }
  return out
}

/**
 * Extrai a mensagem real de erro do backend (pt-BR) a partir de uma exceção do
 * SDK PocketBase ou de qualquer objeto com message/error/data. Remove prefixos
 * da JSVM ("GoError: ..."), bloqueia o genérico "Something went wrong" do SDK e
 * devolve o fallback em português quando nada útil é extraído.
 *
 * ⚠️ 13ª ressurgência — NUNCA remover (ver nota no topo do arquivo).
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const DEFAULT_FALLBACK = 'Ocorreu um erro inesperado. Tente novamente.'
  const GENERIC_PATTERNS = ['something went wrong']

  let raw = ''

  if (error && typeof error === 'object') {
    const anyErr = error as {
      message?: unknown
      response?: { message?: unknown; error?: unknown; data?: unknown }
    }
    const candidates: unknown[] = [
      anyErr?.response?.message,
      anyErr?.response?.error,
      anyErr?.response?.data,
      anyErr?.message,
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        raw = c.trim()
        break
      }
    }
  } else if (typeof error === 'string' && error.trim()) {
    raw = error.trim()
  }

  if (!raw) return fallback || DEFAULT_FALLBACK

  let msg = raw
  msg = msg.replace(/^GoError:\s*/i, '')
  msg = msg.replace(/^Error:\s*/i, '')

  const lower = msg.toLowerCase()
  if (GENERIC_PATTERNS.some((p) => lower.includes(p))) {
    return fallback || DEFAULT_FALLBACK
  }

  return msg || fallback || DEFAULT_FALLBACK
}
