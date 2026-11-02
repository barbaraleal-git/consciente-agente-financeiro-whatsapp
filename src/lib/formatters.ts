// Currency and Date helpers (pt-BR)

/**
 * Format cents into BRL string: e.g. 12500 -> "R$ 125,00"
 */
export function formatCurrency(cents: number): string {
  const value = (cents || 0) / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Parses a currency input string (e.g. "R$ 1.250,50" or "1250,50") into cents integer
 */
export function parseCurrencyToCents(val: string | number): number {
  if (typeof val === 'number') return Math.round(val)
  if (!val) return 0
  const clean = val.replace(/[^\d]/g, '')
  if (!clean) return 0
  return parseInt(clean, 10)
}

/**
 * Format a raw input string to mask as BRL currency during typing
 */
export function maskCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const numberVal = parseInt(digits, 10) / 100
  return numberVal.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formats ISO date 'YYYY-MM-DD' or full string to 'DD/MM/YYYY'
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.slice(0, 10).split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR')
  } catch {
    return dateStr
  }
}

/**
 * Returns current month string in 'YYYY-MM' format
 */
export function getCurrentMonthStr(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Formats 'YYYY-MM' to 'Mês de AAAA' (e.g. 'Outubro de 2026')
 */
export function formatMonthName(monthStr: string): string {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' })
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`
}

/**
 * Formats ISO timestamp to 'DD/MM/YYYY HH:mm'
 */
export function formatDateTime(isoString?: string): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

/**
 * Retorna rótulo legível e amigável da origem do lançamento
 */
export function getSourceLabel(source?: string): string {
  switch (source) {
    case 'whatsapp_text':
      return 'Texto WhatsApp'
    case 'whatsapp_audio':
      return 'Áudio WhatsApp'
    case 'whatsapp':
      return 'WhatsApp'
    case 'manual':
      return 'Manual'
    case 'import':
      return 'Importação'
    case 'agent':
      return 'Agente Web'
    default:
      return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Manual'
  }
}
