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

// v0.0.117: extrai a mensagem REAL do corpo da resposta (message/error/data),
// sem prefixo GoError e bloqueando o genérico "Something went wrong" do SDK.
// Assinatura (error, fallback?) — padrão v0.0.106/v0.0.115 do projeto; era
// pendência de build recorrente (MISSING_EXPORT) e volta a ser obrigatória.
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const FALLBACK = fallback || 'Não foi possível concluir a operação. Tente novamente.'
  const block = (m: unknown): m is string =>
    typeof m === 'string' && m.trim() !== '' && !/^something went wrong/i.test(m.trim())
  const stripGo = (m: string): string => m.replace(/^GoError:\s*/i, '').trim()
  if (error instanceof ClientResponseError) {
    const data = error.response as Record<string, unknown> | undefined
    const candidates = [
      data?.message,
      data?.error,
      (data?.data as Record<string, unknown>)?.message,
    ]
    for (const c of candidates) {
      if (block(c)) return stripGo(c)
    }
  } else if (typeof error === 'string' && block(error)) {
    return stripGo(error)
  } else if (error instanceof Error && block(error.message)) {
    return stripGo(error.message)
  }
  return FALLBACK
}
