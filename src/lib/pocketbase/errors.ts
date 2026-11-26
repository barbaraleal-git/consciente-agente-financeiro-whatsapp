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

export function getBackendErrorMessage(
  error: unknown,
  fallback = 'Algo deu errado. Tente novamente em instantes.',
): string {
  // Padrão restaurado da v0.0.140: extrai a mensagem real do corpo da resposta
  // (message / error / data), remove prefixos técnicos de GoError/Error e
  // bloqueia a mensagem genérica "Something went wrong", que não explica nada
  // para a dona nem para o cliente.
  const generic = ['something went wrong', 'goerror', 'error:']
  let raw = ''
  if (error instanceof ClientResponseError) {
    const resp = error.response as Record<string, unknown> | undefined
    if (resp && typeof resp === 'object') {
      const m = resp.message
      const e = resp.error
      const d = resp.data
      if (typeof m === 'string' && m.trim()) raw = m
      else if (typeof e === 'string' && e.trim()) raw = e
      else if (d && typeof d === 'object' && 'message' in d) {
        const dm = (d as { message?: unknown }).message
        if (typeof dm === 'string' && dm.trim()) raw = dm
      }
    }
    if (!raw && error.message) raw = error.message
  } else if (error instanceof Error) {
    raw = error.message
  } else if (typeof error === 'string' && error.trim()) {
    raw = error
  }
  let msg = String(raw || '').trim()
  for (const g of generic) {
    if (msg.toLowerCase().indexOf(g) === 0) {
      msg = ''
      break
    }
  }
  return msg || fallback
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
