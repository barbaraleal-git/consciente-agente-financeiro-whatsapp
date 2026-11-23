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

/* ==========================================================================
   NOTA ESTRUTURAL PERMANENTE — NÃO REMOVER getBackendErrorMessage.

   Esta função JÁ SUMIU 10 VEZES do projeto em builds anteriores
   (MISSING_EXPORT) e precisa ser restaurada manualmente toda vez.
   Última restauração: v0.0.146 (logo via bundler imports).
   Ela é usada por Settings.tsx, BillingAdminSection.tsx e
   ClientSubscriptionDetailsDialog.tsx com a assinatura abaixo.

   REGRA: qualquer edição deste arquivo DEVE preservar getBackendErrorMessage.
   Qualquer QA deste projeto deve começar verificando que ela existe aqui.
   ========================================================================== */

/**
 * Extrai a mensagem de erro REAL do corpo de uma ClientResponseError,
 * removendo prefixos de GoError quando presentes e bloqueando mensagens
 * genéricas ('Something went wrong' etc.) em favor do fallback.
 */
export function getBackendErrorMessage(error: unknown, fallback?: string): string {
  const safeFallback = fallback || 'Ocorreu um erro inesperado. Tente novamente.'
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error && error.message ? error.message : safeFallback
  }

  // 1) Mensagem de topo do corpo da resposta, se existir e não for genérica.
  const topMsg = (error.response as { message?: string } | undefined)?.message
  // 2) field errors agregados.
  const fieldMsgs = Object.values(extractFieldErrors(error))
  const joined = fieldMsgs.length > 0 ? fieldMsgs.join(' ') : ''
  // 3) mensagens embutidas em text/data do response.
  const rawText =
    typeof (error.response as { text?: string } | undefined)?.text === 'string'
      ? (error.response as { text?: string }).text!
      : ''

  const candidates = [topMsg, joined, rawText, error.message]
  const genericRe =
    /^(something went wrong|an unexpected error occurred|failed to fetch|network error|request failed)$/i

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() && !genericRe.test(candidate.trim())) {
      // Remove prefixos de GoError ("GoError: ..."), quando presentes.
      return candidate.trim().replace(/^GoError:\s*/i, '')
    }
  }
  return safeFallback
}
