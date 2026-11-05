import type { Budget, Category, Transaction } from '@/services/finance'

/**
 * Normaliza string para comparação sem acentos, pontuação ou caixa alta.
 */
export function normalizeText(val?: string | null): string {
  if (!val) return ''
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Verifica se uma transação pertence a uma determinada caixinha (budget).
 * Critérios unificados:
 * 1. Status ativo: apenas lançamentos ativos contam (cancelados/excluídos são ignorados).
 * 2. Tipo despesa: t.type === 'despesa'
 * 3. Mês coincide: se o budget possui mês definido (YYYY-MM), t.date deve iniciar com esse mês.
 * 4. Vínculo:
 *    a) Direto: t.category === b.category
 *    b) Note / Observação: o campo note menciona o nome da categoria da caixinha (ex: "Alimentação - VA")
 *       ou sufixo/código característico (ex: "VA", "VR", "Crédito").
 *    c) Nome da categoria da transação faz menção à caixinha, ou vice-versa.
 */
export function isTransactionInBudget(
  t: Transaction,
  b: Budget,
  categories: Category[],
  allBudgets?: Budget[],
): boolean {
  // Apenas transações ativas contam para os totais
  const status = t.status || 'active'
  if (status !== 'active') return false
  if (t.type !== 'despesa') return false
  if (b.month && !t.date.startsWith(b.month)) return false

  // 1. Vínculo direto por ID de categoria
  if (t.category === b.category) return true

  const budgetCat = categories.find((c) => c.id === b.category)
  if (!budgetCat) return false

  const budgetCatNameNorm = normalizeText(budgetCat.name)
  const noteNorm = normalizeText(t.note)

  // 2. Vínculo pelo campo note (ex: "Alimentação - VA | Essencial" vincula à caixinha "Alimentação - VA")
  if (noteNorm) {
    // Match do nome completo da caixinha contido no note
    if (budgetCatNameNorm && noteNorm.includes(budgetCatNameNorm)) {
      return true
    }

    // Match de sufixo característico (ex: "VA" ou "VR" após hífen em "Alimentação - VA")
    const parts = budgetCat.name.split('-').map((p) => normalizeText(p))
    if (parts.length > 1) {
      const suffix = parts[parts.length - 1]
      if (suffix && suffix.length >= 2) {
        const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
        if (regex.test(noteNorm)) {
          return true
        }
      }
    }
  }

  // 3. Vínculo por hierarquia ou nome de categoria da transação
  const txCat = categories.find((c) => c.id === t.category)
  if (txCat) {
    const txCatNameNorm = normalizeText(txCat.name)

    // Se a categoria da transação contém o nome da caixinha
    if (budgetCatNameNorm && txCatNameNorm.includes(budgetCatNameNorm)) {
      return true
    }

    // Se o nome da caixinha contém o nome da categoria da transação
    if (txCatNameNorm && budgetCatNameNorm.includes(txCatNameNorm)) {
      return true
    }
  }

  return false
}

/**
 * Retorna o valor total gasto em um budget/caixinha considerando a lógica unificada.
 */
export function getBudgetSpent(
  b: Budget,
  transactions: Transaction[],
  categories: Category[],
  allBudgets?: Budget[],
): number {
  return transactions
    .filter((t) => isTransactionInBudget(t, b, categories, allBudgets))
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Retorna a categoria ou caixinha efetiva a ser exibida para a transação na listagem.
 */
export function getEffectiveCategory(
  t: Transaction,
  categories: Category[],
  budgets: Budget[],
): {
  id: string
  name: string
  color: string
  icon: string
  isCaixinha: boolean
  badge?: string
} {
  const directCat = categories.find((c) => c.id === t.category)

  // Identifica badge de sub-classificação se houver no note ou categoria
  let badge: string | undefined
  const noteText = t.note || ''
  if (/não\s+essencial|nao\s+essencial/i.test(noteText)) {
    badge = 'Não Essencial'
  } else if (/essencial/i.test(noteText)) {
    badge = 'Essencial'
  } else if (directCat) {
    if (/não\s+essencial|nao\s+essencial/i.test(directCat.name)) {
      badge = 'Não Essencial'
    } else if (/essencial/i.test(directCat.name)) {
      badge = 'Essencial'
    }
  }

  // Busca se há um budget/caixinha que dá match com esta transação
  const matchedBudget = budgets.find((b) => isTransactionInBudget(t, b, categories, budgets))
  if (matchedBudget) {
    const budgetCat = categories.find((c) => c.id === matchedBudget.category)
    if (budgetCat) {
      return {
        id: budgetCat.id,
        name: budgetCat.name,
        color: budgetCat.color || directCat?.color || '#ec4899',
        icon: budgetCat.icon || directCat?.icon || 'pet-cat',
        isCaixinha: true,
        badge,
      }
    }
  }

  return {
    id: directCat?.id || t.category,
    name: directCat?.name || 'Geral',
    color: directCat?.color || '#64748b',
    icon: directCat?.icon || 'pet-cat',
    isCaixinha: false,
    badge,
  }
}
