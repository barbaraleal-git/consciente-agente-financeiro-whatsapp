/// <reference path="../pb_data/types.d.ts" />

/**
 * Helper compartilhado para montagem do Resumo Visual Padronizado das Caixinhas no WhatsApp.
 * Utilizado toda vez que o cliente solicita visão geral/resumo das suas caixinhas,
 * garantindo layout idêntico, barras de blocos proporcionais, percentuais, alertas e totais.
 */

const CAIXINHA_EMOJI_FALLBACKS = {
  'pet-cat': '🐱',
  'pet-dog': '🐶',
  'pet-paw': '🐾',
  'pet-bear': '🐻',
  'pet-panda': '🐼',
  'pet-koala': '🐨',
  'pet-lion': '🦁',
  'pet-rabbit': '🐰',
  'pet-fox': '🦊',
  'pet-hamster': '🐹',
  'pet-tiger': '🐯',
  'pet-penguin': '🐧',
  'pet-duck': '🦆',
  'pet-owl': '🦉',
  'pet-monkey': '🐵',
  'pet-dolphin': '🐬',
  'pet-butterfly': '🦋',
  'pet-bee': '🐝',
  plane: '✈️',
  palmtree: '🌴',
  gift: '🎁',
  gem: '💎',
  heart: '❤️',
  car: '🚗',
  home: '🏠',
  utensils: '🍽️',
  coffee: '☕',
  'shopping-bag': '🛍️',
  gamepad: '🎮',
  gamepad2: '🎮',
  film: '🎬',
  'heart-pulse': '🏥',
  'graduation-cap': '🎓',
  book: '📚',
  banknote: '💵',
  'trending-up': '📈',
  'piggy-bank': '🐷',
  'shield-check': '🛡️',
  sparkles: '✨',
  smile: '😊',
  ellipsis: '📦',
}

function resolveCaixinhaEmoji(iconId, categoryName) {
  if (!iconId && !categoryName) return '📦'
  const idStr = String(iconId || '').trim()
  if (idStr.startsWith('emoji:')) {
    return idStr.slice(6) || '📦'
  }
  if (CAIXINHA_EMOJI_FALLBACKS[idStr]) {
    return CAIXINHA_EMOJI_FALLBACKS[idStr]
  }

  // Se for caractere emoji direto
  if (/\p{Extended_Pictographic}/u.test(idStr)) {
    return idStr
  }

  // Inferência pelo nome da categoria se não achar ícone
  const nameLow = String(categoryName || '').toLowerCase()
  if (nameLow.includes('aliment') || nameLow.includes('restaurante') || nameLow.includes('refei'))
    return '🍽️'
  if (nameLow.includes('mercad') || nameLow.includes('feira')) return '🛒'
  if (
    nameLow.includes('transp') ||
    nameLow.includes('uber') ||
    nameLow.includes('carro') ||
    nameLow.includes('combust')
  )
    return '🚗'
  if (
    nameLow.includes('morad') ||
    nameLow.includes('casa') ||
    nameLow.includes('aluguel') ||
    nameLow.includes('reform')
  )
    return '🏠'
  if (
    nameLow.includes('saúde') ||
    nameLow.includes('saude') ||
    nameLow.includes('farm') ||
    nameLow.includes('médic')
  )
    return '🏥'
  if (
    nameLow.includes('lazer') ||
    nameLow.includes('viagem') ||
    nameLow.includes('passeio') ||
    nameLow.includes('férias')
  )
    return '🌴'
  if (nameLow.includes('estud') || nameLow.includes('educa') || nameLow.includes('curso'))
    return '📚'
  if (nameLow.includes('roupa') || nameLow.includes('compra')) return '🛍️'
  if (
    nameLow.includes('pet') ||
    nameLow.includes('bicho') ||
    nameLow.includes('gato') ||
    nameLow.includes('cachorr')
  )
    return '🐾'
  if (nameLow.includes('reserva') || nameLow.includes('emergên')) return '🐷'
  if (nameLow.includes('present') || nameLow.includes('anivers')) return '🎁'

  return '📦'
}

function formatCentsToBrl(cents) {
  const val = Number(cents || 0) / 100
  const isNeg = val < 0
  const abs = Math.abs(val)
  const fixed = abs.toFixed(2)
  const parts = fixed.split('.')
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimalPart = parts[1]
  return (isNeg ? '-' : '') + 'R$ ' + integerPart + ',' + decimalPart
}

