import type { Budget, Category, CategoryCaixinhaLink, Transaction } from '@/services/finance'

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
  userLinks?: CategoryCaixinhaLink[],
): boolean {
  // Apenas transações ativas contam para os totais
  const status = t.status || 'active'
  if (status !== 'active') return false
  if (t.type !== 'despesa') return false
  if (b.month && !t.date.startsWith(b.month)) return false

  // Se houver vínculos explícitos configurados pelo cliente:
  const activeLinks = (userLinks || []).filter((l) => l.active)
  if (activeLinks.length > 0) {
    // Vínculos da caixinha específica avaliada
    const budgetSpecificLinks = activeLinks.filter((l) => l.budget === b.id)

    // Se esta caixinha possui vínculos explícitos configurados:
    if (budgetSpecificLinks.length > 0) {
      const txCat = categories.find((c) => c.id === t.category)
      const txCatNameNorm = txCat ? normalizeText(txCat.name) : ''
      const noteNorm = normalizeText(t.note)

      for (const link of budgetSpecificLinks) {
        const linkCatNameNorm = normalizeText(link.category_name)
        if (!linkCatNameNorm) continue

        // 1. Match por ID de categoria se informado
        if (link.category_id && t.category === link.category_id) {
          return true
        }

        // 2. Match pelo nome da categoria da transação
        if (
          txCatNameNorm &&
          (txCatNameNorm === linkCatNameNorm ||
            txCatNameNorm.includes(linkCatNameNorm) ||
            linkCatNameNorm.includes(txCatNameNorm))
        ) {
          return true
        }

        // 3. Match pelo note/observação da transação (ex: "Alimentação Essencial")
        if (noteNorm && (noteNorm === linkCatNameNorm || noteNorm.includes(linkCatNameNorm))) {
          return true
        }
      }

      // Se a caixinha tem vínculos explícitos mas nenhum casou, também verificamos se coincide diretamente
      // com a categoria base da própria caixinha (ex: t.category === b.category)
      if (t.category === b.category) {
        return true
      }

      return false
    }
  }

  // --- COMPORTAMENTO PADRÃO / FALLBACK (Zero Regressão para clientes sem vínculos) ---
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
 * Retorna o valor total gasto em um budget/caixinha considerando a lógica unificada e parametrização.
 */
export function getBudgetSpent(
  b: Budget,
  transactions: Transaction[],
  categories: Category[],
  allBudgets?: Budget[],
  userLinks?: CategoryCaixinhaLink[],
): number {
  return transactions
    .filter((t) => isTransactionInBudget(t, b, categories, allBudgets, userLinks))
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Retorna todas as caixinhas vinculadas a uma transação (quando uma transação alimenta mais de uma caixinha).
 */
export function getMatchedBudgetsForTransaction(
  t: Transaction,
  budgets: Budget[],
  categories: Category[],
  userLinks?: CategoryCaixinhaLink[],
): Budget[] {
  return budgets.filter((b) => isTransactionInBudget(t, b, categories, budgets, userLinks))
}

/**
 * Retorna a categoria ou caixinha efetiva a ser exibida para a transação na listagem.
 */
export function getEffectiveCategory(
  t: Transaction,
  categories: Category[],
  budgets: Budget[],
  userLinks?: CategoryCaixinhaLink[],
): {
  id: string
  name: string
  color: string
  icon: string
  isCaixinha: boolean
  badge?: string
  matchedCaixinhasNames?: string[]
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

  // Busca todas as caixinhas que dão match com esta transação
  const matchedBudgets = getMatchedBudgetsForTransaction(t, budgets, categories, userLinks)
  const matchedCaixinhasNames: string[] = []

  matchedBudgets.forEach((b) => {
    const cat = categories.find((c) => c.id === b.category)
    if (cat?.name) {
      matchedCaixinhasNames.push(cat.name)
    }
  })

  if (matchedBudgets.length > 0) {
    const primaryBudget = matchedBudgets[0]
    const budgetCat = categories.find((c) => c.id === primaryBudget.category)
    if (budgetCat) {
      return {
        id: budgetCat.id,
        name: budgetCat.name,
        color: budgetCat.color || directCat?.color || '#ec4899',
        icon: budgetCat.icon || directCat?.icon || 'pet-cat',
        isCaixinha: true,
        badge,
        matchedCaixinhasNames,
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
    matchedCaixinhasNames: [],
  }
}
