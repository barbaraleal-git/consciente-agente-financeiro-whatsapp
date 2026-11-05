import { Transaction, Budget, Category, CategoryCaixinhaLink } from '@/services/finance'

/**
 * Normaliza strings para comparação flexível (remove acentos, pontuação e caixa alta)
 */
export function normalizeText(str?: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Encontra as caixinhas candidatas vinculadas a uma categoria (ou nome de categoria)
 * para um determinado conjunto de vínculos e caixinhas.
 */
export function getCandidateBudgetsForCategory(
  categoryId: string,
  categoryName: string,
  budgets: Budget[],
  userLinks?: CategoryCaixinhaLink[],
): Budget[] {
  const activeLinks = (userLinks || []).filter((l) => l.active)
  if (activeLinks.length === 0) return []

  const catNameNorm = normalizeText(categoryName)
  const candidateBudgetIds = new Set<string>()

  for (const lk of activeLinks) {
    const lkNameNorm = normalizeText(lk.category_name)
    let isMatch = false

    if (lk.category_id && categoryId && lk.category_id === categoryId) {
      isMatch = true
    } else if (
      catNameNorm &&
      lkNameNorm &&
      (catNameNorm === lkNameNorm ||
        catNameNorm.includes(lkNameNorm) ||
        lkNameNorm.includes(catNameNorm))
    ) {
      isMatch = true
    }

    if (isMatch) {
      candidateBudgetIds.add(lk.budget)
    }
  }

  return budgets.filter((b) => candidateBudgetIds.has(b.id))
}

/**
 * Resolve a caixinha única associada a uma transação (REGRA OFICIAL: ZERO DUPLICAÇÃO).
 * Cada lançamento pertence a UMA e apenas UMA caixinha.
 *
 * Prioridade:
 * 1. Campo explícito t.budget (atribuído na escolha da/o cliente ou no modal)
 * 2. Se há vínculos explícitos configurados:
 *    - Se os vínculos apontam para UMA ÚNICA caixinha candidata: atribui a essa caixinha
 *    - Se os vínculos apontam para MAIS DE UMA caixinha candidata (histórico antigo sem t.budget):
 *      desempata pelo note/descrição da transação (ex.: menção a "VA" vs "VR") ou pela primeira candidata estável
 * 3. Fallback sem vínculos:
 *    - Se casa diretamente com b.category (t.category === b.category)
 *    - Se casa por sufixo ou nome no note (ex.: "Alimentação - VA" vs "Alimentação - VR")
 *    - Se casa por nome de categoria
 * Em caso de múltiplos matches no fallback, escolhe o mais específico (ex.: match por sufixo/note > match genérico).
 */
export function resolveTransactionBudget(
  t: Transaction,
  budgets: Budget[],
  categories: Category[],
  userLinks?: CategoryCaixinhaLink[],
): Budget | null {
  const status = t.status || 'active'
  if (status !== 'active') return null
  if (t.type !== 'despesa') return null

  // Filtra budgets do mesmo mês se a transação e o budget tiverem mês definido
  const monthBudgets = budgets.filter((b) => !b.month || t.date.startsWith(b.month))
  if (monthBudgets.length === 0) return null

  // 1. Se a transação já tem a caixinha efetiva explícita (campo t.budget)
  if (t.budget) {
    const directBudget = monthBudgets.find((b) => b.id === t.budget)
    if (directBudget) return directBudget
    // Se o ID não estiver no mês filtrado, tenta em todos
    const anyMonthBudget = budgets.find((b) => b.id === t.budget)
    if (anyMonthBudget) return anyMonthBudget
  }

  const txCat = categories.find((c) => c.id === t.category)
  const txCatNameNorm = txCat ? normalizeText(txCat.name) : ''
  const noteNorm = normalizeText(t.note)
  const descNorm = normalizeText(t.description)
  const combinedText = `${noteNorm} ${descNorm}`.trim()

  const activeLinks = (userLinks || []).filter((l) => l.active)

  // 2. Se houver vínculos explícitos configurados
  if (activeLinks.length > 0) {
    const candidates = getCandidateBudgetsForCategory(
      t.category,
      txCat?.name || '',
      monthBudgets,
      userLinks,
    )

    if (candidates.length === 1) {
      // Exatamente uma caixinha vinculada -> atribui direto!
      return candidates[0]
    }

    if (candidates.length > 1) {
      // Várias candidatas no histórico (sem t.budget gravado anteriormente):
      // Desempata pelo texto da transação (note / descrição) procurando correspondência com o nome da caixinha ou sufixo
      for (const cand of candidates) {
        const candName = cand.name || categories.find((c) => c.id === cand.category)?.name || ''
        if (!candName) continue
        const candNameNorm = normalizeText(candName)

        if (candNameNorm && combinedText.includes(candNameNorm)) {
          return cand
        }

        const parts = candName.split('-').map((p) => normalizeText(p))
        if (parts.length > 1) {
          const suffix = parts[parts.length - 1]
          if (suffix && suffix.length >= 2) {
            const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
            if (regex.test(combinedText)) {
              return cand
            }
          }
        }
      }

      // Se não desempata por texto, atribui estavelmente à primeira candidata para JAMAIS duplicar
      return candidates[0]
    }
  }

  // 3. Fallback sem vínculos (ou categoria não vinculada):
  // Avalia todas as caixinhas candidatas do mês e pontua o match mais específico
  let bestBudget: Budget | null = null
  let bestScore = 0

  for (const b of monthBudgets) {
    let score = 0
    const bName = b.name || categories.find((c) => c.id === b.category)?.name || ''
    const bNameNorm = normalizeText(bName)

    // Match de sufixo no note/descrição (ex.: "VA" ou "VR")
    if (bName) {
      const parts = bName.split('-').map((p) => normalizeText(p))
      if (parts.length > 1) {
        const suffix = parts[parts.length - 1]
        if (suffix && suffix.length >= 2) {
          const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
          if (regex.test(combinedText)) {
            score = Math.max(score, 80)
          }
        }
      }

      // Match do nome completo da caixinha contido no note/descrição
      if (bNameNorm && combinedText.includes(bNameNorm)) {
        score = Math.max(score, 70)
      }

      // Match de hierarquia ou contenção entre nome da caixinha e nome da categoria do lançamento
      if (txCatNameNorm && bNameNorm) {
        if (bNameNorm.includes(txCatNameNorm) || txCatNameNorm.includes(bNameNorm)) {
          score = Math.max(score, 50)
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestBudget = b
    }
  }

  return bestBudget
}

/**
 * Retorna se uma transação pertence a um budget específico.
 * REGRA VITAL: Cada transação soma em UMA ÚNICA caixinha, nunca em mais de uma.
 */
export function isTransactionInBudget(
  t: Transaction,
  b: Budget,
  categories: Category[],
  allBudgets?: Budget[],
  userLinks?: CategoryCaixinhaLink[],
): boolean {
  const status = t.status || 'active'
  if (status !== 'active') return false
  if (t.type !== 'despesa') return false
  if (b.month && !t.date.startsWith(b.month)) return false

  const listBudgets = allBudgets && allBudgets.length > 0 ? allBudgets : [b]
  const resolved = resolveTransactionBudget(t, listBudgets, categories, userLinks)
  return resolved?.id === b.id
}

/**
 * Retorna o valor total gasto em um budget/caixinha considerando a regra de caixinha única.
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
 * Retorna todas as caixinhas associadas a uma transação (garante no máximo uma caixinha efetiva).
 */
export function getMatchedBudgetsForTransaction(
  t: Transaction,
  budgets: Budget[],
  categories: Category[],
  userLinks?: CategoryCaixinhaLink[],
): Budget[] {
  const resolved = resolveTransactionBudget(t, budgets, categories, userLinks)
  return resolved ? [resolved] : []
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

  // Resolve a caixinha única vinculada
  const resolvedBudget = resolveTransactionBudget(t, budgets, categories, userLinks)

  if (resolvedBudget) {
    const bName =
      resolvedBudget.name ||
      categories.find((c) => c.id === resolvedBudget.category)?.name ||
      'Caixinha'
    const bColor = resolvedBudget.color || directCat?.color || '#ec4899'
    const bIcon = resolvedBudget.icon || directCat?.icon || 'pet-cat'
    return {
      id: resolvedBudget.id,
      name: bName,
      color: bColor,
      icon: bIcon,
      isCaixinha: true,
      badge,
      matchedCaixinhasNames: [bName],
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