function makeProgressBar(percent, totalBlocks = 10) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const filledCount = Math.min(totalBlocks, Math.round((clamped / 100) * totalBlocks))
  const emptyCount = Math.max(0, totalBlocks - filledCount)
  let bar = ''
  for (let i = 0; i < filledCount; i++) bar += '▓'
  for (let j = 0; j < emptyCount; j++) bar += '░'
  return bar
}

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Detecta se uma mensagem de usuário expressa intenção de ver a visão geral/resumo das caixinhas.
 */
function isCaixinhasOverviewIntent(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // Se for lançamento com valor monetário explícito (ex.: "almoço 35", "uber 20 reais"), não é overview
  if (
    /\d+([.,]\d{1,2})?\s*(reais|real|conto|pila)?\b/.test(t) &&
    !t.includes('caixinha') &&
    !t.includes('orcamento')
  ) {
    // Pode ter número no meio de pergunta tipo "resumo das minhas caixinhas"?
    if (
      !t.includes('minhas caixinhas') &&
      !t.includes('todas as caixinhas') &&
      !t.includes('resumo')
    ) {
      return false
    }
  }

  // Padrões diretos de consulta de caixinhas
  const patterns = [
    /quais\s+(sao\s+)?(as\s+)?minhas\s+caixinhas/,
    /minhas\s+caixinhas/,
    /ver\s+caixinhas/,
    /ver\s+minhas\s+caixinhas/,
    /resumo\s+d(as|e)\s+caixinhas/,
    /resumo\s+das\s+minhas\s+caixinhas/,
    /como\s+estao\s+(as\s+)?(minhas\s+)?caixinhas/,
    /status\s+d(as|e)\s+caixinhas/,
    /visao\s+geral\s+d(as|e)\s+caixinhas/,
    /visao\s+geral/,
    /saldo\s+d(as|e)\s+caixinhas/,
    /quanto\s+(ja\s+)?gastei\s+n(as|a)\s+caixinha/,
    /quanto\s+resta\s+n(as|a)\s+caixinha/,
    /listar\s+(as\s+)?caixinhas/,
    /lista\s+d(as|e)\s+caixinhas/,
    /meus\s+orcamentos/,
    /resumo\s+dos\s+orcamentos/,
    /mostrar\s+caixinhas/,
    /todas\s+as\s+caixinhas/,
  ]

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(t)) return true
  }

  // Caso curto: apenas "caixinhas" ou "caixinha"
  if (t === 'caixinhas' || t === 'caixinha' || t === 'orcamentos') return true

  return false
}

/**
 * Constrói o Resumo Visual Padronizado das Caixinhas para um usuário específico no mês corrente (ou informado).
 * Retorna string formatada para o WhatsApp com cabeçalho, barras de blocos ▓░, alertas e resumo de totais.
 */
