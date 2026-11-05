// whatsapp_bridge_inline_summary.js
// MOTOR DETERMINÍSTICO DE RESUMO DAS CAIXINHAS — módulo carregado via require
// DENTRO dos callbacks do whatsapp_bridge.js (webhook + simulate).
// REGRA INVIOLÁVEL: o resumo de caixinhas no WhatsApp é 100% DETERMINÍSTICO da
// base de dados (budgets + transactions). NUNCA passa pelo $ai.agent — elimina
// qualquer risco de alucinação ou ressuscitação de caixinhas excluídas.
// NOTA: o JSVM do PocketBase executa callbacks em pools separados, então as
// declarações top-level do arquivo principal NÃO são visíveis dentro deles.
// Por isso esta lógica vive num módulo próprio, exigido dentro do callback.

const CAIXINHA_EMOJIS = {
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

function resolveCaixinhaEmoji(iconId, categoryName) {
  if (!iconId && !categoryName) return '📦'
  const idStr = String(iconId || '').trim()
  if (idStr.startsWith('emoji:')) {
    return idStr.slice(6) || '📦'
  }
  if (CAIXINHA_EMOJIS[idStr]) {
    return CAIXINHA_EMOJIS[idStr]
  }
  if (/\p{Extended_Pictographic}/u.test(idStr)) {
    return idStr
  }
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

function makeProgressBar(percent, totalBlocks) {
  const blocks = totalBlocks || 10
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const filledCount = Math.min(blocks, Math.round((clamped / 100) * blocks))
  const emptyCount = Math.max(0, blocks - filledCount)
  let bar = ''
  for (let i = 0; i < filledCount; i++) bar += '▓'
  for (let j = 0; j < emptyCount; j++) bar += '░'
  return bar
}

function isCaixinhasOverviewIntent(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // Se for lançamento com valor monetário explícito (ex.: "almoço 35"), não é overview
  if (
    /\d+([.,]\d{1,2})?\s*(reais|real|conto|pila)?\b/.test(t) &&
    !t.includes('caixinha') &&
    !t.includes('orcamento')
  ) {
    if (
      !t.includes('minhas caixinhas') &&
      !t.includes('todas as caixinhas') &&
      !t.includes('resumo')
    ) {
      return false
    }
  }

  const patterns = [
    /quais\s+(sao\s+)?(as\s+)?(minhas\s+)?caixinhas/,
    /minhas\s+caixinhas/,
    /ver\s+(as\s+)?(minhas\s+)?caixinhas/,
    /ver\s+resumo/,
    /meu\s+resumo/,
    /resumo\s+d(as|e)\s+caixinhas/,
    /resumo\s+das\s+minhas\s+caixinhas/,
    /resumo\s+d(o|e)\s+m[eê]s/,
    /resumo\s+mensal/,
    /resumo\s+geral/,
    /resumo\s+financeiro/,
    /^resumo\b/,
    /como\s+estao\s+(as\s+)?(minhas\s+)?caixinhas/,
    /status\s+d(as|e)\s+caixinhas/,
    /visao\s+geral\s+d(as|e)\s+caixinhas/,
    /visao\s+geral/,
    /saldo\s+d(as|e)\s+caixinhas/,
    /saldo\s+das\s+minhas\s+caixinhas/,
    /quanto\s+(ja\s+)?gastei\s+n(as|a)\s+caixinha/,
    /quanto\s+resta\s+n(as|a)\s+caixinha/,
    /quanto\s+(ja\s+)?gastei\s+no\s+m[eê]s/,
    /quanto\s+(ja\s+)?gastei/,
    /listar\s+(as\s+)?caixinhas/,
    /lista\s+d(as|e)\s+caixinhas/,
    /meus\s+orcamentos/,
    /resumo\s+dos\s+orcamentos/,
    /mostrar\s+caixinhas/,
    /todas\s+as\s+caixinhas/,
    /resumo\s+(por\s+favor|rapido|agora|completo|detalhado)/,
    /meus\s+tetos/,
    /teto\s+d(as|e)\s+(minhas\s+)?caixinhas/,
    /(gastos?|gasto)\s+por\s+caixinha/,
    /como\s+est[aã]o?\s+(as\s+)?minhas\s+caixinhas/,
    /quais\s+caixinhas/,
    /estado\s+d(as|e)\s+caixinhas/,
  ]

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(t)) return true
  }

  if (/(^|[^a-z0-9])resumo([^a-z0-9]|$)/.test(t)) return true

  if (
    t === 'resumo' ||
    t === 'resumo.' ||
    t === 'resumo!' ||
    t === 'caixinhas' ||
    t === 'caixinha' ||
    t === 'orcamentos' ||
    t === 'orcamento' ||
    t === 'saldo' ||
    t === 'extrato'
  ) {
    return true
  }

  return false
}

