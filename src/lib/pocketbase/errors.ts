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

/**
 * v0.0.105+: extrai a mensagem AMIGÁVEL que o backend (hook JSVM) colocou no
 * corpo da resposta (ex.: erro de vigência: "Já existe um plano mensal válido
 * no período ..."), removendo prefixos técnicos como "GoError: " e bloqueando
 * o genérico "Something went wrong" do PocketBase. Usar em TODO toast de erro
 * do Backoffice.
 */
export function getBackendErrorMessage(error: unknown, fallback: string): string {
  const raw =
    error instanceof ClientResponseError
      ? ((error.response as unknown as { message?: string; error?: string })?.message ??
        (error.response as unknown as { error?: string })?.error ??
        error.message)
      : error instanceof Error
        ? error.message
        : ''

  let msg = typeof raw === 'string' ? raw.trim() : ''
  if (!msg) return fallback

  // Remove prefixos técnicos do runtime Go/JSVM ("GoError: ", "Error: ").
  msg = msg
    .replace(/^GoError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()

  // Bloqueia mensagens genéricas sem informação útil para a dona.
  const generic =
    !msg ||
    /^something went wrong$/i.test(msg) ||
    /^failed to fetch$/i.test(msg) ||
    msg === fallback
  return generic ? fallback : msg
}
