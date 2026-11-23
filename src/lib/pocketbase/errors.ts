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

// ⚠️ NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER ESTA SEÇÃO ⚠️
// getBackendErrorMessage JÁ FOI APAGADA acidentalmente 8+ vezes durante builds
// (MISSING_EXPORT, v0.0.119/0.0.120/0.0.122 e novamente agora, 9ª vez —
// restaurada em v0.0.142). Este módulo é o ponto único de tradução de erros
// para o usuário. QUALQUER edição neste arquivo DEVE preservar a export
// `getBackendErrorMessage` abaixo. Origem: memória do projeto + decisão da dona.

export function getBackendErrorMessage(error: unknown, fallbackMessage?: string): string {
  const fallback =
    fallbackMessage && fallbackMessage.trim()
      ? fallbackMessage.trim()
      : 'Não foi possível concluir a operação. Tente novamente.'
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : fallback
  }
  const fromBody = error.response?.data?.message
  if (
    typeof fromBody === 'string' &&
    fromBody.trim() &&
    fromBody.trim() !== 'Something went wrong'
  ) {
    return fromBody.replace(/^GoError:\s*/i, '').trim()
  }
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) return msgs.join(' ')
  return error.message || fallback
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