function buildCaixinhasSummaryForUser(app, userId, targetMonthStr) {
  if (!app || !userId) return null

  const now = new Date()
  const monthStr = targetMonthStr || now.toISOString().slice(0, 7) // 'YYYY-MM'
  const monthNumber = parseInt(monthStr.slice(5, 7), 10) - 1
  const monthName = MONTH_NAMES_PT[monthNumber] || 'Mês'

  // 1. Categorias do usuário
  let categories = []
  try {
    categories = app.findRecordsByFilter(
      'categories',
      `(owner = '${userId}' || owner = '' || owner = null) && type = 'despesa'`,
      'name',
      100,
      0,
    )
  } catch (cErr) {
    console.log('[inline_caixinhas_summary] Erro ao carregar categorias:', cErr)
  }

  // 2. Budgets do mês para o usuário
  let budgets = []
  try {
    budgets = app.findRecordsByFilter(
      'budgets',
      `owner = '${userId}' && month = '${monthStr}'`,
      '-created',
      100,
      0,
    )
  } catch (bErr) {
    console.log('[inline_caixinhas_summary] Erro ao carregar budgets:', bErr)
  }

  // Se não houver budgets no mês atual, recupera os tetos mais recentes deduplicados por nome
  if (budgets.length === 0) {
    try {
      const recent = app.findRecordsByFilter(
        'budgets',
        `owner = '${userId}'`,
        '-month,-created',
        100,
        0,
      )
      const seenNames = {}
      const deduped = []
      for (let r = 0; r < recent.length; r++) {
        const nm = String(recent[r].getString('name') || '')
          .toLowerCase()
          .trim()
        if (!nm || seenNames[nm]) continue
        seenNames[nm] = true
        deduped.push(recent[r])
      }
      budgets = deduped
    } catch (_) {}
  }

  const budgetByCategoryId = {}
  const budgetsList = []
  for (let b = 0; b < budgets.length; b++) {
    const bg = budgets[b]
    const catId = bg.getString('category')
    const bId = bg.id
    const bAmt = bg.getInt('amount') || 0
    const bName = bg.getString('name') || ''
    const bIcon = bg.getString('icon') || ''
    const bColor = bg.getString('color') || ''
    budgetsList.push({
      id: bId,
      name: bName,
      icon: bIcon,
      color: bColor,
      category: catId,
      amount: bAmt,
      month: bg.getString('month') || monthStr,
    })
    if (catId && !budgetByCategoryId[catId]) {
      budgetByCategoryId[catId] = bAmt
    }
  }

  // 2.1 Vínculos personalizados (category_caixinha_links)
  let userLinks = []
  try {
    userLinks = app.findRecordsByFilter(
      'category_caixinha_links',
      `user = '${userId}' && active = true`,
      '-created',
      200,
      0,
    )
  } catch (lErr) {
    console.log('[inline_caixinhas_summary] Nenhum vínculo explícito carregado:', lErr)
  }

  // 3. Transações do mês corrente (tipo 'despesa') — APENAS ATIVAS
  const startOfMonth = `${monthStr}-01`
  const endOfMonth = `${monthStr}-31`
  let transactions = []
  try {
    transactions = app.findRecordsByFilter(
      'transactions',
      `owner = '${userId}' && type = 'despesa' && date >= '${startOfMonth}' && date <= '${endOfMonth}' && (status = 'active' || status = '' || status = null)`,
      'date',
      1000,
      0,
    )
  } catch (tErr) {
    console.log('[inline_caixinhas_summary] Erro ao carregar transações:', tErr)
  }

  const categoryById = {}
  for (let c = 0; c < categories.length; c++) {
    const cat = categories[c]
    categoryById[cat.id] = {
      id: cat.id,
      name: cat.getString('name') || '',
      icon: cat.getString('icon') || '',
    }
  }

  const norm = function (str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  const activeLinks = []
  for (let l = 0; l < userLinks.length; l++) {
    const lk = userLinks[l]
    const bId = lk.getString('budget')
    const cName = norm(lk.getString('category_name'))
    const cId = lk.getString('category_id') || lk.getString('category')
    activeLinks.push({ bId, cName, cId })
  }

  // Resolução da caixinha única por transação (ZERO DUPLICAÇÃO)
  const resolveTxBudget = function (tx) {
    const directBudgetId = tx.getString('budget')
    if (directBudgetId) {
      for (let b = 0; b < budgetsList.length; b++) {
        if (budgetsList[b].id === directBudgetId) return budgetsList[b]
      }
    }

    const txCatId = tx.getString('category')
    const txNote = norm(tx.getString('note'))
    const txDesc = norm(tx.getString('description'))
    const combined = `${txNote} ${txDesc}`.trim()
    const txCatMeta = categoryById[txCatId]
    const txCatName = norm(txCatMeta ? txCatMeta.name : '')

    if (activeLinks.length > 0) {
      const candidateBudgetIds = []
      for (let l = 0; l < activeLinks.length; l++) {
        const lk = activeLinks[l]
        let isCand = false
        if (lk.cId && txCatId && lk.cId === txCatId) {
          isCand = true
        } else if (
          txCatName &&
          lk.cName &&
          (txCatName === lk.cName || txCatName.includes(lk.cName) || lk.cName.includes(txCatName))
        ) {
          isCand = true
        }
        if (isCand && !candidateBudgetIds.includes(lk.bId)) {
          candidateBudgetIds.push(lk.bId)
        }
      }

      if (candidateBudgetIds.length === 1) {
        for (let b = 0; b < budgetsList.length; b++) {
          if (budgetsList[b].id === candidateBudgetIds[0]) return budgetsList[b]
        }
      }

      if (candidateBudgetIds.length > 1) {
        for (let i = 0; i < candidateBudgetIds.length; i++) {
          const candId = candidateBudgetIds[i]
          let candBudget = null
          for (let b = 0; b < budgetsList.length; b++) {
            if (budgetsList[b].id === candId) {
              candBudget = budgetsList[b]
              break
            }
          }
          if (!candBudget) continue
          const candName = candBudget.name || (categoryById[candBudget.category] || {}).name || ''
          const candNorm = norm(candName)
          if (candNorm && combined.includes(candNorm)) {
            return candBudget
          }
          if (candName) {
            const parts = candName.split('-').map((p) => norm(p))
            if (parts.length > 1) {
              const suffix = parts[parts.length - 1]
              if (suffix && suffix.length >= 2) {
                const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
                if (regex.test(combined)) return candBudget
              }
            }
          }
        }
        for (let b = 0; b < budgetsList.length; b++) {
          if (budgetsList[b].id === candidateBudgetIds[0]) return budgetsList[b]
        }
      }
    }

    // Fallback sem vínculos: pontua a melhor caixinha
    let bestBudget = null
    let bestScore = 0

    for (let b = 0; b < budgetsList.length; b++) {
      const bg = budgetsList[b]
      const bName = bg.name || (categoryById[bg.category] || {}).name || ''
      const bNorm = norm(bName)
      let score = 0

      if (bName) {
        const parts = bName.split('-').map((p) => norm(p))
        if (parts.length > 1) {
          const suffix = parts[parts.length - 1]
          if (suffix && suffix.length >= 2) {
            const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
            if (regex.test(combined)) {
              score = Math.max(score, 80)
            }
          }
        }
        if (bNorm && combined.includes(bNorm)) {
          score = Math.max(score, 70)
        }
        if (txCatName && bNorm) {
          if (bNorm.includes(txCatName) || txCatName.includes(bNorm)) {
            score = Math.max(score, 50)
          }
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestBudget = bg
      }
    }

    return bestBudget
  }

  // Soma cada transação ativa UMA ÚNICA VEZ na caixinha resolvida
  const spentByBudgetId = {}
  for (let b = 0; b < budgetsList.length; b++) {
    spentByBudgetId[budgetsList[b].id] = 0
  }

  for (let t = 0; t < transactions.length; t++) {
    const tx = transactions[t]
    const amt = tx.getInt('amount') || 0
    const matchedBudget = resolveTxBudget(tx)
    if (matchedBudget && matchedBudget.id) {
      spentByBudgetId[matchedBudget.id] = (spentByBudgetId[matchedBudget.id] || 0) + amt
    }
  }

  // Se não há caixinhas cadastradas
  if (budgetsList.length === 0) {
    return (
      `📊 *Suas Caixinhas — Mês de ${monthName}*\n\n` +
      `Você ainda não tem caixinhas configuradas no Consciente.\n\n` +
      `Acesse a aba Caixinhas no app para definir suas primeiras caixinhas e começar a acompanhar seus limites!`
    )
  }

  // Lista consolidada direto de budgetsList
  const list = []
  let totalSpentCents = 0
  let totalBudgetCents = 0

  for (let b = 0; b < budgetsList.length; b++) {
    const bg = budgetsList[b]
    const bId = bg.id
    const name = bg.name || (categoryById[bg.category] || {}).name || 'Caixinha'
    const iconId = bg.icon || (categoryById[bg.category] || {}).icon || ''
    const emoji = resolveCaixinhaEmoji(iconId, name)
    const budgetCents = bg.amount || 0
    const spentCents = spentByBudgetId[bId] || 0

    totalSpentCents += spentCents
    totalBudgetCents += budgetCents

    let percent = 0
    if (budgetCents > 0) {
      percent = Math.round((spentCents / budgetCents) * 100)
    } else if (spentCents > 0) {
      percent = 100
    }

    list.push({
      name,
      emoji,
      budgetCents,
      spentCents,
      percent,
    })
  }

  try {
    const auditNames = list.map((i) => i.name).join(' | ')
    console.log(
      `[inline_caixinhas_summary] Resumo determinístico userId=${userId} mes=${monthStr} caixinhas=${list.length} [${auditNames}] gasto_total=${totalSpentCents} tetos_total=${totalBudgetCents}`,
    )
  } catch (_) {}

  // Ordena: estouradas primeiro (>= 100%), depois atenção (>= 80%), depois pelo maior valor gasto
  list.sort((a, b) => {
    if (a.percent >= 100 && b.percent < 100) return -1
    if (b.percent >= 100 && a.percent < 100) return 1
    if (a.percent >= 80 && b.percent < 80) return -1
    if (b.percent >= 80 && a.percent < 80) return 1
    return b.spentCents - a.spentCents
  })

  let output = `📊 *Suas Caixinhas — Mês de ${monthName}*\n\n`

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const bar = makeProgressBar(item.percent, 10)
    const spentFmt = formatCentsToBrl(item.spentCents)
    const budgetFmt = item.budgetCents > 0 ? formatCentsToBrl(item.budgetCents) : 'Sem teto'

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

  // Rodapé: total gasto e tetos somados ESTRITAMENTE dos itens listados
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

function buildCaixinhasContextPrompt(app, userId, targetMonthStr) {
  if (!app || !userId) return ''

  const now = new Date()
  const monthStr = targetMonthStr || now.toISOString().slice(0, 7)

  let budgets = []
  try {
    budgets = app.findRecordsByFilter(
      'budgets',
      `owner = '${userId}' && month = '${monthStr}'`,
      '-created',
      100,
      0,
    )
  } catch (_) {}

  if (budgets.length === 0) {
    try {
      const recentCtx = app.findRecordsByFilter(
        'budgets',
        `owner = '${userId}'`,
        '-month,-created',
        100,
        0,
      )
      const seenCtxNames = {}
      const dedupedCtx = []
      for (let r = 0; r < recentCtx.length; r++) {
        const nm = String(recentCtx[r].getString('name') || '')
          .toLowerCase()
          .trim()
        if (!nm || seenCtxNames[nm]) continue
        seenCtxNames[nm] = true
        dedupedCtx.push(recentCtx[r])
      }
      budgets = dedupedCtx
    } catch (_) {}
  }

  if (budgets.length === 0) {
    return `[CAIXINHAS ATIVAS DO USUÁRIO NO MÊS ${monthStr}: Nenhuma caixinha cadastrada no momento. É terminantemente PROIBIDO citar ou inventar nomes de caixinhas.]`
  }

  const startOfMonth = `${monthStr}-01`
  const endOfMonth = `${monthStr}-31`
  let transactions = []
  try {
    transactions = app.findRecordsByFilter(
      'transactions',
      `owner = '${userId}' && type = 'despesa' && date >= '${startOfMonth}' && date <= '${endOfMonth}' && (status = 'active' || status = '' || status = null)`,
      'date',
      1000,
      0,
    )
  } catch (_) {}

  const spentByBudgetId = {}
  for (let b = 0; b < budgets.length; b++) {
    spentByBudgetId[budgets[b].id] = 0
  }
  for (let t = 0; t < transactions.length; t++) {
    const directBid = transactions[t].getString('budget')
    if (directBid && typeof spentByBudgetId[directBid] === 'number') {
      spentByBudgetId[directBid] += transactions[t].getInt('amount') || 0
    }
  }

  const items = []
  for (let b = 0; b < budgets.length; b++) {
    const bg = budgets[b]
    const bName = bg.getString('name') || 'Caixinha'
    const bAmt = bg.getInt('amount') || 0
    const bSpent = spentByBudgetId[bg.id] || 0
    const tetoFmt = bAmt > 0 ? formatCentsToBrl(bAmt) : 'Sem teto'
    const gastoFmt = formatCentsToBrl(bSpent)
    items.push(`- "${bName}" (Teto: ${tetoFmt}, Gasto atual: ${gastoFmt})`)
  }

  return (
    `[ESTADO OFICIAL E FRESCO DAS CAIXINHAS ATIVAS DA BASE DE DADOS (${monthStr}):\n` +
    items.join('\n') +
    `\nREGRAS CRÍTICAS E OBRIGATÓRIAS:\n` +
    `1. Esta é a ÚNICA lista de caixinhas que existem hoje na base. Qualquer caixinha não listada acima foi EXCLUÍDA pelo usuário e é TERMINANTEMENTE PROIBIDO citá-la, sugeri-la ou ressuscitá-la.\n` +
    `2. Resumos visuais e cálculos oficiais de caixinhas são gerados automaticamente pelo sistema via comando "resumo". NUNCA gere números de caixinhas, totais ou saldos por conta própria.\n` +
    `3. Esta lista é recalculada e reenviada A CADA MENSAGEM direto da base de dados. NUNCA cite caixinhas mencionadas em mensagens anteriores da conversa que não estejam na lista acima — caixinhas excluídas pelo usuário deixaram de existir e ressuscitá-las é um erro grave.\n` +
    `4. Se o usuário pedir resumo, visão geral ou estado das caixinhas, responda que o resumo oficial é enviado automaticamente pelo sistema com os dados atualizados — NUNCA monte a lista de caixinhas por conta própria.]`
  )
}

module.exports = {
  isCaixinhasOverviewIntent,
  buildCaixinhasSummaryForUser,
  buildCaixinhasContextPrompt,
}