function buildCaixinhasSummaryForUser(app, userId, targetMonthStr) {
  if (!app || !userId) return null

  const now = new Date()
  const monthStr = targetMonthStr || now.toISOString().slice(0, 7) // 'YYYY-MM'
  const monthNumber = parseInt(monthStr.slice(5, 7), 10) - 1
  const monthName = MONTH_NAMES_PT[monthNumber] || 'Mês'

  // 1. Busca todas as categorias do usuário (somente despesas)
  let categories = []
  try {
    categories = app.findRecordsByFilter(
      'categories',
      `user = '${userId}' && type = 'despesa'`,
      'name',
      100,
      0,
    )
  } catch (cErr) {
    console.log('[caixinhas_summary] Erro ao carregar categorias:', cErr)
  }

  // 2. Busca orçamentos (budgets) ativos do mês para o usuário
  let budgets = []
  try {
    budgets = app.findRecordsByFilter(
      'budgets',
      `user = '${userId}' && month = '${monthStr}'`,
      '-created',
      100,
      0,
    )
  } catch (bErr) {
    console.log('[caixinhas_summary] Erro ao carregar budgets:', bErr)
  }

  // Se não tiver budget no mês atual, busca os budgets mais recentes do usuário para reaproveitar os tetos definidos
  if (budgets.length === 0) {
    try {
      budgets = app.findRecordsByFilter('budgets', `user = '${userId}'`, '-month,-created', 100, 0)
    } catch (_) {}
  }

  const budgetByCategoryId = {}
  for (let b = 0; b < budgets.length; b++) {
    const bg = budgets[b]
    const catId = bg.getString('category')
    if (catId && !budgetByCategoryId[catId]) {
      budgetByCategoryId[catId] = bg.getInt('amount') || 0
    }
  }

  // 3. Busca transações do mês corrente (tipo 'despesa') do usuário — APENAS ATIVAS
  const startOfMonth = `${monthStr}-01`
  const endOfMonth = `${monthStr}-31`
  let transactions = []
  try {
    transactions = app.findRecordsByFilter(
      'transactions',
      `user = '${userId}' && type = 'despesa' && date >= '${startOfMonth}' && date <= '${endOfMonth}' && (status = 'active' || status = '')`,
      'date',
      1000,
      0,
    )
  } catch (tErr) {
    console.log('[caixinhas_summary] Erro ao carregar transações:', tErr)
  }

  // Mapa de nomes/palavras das caixinhas/categorias para matching flexível
  const categoryById = {}
  for (let c = 0; c < categories.length; c++) {
    const cat = categories[c]
    categoryById[cat.id] = {
      id: cat.id,
      name: cat.getString('name') || '',
      icon: cat.getString('icon') || '',
      normName: (cat.getString('name') || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim(),
    }
  }

  const spentByCategoryId = {}
  for (let t = 0; t < transactions.length; t++) {
    const tx = transactions[t]
    const cId = tx.getString('category')
    const amt = tx.getInt('amount') || 0
    const note = (tx.getString('note') || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

    let matchedCatId = cId

    // Se o cId direto não tem budget cadastrado, verifica se o note ou nome da categoria vincula a alguma caixinha com budget
    if (!budgetByCategoryId[matchedCatId]) {
      // 1. Tenta encontrar caixinha cujo nome ou sufixo esteja no note (ex.: note contém "Alimentação - VA" ou "VA")
      for (const bCatId in budgetByCategoryId) {
        const catMeta = categoryById[bCatId]
        if (!catMeta) continue

        // Match no note
        if (note && catMeta.normName && note.includes(catMeta.normName)) {
          matchedCatId = bCatId
          break
        }

        // Match de sufixo no note (ex.: "VA" de "Alimentação - VA")
        const parts = catMeta.name.split('-').map((p) =>
          p
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim(),
        )
        if (parts.length > 1) {
          const suffix = parts[parts.length - 1]
          if (suffix && suffix.length >= 2) {
            const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
            if (regex.test(note)) {
              matchedCatId = bCatId
              break
            }
          }
        }

        // Match entre nome da categoria da transação e caixinha (ex.: categoria "Alimentação Essencial" vs caixinha "Alimentação")
        const txCat = categoryById[cId]
        if (txCat && catMeta.normName && txCat.normName.includes(catMeta.normName)) {
          matchedCatId = bCatId
          break
        }
      }
    }

    if (matchedCatId) {
      spentByCategoryId[matchedCatId] = (spentByCategoryId[matchedCatId] || 0) + amt
    }
  }

  // 4. Se não há caixinhas ativas cadastradas
  if (categories.length === 0 && Object.keys(budgetByCategoryId).length === 0) {
    return (
      `📊 *Suas Caixinhas — Mês de ${monthName}*\n\n` +
      `Você ainda não tem caixinhas configuradas no Consciente.\n\n` +
      `Acesse https://agente-financeiro-whatsapp-37fd3.goskip.app/onboarding para definir suas primeiras caixinhas e começar a acompanhar seus limites!`
    )
  }

  // 5. Monta a lista consolidada das caixinhas
  const list = []
  let totalSpentCents = 0
  let totalBudgetCents = 0

  for (let c = 0; c < categories.length; c++) {
    const cat = categories[c]
    const catId = cat.id
    const name = cat.getString('name') || 'Caixinha'
    const iconId = cat.getString('icon') || ''
    const emoji = resolveCaixinhaEmoji(iconId, name)
    const budgetCents = budgetByCategoryId[catId] || 0
    const spentCents = spentByCategoryId[catId] || 0

    // Ignora se não tem budget e não teve gasto neste mês (evita poluir a lista)
    if (budgetCents === 0 && spentCents === 0) continue

    totalSpentCents += spentCents
    totalBudgetCents += budgetCents

    let percent = 0
    if (budgetCents > 0) {
      percent = Math.round((spentCents / budgetCents) * 100)
    } else if (spentCents > 0) {
      percent = 100 // sem teto configurado mas com gasto
    }

    list.push({
      name,
      emoji,
      budgetCents,
      spentCents,
      percent,
    })
  }

  // Se nenhuma caixinha teve teto ou gasto filtrado, traz ao menos as categorias criadas
  if (list.length === 0 && categories.length > 0) {
    for (let c = 0; c < categories.length; c++) {
      const cat = categories[c]
      list.push({
        name: cat.getString('name') || 'Caixinha',
        emoji: resolveCaixinhaEmoji(cat.getString('icon'), cat.getString('name')),
        budgetCents: 0,
        spentCents: 0,
        percent: 0,
      })
    }
  }

  // Ordena: estouradas primeiro (>= 100%), depois atenção (>= 80%), depois pelo maior valor gasto
  list.sort((a, b) => {
    if (a.percent >= 100 && b.percent < 100) return -1
    if (b.percent >= 100 && a.percent < 100) return 1
    if (a.percent >= 80 && b.percent < 80) return -1
    if (b.percent >= 80 && a.percent < 80) return 1
    return b.spentCents - a.spentCents
  })

  // 6. Formatação do cabeçalho e itens
  let output = `📊 *Suas Caixinhas — Mês de ${monthName}*\n\n`

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const bar = makeProgressBar(item.percent, 10)
    const spentFmt = formatCentsToBrl(item.spentCents)
    const budgetFmt = item.budgetCents > 0 ? formatCentsToBrl(item.budgetCents) : 'Sem teto'

    // Marcadores visuais de alerta
    let alertBadge = ''
    let statusText = ''

    if (item.budgetCents > 0) {
      if (item.spentCents > item.budgetCents) {
        const overCents = item.spentCents - item.budgetCents
        alertBadge = ' 🚨'
        statusText = `🚨 *Estourada por ${formatCentsToBrl(overCents)}*`
      } else if (item.percent >= 80) {
        const remaining = item.budgetCents - item.spentCents
        alertBadge = ' ⚠️'
        statusText = `⚠️ *Atenção:* restam ${formatCentsToBrl(remaining)}`
      } else {
        const remaining = item.budgetCents - item.spentCents
        statusText = `Restam ${formatCentsToBrl(remaining)}`
      }
    } else {
      statusText = 'Defina um teto no app para acompanhar a meta'
    }

    output += `${item.emoji} *${item.name}*${alertBadge}\n`
    output += `${bar} ${item.percent}%\n`
    output += `Gasto: ${spentFmt} / Teto: ${budgetFmt}\n`
    output += `(${statusText})\n\n`
  }

  // 7. Rodapé com linha de resumo
  const totalRemainingCents = totalBudgetCents - totalSpentCents
  output += `───────────────────────\n`
  output += `💰 *Total Gasto no Mês:* ${formatCentsToBrl(totalSpentCents)}\n`
  if (totalBudgetCents > 0) {
    output += `🎯 *Total dos Tetos:* ${formatCentsToBrl(totalBudgetCents)}\n`
    if (totalRemainingCents >= 0) {
      output += `✨ *Saldo Restante no Mês:* ${formatCentsToBrl(totalRemainingCents)}\n`
    } else {
      output += `🚨 *Estouro Geral no Mês:* ${formatCentsToBrl(Math.abs(totalRemainingCents))}\n`
    }
  } else {
    output += `💡 *Dica:* Defina seus tetos para ter a barra de progresso do mês completa!`
  }

  return output.trim()
}

// Exporta tanto em module.exports quanto no globalThis (PocketBase JSVM)
const caixinhasSummaryExports = {
  isCaixinhasOverviewIntent,
  buildCaixinhasSummaryForUser,
  formatCentsToBrl,
  makeProgressBar,
  resolveCaixinhaEmoji,
}

if (typeof globalThis !== 'undefined') {
  globalThis.__caixinhasSummaryHelper = caixinhasSummaryExports
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = caixinhasSummaryExports
}
