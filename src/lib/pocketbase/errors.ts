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
 * Extrai a mensagem de erro REAL do backend (message/error/data), remove
 * prefixos técnicos (GoError, etc.), bloqueia o genérico "Something went wrong"
 * do SDK e devolve sempre uma frase amigável em português.
 *
 * Usada em todo toast de erro do Backoffice (regra v0.0.104/105).
 */
export function getBackendErrorMessage(error: unknown): string {
  const BLOCKED_GENERICS = new Set([
    'something went wrong',
    'an unexpected error occurred',
    'clientresponseerror',
    'response error',
  ])

  let message = ''
  let status = 0

  const collect = (value: unknown, depth = 0): string => {
    if (depth > 4 || value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value instanceof Error) return value.message
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const order = ['message', 'error', 'detail', 'reason', 'description', 'data', 'response']
      for (const key of order) {
        if (key in obj) {
          const found = collect(obj[key], depth + 1)
          if (found) return found
        }
      }
    }
    return ''
  }

  if (error instanceof ClientResponseError) {
    status = error.status
    message = collect(error.response?.data) || collect(error.response) || error.message || ''
  } else if (error instanceof Error) {
    message = error.message
    status = (error as { status?: number }).status ?? 0
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    status = typeof obj.status === 'number' ? obj.status : 0
    message = collect(obj.data) || collect(obj) || ''
  } else if (typeof error === 'string') {
    message = error
  }

  // Remove prefixos técnicos ("GoError: ", "Error: ", etc.)
  message = message
    .replace(/^\s*(GoError|Error|FetchError|TypeError)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const isGeneric = !message || BLOCKED_GENERICS.has(message.toLowerCase())

  if (isGeneric) {
    if (status === 400) return 'Dados inválidos. Verifique os campos e tente novamente.'
    if (status === 401 || status === 403) return 'Você não tem permissão para executar esta ação.'
    if (status === 404) return 'Registro não encontrado.'
    if (status === 429) return 'Muitas tentativas. Aguarde um momento e tente novamente.'
    if (status >= 500) return 'Erro interno do servidor. Tente novamente em instantes.'
    return 'Não foi possível concluir a operação. Tente novamente.'
  }

  return message
}
