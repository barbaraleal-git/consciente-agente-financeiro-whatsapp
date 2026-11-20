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

// NOTA ESTRUTURAL (3 incidentes registrados): getBackendErrorMessage é exportada
// OBRIGATORIAMENTE deste arquivo — não remover, não renomear, não mudar a aridade
// (error, fallback?). Consumidores: BillingAdminSection, ClientSubscriptionDetailsDialog
// e Settings (foto de perfil). Ver getBackendErrorMessage abaixo.

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}

/**
 * Extrai a mensagem de erro amigável de uma ClientResponseError do PocketBase,
 * retornando a mensagem real do corpo (sem GoError, sem genéricos em inglês).
 * Aridade (error, fallback?) — convenção do projeto, obrigatória para o build.
 *
 * Estrutural: única fonte da função no projeto (getBackendErrorMessage),
 * aridade fixa e fallback sempre PT — evita que edições futuras do arquivo
 * derrubem a exportação novamente (3º incidente registrado).
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const FALLBACK_PADRAO = 'Não foi possível concluir a operação. Tente novamente.'
  let mensagem = ''
  if (error instanceof ClientResponseError) {
    const data = error.response?.data as Record<string, unknown> | undefined
    const corpo =
      data && typeof data === 'object'
        ? (data.error as string) ||
          (data.message as string) ||
          (typeof data.data === 'string' ? (data.data as string) : '') ||
          ''
        : ''
    let bruta = corpo || error.message || ''
    // Remove prefixos técnicos (GoError wrapping do PocketBase/JSVM)
    bruta = bruta.replace(/^.*?GoError:\s*/, '')
    // Mensagens genéricas em inglês são bloqueadas — preferimos o fallback PT
    const genericas = [
      'something went wrong',
      'an unexpected error occurred',
      'failed to fetch',
      'network error',
      'internal server error',
    ]
    const baixa = bruta.toLowerCase()
    if (!bruta || genericas.some((g) => baixa.includes(g))) {
      bruta = ''
    }
    mensagem = bruta
  } else if (error instanceof Error) {
    mensagem = error.message
  }
  return mensagem || fallback || FALLBACK_PADRAO
}
