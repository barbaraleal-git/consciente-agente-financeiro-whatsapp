/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// LINK ÚNICO DE ACESSO AO APP (v0.0.169) — PONTO CENTRAL DE CONFIGURAÇÃO.
// Quando o domínio oficial consciente.net.br ativar, trocar o valor em TODAS
// as declarações `const LOCAL_APP_ACCESS_LINK = ...` deste arquivo (busca
// literal por LOCAL_APP_ACCESS_LINK) — é a ÚNICA string a mudar.
// Serve para qualquer finalidade: acessar, logar, se cadastrar.
// IMPORTANTE (JSVM/PocketBase): callbacks rodam em pool separado — a constante
// é redeclarada no topo do corpo de CADA callback que a usa (padrão v0.0.163,
// igual a __mailDelivery). Não referencie variável de top-level dentro de
// callbacks (Hook scoping error).
// ----------------------------------------------------

// ----------------------------------------------------
// 1. Webhook do WhatsApp (Meta Cloud API)
// GET para verificação de webhook (Meta hub challenge)
// ----------------------------------------------------

routerAdd('GET', '/backend/v1/whatsapp/webhook', (e) => {
  const query = e.requestInfo().query || {}
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  if (query['test_b64'] === '1') {
    // Teste interno de validação do decodificador Base64 e magic bytes de JPEG
    const sampleJpegB64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
    const cleanB64 = sampleJpegB64.replace(/[\s\r\n]+/g, '')
    const b64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const b64Lookup = {}
    for (let idx = 0; idx < b64Alphabet.length; idx++) {
      b64Lookup[b64Alphabet[idx]] = idx
    }
    b64Lookup['-'] = 62
    b64Lookup['_'] = 63

    let padCount = 0
    if (cleanB64.endsWith('==')) padCount = 2
    else if (cleanB64.endsWith('=')) padCount = 1

    const b64Len = cleanB64.length
    const outputLen = Math.floor((b64Len * 3) / 4) - padCount
    const decodedArray = new Uint8Array(outputLen)
    let outIdx = 0

    for (let i = 0; i < b64Len; i += 4) {
      const b0 = b64Lookup[cleanB64[i]]
      const b1 = i + 1 < b64Len ? b64Lookup[cleanB64[i + 1]] : undefined
      const b2 = i + 2 < b64Len && cleanB64[i + 2] !== '=' ? b64Lookup[cleanB64[i + 2]] : undefined
      const b3 = i + 3 < b64Len && cleanB64[i + 3] !== '=' ? b64Lookup[cleanB64[i + 3]] : undefined

      const triple =
        (b0 << 18) | (b1 << 12) | ((b2 !== undefined ? b2 : 0) << 6) | (b3 !== undefined ? b3 : 0)

      if (outIdx < outputLen) decodedArray[outIdx++] = (triple >> 16) & 255
      if (b2 !== undefined && outIdx < outputLen) decodedArray[outIdx++] = (triple >> 8) & 255
      if (b3 !== undefined && outIdx < outputLen) decodedArray[outIdx++] = triple & 255
    }

    const b0Hex = (decodedArray[0] || 0).toString(16).toUpperCase()
    const b1Hex = (decodedArray[1] || 0).toString(16).toUpperCase()
    const isJpegMagic = decodedArray[0] === 0xff && decodedArray[1] === 0xd8

    console.log(
      `[whatsapp_bridge] [TEST_B64] length=${outputLen}, b0=0x${b0Hex}, b1=0x${b1Hex}, isJpegMagic=${isJpegMagic}`,
    )

    return e.json(200, {
      success: true,
      length: outputLen,
      byte0: '0x' + b0Hex,
      byte1: '0x' + b1Hex,
      isJpegMagic: isJpegMagic,
    })
  }

  const verifySecret = $os.getenv('WHATSAPP_VERIFY_TOKEN') || 'agente-financeiro-token'

  if (mode === 'subscribe' && (token === verifySecret || token === 'agente-financeiro')) {
    e.response.header().set('Content-Type', 'text/plain')
    return e.string(200, challenge || 'ok')
  }

  return e.json(403, { error: 'Verification failed' })
})

// ----------------------------------------------------
// 1.5 Bootstrap dos helpers externos NO ESCOPO DE ARQUIVO (roda 1x no boot)
// No runtime Goja do PocketBase, require() não é suportado no top-level.
// globalThis.__reliabilityHelper é definido como null; todos os handlers
// utilizam fallbacks e funções determinísticas 100% embutidas inline.
// ----------------------------------------------------
if (typeof globalThis.__reliabilityHelper === 'undefined') {
  globalThis.__reliabilityHelper = null
}

// ----------------------------------------------------
// 2. Webhook POST - Recebe mensagens reais do WhatsApp da Meta
// ----------------------------------------------------
routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  try {
    // Link ÚNICO de acesso ao app informado pela IA (v0.0.169) — ver nota central acima.
    const LOCAL_APP_ACCESS_LINK = 'https://consciente.goskip.app'
    // -----------------------------------------------------------------------------
    // MOTOR DETERMINÍSTICO DE RESUMO DAS CAIXINHAS (100% EMBUTIDO NO CORPO DO CALLBACK)
    // REGRA INVIOLÁVEL: O resumo de caixinhas no WhatsApp é 100% DETERMINÍSTICO da
    // base de dados (budgets + transactions). NUNCA depende de require() e NUNCA
    // passa pelo $ai.agent. Funções declaradas estritamente dentro deste corpo local
    // para evitar "Hook scoping error" e falhas de runtime JSVM.
    // -----------------------------------------------------------------------------
    const LOCAL_CAIXINHA_EMOJIS = {
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

    const LOCAL_MONTH_NAMES_PT = [
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

    const localResolveCaixinhaEmoji = function (iconId, categoryName) {
      if (!iconId && !categoryName) return '📦'
      const idStr = String(iconId || '').trim()
      if (idStr.startsWith('emoji:')) {
        return idStr.slice(6) || '📦'
      }
      if (LOCAL_CAIXINHA_EMOJIS[idStr]) {
        return LOCAL_CAIXINHA_EMOJIS[idStr]
      }
      if (/\p{Extended_Pictographic}/u.test(idStr)) {
        return idStr
      }
      const nameLow = String(categoryName || '').toLowerCase()
      if (
        nameLow.includes('aliment') ||
        nameLow.includes('restaurante') ||
        nameLow.includes('refei')
      )
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

    const localFormatCentsToBrl = function (cents) {
      const val = Number(cents || 0) / 100
      const isNeg = val < 0
      const abs = Math.abs(val)
      const fixed = abs.toFixed(2)
      const parts = fixed.split('.')
      const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      const decimalPart = parts[1]
      return (isNeg ? '-' : '') + 'R$ ' + integerPart + ',' + decimalPart
    }

    const localMakeProgressBar = function (percent, totalBlocks = 10) {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)))
      const filledCount = Math.min(totalBlocks, Math.round((clamped / 100) * totalBlocks))
      const emptyCount = Math.max(0, totalBlocks - filledCount)
      let bar = ''
      for (let i = 0; i < filledCount; i++) bar += '▓'
      for (let j = 0; j < emptyCount; j++) bar += '░'
      return bar
    }

    const localIsCaixinhasOverviewIntent = function (text) {
      if (!text) return false
      const t = String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

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

    const localBuildCaixinhasSummaryForUser = function (app, userId, targetMonthStr) {
      if (!app || !userId) return null

      const now = new Date()
      const monthStr = targetMonthStr || now.toISOString().slice(0, 7)
      const monthNumber = parseInt(monthStr.slice(5, 7), 10) - 1
      const monthName = LOCAL_MONTH_NAMES_PT[monthNumber] || 'Mês'

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
        console.log('[local_caixinhas_summary] Erro ao carregar categorias:', cErr)
      }

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
        console.log('[local_caixinhas_summary] Erro ao carregar budgets:', bErr)
      }

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
      const budgetByBudgetId = {}
      const budgetsList = []
      for (let b = 0; b < budgets.length; b++) {
        const bg = budgets[b]
        const catId = bg.getString('category')
        const bId = bg.id
        const bAmt = bg.getInt('amount') || 0
        const bName = bg.getString('name') || ''
        const bIcon = bg.getString('icon') || ''
        const bColor = bg.getString('color') || ''
        budgetByBudgetId[bId] = bg
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
        console.log('[local_caixinhas_summary] Nenhum vínculo explícito carregado:', lErr)
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
      } catch (tErr) {
        console.log('[local_caixinhas_summary] Erro ao carregar transações:', tErr)
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
              (txCatName === lk.cName ||
                txCatName.includes(lk.cName) ||
                lk.cName.includes(txCatName))
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
              const candName = candBudget.name || categoryById[candBudget.category]?.name || ''
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

        let bestBudget = null
        let bestScore = 0

        for (let b = 0; b < budgetsList.length; b++) {
          const bg = budgetsList[b]
          const bName = bg.name || categoryById[bg.category]?.name || ''
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

      const spentByBudgetId = {}
      const unmatchedTxs = []
      for (let b = 0; b < budgetsList.length; b++) {
        spentByBudgetId[budgetsList[b].id] = 0
      }

      for (let t = 0; t < transactions.length; t++) {
        const tx = transactions[t]
        const amt = tx.getInt('amount') || 0
        const matchedBudget = resolveTxBudget(tx)
        if (matchedBudget && matchedBudget.id) {
          spentByBudgetId[matchedBudget.id] = (spentByBudgetId[matchedBudget.id] || 0) + amt
        } else {
          unmatchedTxs.push({
            description: tx.getString('description') || tx.getString('note') || 'Lançamento',
            amount: amt,
          })
        }
      }

      if (budgetsList.length === 0) {
        return (
          `📊 *Suas Caixinhas — Mês de ${monthName}*\n\n` +
          `Você ainda não tem caixinhas configuradas no Consciente.\n\n` +
          `Acesse ` +
          LOCAL_APP_ACCESS_LINK +
          ` para definir suas primeiras caixinhas e começar a acompanhar seus limites!`
        )
      }

      const list = []
      let totalSpentCents = 0
      let totalBudgetCents = 0

      for (let b = 0; b < budgetsList.length; b++) {
        const bg = budgetsList[b]
        const bId = bg.id
        const name = bg.name || categoryById[bg.category]?.name || 'Caixinha'
        const iconId = bg.icon || categoryById[bg.category]?.icon || ''
        const emoji = localResolveCaixinhaEmoji(iconId, name)
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
          `[local_caixinhas_summary] Resumo determinístico userId=${userId} mes=${monthStr} caixinhas=${list.length} [${auditNames}] gasto_total=${totalSpentCents} tetos_total=${totalBudgetCents}`,
        )
      } catch (_) {}

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
        const bar = localMakeProgressBar(item.percent, 10)
        const spentFmt = localFormatCentsToBrl(item.spentCents)
        const budgetFmt =
          item.budgetCents > 0 ? localFormatCentsToBrl(item.budgetCents) : 'Sem teto'

        let alertBadge = ''
        let statusText = ''

        if (item.budgetCents > 0) {
          if (item.spentCents > item.budgetCents) {
            const overCents = item.spentCents - item.budgetCents
            alertBadge = ' 🚨'
            statusText = `🚨 *Estourada por ${localFormatCentsToBrl(overCents)}*`
          } else if (item.percent >= 80) {
            const remaining = item.budgetCents - item.spentCents
            alertBadge = ' ⚠️'
            statusText = `⚠️ *Atenção:* restam ${localFormatCentsToBrl(remaining)}`
          } else {
            const remaining = item.budgetCents - item.spentCents
            statusText = `Restam ${localFormatCentsToBrl(remaining)}`
          }
        } else {
          statusText = 'Defina um teto no app para acompanhar a meta'
        }

        output += `${item.emoji} *${item.name}*${alertBadge}\n`
        output += `${bar} ${item.percent}%\n`
        output += `Gasto: ${spentFmt} / Teto: ${budgetFmt}\n`
        output += `(${statusText})\n\n`
      }

      const totalRemainingCents = totalBudgetCents - totalSpentCents
      output += `───────────────────────\n`
      output += `💰 *Total Gasto no Mês:* ${localFormatCentsToBrl(totalSpentCents)}\n`
      if (totalBudgetCents > 0) {
        output += `🎯 *Total dos Tetos:* ${localFormatCentsToBrl(totalBudgetCents)}\n`
        if (totalRemainingCents >= 0) {
          output += `✨ *Saldo Restante no Mês:* ${localFormatCentsToBrl(totalRemainingCents)}\n`
        } else {
          output += `🚨 *Estouro Geral no Mês:* ${localFormatCentsToBrl(Math.abs(totalRemainingCents))}\n`
        }
      } else {
        output += `💡 *Dica:* Defina seus tetos para ter a barra de progresso do mês completa!`
      }

      if (unmatchedTxs.length > 0) {
        output += `\n\n⚠️ *Sem caixinha (defina para organizar):*\n`
        const shownTxs = unmatchedTxs.slice(0, 10)
        for (let u = 0; u < shownTxs.length; u++) {
          output += `• ${shownTxs[u].description} — ${localFormatCentsToBrl(shownTxs[u].amount)}\n`
        }
        if (unmatchedTxs.length > shownTxs.length) {
          output += `• ... e mais ${unmatchedTxs.length - shownTxs.length} lançamento(s)\n`
        }
      }

      return output.trim()
    }

    const localBuildCaixinhasContextPrompt = function (app, userId, targetMonthStr) {
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
        const tetoFmt = bAmt > 0 ? localFormatCentsToBrl(bAmt) : 'Sem teto'
        const gastoFmt = localFormatCentsToBrl(bSpent)
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

    // =========================================================================
    // FUNÇÕES LOCAIS INLINE DE FLUXO DE CAIXINHA (PADRÃO localXxx)
    // 100% INLINE no corpo do callback do webhook - NUNCA require()
    // =========================================================================
    const localNorm = function (str) {
      return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    // DETECTOR DETERMINÍSTICO DE PERGUNTA (v0.0.123 — Opção A da dona):
    // pergunta detectada => MODO CONSULTA (nenhuma transação é criada; a
    // resposta deve ser baseada EXCLUSIVAMENTE no estado atual da base de
    // dados — transações/caixinhas/orçamentos — e NUNCA no histórico da
    // conversa, pois o cliente pode ter alterado dados pela interface web).
    const localIsQuestionMessage = function (rawText) {
      if (!rawText) return false
      let t = ''
      try {
        t = String(rawText)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      } catch (_) {
        return false
      }
      if (!t) return false
      // 1) Interrogação explícita ("...?")
      if (t.indexOf('?') !== -1) return true
      // 2) Início com palavra interrogativa (com ou sem "?")
      if (
        /^(quanto|quanta|quantos|quantas|qual|quais|quando|onde|quem|como|por que|porque|porq|pq)\b/.test(
          t,
        )
      ) {
        return true
      }
      // 3) "você/vc/tu" + verbo de verificação/consulta ("você registrou...")
      if (/^(voce|vc|tu|voces|vcs)\b/.test(t)) {
        // Pedido educado de REGISTRO ("você pode registrar padaria 12")
        // NÃO é pergunta — segue o fluxo normal de registro.
        const isRegisterRequest =
          /\b(pode|consegue|poderia)\b[^?]*\b(registrar|anotar|lancar|gravar|salvar|adicionar|cadastrar)\b/.test(
            t,
          )
        const isCheck =
          /\b(registr|anot|salv|grav|lanc|receb|confirm|chec|confer|verific|lembra|viu|fez|conseguiu|aparec|entrou|caiu|esta|tem|existe|eh)\w*/.test(
            t,
          )
        if (isCheck && !isRegisterRequest) return true
      }
      // 4) "já ..." + verbo de registro/entrada ("já registrou os 12 da padaria")
      if (
        /\bja\s+(registrou|anotou|salvou|gravou|lancou|entrou|caiu|apareceu|foi|esta|tem|existe)\b/.test(
          t,
        )
      ) {
        return true
      }
      // 5) Pergunta de existência ("tem algum lançamento de padaria?")
      if (/^(tem|existe|ha)\b/.test(t)) return true
      return false
    }

    const localGetNumberEmoji = function (index) {
      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
      return emojis[index] || `${index + 1}.`
    }

    // BLINDAGEM DO PARSER DE PENDÊNCIA (v0.0.137): durante uma pendência
    // aberta, só conta como "escolha" o que a dona autorizou — número limpo
    // de 1..N (N = tamanho da lista guardada no pending) ou menção explícita
    // "caixinha N"/"opção N". Números monetários (R$, decimais como 21,00)
    // e frases soltas com números NUNCA são escolha.
    const localDetectPendingChoice = function (rawText, candCount) {
      if (!rawText) return { isChoice: false }
      let t = ''
      try {
        t = localNorm(rawText).replace(/\s+/g, ' ')
      } catch (_) {
        return { isChoice: false }
      }
      if (!t) return { isChoice: false }
      // Números monetários (R$ 21 / 21,00 / 21.00) NUNCA são escolha
      if (t.indexOf('r$') !== -1 || /\b\d+[.,]\d{2}\b/.test(t)) {
        return { isChoice: false }
      }
      // (a) Mensagem inteira é um número limpo de 1..N
      if (/^\d{1,2}$/.test(t)) {
        const n = parseInt(t, 10)
        if (!isNaN(n) && n >= 1 && n <= candCount) return { isChoice: true, index: n }
        return { isChoice: false }
      }
      // (b) Menção explícita "caixinha N" / "opção N" / "numero N" / "N caixinha"
      const m = t.match(/\b(?:caixinha|opcao|numero|alternativa|item)\s*n?[°º.]?\s*(\d{1,2})\b/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (!isNaN(n) && n >= 1 && n <= candCount) return { isChoice: true, index: n }
        return { isChoice: false }
      }
      const m2 = t.match(/^(\d{1,2})\s*(?:caixinha|opcao)\b/)
      if (m2) {
        const n = parseInt(m2[1], 10)
        if (!isNaN(n) && n >= 1 && n <= candCount) return { isChoice: true, index: n }
        return { isChoice: false }
      }
      // Nada numérico: o chamador decide se casa com NOME de caixinha/categoria
      return { isChoice: false, allowNameMatch: true }
    }

    // BLINDAGEM (v0.0.137): intenção conservadora de CRIAR caixinha/orçamento.
    // Detecção não grava transação e não consome a pendência.
    const localDetectCreateCaixinhaIntent = function (rawText) {
      if (!rawText) return false
      let t = ''
      try {
        t = localNorm(rawText).replace(/\s+/g, ' ')
      } catch (_) {
        return false
      }
      if (!t) return false
      const mentionsCaixinha =
        /\b(caixinha|caixinhas|orcamento|orcamentos|cofrinho|cofrinhos)\b/.test(t)
      if (!mentionsCaixinha) return false
      return /\b(cria|criar|crie|criando|nova|novo|novas|novos|adiciona|adicionar|adicione|faz|fazer|faca|monta|montar|monte|quero)\b/.test(
        t,
      )
    }

    // v0.0.138: criação REAL de caixinha durante pendência (substitui o
    // "Em breve você poderá fazer isso por aqui"). Extrai o nome da frase
    // ("chamada Saúde", "com o nome de saúde", "chamado X" → "Saúde"/"X").
    // Retorna { hasName, name } — name já normalizado para exibição
    // (capitalizado), sem gravar nada aqui.
    const localExtractNewCaixinhaName = function (rawText) {
      if (!rawText) return { hasName: false, name: '' }
      let t = ''
      try {
        t = localNorm(rawText).replace(/\s+/g, ' ').trim()
      } catch (_) {
        return { hasName: false, name: '' }
      }
      if (!t) return { hasName: false, name: '' }
      const patterns = [
        /\b(?:chamada|chamado|chamada de|chamado de|chamada como|chamado como|com o nome de|com nome de|com o nome|com nome|nome de|nome:|nome)\s+(.+)$/,
        /\b(?:caixinha|cofrinho|orcamento)\s+(.+)$/,
      ]
      let candidate = ''
      for (let pi = 0; pi < patterns.length; pi++) {
        const mN = t.match(patterns[pi])
        if (mN && mN[1]) {
          candidate = mN[1]
          break
        }
      }
      if (!candidate) return { hasName: false, name: '' }
      // Remove verbo/resíduo inicial ("criar ", "crie ", "uma ", "nova "...)
      candidate = candidate.replace(
        /^(?:cria|criar|crie|criando|monta|montar|monte|faz|fazer|faca|adiciona|adicionar|adicione|quero|uma|um|o|a|nova|novo|novo caixinha|de)\s+/,
        '',
      )
      // Remove frases de guarda do lançamento pendente no fim
      candidate = candidate
        .replace(
          /\s*(?:e\s+)?(?:guarda|guarde|registra|registre|grava|grave|coloque|coloca|salva|salve|lanca|lance|joga|jogue)(?:\s+(?:esse|esta|este|isso|o|a|os|as|meu|minha))?\b.*$/,
          '',
        )
        .trim()
      // Remove resíduos de cortesia ("pra mim", "por favor"...) que sobramam
      candidate = candidate
        .replace(/\s*(?:pra|para)\s+mim\s*$/, '')
        .replace(/\s*(?:por\s+favor|pf|pfv)\s*$/, '')
        .replace(/\s*(?:aqui|agora)\s*$/, '')
        .trim()
      candidate = candidate.replace(/\s+/g, ' ').trim()
      if (!candidate || candidate.length > 60) return { hasName: false, name: '' }
      // Capitaliza cada palavra para exibição ("saúde" → "Saúde")
      const words = candidate.split(' ')
      for (let wi = 0; wi < words.length; wi++) {
        if (words[wi].length > 2) {
          words[wi] = words[wi].charAt(0).toUpperCase() + words[wi].slice(1)
        }
      }
      return { hasName: true, name: words.join(' ') }
    }

    // v0.0.138: cria a caixinha (se ainda não existir, case-insensitive) e
    // grava o lançamento pendente nela, reaproveitando o shape de transação
    // e o aviso de teto do fluxo de escolha já existente (~1694). Retorna
    // { reply } — o chamador responde com handled: true.
    const localCreateCaixinhaAndRecord = function (
      app,
      userId,
      pendingInfo,
      caixinhaName,
      todayStr,
      txSource,
      contactRef,
    ) {
      const amount = pendingInfo.amount || 0
      const description = pendingInfo.description || 'Gasto'
      const expenseDate = pendingInfo.date || todayStr
      const valFmt = localFormatCentsToBrl(amount)
      const normTarget = localNorm(caixinhaName)

      // 2. Se já existe caixinha do mesmo owner com nome equivalente
      // (case-insensitive), usa a existente — nunca duplica.
      let budgetRec = null
      let wasCreated = false
      try {
        const existing = app.findRecordsByFilter(
          'budgets',
          `owner = '${userId}'`,
          '-created',
          500,
          0,
        )
        for (let i = 0; i < existing.length; i++) {
          if (localNorm(existing[i].getString('name')) === normTarget) {
            budgetRec = existing[i]
            break
          }
        }
      } catch (_) {}

      // 3. Não existe: cria com teto zero (aviso de teto só quando há teto).
      if (!budgetRec) {
        try {
          const budgetsCol = app.findCollectionByNameOrId('budgets')
          const created = new Record(budgetsCol)
          created.set('owner', userId)
          created.set('name', caixinhaName)
          created.set('month', expenseDate.slice(0, 7))
          created.set('amount', 0)
          app.save(created)
          budgetRec = created
          wasCreated = true
        } catch (e) {
          console.log(
            `[whatsapp_bridge] v0.0.138: falha ao criar caixinha '${caixinhaName}' p/ user ${userId}: ${e}`,
          )
          return {
            reply: `Não consegui criar a caixinha *${caixinhaName}* agora. 😕 Tente responder com o número da caixinha da lista, por favor!`,
          }
        }
      }

      // 4. Grava o lançamento pendente (mesmo shape do fluxo de escolha).
      let savedTx = false
      try {
        const txCol = app.findCollectionByNameOrId('transactions')
        const newTx = new Record(txCol)
        newTx.set('owner', userId)
        newTx.set('amount', amount)
        newTx.set('description', description)
        newTx.set('date', expenseDate)
        newTx.set('category', pendingInfo.category_id)
        newTx.set('type', 'despesa')
        newTx.set('source', pendingInfo.source || txSource)
        newTx.set('status', 'active')
        newTx.set('is_retroactive', pendingInfo.is_retroactive || false)
        newTx.set('budget', budgetRec.id)
        newTx.set('message_timestamp', new Date().toISOString())
        if (pendingInfo.note) {
          newTx.set('note', pendingInfo.note)
        }
        app.save(newTx)
        savedTx = true
      } catch (e) {
        console.log(
          `[whatsapp_bridge] v0.0.138: falha ao gravar lançamento na caixinha '${caixinhaName}' p/ user ${userId}: ${e}`,
        )
      }

      if (!savedTx) {
        return {
          reply: `Criei a caixinha *${caixinhaName}*, mas não consegui gravar o gasto agora. 😕 Pode mandar o lançamento de novo, por favor?`,
        }
      }

      // 5. Limpa a pendência (mesmos campos que o fluxo já limpa).
      contactRef.set('pending_category', '')
      contactRef.set('pending_caixinha', '')
      try {
        app.save(contactRef)
      } catch (_) {}

      // Aviso de teto (só quando há teto definido — teto zero não avisa).
      let remainingPhrase = ''
      try {
        const monthPrefix = expenseDate.slice(0, 7)
        const tetoCents = budgetRec.getInt('amount') || 0
        if (tetoCents > 0) {
          const txs = app.findRecordsByFilter(
            'transactions',
            `owner = '${userId}' && budget = '${budgetRec.id}' && type = 'despesa' && (status = 'active' || status = '' || status = null) && date >= '${monthPrefix}-01' && date <= '${monthPrefix}-31'`,
            '',
            500,
            0,
          )
          let spentTotal = 0
          for (let st = 0; st < txs.length; st++) {
            spentTotal += txs[st].getInt('amount') || 0
          }
          const rest = tetoCents - spentTotal
          if (rest >= 0) {
            remainingPhrase = ` Restam ${localFormatCentsToBrl(rest)} do seu teto neste mês.`
          } else {
            remainingPhrase = ` 🚨 Atenção: caixinha estourada por ${localFormatCentsToBrl(Math.abs(rest))}.`
          }
        }
      } catch (_) {}

      const retroPhrase =
        pendingInfo.is_retroactive && expenseDate
          ? ` (contabilizado em ${localFormatDatePtBr(expenseDate)})`
          : ''

      // 6. Confirmação.
      const confirmMsg = wasCreated
        ? `Caixinha *${caixinhaName}* criada ✅ Registrei o gasto de *${valFmt}* (${description}) nela${retroPhrase}. Ela nasceu sem teto — defina um no app quando quiser.`
        : `Registrei o gasto de *${valFmt}* (${description}) na caixinha *${caixinhaName}*, que você já tinha${retroPhrase} ✅`
      return {
        reply: confirmMsg + remainingPhrase,
      }
    }

    const localFormatDatePtBr = function (ymdStr) {
      if (!ymdStr || ymdStr.length < 10) return ''
      const parts = ymdStr.slice(0, 10).split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
      return ymdStr
    }

    const localParseRetroactiveDate = function (text, referenceDate) {
      if (!text) return null
      const now = referenceDate ? new Date(referenceDate) : new Date()
      const refYear = now.getFullYear()
      const refMonth = now.getMonth()
      const refDay = now.getDate()
      const t = localNorm(text)

      const formatYmd = function (d) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }
      const todayYmd = formatYmd(now)

      if (/\banteontem\b/.test(t)) {
        const target = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        return { isRetroactive: true, targetDateStr: formatYmd(target), matchedPhrase: 'anteontem' }
      }
      if (/\bontem\b/.test(t)) {
        const target = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
        return { isRetroactive: true, targetDateStr: formatYmd(target), matchedPhrase: 'ontem' }
      }
      const weekDaysMap = {
        domingo: 0,
        segunda: 1,
        terca: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
      }
      const weekMatch = t.match(
        /\b(n[ao]|ultim[ao]|passad[ao])?\s*(segunda|terca|quarta|quinta|sexta|sabado|domingo)(-feira)?\b/,
      )
      if (weekMatch) {
        const targetDayIndex = weekDaysMap[weekMatch[2]]
        if (typeof targetDayIndex === 'number') {
          const currentDayIndex = now.getDay()
          let diff = currentDayIndex - targetDayIndex
          if (diff <= 0) diff += 7
          const target = new Date(now.getTime() - diff * 24 * 60 * 60 * 1000)
          const targetStr = formatYmd(target)
          if (targetStr !== todayYmd) {
            return {
              isRetroactive: true,
              targetDateStr: targetStr,
              matchedPhrase: weekMatch[0].trim(),
            }
          }
        }
      }
      const slashMatch = t.match(/\b(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?\b/)
      if (slashMatch) {
        const dNum = parseInt(slashMatch[1], 10)
        const mNum = parseInt(slashMatch[2], 10) - 1
        let yNum = slashMatch[4] ? parseInt(slashMatch[4], 10) : refYear
        if (yNum < 100) yNum += 2000
        if (dNum >= 1 && dNum <= 31 && mNum >= 0 && mNum <= 11) {
          const target = new Date(yNum, mNum, dNum)
          const targetStr = formatYmd(target)
          return {
            isRetroactive: targetStr !== todayYmd,
            targetDateStr: targetStr,
            matchedPhrase: slashMatch[0],
          }
        }
      }
      const monthsMap = {
        janeiro: 0,
        fevereiro: 1,
        marco: 2,
        abril: 3,
        maio: 4,
        junho: 5,
        julho: 6,
        agosto: 7,
        setembro: 8,
        outubro: 9,
        novembro: 10,
        dezembro: 11,
      }
      const dayMonthMatch = t.match(
        /\b(no\s+)?dia\s+(\d{1,2})(\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))?\b/,
      )
      if (dayMonthMatch) {
        const dNum = parseInt(dayMonthMatch[2], 10)
        let mNum = refMonth
        if (dayMonthMatch[4] && typeof monthsMap[dayMonthMatch[4]] === 'number') {
          mNum = monthsMap[dayMonthMatch[4]]
        } else if (dNum > refDay) {
          mNum = refMonth === 0 ? 11 : refMonth - 1
        }
        const yNum = mNum > refMonth ? refYear - 1 : refYear
        if (dNum >= 1 && dNum <= 31) {
          const target = new Date(yNum, mNum, dNum)
          const targetStr = formatYmd(target)
          return {
            isRetroactive: targetStr !== todayYmd,
            targetDateStr: targetStr,
            matchedPhrase: dayMonthMatch[0].trim(),
          }
        }
      }
      return null
    }

    const localIsConfirmationNo = function (text) {
      if (!text) return false
      const t = localNorm(text)
      return (
        t === 'nao' ||
        t === 'n' ||
        t === 'cancela nao' ||
        t === 'deixa' ||
        t === 'deixa pra la' ||
        t === 'esquece' ||
        t === 'nao precisa'
      )
    }

    const localTryParseSpendingExpense = function (app, userId, text, referenceDateYmd) {
      if (!app || !userId || !text) return null
      const raw = String(text).trim()
      const norm = localNorm(raw)

      const hasNumber = /\d+([.,]\d{1,2})?/.test(norm)
      let isCandidate = false
      if (hasNumber) {
        if (
          norm.includes('real') ||
          norm.includes('reais') ||
          norm.includes('r$') ||
          norm.includes('gastei') ||
          norm.includes('comprei') ||
          norm.includes('paguei') ||
          norm.includes('custou') ||
          norm.includes('despesa') ||
          norm.includes('almo') ||
          norm.includes('uber') ||
          norm.includes('mercado') ||
          norm.includes('padaria') ||
          norm.includes('farmacia') ||
          norm.includes('cafe') ||
          norm.includes('gasolina') ||
          norm.includes('lanche') ||
          norm.includes('pizza') ||
          norm.includes('jantar') ||
          norm.includes('ifood') ||
          norm.includes('combustivel')
        ) {
          isCandidate = true
        } else if (/^[a-z\s]{3,20}\s+\d+([.,]\d{1,2})?$/.test(norm)) {
          isCandidate = true
        } else if (/^\d+([.,]\d{1,2})?\s+[a-z\s]{3,20}$/.test(norm)) {
          isCandidate = true
        }
      } else if (
        norm.startsWith('gastei ') ||
        norm.startsWith('paguei ') ||
        norm.startsWith('comprei ') ||
        norm.includes(' novo gasto') ||
        norm.includes('registrar gasto') ||
        norm.includes('registra gasto') ||
        norm.includes('lancar gasto') ||
        norm.includes('lança gasto')
      ) {
        isCandidate = true
      }

      if (!isCandidate) return null

      const valMatch =
        raw.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/i) ||
        raw.match(/(\d+(?:[.,]\d{1,2})?)\s*reais/i) ||
        raw.match(/\b(\d+(?:[.,]\d{1,2})?)\b/)

      if (!valMatch) return null

      const numStr = valMatch[1].replace(',', '.')
      const floatVal = parseFloat(numStr)
      if (isNaN(floatVal) || floatVal <= 0) return null
      const cents = Math.round(floatVal * 100)

      let dateYmd = referenceDateYmd || new Date().toISOString().slice(0, 10)
      let isRetroactive = false
      let matchedPhrase = ''
      const retro = localParseRetroactiveDate(raw, dateYmd)
      if (retro && retro.isRetroactive && retro.targetDateStr) {
        dateYmd = retro.targetDateStr
        isRetroactive = true
        matchedPhrase = retro.matchedPhrase
      }

      let userCategories = []
      try {
        userCategories = app.findRecordsByFilter(
          'categories',
          `(owner = '${userId}' || owner = '' || owner = null) && type = 'despesa'`,
          '-created',
          100,
          0,
        )
      } catch (_) {}

      if (userCategories.length === 0) {
        try {
          userCategories = app.findRecordsByFilter(
            'categories',
            `type = 'despesa'`,
            '-created',
            100,
            0,
          )
        } catch (_) {}
      }

      let matchedCategory = null
      let matchedCategoryScore = 0
      let matchedCategories = []

      const cleanedTerm = norm
        .replace(valMatch[0].toLowerCase(), '')
        .replace(
          /\b(gastei|comprei|paguei|custou|no|na|de|em|para|com|reais|r\$|ontem|anteontem)\b/g,
          ' ',
        )
        .trim()

      for (let c = 0; c < userCategories.length; c++) {
        const cat = userCategories[c]
        const cName = localNorm(cat.getString('name'))
        let score = 0

        if (cName && norm.includes(cName)) {
          score = 100
        } else if (
          cName.includes('alimenta') &&
          (norm.includes('almo') ||
            norm.includes('jantar') ||
            norm.includes('lanche') ||
            norm.includes('comida') ||
            norm.includes('restaurante') ||
            norm.includes('mercado') ||
            norm.includes('padaria') ||
            norm.includes('ifood') ||
            norm.includes('pizza') ||
            norm.includes('cafe'))
        ) {
          score = 80
        } else if (
          cName.includes('transporte') &&
          (norm.includes('uber') ||
            norm.includes('gasolina') ||
            norm.includes('combustivel') ||
            norm.includes('onibus') ||
            norm.includes('metro') ||
            norm.includes('estacionamento') ||
            norm.includes('pedagio'))
        ) {
          score = 80
        } else if (
          cName.includes('saude') &&
          (norm.includes('farmacia') ||
            norm.includes('remedio') ||
            norm.includes('medico') ||
            norm.includes('consulta') ||
            norm.includes('dentista'))
        ) {
          score = 80
        } else if (
          cName.includes('moradia') &&
          (norm.includes('aluguel') ||
            norm.includes('condominio') ||
            norm.includes('luz') ||
            norm.includes('agua') ||
            norm.includes('internet'))
        ) {
          score = 80
        } else if (
          cName.includes('lazer') &&
          (norm.includes('cinema') ||
            norm.includes('show') ||
            norm.includes('passeio') ||
            norm.includes('viagem') ||
            norm.includes('bar'))
        ) {
          score = 80
        }

        if (score > 0) {
          if (score > matchedCategoryScore) {
            matchedCategoryScore = score
            matchedCategory = cat
            matchedCategories = [{ id: cat.id, name: cat.getString('name') }]
          } else if (score === matchedCategoryScore) {
            // Evita duplicatas se a mesma categoria aparecer duas vezes
            if (!matchedCategories.some((mc) => mc.id === cat.id)) {
              matchedCategories.push({ id: cat.id, name: cat.getString('name') })
            }
          }
        }
      }

      let candidateCategories = []
      if (matchedCategoryScore > 0 && matchedCategories.length > 0) {
        candidateCategories = matchedCategories
      }

      if (!matchedCategory && userCategories.length > 0) {
        matchedCategory =
          userCategories.find((c) => localNorm(c.getString('name')).includes('outros')) ||
          userCategories[0]
        candidateCategories = []
      }

      if (!matchedCategory) return null

      let desc = cleanedTerm
        ? cleanedTerm.charAt(0).toUpperCase() + cleanedTerm.slice(1)
        : matchedCategory.getString('name')

      if (desc.length < 3) {
        desc = matchedCategory.getString('name')
      }

      return {
        amount: cents,
        description: desc,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.getString('name'),
        candidateCategories: candidateCategories,
        date: dateYmd,
        isRetroactive: isRetroactive,
        matchedPhrase: matchedPhrase,
      }
    }

    const localGetCandidateBudgetsForCategory = function (
      app,
      userId,
      categoryId,
      categoryName,
      currentMonth,
    ) {
      const normCatName = localNorm(categoryName)
      let links = []
      try {
        links = app.findRecordsByFilter(
          'category_caixinha_links',
          `user = '${userId}' && active = true`,
          '-created',
          100,
          0,
        )
      } catch (_) {}

      if (links.length === 0) return []

      const matchingBudgetIds = []
      for (let l = 0; l < links.length; l++) {
        const lk = links[l]
        const lkCatId = lk.getString('category_id') || lk.getString('category')
        const lkCatName = localNorm(lk.getString('category_name'))
        const bId = lk.getString('budget')
        if (!bId) continue

        if (
          (lkCatId && lkCatId === categoryId) ||
          (lkCatName &&
            normCatName &&
            (lkCatName === normCatName ||
              lkCatName.includes(normCatName) ||
              normCatName.includes(lkCatName)))
        ) {
          if (!matchingBudgetIds.includes(bId)) {
            matchingBudgetIds.push(bId)
          }
        }
      }

      if (matchingBudgetIds.length === 0) return []

      let userBudgets = []
      try {
        userBudgets = app.findRecordsByFilter('budgets', `owner = '${userId}'`, '-created', 100, 0)
      } catch (_) {}

      let allCats = []
      try {
        allCats = app.findRecordsByFilter('categories', '', '', 200, 0)
      } catch (_) {}
      const catMap = {}
      for (let c = 0; c < allCats.length; c++) {
        catMap[allCats[c].id] = allCats[c]
      }

      const candidates = []
      for (let b = 0; b < userBudgets.length; b++) {
        const bg = userBudgets[b]
        if (matchingBudgetIds.includes(bg.id)) {
          const directName = bg.getString('name')
          const directIcon = bg.getString('icon')
          const bCat = catMap[bg.getString('category')]
          const bName = directName || (bCat ? bCat.getString('name') : 'Caixinha')
          const bIcon = directIcon || (bCat ? bCat.getString('icon') : '')
          candidates.push({
            id: bg.id,
            name: bName,
            icon: bIcon,
            amount: bg.getInt('amount') || 0,
          })
        }
      }

      return candidates
    }

    const localHandleCaixinhaFlow = function (
      app,
      userId,
      text,
      contactRecord,
      referenceDateYmd,
      sourceOverride,
    ) {
      if (!app || !userId || !text) {
        return { handled: false, reply: '' }
      }

      const cleanText = String(text).trim()
      const todayStr = referenceDateYmd || new Date().toISOString().slice(0, 10)
      const txSource = sourceOverride || 'whatsapp_text'

      // 1.0 VERIFICA SE EXISTE PENDÊNCIA DE CATEGORIA AGUARDANDO RESPOSTA (pending_category) - Nível 1
      let pendingCategoryData = null
      if (contactRecord) {
        const rawPendingCat = contactRecord.getString('pending_category')
        if (rawPendingCat) {
          try {
            pendingCategoryData = JSON.parse(rawPendingCat)
          } catch (_) {}
        }
      }

      if (
        pendingCategoryData &&
        Array.isArray(pendingCategoryData.candidate_categories) &&
        pendingCategoryData.candidate_categories.length > 0
      ) {
        if (localIsConfirmationNo(cleanText) || cleanText.toLowerCase() === 'cancelar') {
          contactRecord.set('pending_category', '')
          try {
            app.save(contactRecord)
          } catch (_) {}
          return {
            handled: true,
            reply:
              'Tudo bem! Cancelei o registro do gasto. Seus lançamentos não foram alterados! Se precisar de algo, só me chamar. 😊',
          }
        }

        const catCands = pendingCategoryData.candidate_categories
        let chosenCategory = null

        // v0.0.138: pedido de CRIAR caixinha durante pendência agora CRIA
        // de verdade (teto zero) e grava o lançamento pendente nela.
        if (localDetectCreateCaixinhaIntent(cleanText)) {
          const nomeExtraido = localExtractNewCaixinhaName(cleanText)
          if (!nomeExtraido.hasName) {
            return {
              handled: true,
              reply: 'Perfeito! Qual o nome da caixinha? (ex.: "Crie uma caixinha chamada Saúde")',
            }
          }
          const respCatC = localCreateCaixinhaAndRecord(
            app,
            userId,
            pendingCategoryData,
            nomeExtraido.name,
            todayStr,
            txSource,
            contactRecord,
          )
          return { handled: true, reply: respCatC.reply }
        }

        // BLINDAGEM (v0.0.137): só número limpo 1..N ou "opção N" é escolha
        const shieldCat = localDetectPendingChoice(cleanText, catCands.length)
        if (shieldCat.isChoice) {
          chosenCategory = catCands[shieldCat.index - 1]
        } else if (shieldCat.allowNameMatch) {
          const normInput = localNorm(cleanText)
          for (let i = 0; i < catCands.length; i++) {
            const cName = localNorm(catCands[i].name)
            if (normInput === cName || cName.includes(normInput) || normInput.includes(cName)) {
              chosenCategory = catCands[i]
              break
            }
          }
        }

        if (chosenCategory) {
          // Limpa pending_category pois a categoria foi resolvida com sucesso
          contactRecord.set('pending_category', '')
          try {
            app.save(contactRecord)
          } catch (_) {}

          const chosenCategoryId = chosenCategory.id
          const chosenCategoryName = chosenCategory.name
          const catExpenseDate = pendingCategoryData.date || todayStr

          // Busca caixinhas candidatas para a categoria escolhida
          const caixinhaCandidates = localGetCandidateBudgetsForCategory(
            app,
            userId,
            chosenCategoryId,
            chosenCategoryName,
            catExpenseDate.slice(0, 7),
          )

          // Subcaso 1: Categoria escolhida possui mais de 1 caixinha vinculada (>1) -> Pergunta de caixinha (Nível 2)
          if (caixinhaCandidates.length > 1) {
            contactRecord.set(
              'pending_caixinha',
              JSON.stringify({
                amount: pendingCategoryData.amount,
                description: pendingCategoryData.description,
                category_id: chosenCategoryId,
                category_name: chosenCategoryName,
                date: catExpenseDate,
                is_retroactive: pendingCategoryData.is_retroactive || false,
                candidate_budgets: caixinhaCandidates,
                source: pendingCategoryData.source || txSource,
                note: pendingCategoryData.note || '',
                created_at: new Date().toISOString(),
              }),
            )
            try {
              app.save(contactRecord)
            } catch (_) {}

            let optionsList = ''
            for (let i = 0; i < caixinhaCandidates.length; i++) {
              optionsList += `${localGetNumberEmoji(i)} ${caixinhaCandidates[i].name}\n`
            }
            const valFmt = localFormatCentsToBrl(pendingCategoryData.amount)

            return {
              handled: true,
              reply: `Esse gasto de ${valFmt} (${pendingCategoryData.description}) entra em qual caixinha?\n\n${optionsList}\nResponda com o número ou nome da caixinha! 😊`,
            }
          }

          // Subcaso 2: Categoria escolhida possui exatamente 1 caixinha vinculada (=== 1) -> Grava direto com o budget
          if (caixinhaCandidates.length === 1) {
            const singleBudget = caixinhaCandidates[0]
            let txCol = null
            try {
              txCol = app.findCollectionByNameOrId('transactions')
            } catch (_) {}

            if (txCol) {
              const newTx = new Record(txCol)
              newTx.set('owner', userId)
              newTx.set('amount', pendingCategoryData.amount)
              newTx.set('description', pendingCategoryData.description)
              newTx.set('date', catExpenseDate)
              newTx.set('category', chosenCategoryId)
              newTx.set('type', 'despesa')
              newTx.set('source', pendingCategoryData.source || txSource)
              newTx.set('status', 'active')
              newTx.set('is_retroactive', pendingCategoryData.is_retroactive || false)
              newTx.set('budget', singleBudget.id)
              newTx.set('message_timestamp', new Date().toISOString())
              if (pendingCategoryData.note) {
                newTx.set('note', pendingCategoryData.note)
              }
              app.save(newTx)
            }

            const valFmt = localFormatCentsToBrl(pendingCategoryData.amount)
            let retroPhrase = ''
            if (pendingCategoryData.is_retroactive && catExpenseDate) {
              retroPhrase = ` (contabilizado em ${localFormatDatePtBr(catExpenseDate)})`
            }

            let remainingPhrase = ''
            try {
              const monthPrefix = catExpenseDate.slice(0, 7)
              const bRec = app.findRecordById('budgets', singleBudget.id)
              const tetoCents = (bRec && bRec.getInt('amount')) || singleBudget.amount || 0
              if (tetoCents > 0) {
                const txs = app.findRecordsByFilter(
                  'transactions',
                  `owner = '${userId}' && budget = '${singleBudget.id}' && type = 'despesa' && (status = 'active' || status = '' || status = null) && date >= '${monthPrefix}-01' && date <= '${monthPrefix}-31'`,
                  '',
                  500,
                  0,
                )
                let spentTotal = 0
                for (let st = 0; st < txs.length; st++) {
                  spentTotal += txs[st].getInt('amount') || 0
                }
                const rest = tetoCents - spentTotal
                if (rest >= 0) {
                  remainingPhrase = ` Restam ${localFormatCentsToBrl(rest)} do seu teto neste mês.`
                } else {
                  remainingPhrase = ` 🚨 Atenção: caixinha estourada por ${localFormatCentsToBrl(Math.abs(rest))}.`
                }
              }
            } catch (_) {}

            return {
              handled: true,
              reply: `Registrei seu gasto de *${pendingCategoryData.description}* (${valFmt}) na caixinha *${singleBudget.name}*${retroPhrase} ✅${remainingPhrase}`,
            }
          }

          // Subcaso 3: Categoria escolhida possui 0 caixinhas vinculadas (=== 0) -> Pendência de caixinha com TODAS as caixinhas do usuário
          if (contactRecord) {
            let allBudgetsB = []
            try {
              allBudgetsB = app.findRecordsByFilter(
                'budgets',
                `owner = '${userId}'`,
                '-created',
                100,
                0,
              )
            } catch (_) {}

            if (allBudgetsB.length > 0) {
              const allCandidatesB = []
              for (let b = 0; b < allBudgetsB.length; b++) {
                const bgB = allBudgetsB[b]
                allCandidatesB.push({
                  id: bgB.id,
                  name: bgB.getString('name') || 'Caixinha',
                  icon: bgB.getString('icon') || '',
                  amount: bgB.getInt('amount') || 0,
                })
              }

              contactRecord.set(
                'pending_caixinha',
                JSON.stringify({
                  amount: pendingCategoryData.amount,
                  description: pendingCategoryData.description,
                  category_id: chosenCategoryId,
                  category_name: chosenCategoryName,
                  date: catExpenseDate,
                  is_retroactive: pendingCategoryData.is_retroactive || false,
                  candidate_budgets: allCandidatesB,
                  source: pendingCategoryData.source || txSource,
                  note: pendingCategoryData.note || '',
                  created_at: new Date().toISOString(),
                }),
              )
              try {
                app.save(contactRecord)
              } catch (_) {}

              let allOptionsListB = ''
              for (let i = 0; i < allCandidatesB.length; i++) {
                allOptionsListB += `${localGetNumberEmoji(i)} ${allCandidatesB[i].name}\n`
              }
              const valFmtB = localFormatCentsToBrl(pendingCategoryData.amount)

              return {
                handled: true,
                reply: `Esse gasto de ${valFmtB} (${pendingCategoryData.description}) entra em qual caixinha?\n\n${allOptionsListB}\nResponda com o número ou nome da caixinha! 😊`,
              }
            }
          }

          // Sem contato ou sem caixinhas cadastradas: mantém comportamento anterior
          return { handled: false, reply: '' }
        }

        // Resposta não casou com nenhuma categoria da lista: repete a pergunta de categoria
        let repeatCatList = ''
        for (let i = 0; i < catCands.length; i++) {
          repeatCatList += `${localGetNumberEmoji(i)} ${catCands[i].name}\n`
        }
        const valFmt = localFormatCentsToBrl(pendingCategoryData.amount)
        return {
          handled: true,
          reply: `Não entendi qual opção você escolheu para o gasto de *${valFmt}* (${pendingCategoryData.description}).\n\nPor favor, responda apenas com o número ou nome da categoria:\n\n${repeatCatList}\nOu envie "cancelar" para desconsiderar.`,
        }
      }

      // 1.1 VERIFICA SE EXISTE PENDÊNCIA AGUARDANDO RESPOSTA (pending_caixinha) - Nível 2
      let pendingData = null
      if (contactRecord) {
        const rawPending = contactRecord.getString('pending_caixinha')
        if (rawPending) {
          try {
            pendingData = JSON.parse(rawPending)
          } catch (_) {}
        }
      }

      if (
        pendingData &&
        Array.isArray(pendingData.candidate_budgets) &&
        pendingData.candidate_budgets.length > 0
      ) {
        if (localIsConfirmationNo(cleanText) || cleanText.toLowerCase() === 'cancelar') {
          contactRecord.set('pending_caixinha', '')
          try {
            app.save(contactRecord)
          } catch (_) {}
          return {
            handled: true,
            reply:
              'Tudo bem! Cancelei o registro do gasto. Seus lançamentos não foram alterados! Se precisar de algo, só me chamar. 😊',
          }
        }

        const cands = pendingData.candidate_budgets
        let chosenBudget = null

        // v0.0.138: pedido de CRIAR caixinha durante pendência agora CRIA
        // de verdade (teto zero) e grava o lançamento pendente nela.
        if (localDetectCreateCaixinhaIntent(cleanText)) {
          const nomeExtraidoB = localExtractNewCaixinhaName(cleanText)
          if (!nomeExtraidoB.hasName) {
            return {
              handled: true,
              reply: 'Perfeito! Qual o nome da caixinha? (ex.: "Crie uma caixinha chamada Saúde")',
            }
          }
          const respPendC = localCreateCaixinhaAndRecord(
            app,
            userId,
            pendingData,
            nomeExtraidoB.name,
            todayStr,
            txSource,
            contactRecord,
          )
          return { handled: true, reply: respPendC.reply }
        }

        // BLINDAGEM (v0.0.137): só número limpo 1..N, "caixinha N" ou "opção N"
        // é escolha; números monetários e frases com números não são.
        const shieldPick = localDetectPendingChoice(cleanText, cands.length)
        if (shieldPick.isChoice) {
          chosenBudget = cands[shieldPick.index - 1]
        } else if (shieldPick.allowNameMatch) {
          const normInput = localNorm(cleanText)
          for (let i = 0; i < cands.length; i++) {
            const cName = localNorm(cands[i].name)
            if (normInput === cName || cName.includes(normInput) || normInput.includes(cName)) {
              chosenBudget = cands[i]
              break
            }
            const parts = cands[i].name.split('-').map((p) => localNorm(p))
            if (parts.length > 1) {
              const suffix = parts[parts.length - 1]
              if (suffix && (normInput === suffix || normInput.includes(suffix))) {
                chosenBudget = cands[i]
                break
              }
            }
          }
        }

        if (chosenBudget) {
          let txCol = null
          try {
            txCol = app.findCollectionByNameOrId('transactions')
          } catch (_) {}

          if (txCol) {
            const newTx = new Record(txCol)
            newTx.set('owner', userId)
            newTx.set('amount', pendingData.amount)
            newTx.set('description', pendingData.description)
            newTx.set('date', pendingData.date)
            newTx.set('category', pendingData.category_id)
            newTx.set('type', 'despesa')
            newTx.set('source', pendingData.source || txSource)
            newTx.set('status', 'active')
            newTx.set('is_retroactive', pendingData.is_retroactive || false)
            newTx.set('budget', chosenBudget.id)
            newTx.set('message_timestamp', new Date().toISOString())
            if (pendingData.note) {
              newTx.set('note', pendingData.note)
            }
            app.save(newTx)
          }

          contactRecord.set('pending_caixinha', '')
          try {
            app.save(contactRecord)
          } catch (_) {}

          const valFmt = localFormatCentsToBrl(pendingData.amount)
          let retroPhrase = ''
          if (pendingData.is_retroactive && pendingData.date) {
            retroPhrase = ` (contabilizado em ${localFormatDatePtBr(pendingData.date)})`
          }

          // Calcula quanto resta do teto da caixinha escolhida
          let remainingPhrase = ''
          try {
            const monthPrefix = (pendingData.date || todayStr).slice(0, 7)
            const bRec = app.findRecordById('budgets', chosenBudget.id)
            const tetoCents = (bRec && bRec.getInt('amount')) || chosenBudget.amount || 0
            if (tetoCents > 0) {
              const txs = app.findRecordsByFilter(
                'transactions',
                `owner = '${userId}' && budget = '${chosenBudget.id}' && type = 'despesa' && (status = 'active' || status = '' || status = null) && date >= '${monthPrefix}-01' && date <= '${monthPrefix}-31'`,
                '',
                500,
                0,
              )
              let spentTotal = 0
              for (let st = 0; st < txs.length; st++) {
                spentTotal += txs[st].getInt('amount') || 0
              }
              const rest = tetoCents - spentTotal
              if (rest >= 0) {
                remainingPhrase = ` Restam ${localFormatCentsToBrl(rest)} do seu teto neste mês.`
              } else {
                remainingPhrase = ` 🚨 Atenção: caixinha estourada por ${localFormatCentsToBrl(Math.abs(rest))}.`
              }
            }
          } catch (_) {}

          return {
            handled: true,
            reply: `Perfeito! Registrei seu gasto de *${pendingData.description}* (${valFmt}) na caixinha *${chosenBudget.name}*${retroPhrase} ✅${remainingPhrase}\n\nQualquer novo gasto, só mandar!`,
          }
        }

        let repeatList = ''
        for (let i = 0; i < cands.length; i++) {
          repeatList += `${localGetNumberEmoji(i)} ${cands[i].name}\n`
        }
        const valFmt = localFormatCentsToBrl(pendingData.amount)
        return {
          handled: true,
          reply: `Não entendi qual opção você escolheu para o gasto de *${valFmt}* (${pendingData.description}).\n\nPor favor, responda apenas com o número da caixinha:\n\n${repeatList}\nOu envie "cancelar" para desconsiderar.`,
        }
      }

      // 2. SE NÃO HÁ PENDÊNCIA, ANALISA SE A MENSAGEM É UM NOVO GASTO
      const parsedExpense = localTryParseSpendingExpense(app, userId, cleanText, todayStr)
      if (!parsedExpense) {
        return { handled: false, reply: '' }
      }

      // Caso 0: MAIS DE UMA CATEGORIA CANDIDATA (>1) -> Pergunta de CATEGORIA (Nível 1) e NÃO grava nada ainda
      if (
        Array.isArray(parsedExpense.candidateCategories) &&
        parsedExpense.candidateCategories.length > 1
      ) {
        if (contactRecord) {
          contactRecord.set(
            'pending_category',
            JSON.stringify({
              amount: parsedExpense.amount,
              description: parsedExpense.description,
              date: parsedExpense.date,
              is_retroactive: parsedExpense.isRetroactive,
              source: txSource,
              note: '',
              candidate_categories: parsedExpense.candidateCategories,
              created_at: new Date().toISOString(),
            }),
          )
          try {
            app.save(contactRecord)
          } catch (_) {}
        }

        let catOptionsList = ''
        for (let i = 0; i < parsedExpense.candidateCategories.length; i++) {
          catOptionsList += `${localGetNumberEmoji(i)} ${parsedExpense.candidateCategories[i].name}\n`
        }
        const valFmt = localFormatCentsToBrl(parsedExpense.amount)

        return {
          handled: true,
          reply: `Esse gasto de ${valFmt} (${parsedExpense.description}) é de qual categoria?\n\n${catOptionsList}\nResponda com o número ou o nome da categoria! 😊`,
        }
      }

      const candidates = localGetCandidateBudgetsForCategory(
        app,
        userId,
        parsedExpense.categoryId,
        parsedExpense.categoryName,
        todayStr.slice(0, 7),
      )

      // Caso 1: MAIS DE UMA CAIXINHA CANDIDATA (>1) -> Pergunta 1️⃣/2️⃣ e NÃO grava transação ainda
      if (candidates.length > 1) {
        if (contactRecord) {
          contactRecord.set(
            'pending_caixinha',
            JSON.stringify({
              amount: parsedExpense.amount,
              description: parsedExpense.description,
              category_id: parsedExpense.categoryId,
              category_name: parsedExpense.categoryName,
              date: parsedExpense.date,
              is_retroactive: parsedExpense.isRetroactive,
              candidate_budgets: candidates,
              source: txSource,
              created_at: new Date().toISOString(),
            }),
          )
          try {
            app.save(contactRecord)
          } catch (_) {}
        }

        let optionsList = ''
        for (let i = 0; i < candidates.length; i++) {
          optionsList += `${localGetNumberEmoji(i)} ${candidates[i].name}\n`
        }
        const valFmt = localFormatCentsToBrl(parsedExpense.amount)

        return {
          handled: true,
          reply: `Esse gasto de ${valFmt} (${parsedExpense.description}) entra em qual caixinha?\n\n${optionsList}\nResponda com o número ou nome da caixinha! 😊`,
        }
      }

      // Caso 2: UMA ÚNICA CAIXINHA CANDIDATA (=== 1) -> Grava direto com o budget preenchido
      if (candidates.length === 1) {
        const singleBudget = candidates[0]
        let txCol = null
        try {
          txCol = app.findCollectionByNameOrId('transactions')
        } catch (_) {}

        if (txCol) {
          const newTx = new Record(txCol)
          newTx.set('owner', userId)
          newTx.set('amount', parsedExpense.amount)
          newTx.set('description', parsedExpense.description)
          newTx.set('date', parsedExpense.date)
          newTx.set('category', parsedExpense.categoryId)
          newTx.set('type', 'despesa')
          newTx.set('source', txSource)
          newTx.set('status', 'active')
          newTx.set('is_retroactive', parsedExpense.isRetroactive || false)
          newTx.set('budget', singleBudget.id)
          newTx.set('message_timestamp', new Date().toISOString())
          app.save(newTx)
        }

        const valFmt = localFormatCentsToBrl(parsedExpense.amount)
        let retroPhrase = ''
        if (parsedExpense.isRetroactive && parsedExpense.date) {
          retroPhrase = ` (contabilizado em ${localFormatDatePtBr(parsedExpense.date)})`
        }

        let remainingPhrase = ''
        try {
          const monthPrefix = (parsedExpense.date || todayStr).slice(0, 7)
          const bRec = app.findRecordById('budgets', singleBudget.id)
          const tetoCents = (bRec && bRec.getInt('amount')) || singleBudget.amount || 0
          if (tetoCents > 0) {
            const txs = app.findRecordsByFilter(
              'transactions',
              `owner = '${userId}' && budget = '${singleBudget.id}' && type = 'despesa' && (status = 'active' || status = '' || status = null) && date >= '${monthPrefix}-01' && date <= '${monthPrefix}-31'`,
              '',
              500,
              0,
            )
            let spentTotal = 0
            for (let st = 0; st < txs.length; st++) {
              spentTotal += txs[st].getInt('amount') || 0
            }
            const rest = tetoCents - spentTotal
            if (rest >= 0) {
              remainingPhrase = ` Restam ${localFormatCentsToBrl(rest)} do seu teto neste mês.`
            } else {
              remainingPhrase = ` 🚨 Atenção: caixinha estourada por ${localFormatCentsToBrl(Math.abs(rest))}.`
            }
          }
        } catch (_) {}

        return {
          handled: true,
          reply: `Registrei seu gasto de *${parsedExpense.description}* (${valFmt}) na caixinha *${singleBudget.name}*${retroPhrase} ✅${remainingPhrase}`,
        }
      }

      // Caso 3: ZERO VÍNCULOS PARAMETRIZADOS (=== 0) -> Pendência de caixinha com TODAS as caixinhas do usuário
      if (contactRecord) {
        let allBudgets = []
        try {
          allBudgets = app.findRecordsByFilter('budgets', `owner = '${userId}'`, '-created', 100, 0)
        } catch (_) {}

        if (allBudgets.length > 0) {
          const allCandidates = []
          for (let b = 0; b < allBudgets.length; b++) {
            const bg = allBudgets[b]
            allCandidates.push({
              id: bg.id,
              name: bg.getString('name') || 'Caixinha',
              icon: bg.getString('icon') || '',
              amount: bg.getInt('amount') || 0,
            })
          }

          contactRecord.set(
            'pending_caixinha',
            JSON.stringify({
              amount: parsedExpense.amount,
              description: parsedExpense.description,
              category_id: parsedExpense.categoryId,
              category_name: parsedExpense.categoryName,
              date: parsedExpense.date,
              is_retroactive: parsedExpense.isRetroactive,
              candidate_budgets: allCandidates,
              source: txSource,
              note: '',
              created_at: new Date().toISOString(),
            }),
          )
          try {
            app.save(contactRecord)
          } catch (_) {}

          let allOptionsList = ''
          for (let i = 0; i < allCandidates.length; i++) {
            allOptionsList += `${localGetNumberEmoji(i)} ${allCandidates[i].name}\n`
          }
          const valFmt = localFormatCentsToBrl(parsedExpense.amount)

          return {
            handled: true,
            reply: `Esse gasto de ${valFmt} (${parsedExpense.description}) entra em qual caixinha?\n\n${allOptionsList}\nResponda com o número ou nome da caixinha! 😊`,
          }
        }
      }

      // Sem contato ou sem caixinhas cadastradas: mantém comportamento anterior
      return { handled: false, reply: '' }
    }
    const normalizeDigits = function (raw) {
      if (!raw) return ''
      let digits = String(raw).replace(/\D/g, '')
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits
      }
      return digits
    }

    const getOrCreateGuestUser = function () {
      try {
        const guest = $app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'whatsapp-visitante@agente.internal',
        )
        if (guest && guest.id) return guest
      } catch (_) {}

      try {
        const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
        if (users.length > 0 && users[0].id) return users[0]
      } catch (_) {}

      try {
        const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
        const newGuest = new Record(usersCol)
        newGuest.setEmail('whatsapp-visitante@agente.internal')
        newGuest.setPassword('Skip@Pass123!')
        newGuest.setVerified(true)
        newGuest.set('name', 'Visitante WhatsApp')
        newGuest.set('onboarding_completed', true)
        $app.save(newGuest)
        console.log('[whatsapp_bridge] Usuário visitante criado sob demanda:', newGuest.id)
        return newGuest
      } catch (err) {
        console.log('[whatsapp_bridge] Falha ao criar usuário visitante sob demanda:', err)
      }

      return null
    }

    const isUserAccountReady = function (u) {
      if (!u || !u.id) return false
      // Visitante técnico nunca é considerado usuário cadastrado
      if (u.getString('email') === 'whatsapp-visitante@agente.internal') return false

      // Critério único e centralizado de cadastro completo:
      // Usuário existe no banco de dados. Tolera email pendente de verificação
      // (usuária pode lançar gastos logo após criar conta sem travar no clique do email).
      // Onboarding de caixinhas concluído (onboarding_completed: true) OU possui caixinhas/categorias criadas.
      const onboardingFlag = u.getBool('onboarding_completed')
      if (onboardingFlag) return true

      try {
        const cats = $app.findRecordsByFilter('categories', `owner = '${u.id}'`, '-created', 1, 0)
        if (cats.length > 0) return true
      } catch (_) {}

      return false
    }

    const resolveUser = function (phoneDigits, senderName) {
      if (!phoneDigits) return null

      const suffixMatch = function (p1, p2) {
        if (!p1 || !p2) return false
        if (p1 === p2) return true
        if (p1.endsWith(p2) || p2.endsWith(p1)) return true
        const s1 = p1.slice(-8)
        const s2 = p2.slice(-8)
        return s1.length >= 8 && s1 === s2
      }

      // 1. Verifica se já existe vínculo explícito em whatsapp_contacts
      try {
        const contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', phoneDigits)
        const contactUserId = contact.getString('user')
        if (contactUserId) {
          const u = $app.findRecordById('_pb_users_auth_', contactUserId)
          if (u && u.id && u.getString('email') !== 'whatsapp-visitante@agente.internal') {
            return u
          }
        }
      } catch (_) {}

      // 2. Busca na coleção de usuários pelo campo phone (com match por sufixo)
      try {
        const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 300, 0)
        for (let u = 0; u < users.length; u++) {
          const user = users[u]
          if (user.getString('email') === 'whatsapp-visitante@agente.internal') continue
          const userPhone = normalizeDigits(user.getString('phone'))
          if (userPhone && suffixMatch(userPhone, phoneDigits)) {
            return user
          }
        }
      } catch (_) {}

      // 3. Fallback inteligente: se há exatamente 1 usuário real cadastrado no sistema
      // (caso típico de single-user / ambiente de teste após reset) e o usuário ainda não
      // preencheu o campo phone, faz a auto-associação automática e salva o phone
      try {
        const realUsers = $app.findRecordsByFilter(
          '_pb_users_auth_',
          "email != 'whatsapp-visitante@agente.internal'",
          '-created',
          10,
          0,
        )
        if (realUsers.length === 1) {
          const soleUser = realUsers[0]
          const existingPhone = normalizeDigits(soleUser.getString('phone'))
          if (!existingPhone || suffixMatch(existingPhone, phoneDigits)) {
            if (!existingPhone) {
              try {
                soleUser.set('phone', phoneDigits)
                $app.save(soleUser)
                console.log(
                  `[whatsapp_bridge] Telefone ${phoneDigits} auto-vinculado ao único usuário real cadastrado: ${soleUser.id} (${soleUser.getString('email')})`,
                )
              } catch (_) {}
            }
            return soleUser
          }
        }
      } catch (_) {}

      return null
    }

    const sendMetaStatusAndTyping = function (messageId) {
      if (!messageId) return { success: false, error: 'message_id ausente' }

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          if (recToken) break
        }
      } catch (_) {}

      if (!token) {
        console.log('[whatsapp_bridge] [status+typing] Token ausente, prosseguindo sem indicação')
        return { success: false, error: 'Token ausente' }
      }

      const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: String(messageId),
        typing_indicator: {
          type: 'text',
        },
      }

      try {
        const res = $http.send({
          url: endpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 10,
        })
        const statusCode = res.statusCode
        if (statusCode >= 200 && statusCode < 300) {
          console.log(
            '[whatsapp_bridge] [status+typing] Sucesso status=read + typing_indicator para msg:',
            messageId,
          )
          return { success: true, status: statusCode }
        }
        console.log(
          '[whatsapp_bridge] [status+typing] Meta retornou status HTTP ' +
            statusCode +
            ', seguindo normalmente',
        )
        return { success: false, status: statusCode }
      } catch (err) {
        console.log(
          '[whatsapp_bridge] [status+typing] Exceção na chamada de status (fail-safe):',
          err,
        )
        return { success: false, error: String(err) }
      }
    }

    const sendMetaMessage = function (toNumber, textBody) {
      const cleanTo = normalizeDigits(toNumber)
      if (!cleanTo) return { success: false, error: 'Número inválido' }

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let statusRecord = null

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          if (!statusRecord) statusRecord = rec
          if (recToken) {
            statusRecord = rec
            break
          }
        }
      } catch (_) {}

      if (!token) {
        const errMsg = 'Token da Meta ausente em Minha Conta'
        console.log('[whatsapp_bridge] Falha no envio: Token de acesso ausente')
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'failed_missing_token')
            statusRecord.set('last_send_error', errMsg)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return { success: false, error: errMsg, missing_token: true }
      }

      const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: false,
          body: String(textBody || '').trim(),
        },
      }

      console.log('[whatsapp_bridge] POST ' + endpoint + ' para to=' + cleanTo)

      let res = null
      try {
        res = $http.send({
          url: endpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 30,
        })
      } catch (httpErr) {
        const netErr =
          'Erro de conexão com Meta Graph API: ' +
          (httpErr ? httpErr.message || String(httpErr) : '')
        console.log('[whatsapp_bridge] Exceção $http.send:', netErr)
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'network_error')
            statusRecord.set('last_send_error', netErr)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return { success: false, error: netErr }
      }

      const statusCode = res.statusCode
      const rawBody = res.rawText || ''
      let responseJson = {}
      try {
        responseJson = JSON.parse(rawBody)
      } catch (_) {
        responseJson = { raw: rawBody }
      }

      console.log(
        '[whatsapp_bridge] Meta Graph API statusCode=' +
          statusCode +
          ' body=' +
          rawBody.slice(0, 300),
      )

      if (statusCode >= 200 && statusCode < 300) {
        const msgId =
          responseJson.messages && responseJson.messages[0] ? responseJson.messages[0].id : null
        console.log('[whatsapp_bridge] Sucesso no envio Meta Cloud API. ID:', msgId)
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'success')
            statusRecord.set('last_send_error', '')
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return { success: true, status: statusCode, message_id: msgId, data: responseJson }
      }

      const metaErr = responseJson.error || {}
      const metaCode = metaErr.code
      const metaSubcode = metaErr.error_subcode
      const metaMsg = metaErr.message || rawBody || 'Erro HTTP ' + statusCode

      let friendly = metaMsg
      if (statusCode === 401 || metaCode === 190) {
        friendly =
          'Token da Meta expirado ou inválido (code ' +
          metaCode +
          '). Atualize o token em Minha Conta.'
      } else if (
        metaCode === 131047 ||
        metaSubcode === 2494010 ||
        /template/i.test(metaMsg) ||
        /24\s*hour/i.test(metaMsg)
      ) {
        friendly =
          'Janela de 24h fechada. Cliente precisa enviar mensagem primeiro ou usar template aprovado pela Meta.'
        console.log('[whatsapp_bridge] [JANELA 24H FECHADA] Meta requer template de mensagem.')
      } else if (metaCode === 131030 || metaCode === 131026) {
        friendly = 'Número não cadastrado na lista de teste da Meta (code ' + metaCode + ').'
      }

      if (statusRecord) {
        try {
          statusRecord.set('last_send_status', 'failed_' + statusCode)
          statusRecord.set('last_send_error', friendly.slice(0, 500))
          statusRecord.set('last_send_at', new Date().toISOString())
          $app.save(statusRecord)
        } catch (_) {}
      }

      return {
        success: false,
        status: statusCode,
        code: metaCode,
        subcode: metaSubcode,
        error: friendly,
        meta_raw: metaErr,
      }
    }

    const body = e.requestInfo().body || {}
    const entries = body.entry || []

    let processedCount = 0

    // Deduplicação em memória (globalThis) para filtrar reenvios ultrarrápidos da Meta
    if (typeof globalThis !== 'undefined' && !globalThis.__recentWamids) {
      globalThis.__recentWamids = new Map()
    }

    const isMessageAlreadyProcessed = function (wamid, phone, msgTimestamp) {
      if (!wamid) return false

      // 1. Checagem em memória (LRU básico com TTL de 15 minutos)
      const now = Date.now()
      if (globalThis && globalThis.__recentWamids) {
        // Limpeza de entradas mais velhas que 15 min
        if (globalThis.__recentWamids.size > 200) {
          for (let [kId, kTime] of globalThis.__recentWamids.entries()) {
            if (now - kTime > 900000) {
              globalThis.__recentWamids.delete(kId)
            }
          }
        }
        if (globalThis.__recentWamids.has(wamid)) {
          return true
        }
      }

      // 2. Checagem persistente na coleção whatsapp_processed_messages
      try {
        const found = $app.findFirstRecordByData('whatsapp_processed_messages', 'message_id', wamid)
        if (found) {
          if (globalThis && globalThis.__recentWamids) {
            globalThis.__recentWamids.set(wamid, now)
          }
          return true
        }
      } catch (_) {
        // Não encontrado na coleção — continua
      }

      return false
    }

    const markMessageAsProcessed = function (wamid, phone, msgType, rawTimestamp) {
      if (!wamid) return
      const now = Date.now()
      if (globalThis && globalThis.__recentWamids) {
        globalThis.__recentWamids.set(wamid, now)
      }
      try {
        const col = $app.findCollectionByNameOrId('whatsapp_processed_messages')
        const rec = new Record(col)
        rec.set('message_id', wamid)
        rec.set('phone', phone || '')
        rec.set('msg_type', msgType || '')
        rec.set('raw_timestamp', rawTimestamp || '')
        $app.save(rec)
      } catch (saveErr) {
        // Se der conflito de chave única, já está salvo
        console.log(
          '[whatsapp_bridge] [idempotencia] Registro de wamid ignorado (possível concorrência):',
          saveErr,
        )
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const changes = entry.changes || []

      for (let j = 0; j < changes.length; j++) {
        const change = changes[j]
        const value = change.value || {}
        const messages = value.messages || []
        const contactsList = value.contacts || []

        for (let k = 0; k < messages.length; k++) {
          const msg = messages[k]
          const fromRaw = msg.from
          const msgType = msg.type
          const incomingMsgId = msg.id

          // CRITÉRIO DE IDEMPOTÊNCIA: Se a Meta reenviar o webhook desta mesma mensagem (retry por tempo >5s),
          // ignoramos completamente o reprocessamento para evitar respostas em duplicidade ou falsas
          // rejeições de "gasto já registrado".
          if (incomingMsgId && isMessageAlreadyProcessed(incomingMsgId, fromRaw, msg.timestamp)) {
            console.log(
              `[whatsapp_bridge] [idempotencia] Mensagem repetida detectada (wamid=${incomingMsgId}, from=${fromRaw}). Ignorando reenvio da Meta.`,
            )
            continue
          }

          // Marca imediatamente para evitar que requests concorrentes entrem no mesmo fluxo
          if (incomingMsgId) {
            markMessageAsProcessed(incomingMsgId, fromRaw, msgType, msg.timestamp || '')
          }

          // Extrai o timestamp original da mensagem enviado pela Meta
          // msg.timestamp é string de Unix seconds (ex: "1711234567")
          let messageTimestampIso = ''
          if (msg.timestamp) {
            try {
              const sec = parseInt(msg.timestamp, 10)
              if (!isNaN(sec) && sec > 0) {
                messageTimestampIso = new Date(sec * 1000).toISOString()
              }
            } catch (_) {}
          }
          if (!messageTimestampIso) {
            messageTimestampIso = new Date().toISOString()
          }

          let textContent = ''
          let isAudioMessage = msgType === 'audio' || msgType === 'voice'

          if (msgType === 'text' && msg.text) {
            textContent = msg.text.body || ''
          } else if (msgType === 'interactive' && msg.interactive) {
            textContent =
              msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || ''
          } else if (isAudioMessage) {
            const audioData = msg.audio || msg.voice || {}
            const mediaId = audioData.id
            console.log(
              `[whatsapp_bridge] [AUDIO] Recebido áudio de ${fromRaw}, mediaId=${mediaId}, mime=${audioData.mime_type || ''}`,
            )

            // Obter token da Meta para baixar a mídia
            let metaToken =
              $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
            try {
              const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
              for (let w = 0; w < wsList.length; w++) {
                const rec = wsList[w]
                const tk = rec.getString('access_token')
                if (tk) {
                  metaToken = tk
                  break
                }
              }
            } catch (_) {}

            if (!mediaId || !metaToken) {
              console.log(
                '[whatsapp_bridge] [AUDIO] Falha: mediaId ou token da Meta ausente. mediaId=' +
                  mediaId +
                  ', temToken=' +
                  !!metaToken,
              )
            } else {
              try {
                // Passo (a): Obter a URL de download da mídia via Meta Cloud API
                console.log(
                  '[whatsapp_bridge] [AUDIO] Consultando URL da mídia na Meta Graph API: ' +
                    mediaId,
                )
                const mediaMetaRes = $http.send({
                  url: 'https://graph.facebook.com/v21.0/' + mediaId,
                  method: 'GET',
                  headers: {
                    Authorization: 'Bearer ' + metaToken,
                  },
                  timeout: 15,
                })

                let mediaUrl = ''
                if (mediaMetaRes.statusCode >= 200 && mediaMetaRes.statusCode < 300) {
                  // No PocketBase JSVM, respostas JSON são disponibilizadas diretamente em res.json
                  const metaJson =
                    mediaMetaRes.json ||
                    (mediaMetaRes.rawText ? JSON.parse(mediaMetaRes.rawText) : {})
                  mediaUrl = metaJson.url || ''
                  console.log(
                    '[whatsapp_bridge] [AUDIO] URL da mídia obtida com sucesso: ' +
                      (mediaUrl ? 'SIM' : 'NÃO'),
                  )
                } else {
                  console.log(
                    '[whatsapp_bridge] [AUDIO] Meta retornou status ' +
                      mediaMetaRes.statusCode +
                      ' ao consultar mediaId: ' +
                      (mediaMetaRes.rawText || JSON.stringify(mediaMetaRes.json || {})),
                  )
                }

                if (mediaUrl) {
                  console.log('[whatsapp_bridge] [AUDIO] Download iniciado...')
                  const downloadRes = $http.send({
                    url: mediaUrl,
                    method: 'GET',
                    headers: {
                      Authorization: 'Bearer ' + metaToken,
                      'User-Agent': 'Consciente-Agent/1.0',
                    },
                    timeout: 25,
                  })

                  if (downloadRes.statusCode >= 200 && downloadRes.statusCode < 300) {
                    // Obtém os bytes do áudio baixado (downloadRes.body é slice de bytes []byte)
                    const audioBytes = downloadRes.body || []
                    const bytesLength = Array.isArray(audioBytes) ? audioBytes.length : 0
                    console.log(
                      `[whatsapp_bridge] [AUDIO] Download concluído: ${bytesLength} bytes recebidos. Preparando transcrição via IA...`,
                    )

                    // Obtenção da chave STT OBRIGATORIAMENTE da coleção whatsapp_status lida na hora
                    let dbSttKey = ''
                    try {
                      const wsListForStt = $app.findRecordsByFilter(
                        'whatsapp_status',
                        '',
                        '-created',
                        10,
                        0,
                      )
                      for (let wsIdx = 0; wsIdx < wsListForStt.length; wsIdx++) {
                        const sk = wsListForStt[wsIdx].getString('stt_api_key')
                        if (sk && sk.trim()) {
                          dbSttKey = sk.trim()
                          break
                        }
                      }
                    } catch (wsErr) {
                      console.log(
                        '[whatsapp_bridge] [AUDIO] Falha ao consultar stt_api_key em whatsapp_status:',
                        wsErr,
                      )
                    }

                    // Fallback opcional por variável de ambiente se whatsapp_status não tiver configurado
                    const envGroqKey = $os.getenv('GROQ_API_KEY') || ''
                    const envOpenAiKey = $os.getenv('OPENAI_API_KEY') || ''
                    const activeKey = dbSttKey || envGroqKey || envOpenAiKey || ''

                    // Registra apenas a presença (true/false) — NUNCA o valor da chave
                    console.log(
                      `[whatsapp_bridge] [AUDIO] Chave STT presente: ${!!activeKey} (origem: ${dbSttKey ? 'whatsapp_status' : envGroqKey ? 'env_groq' : envOpenAiKey ? 'env_openai' : 'nenhuma'})`,
                    )

                    let transcribedText = ''
                    let transcriptionFailureReason = ''

                    // Tentativa 1: Groq Whisper API (whisper-large-v3-turbo) com fallback para whisper-large-v3
                    // O modelo whisper-large-v3-turbo é o mais rápido e econômico da Groq
                    if (activeKey && bytesLength > 0) {
                      const groqModels = ['whisper-large-v3-turbo', 'whisper-large-v3']
                      for (let gm = 0; gm < groqModels.length; gm++) {
                        const currentModel = groqModels[gm]
                        try {
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Tentativa 1 - Groq] Chamando https://api.groq.com/openai/v1/audio/transcriptions model=${currentModel}...`,
                          )
                          const audioFileObj = $filesystem.fileFromBytes(audioBytes, 'audio.ogg')
                          const form = new FormData()
                          form.append('file', audioFileObj)
                          form.append('model', currentModel)
                          form.append('language', 'pt')
                          form.append('response_format', 'json')

                          const gRes = $http.send({
                            url: 'https://api.groq.com/openai/v1/audio/transcriptions',
                            method: 'POST',
                            headers: {
                              Authorization: 'Bearer ' + activeKey,
                            },
                            body: form,
                            timeout: 12,
                          })

                          const gCode = gRes.statusCode
                          const gJson = gRes.json || (gRes.rawText ? JSON.parse(gRes.rawText) : {})
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Tentativa 1 - Groq] Endpoint: /audio/transcriptions, HTTP status: ${gCode}`,
                          )

                          if (gCode >= 200 && gCode < 300) {
                            if (gJson && gJson.text) {
                              transcribedText = String(gJson.text).trim()
                              console.log(
                                `[whatsapp_bridge] [AUDIO] [Tentativa 1 - Groq] Sucesso! Transcrição: "${transcribedText.slice(0, 60)}..."`,
                              )
                              break
                            }
                          } else {
                            const errBody =
                              gRes.rawText || JSON.stringify(gJson || {}) || 'corpo vazio'
                            console.log(
                              `[whatsapp_bridge] [AUDIO] [Tentativa 1 - Groq] Falha HTTP ${gCode}: ${errBody.slice(0, 200)}`,
                            )
                            transcriptionFailureReason = `Groq ${currentModel} HTTP ${gCode}: ${errBody.slice(0, 150)}`
                          }
                        } catch (gErr) {
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Tentativa 1 - Groq] Exceção com model ${currentModel}:`,
                            gErr,
                          )
                          transcriptionFailureReason = String(gErr)
                        }
                      }
                    }

                    // Tentativa 2: Fallback OpenAI Whisper direto se Groq falhou ou se chave for sk- OpenAI
                    if (!transcribedText && activeKey && bytesLength > 0) {
                      try {
                        console.log(
                          '[whatsapp_bridge] [AUDIO] [Tentativa 2 - Fallback OpenAI] Chamando https://api.openai.com/v1/audio/transcriptions model=whisper-1...',
                        )
                        const audioFileObj = $filesystem.fileFromBytes(audioBytes, 'audio.ogg')
                        const form = new FormData()
                        form.append('file', audioFileObj)
                        form.append('model', 'whisper-1')
                        form.append('language', 'pt')
                        form.append('response_format', 'json')

                        const oRes = $http.send({
                          url: 'https://api.openai.com/v1/audio/transcriptions',
                          method: 'POST',
                          headers: {
                            Authorization: 'Bearer ' + activeKey,
                          },
                          body: form,
                          timeout: 12,
                        })

                        const oCode = oRes.statusCode
                        const oJson = oRes.json || (oRes.rawText ? JSON.parse(oRes.rawText) : {})
                        console.log(
                          `[whatsapp_bridge] [AUDIO] [Tentativa 2 - Fallback OpenAI] HTTP status: ${oCode}`,
                        )

                        if (oCode >= 200 && oCode < 300) {
                          if (oJson && oJson.text) {
                            transcribedText = String(oJson.text).trim()
                            console.log(
                              `[whatsapp_bridge] [AUDIO] [Tentativa 2 - Fallback OpenAI] Sucesso! Transcrição: "${transcribedText.slice(0, 60)}..."`,
                            )
                          }
                        } else {
                          const errBody =
                            oRes.rawText || JSON.stringify(oJson || {}) || 'corpo vazio'
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Tentativa 2 - Fallback OpenAI] Falha HTTP ${oCode}: ${errBody.slice(0, 200)}`,
                          )
                          if (!transcriptionFailureReason) {
                            transcriptionFailureReason = `OpenAI HTTP ${oCode}: ${errBody.slice(0, 150)}`
                          }
                        }
                      } catch (oErr) {
                        console.log(
                          '[whatsapp_bridge] [AUDIO] [Tentativa 2 - Fallback OpenAI] Exceção:',
                          oErr,
                        )
                        if (!transcriptionFailureReason) {
                          transcriptionFailureReason = String(oErr)
                        }
                      }
                    }

                    if (transcribedText) {
                      textContent = transcribedText
                      console.log(
                        `[whatsapp_bridge] [AUDIO] Resultado final: texto extraído com sucesso (${transcribedText.length} caracteres): "${textContent.slice(0, 60)}..."`,
                      )
                    } else {
                      console.log(
                        `[whatsapp_bridge] [AUDIO] Transcrição não produziu texto. Causa: ${transcriptionFailureReason || 'nenhum provedor respondeu com texto válido'}`,
                      )
                    }
                  } else {
                    console.log(
                      '[whatsapp_bridge] [AUDIO] Falha ao baixar binário da URL Meta: status ' +
                        downloadRes.statusCode,
                    )
                  }
                }
              } catch (audioErr) {
                console.log(
                  '[whatsapp_bridge] [AUDIO] Exceção durante processamento de áudio:',
                  audioErr,
                )
              }
            }
          }

          console.log(
            `[whatsapp_bridge] Recebido webhook: from=${fromRaw}, type=${msgType}, id=${incomingMsgId || 's/id'}, text="${textContent.slice(0, 100)}"`,
          )

          // Se for mensagem de áudio e não conseguimos transcrever:
          // Resposta acolhedora, honesta e orientativa para o usuário, conforme critério de aceitação #2
          if (fromRaw && isAudioMessage && !textContent) {
            console.log(
              '[whatsapp_bridge] [AUDIO] Transcrição não produziu texto. Enviando resposta orientativa para: ' +
                fromRaw,
            )
            const audioFriendlyMsg =
              'Recebi seu áudio aqui no Consciente! 🎙️\n\nNo momento tivemos uma instabilidade na conversão de voz para texto e não consegui ouvir o que você falou. Você pode digitar rapidinho o gasto aqui para mim (ex: "Almoço 35" ou "Mercado 120")? Já registro direto na sua caixinha!'
            sendMetaMessage(fromRaw, audioFriendlyMsg)
            processedCount++
            continue
          }

          if (fromRaw && textContent) {
            // AJUSTE 2: Indicação imediata de recebimento no WhatsApp
            // Marca imediatamente a mensagem como lida e dispara os três pontinhos (typing indicator)
            // Custo ZERO na Meta e fail-safe (qualquer erro é apenas logado e não afeta o agente)
            if (incomingMsgId) {
              try {
                sendMetaStatusAndTyping(incomingMsgId)
              } catch (typeErr) {
                console.log(
                  '[whatsapp_bridge] Falha ao acionar typing inicial (ignorado):',
                  typeErr,
                )
              }
            }
            const phoneDigits = normalizeDigits(fromRaw)
            let senderName = ''
            if (contactsList && contactsList[k]) {
              senderName = contactsList[k].profile?.name || ''
            }

            // 1. Localiza usuário vinculado
            const matchedUser = resolveUser(phoneDigits, senderName)
            console.log(
              `[whatsapp_bridge] Usuário vinculado para ${phoneDigits}: ${matchedUser ? matchedUser.id + ' (' + matchedUser.getString('email') + ')' : 'NENHUM (não cadastrado)'}`,
            )

            // 2. Busca ou cria whatsapp_contact
            const contactsCol = $app.findCollectionByNameOrId('whatsapp_contacts')
            let contact = null
            try {
              contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', phoneDigits)
            } catch (_) {
              contact = new Record(contactsCol)
              contact.set('phone_number', phoneDigits)
              contact.set('name', senderName || 'Contato WhatsApp')
              contact.set('messages_count', 0)
            }

            if (matchedUser) {
              contact.set('user', matchedUser.id)
              if (matchedUser.getString('name') && !contact.getString('name')) {
                contact.set('name', matchedUser.getString('name'))
              }
              try {
                if (!matchedUser.getString('phone')) {
                  matchedUser.set('phone', phoneDigits)
                  $app.save(matchedUser)
                }
              } catch (_) {}
            } else if (!contact.getString('user')) {
              contact.set('user', '')
            }

            if (senderName && contact.getString('name') === 'Contato WhatsApp') {
              contact.set('name', senderName)
            }
            $app.save(contact)

            // -----------------------------------------------------------------
            // TESTE DE ECO (ex-Item 39): comando de diagnóstico "#eco ..." ou
            // "/eco ..." — valida o caminho completo do webhook (recebimento pela
            // Meta → persistência por wamid → envio de volta pela Meta Graph API)
            // SEM consumir IA. Posição: APÓS a resolução de identidade/persistência
            // e ANTES do gate de assinatura e de qualquer chamada ao $ai.agent.
            // Padrão localXxx estrito (nada declarado em try e usado fora).
            // -----------------------------------------------------------------
            const localEchoLower = textContent.toLowerCase().trim()
            const localEchoIsEco =
              localEchoLower === '#eco' ||
              localEchoLower === '/eco' ||
              localEchoLower.indexOf('#eco ') === 0 ||
              localEchoLower.indexOf('/eco ') === 0
            if (localEchoIsEco) {
              const localEchoPayload = textContent.replace(/^\s*(#eco|\/eco)\s*/i, '').trim()
              const localEchoReply =
                '🔁 Teste de Eco — Consciente\n\n' +
                'Mensagem recebida, persistida e devolvida ponta a ponta ' +
                '(webhook Meta → persistência wamid → envio Meta Graph API), SEM passar pela IA. ✅\n\n' +
                'Você enviou: "' +
                (localEchoPayload || '(comando #eco sem conteúdo)') +
                '"\n\n' +
                'wamid: ' +
                (incomingMsgId || 's/id') +
                '\n\nCanal de diagnóstico OK — se esta mensagem chegou, o caminho completo do webhook está íntegro!'
              console.log(
                '[whatsapp_bridge] [ECO] Interceptação de Teste de Eco: from=' +
                  fromRaw +
                  ' wamid=' +
                  (incomingMsgId || 's/id') +
                  ' payload="' +
                  localEchoPayload.slice(0, 80) +
                  '"',
              )
              try {
                const localEchoSendRes = sendMetaMessage(fromRaw, localEchoReply)
                console.log(
                  '[whatsapp_bridge] [ECO] Envio Meta Graph API: success=' +
                    localEchoSendRes.success +
                    (localEchoSendRes.error ? ' erro=' + localEchoSendRes.error : ''),
                )
              } catch (localEchoErr) {
                console.log('[whatsapp_bridge] [ECO] Erro no envio do eco:', localEchoErr)
              }
              try {
                const localEchoCount = contact.getInt('messages_count') || 0
                contact.set('messages_count', localEchoCount + 1)
                contact.set('last_message_at', new Date().toISOString())
                $app.save(contact)
              } catch (_) {}
              processedCount++
              continue
            }

            // 3. Determina usuário ativo para o agente e status de cadastro completo
            let activeUserId = ''
            let isRegistered = false
            let hasCompletedOnboarding = false
            let subStatus = 'trial'
            let isSubSuspended = false
            let subSuspendedMsg = ''

            if (matchedUser) {
              activeUserId = matchedUser.id
              isRegistered = true
              hasCompletedOnboarding = isUserAccountReady(matchedUser)

              // GATE DE ASSINATURA: checa status da conta
              // Estados: 'active', 'trial', 'carencia' (7 dias), 'bloqueado', 'cancelado'
              subStatus = matchedUser.getString('subscription_status') || 'trial'
              const carenciaUntil = matchedUser.getString('carencia_until') || ''
              // Acesso pós-cancelamento: status 'cancelado' com access_until
              // no futuro mantém o cliente ativo no WhatsApp até o fim do
              // período já pago (mesma filosofia do gate do app).
              const accessUntilWpp = matchedUser.getString('access_until') || ''
              const nowIso = new Date().toISOString()

              // ANUAL VIA PIX (pagamento único): conta 'active' SEM assinatura
              // recorrente (sem stripe_subscription_id) com access_until
              // gravado. Quando a validade de 12 meses expira, a conta cai no
              // fluxo de não-assinante (mesma filosofia do gate do app).
              const stripeSubWpp = matchedUser.getString('stripe_subscription_id') || ''
              if (
                subStatus === 'active' &&
                !stripeSubWpp &&
                accessUntilWpp &&
                accessUntilWpp <= nowIso
              ) {
                console.log(
                  '[whatsapp_bridge] Pagamento único expirado (access_until=' +
                    accessUntilWpp +
                    ' agora=' +
                    nowIso +
                    ') → conta volta a não-assinante.',
                )
                subStatus = 'cancelado'
                try {
                  matchedUser.set('subscription_status', 'cancelado')
                  $app.save(matchedUser)
                } catch (_) {}
              }

              if (subStatus === 'cancelado' && accessUntilWpp) {
                const isAccessActive = accessUntilWpp > nowIso
                console.log(
                  '[whatsapp_bridge] Cancelado com access_until=' +
                    accessUntilWpp +
                    ' agora=' +
                    nowIso +
                    ' → acesso ' +
                    (isAccessActive ? 'MANTIDO' : 'expirado'),
                )
                if (isAccessActive) {
                  subStatus = 'active'
                }
              }

              if (subStatus === 'carencia') {
                if (carenciaUntil && nowIso > carenciaUntil) {
                  subStatus = 'bloqueado'
                  try {
                    matchedUser.set('subscription_status', 'bloqueado')
                    $app.save(matchedUser)
                  } catch (_) {}
                }
              }

              if (subStatus === 'carencia') {
                isSubSuspended = true
                subSuspendedMsg =
                  'Olá! Notamos uma pendência no pagamento da sua assinatura do Consciente. ' +
                  'Seu acesso ao WhatsApp está temporariamente suspenso durante o período de carência de 7 dias, mas você ainda pode consultar seus dados no aplicativo.\n\n' +
                  'Para continuar registrando seus gastos com facilidade por aqui, por favor regularize sua assinatura em:\n' +
                  'https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?tab=planos\n\n' +
                  'Qualquer dúvida, estamos à disposição!'
              } else if (subStatus === 'bloqueado' || subStatus === 'cancelado') {
                isSubSuspended = true
                subSuspendedMsg =
                  'Olá! Sua assinatura do Consciente está inativa no momento. ' +
                  'Para voltar a ter seu parceiro financeiro no WhatsApp e no aplicativo, basta reativar seu plano em:\n' +
                  'https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?tab=planos\n\n' +
                  'Esperamos ter você de volta em breve!'
              }
            } else {
              const guest = getOrCreateGuestUser()
              if (guest) {
                activeUserId = guest.id
              }
            }

            console.log(
              `[whatsapp_bridge] activeUserId para agente: "${activeUserId}", isRegistered=${isRegistered}, hasCompletedOnboarding=${hasCompletedOnboarding}, subStatus=${subStatus}, isSubSuspended=${isSubSuspended}`,
            )

            // Se a assinatura estiver suspensa (carência ou bloqueado), responde mensagem gentil e não processa gasto
            if (isSubSuspended && subSuspendedMsg) {
              console.log(
                '[whatsapp_bridge] Resposta de suspensão de assinatura enviada para ' + fromRaw,
              )
              sendMetaMessage(fromRaw, subSuspendedMsg)
              processedCount++
              continue
            }

            const existingConvId = contact.getString('conversation_id') || null
            const todayStr = messageTimestampIso
              ? messageTimestampIso.slice(0, 10)
              : new Date().toISOString().slice(0, 10)
            const msgSource = isAudioMessage ? 'whatsapp_audio' : 'whatsapp_text'

            let promptForAgent = `[Data para registro: ${todayStr}. Origem da mensagem: ${msgSource}. Data e hora exata da mensagem: ${messageTimestampIso}. Usuário cadastrado e ativo (${matchedUser ? matchedUser.getString('name') || matchedUser.getString('email') : ''}). IMPORTANTE: No banco de dados, o campo amount de transactions deve ser gravado em CENTAVOS (valor em reais * 100, ex: 100 reais = 10000 centavos, 45 reais = 4500). O campo source deve ser '${msgSource}', o campo status deve ser 'active' e o campo message_timestamp deve ser '${messageTimestampIso}'. Para a data da transação, use '${todayStr}' a menos que o cliente informe data diferente. REGISTRE IMEDIATAMENTE qualquer gasto enviado sem pedir para finalizar cadastro]: ${textContent}`

            if (!isRegistered) {
              promptForAgent =
                `[ATENÇÃO: Mensagem recebida via WhatsApp de um número AINDA NÃO CADASTRADO ou NÃO VINCULADO no aplicativo (${phoneDigits}, nome: "${senderName || 'Visitante'}").
Apresente-se cordialmente como o Consciente - Seu parceiro nas finanças. Explique brevemente que você ajuda no controle diário de custos e caixinhas.
Se a mensagem for um gasto ou dúvida, convide a pessoa a acessar o app informando OBRIGATORIAMENTE este ÚNICO link oficial (serve para acessar, logar ou se cadastrar — nunca informe outros links ou variações):
- Link de acesso ao Consciente: ` +
                LOCAL_APP_ACCESS_LINK +
                `
Se a pessoa já tem conta criada e não está sendo reconhecida, instrua com carinho: "Acesse ` +
                LOCAL_APP_ACCESS_LINK +
                ` e confirme seu WhatsApp em Minha Conta > Perfil para sincronizar seus lançamentos na hora!"]: ${textContent}`
            } else if (!hasCompletedOnboarding) {
              // Usuário cadastrado no banco mas que ainda não passou pelo onboarding de caixinhas
              promptForAgent =
                `[ATENÇÃO: Usuário cadastrado (${matchedUser.getString('name') || matchedUser.getString('email')}), porém ainda sem caixinhas configuradas. Incentive-o amigavelmente a acessar o app pelo ÚNICO link oficial ` +
                LOCAL_APP_ACCESS_LINK +
                ` para definir suas primeiras caixinhas (o mesmo link serve para acessar, logar ou se cadastrar) ou registre o gasto em categoria padrão se ele insistir]: ${textContent}`
            }

            let agentReply = ''
            let newConvId = existingConvId

            // Helper de confiabilidade é carregado UMA VEZ no boot (ver seção 1.5) e
            // cacheado em globalThis. NUNCA chamamos require dentro do handler —
            // isso falhava com "Invalid module" no runtime Goja.
            const reliabilityHelper =
              typeof globalThis !== 'undefined' ? globalThis.__reliabilityHelper : null

            // 1. Guardrail de Temas (Item 22): recusa gentil se fora de finanças/app
            if (
              textContent &&
              reliabilityHelper &&
              typeof reliabilityHelper.isOffTopicQuery === 'function' &&
              reliabilityHelper.isOffTopicQuery(textContent)
            ) {
              console.log(
                '[whatsapp_bridge] Mensagem fora de escopo detectada pelo guardrail:',
                textContent,
              )
              agentReply = reliabilityHelper.OFF_TOPIC_GUARDRAIL_REPLY
            }

            // 1.2 DETECTOR DETERMINÍSTICO DE PERGUNTA (v0.0.123 — Opção A da dona)
            // Pergunta => MODO CONSULTA: NENHUMA transação pode ser criada e os
            // fluxos que registram (cancelamento de pendência, escolha de caixinha,
            // retroativo) são ignorados; o prompt do agente troca para consulta
            // baseada EXCLUSIVAMENTE na base de dados atual (não no histórico).
            let isConsultaMode = false
            if (!agentReply && isRegistered && textContent) {
              try {
                isConsultaMode =
                  typeof localIsQuestionMessage === 'function' &&
                  localIsQuestionMessage(textContent)
              } catch (qDetErr) {
                console.log(
                  '[whatsapp_bridge] Erro no detector de pergunta (seguindo fluxo normal):',
                  qDetErr,
                )
                isConsultaMode = false
              }
              if (isConsultaMode) {
                console.log(
                  '[whatsapp_bridge] PERGUNTA detectada — MODO CONSULTA ativo (nenhuma transação será criada):',
                  textContent,
                )
                promptForAgent = `[MODO CONSULTA — NÃO crie transações; responda à pergunta do cliente com base EXCLUSIVAMENTE nos dados atuais da base de dados (transações, caixinhas, orçamentos), consultando as coleções; NÃO use o histórico da conversa como fonte de verdade sobre lançamentos ou saldos — o cliente pode ter feito um lançamento ou uma alteração diretamente pela interface do app, que é a fonte mais atual. Responda à pergunta a seguir; se o cliente na verdade quis registrar um gasto, oriente-o a enviar no formato curto (ex.: "Padaria 12") SEM criar nada agora]: ${textContent}`
              }
            }

            // 2. Fluxo Conversacional de Cancelamento / Substituição (Item 23)
            if (
              !agentReply &&
              !isConsultaMode &&
              isRegistered &&
              textContent &&
              reliabilityHelper &&
              typeof reliabilityHelper.handleCancellationFlow === 'function'
            ) {
              try {
                const cancelRes = reliabilityHelper.handleCancellationFlow(
                  $app,
                  activeUserId,
                  contact,
                  textContent,
                )
                if (cancelRes && cancelRes.handled && cancelRes.reply) {
                  agentReply = cancelRes.reply
                  console.log(
                    '[whatsapp_bridge] Fluxo de cancelamento interceptado com resposta:',
                    agentReply,
                  )
                }
              } catch (cFlowErr) {
                console.log('[whatsapp_bridge] Erro no fluxo de cancelamento seguro:', cFlowErr)
              }
            }

            // 2.1 Fluxo Conversacional de Escolha Obrigatória de Caixinha (Item 29 / v0.0.56 / v0.0.69)
            // Se há pendência de escolha de caixinha (pending_caixinha) ou novo gasto em categoria
            // com 1 ou mais caixinhas vinculadas (category_caixinha_links):
            // Executado primariamente via localHandleCaixinhaFlow 100% INLINE no callback (padrão localXxx sem require)
            if (
              !agentReply &&
              !isConsultaMode &&
              isRegistered &&
              textContent &&
              typeof localHandleCaixinhaFlow === 'function'
            ) {
              try {
                const caixinhaRes = localHandleCaixinhaFlow(
                  $app,
                  activeUserId,
                  textContent,
                  contact,
                  todayStr,
                  msgSource,
                )
                if (caixinhaRes && caixinhaRes.handled && caixinhaRes.reply) {
                  agentReply = caixinhaRes.reply
                  console.log(
                    '[whatsapp_bridge] Fluxo de escolha de caixinha (inline) executado com resposta:',
                    agentReply,
                  )
                }
              } catch (cxFlowErr) {
                console.log(
                  '[whatsapp_bridge] Erro no fluxo de escolha de caixinha (inline):',
                  cxFlowErr,
                )
              }
            } else if (
              !agentReply &&
              !isConsultaMode &&
              isRegistered &&
              textContent &&
              reliabilityHelper &&
              typeof reliabilityHelper.handleCaixinhaFlow === 'function'
            ) {
              try {
                const caixinhaRes = reliabilityHelper.handleCaixinhaFlow(
                  $app,
                  activeUserId,
                  textContent,
                  contact,
                  todayStr,
                  msgSource,
                )
                if (caixinhaRes && caixinhaRes.handled && caixinhaRes.reply) {
                  agentReply = caixinhaRes.reply
                  console.log(
                    '[whatsapp_bridge] Fluxo de escolha de caixinha executado com resposta (fallback helper):',
                    agentReply,
                  )
                }
              } catch (cxFlowErr) {
                console.log('[whatsapp_bridge] Erro no fluxo de escolha de caixinha:', cxFlowErr)
              }
            }

            // 3. Detecção e Ajuste de Data Retroativa (Item 28)
            let retroactiveInfo = null
            if (
              !agentReply &&
              !isConsultaMode &&
              textContent &&
              reliabilityHelper &&
              typeof reliabilityHelper.parseRetroactiveDate === 'function'
            ) {
              try {
                retroactiveInfo = reliabilityHelper.parseRetroactiveDate(textContent, todayStr)
                if (
                  retroactiveInfo &&
                  retroactiveInfo.isRetroactive &&
                  retroactiveInfo.targetDateStr
                ) {
                  console.log(
                    `[whatsapp_bridge] Data retroativa detectada (${retroactiveInfo.matchedPhrase} -> ${retroactiveInfo.targetDateStr})`,
                  )
                  // Atualiza o prompt do agente com instrução inequívoca de data e marcação
                  promptForAgent =
                    `[ATENÇÃO: LANÇAMENTO RETROATIVO DETECTADO. O cliente informou expressamente que o gasto ocorreu em: ${retroactiveInfo.targetDateStr} (frase: "${retroactiveInfo.matchedPhrase}"). REGISTRE com campo 'date' = '${retroactiveInfo.targetDateStr}', 'is_retroactive' = true, 'status' = 'active'. Na confirmação, cite expressamente a data retroativa no formato "contabilizado em ${retroactiveInfo.matchedPhrase} (${retroactiveInfo.targetDateStr.slice(8, 10)}/${retroactiveInfo.targetDateStr.slice(5, 7)})"]: ` +
                    promptForAgent
                }
              } catch (retErr) {
                console.log('[whatsapp_bridge] Erro ao interpretar data retroativa:', retErr)
              }
            }

            // Verificação de intenção padronizada: Resumo Visual das Caixinhas
            // REGRA INVIOLÁVEL: O resumo de caixinhas no WhatsApp é 100% DETERMINÍSTICO da base de dados.
            // NUNCA passa pelo $ai.agent (evita alucinação de caixinhas deletadas ou números inconsistentes).
            // Funções locais estritas declaradas dentro do callback (localIsCaixinhasOverviewIntent, localBuildCaixinhasSummaryForUser).
            let isCaixinhasOverview = false
            if (isRegistered && textContent) {
              try {
                if (typeof localIsCaixinhasOverviewIntent === 'function') {
                  isCaixinhasOverview = localIsCaixinhasOverviewIntent(textContent)
                }
              } catch (intentErr) {
                console.log('[whatsapp_bridge] Erro na checagem de intenção de resumo:', intentErr)
              }
            }

            if (isCaixinhasOverview) {
              console.log(
                `[whatsapp_bridge] Interceptação determinística de resumo (inline) para usuário ${activeUserId}. Montando resumo DIRETO da base (SEM IA)...`,
              )
              try {
                const summary = localBuildCaixinhasSummaryForUser(
                  $app,
                  activeUserId,
                  todayStr.slice(0, 7),
                )
                if (summary) {
                  agentReply = summary
                  console.log(
                    `[whatsapp_bridge] Resumo visual determinístico montado com sucesso (tamanho=${agentReply.length}). Enviando diretamente pela Meta Cloud API.`,
                  )
                } else {
                  agentReply =
                    'Não consegui carregar suas caixinhas no momento. Por favor, tente novamente em alguns instantes ou consulte pelo app!'
                }
              } catch (sumErr) {
                console.error(
                  '[whatsapp_bridge] Erro ao construir resumo determinístico de caixinhas:',
                  sumErr,
                )
                // Mensagem honesta de erro — NUNCA cair no $ai.agent para resumo!
                agentReply =
                  'Ocorreu uma instabilidade ao consultar suas caixinhas na base de dados agora. Por favor, tente novamente em alguns instantes ou acesse pelo app!'
              }
            }

            const isConvNotFoundError = function (err) {
              if (!err) return false
              const errStr = String(err).toLowerCase()
              return (
                errStr.includes('conversation not found') ||
                errStr.includes('conversation_not_found') ||
                (err.message && /conversation not found/i.test(err.message))
              )
            }

            // Executa o agente se tivermos activeUserId válido e ainda não temos resposta pronta
            if (activeUserId && !agentReply) {
              // INJEÇÃO DE CONTEXTO DETERMINÍSTICO DE CAIXINHAS ATIVAS (Anti-alucinação):
              // Para mensagens que seguem para o $ai.agent, injeta no prompt a lista fresca
              // das caixinhas ativas lidas da base de dados neste exato momento.
              // Instrução explícita: PROIBIDO inventar/citar caixinha fora da lista.
              // Usa localBuildCaixinhasContextPrompt declarada no callback.
              if (isRegistered) {
                try {
                  if (typeof localBuildCaixinhasContextPrompt === 'function') {
                    const caixinhasContext = localBuildCaixinhasContextPrompt(
                      $app,
                      activeUserId,
                      todayStr.slice(0, 7),
                    )
                    if (caixinhasContext) {
                      promptForAgent = `${caixinhasContext}\n\n${promptForAgent}`
                    }
                  } else {
                    console.log(
                      '[whatsapp_bridge] Contexto anti-alucinação indisponível (localBuildCaixinhasContextPrompt não encontrada).',
                    )
                  }
                } catch (ctxErr) {
                  console.log(
                    '[whatsapp_bridge] Erro ao injetar contexto fresco de caixinhas no prompt:',
                    ctxErr,
                  )
                }
              }
              // Suporte a reemissão periódica de typing a cada ~12s caso a resposta demore,
              // com limite estrito de no máximo 3 reemissões para não martelar a Meta.
              let typingIntervalId = null
              let typingRetries = 0
              let isReplyFinished = false

              if (incomingMsgId && typeof setInterval === 'function') {
                try {
                  typingIntervalId = setInterval(() => {
                    if (isReplyFinished || typingRetries >= 3) {
                      if (typingIntervalId && typeof clearInterval === 'function') {
                        try {
                          clearInterval(typingIntervalId)
                        } catch (_) {}
                      }
                      return
                    }
                    typingRetries++
                    console.log(
                      `[whatsapp_bridge] Reemitindo typing indicator (${typingRetries}/3) para msg: ${incomingMsgId}`,
                    )
                    try {
                      sendMetaStatusAndTyping(incomingMsgId)
                    } catch (_) {}
                  }, 12000)
                } catch (timerErr) {
                  console.log(
                    '[whatsapp_bridge] Timer de typing indicator não suportado no runtime (ignorado):',
                    timerErr,
                  )
                }
              }

              // Chamada do agente com retry e backoff para falhas transitórias
              const maxAgentAttempts = 3
              let agentAttempt = 0
              let currentConvIdForChat = existingConvId

              while (agentAttempt < maxAgentAttempts && !agentReply) {
                agentAttempt++
                try {
                  console.log(
                    `[whatsapp_bridge] Chamando $ai.agent('financeiro-whatsapp').chat (tentativa ${agentAttempt}/${maxAgentAttempts}) user_id=${activeUserId}, conv_id=${currentConvIdForChat || 'null'}`,
                  )
                  const agentResult = $ai.agent('financeiro-whatsapp').chat({
                    user_id: activeUserId,
                    conversation_id: currentConvIdForChat,
                    message: promptForAgent,
                  })
                  agentReply = agentResult.content || ''
                  newConvId = agentResult.conversation_id || currentConvIdForChat
                  console.log(
                    `[whatsapp_bridge] Agente respondeu com sucesso! (tentativa ${agentAttempt}) conv_id=${newConvId}, tamanho=${agentReply.length}`,
                  )
                } catch (aErr) {
                  console.error(
                    `[whatsapp_bridge] Falha ao executar agente na tentativa ${agentAttempt}/${maxAgentAttempts}:`,
                    aErr,
                  )

                  if (currentConvIdForChat && isConvNotFoundError(aErr)) {
                    console.log(
                      `[whatsapp_bridge] Conversation_id inválido (${currentConvIdForChat}). Resetando para conversa limpa na próxima tentativa...`,
                    )
                    currentConvIdForChat = null
                  } else if (
                    /context canceled|context deadline|gateway call|timeout|deadline exceeded/i.test(
                      String(aErr),
                    )
                  ) {
                    console.warn(
                      `[whatsapp_bridge] Falha transitória de gateway/timeout detectada na tentativa ${agentAttempt}. Tentando com conversa limpa e backoff...`,
                    )
                    currentConvIdForChat = null
                    // Backoff exponencial simples (600ms na tentativa 1, 1400ms na tentativa 2)
                    if (agentAttempt < maxAgentAttempts) {
                      const backoffMs = agentAttempt * 700
                      try {
                        if (typeof $sleep === 'function') {
                          $sleep(backoffMs)
                        } else {
                          const sleepStart = Date.now()
                          while (Date.now() - sleepStart < backoffMs) {}
                        }
                      } catch (_) {}
                    }
                  } else {
                    // Outro erro: reseta conversa limpa para última tentativa se ainda houver
                    currentConvIdForChat = null
                  }
                }
              }

              isReplyFinished = true
              if (typingIntervalId && typeof clearInterval === 'function') {
                try {
                  clearInterval(typingIntervalId)
                } catch (_) {}
              }
            } else {
              console.log(
                '[whatsapp_bridge] Nenhum activeUserId encontrado. Usando fallback de boas-vindas diretamente.',
              )
            }

            // Funções de fallback 100% INLINE dentro do callback do webhook
            // NUNCA declaradas no top-level para respeitar o isolamento de escopo do JSVM do PocketBase
            const isSpendingExpenseMessageInline = function (rawText) {
              if (!rawText) return false
              const t = String(rawText)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
              const hasNumber = /\d+([.,]\d{1,2})?/.test(t)
              if (hasNumber) {
                if (
                  t.includes('real') ||
                  t.includes('reais') ||
                  t.includes('r$') ||
                  t.includes('gastei') ||
                  t.includes('comprei') ||
                  t.includes('paguei') ||
                  t.includes('custou') ||
                  t.includes('despesa') ||
                  t.includes('almo') ||
                  t.includes('uber') ||
                  t.includes('mercado') ||
                  t.includes('padaria') ||
                  t.includes('farmacia') ||
                  t.includes('cafe') ||
                  t.includes('gasolina') ||
                  t.includes('lanche') ||
                  t.includes('pizza') ||
                  t.includes('jantar') ||
                  t.includes('ifood') ||
                  t.includes('combustivel')
                ) {
                  return true
                }
                // Formato abreviado clássico: [categoria/nome] [número] (ex: "Almoço 35", "Mercado 120", "Uber 25,50")
                if (/^[a-z\s]{3,20}\s+\d+([.,]\d{1,2})?$/.test(t)) {
                  return true
                }
              }
              if (
                t.startsWith('gastei ') ||
                t.startsWith('paguei ') ||
                t.startsWith('comprei ') ||
                t.includes(' novo gasto') ||
                t.includes('registrar gasto') ||
                t.includes('registra gasto') ||
                t.includes('lancar gasto') ||
                t.includes('lança gasto')
              ) {
                return true
              }
              return false
            }

            const buildGracefulFallbackInline = function (rawText, isAudio) {
              if (isAudio) {
                return 'Recebi seu áudio aqui no Consciente! 🎙️\nTivemos uma oscilação momentânea no processamento agora. Se você puder mandar novamente ou digitar rapidinho em texto (ex: "Almoço 35"), já registro direto na sua caixinha!'
              }
              const raw = String(rawText || '').trim()
              const isSpending = isSpendingExpenseMessageInline(raw)
              if (isSpending) {
                return 'Olá! Não consegui processar seu gasto agora no Consciente devido a uma oscilação momentânea. Por favor, envie novamente com o valor e a categoria (ex: "Almoço 35 reais") para eu registrar na sua caixinha!'
              }
              const lower = raw.toLowerCase()
              if (
                lower.includes('deu certo') ||
                lower.includes('conseguiu') ||
                lower.includes('registrou') ||
                lower.includes('salvou') ||
                lower.includes('gravou')
              ) {
                return 'Olá! O Consciente está aqui com você! 👋\nTivemos uma oscilação rápida agora há pouco e sua última solicitação pode não ter sido concluída. Você pode me mandar novamente o que gostaria de registrar ou checar? Se foi um gasto, pode mandar o valor e a caixinha (ex: "Almoço 35").'
              }
              if (
                lower === 'oi' ||
                lower === 'ola' ||
                lower === 'olá' ||
                lower.startsWith('oi ') ||
                lower.startsWith('ola ') ||
                lower.startsWith('olá ') ||
                lower.startsWith('bom dia') ||
                lower.startsWith('boa tarde') ||
                lower.startsWith('boa noite') ||
                lower.includes('tudo bem') ||
                lower.includes('e agora')
              ) {
                return 'Olá! Eu sou o Consciente - Seu parceiro nas finanças! 👋\nComo posso te ajudar agora? Você pode registrar um gasto (ex: "Almoço 35"), ver o resumo das caixinhas enviando "resumo", ou tirar uma dúvida financeira!'
              }
              return 'Olá! O Consciente está conectado com você! 👋\nTivemos uma oscilação momentânea e não consegui interpretar sua mensagem agora. Como posso te ajudar? Você pode me enviar um gasto para registrar (ex: "Mercado 120") ou mandar "resumo" para ver suas caixinhas!'
            }

            // Fallback garantido: toda mensagem SEMPRE produz uma resposta amigável e acolhedora
            if (!agentReply) {
              if (isConsultaMode) {
                // MODO CONSULTA: falha do agente NUNCA pede reenvio de gasto —
                // responde com instabilidade de CONSULTA e aponta para o app.
                agentReply =
                  'Tive uma instabilidade ao consultar seus dados na base agora. 🙏\nPor favor, tente perguntar novamente em alguns instantes — ou confira seus lançamentos e caixinhas direto no app, que sempre mostram o estado mais atual.'
              } else if (!isRegistered) {
                agentReply =
                  'Olá! Eu sou o Consciente - Seu parceiro nas finanças no WhatsApp. 👋\n\nSeu número ainda não está reconhecido no app. Acesse o Consciente em: ' +
                  LOCAL_APP_ACCESS_LINK +
                  ' — o mesmo link serve para acessar, logar ou criar sua conta. Se já tem conta, confirme seu WhatsApp em Minha Conta > Perfil para sincronizar seus lançamentos na hora!'
              } else if (!hasCompletedOnboarding) {
                agentReply =
                  'Olá! Seu cadastro no Consciente foi localizado, mas suas caixinhas ainda precisam ser configuradas. Acesse ' +
                  LOCAL_APP_ACCESS_LINK +
                  ' para definir suas caixinhas de gastos!'
              } else if (
                reliabilityHelper &&
                typeof reliabilityHelper.buildGracefulFallbackReply === 'function'
              ) {
                try {
                  agentReply = reliabilityHelper.buildGracefulFallbackReply(
                    textContent,
                    isAudioMessage,
                  )
                } catch (relFbErr) {
                  console.error(
                    '[whatsapp_bridge] Erro ao chamar buildGracefulFallbackReply do reliabilityHelper, recorrendo ao inline:',
                    relFbErr,
                  )
                  agentReply = buildGracefulFallbackInline(textContent, isAudioMessage)
                }
              } else {
                // Fallback interno 100% embutido inline no callback — NUNCA pede gasto para saudações/dúvidas
                agentReply = buildGracefulFallbackInline(textContent, isAudioMessage)
              }
              console.log(
                `[whatsapp_bridge] Mensagem de fallback gerada: "${agentReply.slice(0, 100)}"`,
              )
            }

            // Atualiza contato: incrementa contagem e salva data e conversa
            try {
              const currentCount = contact.getInt('messages_count') || 0
              contact.set('messages_count', currentCount + 1)
              contact.set('last_message_at', new Date().toISOString())
              if (newConvId) {
                contact.set('conversation_id', newConvId)
              }
              $app.save(contact)
              console.log(
                `[whatsapp_bridge] Contato ${phoneDigits} atualizado: count=${currentCount + 1}, conv=${newConvId || 'vazio'}`,
              )
            } catch (saveErr) {
              console.log('[whatsapp_bridge] Erro ao salvar contato:', saveErr)
            }

            // Envia resposta no WhatsApp pela WhatsApp Cloud API da Meta oficial
            if (agentReply) {
              try {
                const sendResult = sendMetaMessage(phoneDigits, agentReply)
                if (!sendResult.success) {
                  console.log('[whatsapp_bridge] Envio Meta Cloud API falhou:', sendResult.error)
                } else {
                  console.log(
                    '[whatsapp_bridge] Resposta entregue com sucesso via WhatsApp Meta Cloud API para:',
                    phoneDigits,
                  )
                }
              } catch (metaErr) {
                console.log(
                  '[whatsapp_bridge] Exceção inesperada no envio Meta Cloud API:',
                  metaErr,
                )
              }
            }

            processedCount++
          }
        }
      }
    }

    return e.json(200, { success: true, processed: processedCount })
  } catch (err) {
    console.log('[whatsapp_bridge] Erro no webhook POST:', err)
    return e.json(200, { success: false, error: String(err) })
  }
})

// ----------------------------------------------------
// 3. Rota de Envio de Mensagem de Teste Direto (Meta Cloud API) - RESTRITA A ADMIN
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/send-test',
  (e) => {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
        authUser.getString('role') === 'admin')
    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }
    try {
      const normalizeDigits = function (raw) {
        if (!raw) return ''
        let digits = String(raw).replace(/\D/g, '')
        if (digits.length === 10 || digits.length === 11) {
          digits = '55' + digits
        }
        return digits
      }

      const body = e.requestInfo().body || {}
      const targetPhone = normalizeDigits(body.to_number || '5511949989868')
      const text =
        body.text ||
        'Olá! Seu canal oficial do Consciente - Seu parceiro nas finanças está conectado e ativo via Meta Cloud API. Canal configurado com sucesso para suas caixinhas!'

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let statusRecord = null

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          if (!statusRecord) statusRecord = rec
          if (recToken) {
            statusRecord = rec
            break
          }
        }
      } catch (_) {}

      if (!token) {
        const msg =
          'Token de Acesso da Meta não configurado. Por favor, cole seu Token Permanente em Minha Conta > Canal Oficial WhatsApp Business.'
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'failed_missing_token')
            statusRecord.set('last_send_error', msg)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return e.json(400, {
          success: false,
          missing_token: true,
          error: msg,
        })
      }

      const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: targetPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: String(text).trim(),
        },
      }

      console.log('[whatsapp_bridge] send-test disparado para: ' + targetPhone)

      let res = null
      try {
        res = $http.send({
          url: endpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 30,
        })
      } catch (httpErr) {
        const netErr =
          'Erro de conexão com Meta Graph API: ' +
          (httpErr ? httpErr.message || String(httpErr) : '')
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'network_error')
            statusRecord.set('last_send_error', netErr)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return e.json(500, { success: false, error: netErr })
      }

      const statusCode = res.statusCode
      const rawBody = res.rawText || ''
      let responseJson = {}
      try {
        responseJson = JSON.parse(rawBody)
      } catch (_) {
        responseJson = { raw: rawBody }
      }

      console.log(
        '[whatsapp_bridge] send-test retorno statusCode=' +
          statusCode +
          ' body=' +
          rawBody.slice(0, 300),
      )

      if (statusCode >= 200 && statusCode < 300) {
        const msgId =
          responseJson.messages && responseJson.messages[0] ? responseJson.messages[0].id : null
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'success')
            statusRecord.set('last_send_error', '')
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return e.json(200, {
          success: true,
          message_id: msgId,
          data: responseJson,
        })
      }

      const metaErr = responseJson.error || {}
      const metaCode = metaErr.code
      const metaSubcode = metaErr.error_subcode
      const metaMsg = metaErr.message || rawBody || 'Erro HTTP ' + statusCode

      let friendly = metaMsg
      if (statusCode === 401 || metaCode === 190) {
        friendly =
          'Token da Meta expirado ou inválido (code ' +
          metaCode +
          '). Atualize o token em Minha Conta.'
      } else if (
        metaCode === 131047 ||
        metaSubcode === 2494010 ||
        /template/i.test(metaMsg) ||
        /24\s*hour/i.test(metaMsg)
      ) {
        friendly =
          'Janela de 24h fechada. Cliente precisa enviar mensagem primeiro ou usar template aprovado pela Meta.'
      } else if (metaCode === 131030 || metaCode === 131026) {
        friendly = 'Número não cadastrado na lista de teste da Meta (code ' + metaCode + ').'
      }

      if (statusRecord) {
        try {
          statusRecord.set('last_send_status', 'failed_' + statusCode)
          statusRecord.set('last_send_error', friendly.slice(0, 500))
          statusRecord.set('last_send_at', new Date().toISOString())
          $app.save(statusRecord)
        } catch (_) {}
      }

      return e.json(statusCode || 400, {
        success: false,
        error: friendly,
        code: metaCode,
        subcode: metaSubcode,
        meta_raw: metaErr,
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Exceção em send-test:', err)
      return e.json(500, {
        success: false,
        error: String(err),
      })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 4. Rota para Salvar Token de Acesso da Meta com Segurança - RESTRITA A ADMIN
// ----------------------------------------------------

routerAdd(
  'POST',
  '/backend/v1/whatsapp/token',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const body = e.requestInfo().body || {}
      const token = String(body.access_token || '').trim()

      if (!token) {
        return e.json(400, { error: 'O token de acesso não pode ser vazio' })
      }

      const wsCol = $app.findCollectionByNameOrId('whatsapp_status')
      let record = null

      try {
        const records = $app.findRecordsByFilter(
          'whatsapp_status',
          `owner = '${authUser.id}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          record = records[0]
        }
      } catch (_) {}

      if (!record) {
        try {
          const anyRecords = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
          if (anyRecords.length > 0) {
            record = anyRecords[0]
          }
        } catch (_) {}
      }

      if (!record) {
        record = new Record(wsCol)
        record.set('owner', authUser.id)
        record.set('phone_number', '+55 11 94998-9868')
        record.set('phone_number_id', '1314873981716321')
        record.set('waba_id', '1888947369148112')
        record.set('app_name', 'Consciente')
        record.set('verify_token', 'agente-financeiro')
        record.set('connected', true)
      }

      record.set('access_token', token)
      record.set('last_send_error', '')
      $app.save(record)

      console.log(
        '[whatsapp_bridge] Token permanente da Meta atualizado para o usuário:',
        authUser.id,
      )

      return e.json(200, {
        success: true,
        token_configurado: true,
        message: 'Token de Acesso da Meta salvo com sucesso!',
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro ao salvar token da Meta:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 4.1 Rota para Salvar Chave de Transcrição de Voz (STT API Key) - RESTRITA A ADMIN
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/stt-key',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const body = e.requestInfo().body || {}
      const sttKey = String(body.stt_api_key || body.key || '').trim()

      if (!sttKey) {
        return e.json(400, { error: 'A chave de transcrição (STT) não pode ser vazia' })
      }

      const wsCol = $app.findCollectionByNameOrId('whatsapp_status')
      let record = null

      try {
        const records = $app.findRecordsByFilter(
          'whatsapp_status',
          `owner = '${authUser.id}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          record = records[0]
        }
      } catch (_) {}

      // Se o registro não tem owner ou é global, reaproveita o existente
      if (!record) {
        try {
          const anyRecords = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
          if (anyRecords.length > 0) {
            record = anyRecords[0]
          }
        } catch (_) {}
      }

      if (!record) {
        record = new Record(wsCol)
        record.set('owner', authUser.id)
        record.set('phone_number', '+55 11 94998-9868')
        record.set('phone_number_id', '1314873981716321')
        record.set('waba_id', '1888947369148112')
        record.set('app_name', 'Consciente')
        record.set('verify_token', 'agente-financeiro')
        record.set('connected', true)
      }

      record.set('stt_api_key', sttKey)
      $app.save(record)

      console.log(
        '[whatsapp_bridge] Chave de transcrição (STT) atualizada com sucesso para admin:',
        authUser.id,
      )

      return e.json(200, {
        success: true,
        stt_configurado: true,
        message: 'Chave de transcrição de voz salva com sucesso!',
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro ao salvar chave STT:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 5. Rota de Simulação com Agente
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/simulate',
  (e) => {
    try {
      // Link ÚNICO de acesso ao app informado pela IA (v0.0.169) — ver nota central acima.
      const LOCAL_APP_ACCESS_LINK = 'https://consciente.goskip.app'

      const normalizeDigits = function (raw) {
        if (!raw) return ''
        let digits = String(raw).replace(/\D/g, '')
        if (digits.length === 10 || digits.length === 11) {
          digits = '55' + digits
        }
        return digits
      }

      const getOrCreateGuestUser = function () {
        try {
          const guest = $app.findAuthRecordByEmail(
            '_pb_users_auth_',
            'whatsapp-visitante@agente.internal',
          )
          if (guest && guest.id) return guest
        } catch (_) {}

        try {
          const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
          if (users.length > 0 && users[0].id) return users[0]
        } catch (_) {}

        try {
          const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
          const newGuest = new Record(usersCol)
          newGuest.setEmail('whatsapp-visitante@agente.internal')
          newGuest.setPassword('Skip@Pass123!')
          newGuest.setVerified(true)
          newGuest.set('name', 'Visitante WhatsApp')
          newGuest.set('onboarding_completed', true)
          $app.save(newGuest)
          console.log('[whatsapp_bridge] Usuário visitante criado sob demanda:', newGuest.id)
          return newGuest
        } catch (err) {
          console.log('[whatsapp_bridge] Falha ao criar usuário visitante sob demanda:', err)
        }

        return null
      }

      const resolveUser = function (phoneDigits, senderName) {
        if (!phoneDigits) return null

        const suffixMatch = function (p1, p2) {
          if (!p1 || !p2) return false
          if (p1 === p2) return true
          if (p1.endsWith(p2) || p2.endsWith(p1)) return true
          const s1 = p1.slice(-8)
          const s2 = p2.slice(-8)
          return s1.length >= 8 && s1 === s2
        }

        // 1. Verifica se já existe vínculo explícito em whatsapp_contacts
        try {
          const contact = $app.findFirstRecordByData(
            'whatsapp_contacts',
            'phone_number',
            phoneDigits,
          )
          const contactUserId = contact.getString('user')
          if (contactUserId) {
            const u = $app.findRecordById('_pb_users_auth_', contactUserId)
            if (u && u.id && u.getString('email') !== 'whatsapp-visitante@agente.internal') return u
          }
        } catch (_) {}

        // 2. Busca na coleção de usuários pelo campo phone (com match por sufixo)
        try {
          const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 300, 0)
          for (let u = 0; u < users.length; u++) {
            const user = users[u]
            if (user.getString('email') === 'whatsapp-visitante@agente.internal') continue
            const userPhone = normalizeDigits(user.getString('phone'))
            if (userPhone && suffixMatch(userPhone, phoneDigits)) {
              return user
            }
          }
        } catch (_) {}

        // 3. Fallback: single real user
        try {
          const realUsers = $app.findRecordsByFilter(
            '_pb_users_auth_',
            "email != 'whatsapp-visitante@agente.internal'",
            '-created',
            10,
            0,
          )
          if (realUsers.length === 1) {
            const soleUser = realUsers[0]
            const existingPhone = normalizeDigits(soleUser.getString('phone'))
            if (!existingPhone || suffixMatch(existingPhone, phoneDigits)) {
              if (!existingPhone) {
                try {
                  soleUser.set('phone', phoneDigits)
                  $app.save(soleUser)
                } catch (_) {}
              }
              return soleUser
            }
          }
        } catch (_) {}

        return null
      }

      const sendMetaMessage = function (toNumber, textBody) {
        const cleanTo = normalizeDigits(toNumber)
        if (!cleanTo) return { success: false, error: 'Número inválido' }

        let activePhoneId = '1314873981716321'
        let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
        let statusRecord = null

        try {
          const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
          for (let idx = 0; idx < wsList.length; idx++) {
            const rec = wsList[idx]
            if (rec.getString('phone_number_id')) {
              activePhoneId = rec.getString('phone_number_id')
            }
            const recToken = rec.getString('access_token')
            if (recToken && !token) {
              token = recToken
            }
            if (!statusRecord) statusRecord = rec
            if (recToken) {
              statusRecord = rec
              break
            }
          }
        } catch (_) {}

        if (!token) {
          return { success: false, error: 'Token de acesso da Meta não configurado' }
        }

        const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: false,
            body: String(textBody || '').trim(),
          },
        }

        let res = null
        try {
          res = $http.send({
            url: endpoint,
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeout: 30,
          })
        } catch (httpErr) {
          return { success: false, error: httpErr ? httpErr.message || String(httpErr) : '' }
        }

        const statusCode = res.statusCode
        if (statusCode >= 200 && statusCode < 300) {
          return { success: true, status: statusCode }
        }

        return { success: false, status: statusCode, error: 'Erro HTTP ' + statusCode }
      }

      const body = e.requestInfo().body || {}
      const rawPhone = body.phone_number
      const message = body.message
      const senderName = body.sender_name || 'Usuário Teste'
      const sendRemote = body.send_remote !== false

      if (!rawPhone || !message) {
        return e.json(400, { error: 'phone_number e message são obrigatórios' })
      }

      const phoneDigits = normalizeDigits(rawPhone)

      // 1. Localiza usuário vinculado
      const matchedUser = resolveUser(phoneDigits, senderName)

      // 2. Localiza ou cria registro de contato
      const contactsCol = $app.findCollectionByNameOrId('whatsapp_contacts')
      let contact = null
      try {
        contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', phoneDigits)
      } catch (_) {
        contact = new Record(contactsCol)
        contact.set('phone_number', phoneDigits)
        contact.set('name', senderName || 'Contato WhatsApp')
        contact.set('messages_count', 0)
      }

      if (matchedUser) {
        contact.set('user', matchedUser.id)
        if (matchedUser.getString('name') && !contact.getString('name')) {
          contact.set('name', matchedUser.getString('name'))
        }
        try {
          if (!matchedUser.getString('phone')) {
            matchedUser.set('phone', phoneDigits)
            $app.save(matchedUser)
          }
        } catch (_) {}
      } else if (!contact.getString('user')) {
        contact.set('user', '')
      }

      if (senderName && contact.getString('name') === 'Contato WhatsApp') {
        contact.set('name', senderName)
      }
      $app.save(contact)

      // -------------------------------------------------------------------
      // TESTE DE ECO (ex-Item 39, v0.0.98) — espelho da interceptação do
      // webhook real, para validar pelo Backoffice (/simulate) sem número
      // real. Responde a MESMA mensagem de volta SEM consumir IA. Padrão
      // localXxx estrito. Intercepta ANTES da resolução do usuário ativo —
      // funciona também para números não cadastrados (uso no Backoffice).
      // -------------------------------------------------------------------
      const localSimEchoLower = String(message || '')
        .toLowerCase()
        .trim()
      const localSimEchoIsEco =
        localSimEchoLower === '#eco' ||
        localSimEchoLower === '/eco' ||
        localSimEchoLower.indexOf('#eco ') === 0 ||
        localSimEchoLower.indexOf('/eco ') === 0
      if (localSimEchoIsEco) {
        const localSimEchoPayload = String(message || '')
          .replace(/^\s*(#eco|\/eco)\s*/i, '')
          .trim()
        const localSimEchoReply =
          '🔁 Teste de Eco — Consciente\n\n' +
          'Mensagem recebida, persistida e devolvida ponta a ponta ' +
          '(simulador Backoffice → persistência → envio Meta Graph API), SEM passar pela IA. ✅\n\n' +
          'Você enviou: "' +
          (localSimEchoPayload || '(comando #eco sem conteúdo)') +
          '"\n\n' +
          'Canal de diagnóstico OK — se esta resposta apareceu no simulador, a interceptação de eco está íntegra!'
        console.log(
          '[whatsapp_bridge] [simulate] [ECO] Interceptação de Teste de Eco: phone=' +
            phoneDigits +
            ' payload="' +
            localSimEchoPayload.slice(0, 80) +
            '"',
        )
        let localSimEchoRemoteSent = false
        let localSimEchoRemoteError = null
        if (sendRemote) {
          try {
            const localSimEchoMetaRes = sendMetaMessage(phoneDigits, localSimEchoReply)
            localSimEchoRemoteSent = localSimEchoMetaRes.success
            localSimEchoRemoteError = localSimEchoMetaRes.error || null
            console.log(
              '[whatsapp_bridge] [simulate] [ECO] Envio Meta Graph API: success=' +
                localSimEchoRemoteSent +
                (localSimEchoRemoteError ? ' erro=' + localSimEchoRemoteError : ''),
            )
          } catch (localSimEchoErr) {
            console.log('[whatsapp_bridge] [simulate] [ECO] Erro no envio do eco:', localSimEchoErr)
          }
        }
        try {
          const localSimEchoCount = contact.getInt('messages_count') || 0
          contact.set('messages_count', localSimEchoCount + 1)
          contact.set('last_message_at', new Date().toISOString())
          $app.save(contact)
        } catch (_) {}
        return e.json(200, {
          success: true,
          simulation: true,
          echo_test: true,
          phone: phoneDigits,
          user_id: matchedUser ? matchedUser.id : '',
          user_name: matchedUser ? matchedUser.getString('name') : 'Visitante',
          is_registered: !!matchedUser,
          conversation_id: contact.getString('conversation_id') || null,
          reply: localSimEchoReply,
          remote_sent: localSimEchoRemoteSent,
          remote_error: localSimEchoRemoteError,
        })
      }

      // 3. Determina usuário ativo para o agente
      let activeUserId = ''
      let isRegistered = false

      if (matchedUser) {
        activeUserId = matchedUser.id
        isRegistered = true
      } else {
        const guest = getOrCreateGuestUser()
        if (guest) {
          activeUserId = guest.id
        }
      }

      const existingConvId = contact.getString('conversation_id') || null
      const messageTimestampIso = new Date().toISOString()
      const todayStr = messageTimestampIso.slice(0, 10)

      let promptForAgent = `[Data para registro: ${todayStr}. Origem da mensagem: whatsapp_text. Data e hora exata da mensagem: ${messageTimestampIso}. Usuário cadastrado e ativo (${matchedUser ? matchedUser.getString('name') || matchedUser.getString('email') : ''}). IMPORTANTE: No banco de dados, o campo amount de transactions deve ser gravado em CENTAVOS (valor em reais * 100, ex: 100 reais = 10000 centavos, 45 reais = 4500). O campo source deve ser 'whatsapp_text' e o campo message_timestamp deve ser '${messageTimestampIso}'. Para a data da transação, use '${todayStr}'. REGISTRE IMEDIATAMENTE qualquer gasto enviado sem pedir para finalizar cadastro]: ${message}`
      if (!isRegistered) {
        promptForAgent =
          `[ATENÇÃO: Mensagem recebida via WhatsApp de um número AINDA NÃO CADASTRADO ou NÃO VINCULADO no aplicativo (${phoneDigits}, nome: "${senderName || 'Visitante'}").
Apresente-se cordialmente como o Consciente - Seu parceiro nas finanças. Explique brevemente que você ajuda no controle diário de custos e caixinhas.
Se a mensagem for um gasto ou dúvida, convide a pessoa a acessar o app informando OBRIGATORIAMENTE este ÚNICO link oficial (serve para acessar, logar ou se cadastrar — nunca informe outros links ou variações):
- Link de acesso ao Consciente: ` +
          LOCAL_APP_ACCESS_LINK +
          `
Se a pessoa já tem conta criada e não está sendo reconhecida, instrua com carinho: "Acesse ` +
          LOCAL_APP_ACCESS_LINK +
          ` e confirme seu WhatsApp em Minha Conta > Perfil para sincronizar seus lançamentos na hora!"]: ${message}`
      }

      let agentReply = ''
      let newConvId = existingConvId

      // Helper de confiabilidade carregado no boot (seção 1.5), cacheado em globalThis.
      const reliabilityHelperSim =
        typeof globalThis !== 'undefined' ? globalThis.__reliabilityHelper : null

      // 1. Guardrail de Temas (Item 22) no simulate
      if (
        message &&
        reliabilityHelperSim &&
        typeof reliabilityHelperSim.isOffTopicQuery === 'function' &&
        reliabilityHelperSim.isOffTopicQuery(message)
      ) {
        console.log(
          '[whatsapp_bridge] [simulate] Mensagem fora de escopo detectada pelo guardrail:',
          message,
        )
        agentReply = reliabilityHelperSim.OFF_TOPIC_GUARDRAIL_REPLY
      }

      // 1.2 DETECTOR DETERMINÍSTICO DE PERGUNTA (v0.0.123 — Opção A da dona)
      // Pergunta => MODO CONSULTA: NENHUMA transação pode ser criada e os
      // fluxos que registram (cancelamento de pendência, escolha de caixinha,
      // retroativo) são ignorados; o prompt do agente troca para consulta
      // baseada EXCLUSIVAMENTE na base de dados atual (não no histórico).
      let isConsultaMode = false
      if (!agentReply && isRegistered && message) {
        try {
          isConsultaMode =
            typeof globalThis !== 'undefined' &&
            !!globalThis.__whatsappIsQuestionMessage &&
            globalThis.__whatsappIsQuestionMessage(message)
        } catch (qDetErr) {
          console.log(
            '[whatsapp_bridge] [simulate] Erro no detector de pergunta (seguindo fluxo normal):',
            qDetErr,
          )
          isConsultaMode = false
        }
        if (isConsultaMode) {
          console.log(
            '[whatsapp_bridge] [simulate] PERGUNTA detectada — MODO CONSULTA ativo (nenhuma transação será criada):',
            message,
          )
          promptForAgent = `[MODO CONSULTA — NÃO crie transações; responda à pergunta do cliente com base EXCLUSIVAMENTE nos dados atuais da base de dados (transações, caixinhas, orçamentos), consultando as coleções; NÃO use o histórico da conversa como fonte de verdade sobre lançamentos ou saldos — o cliente pode ter feito um lançamento ou uma alteração diretamente pela interface do app, que é a fonte mais atual. Responda à pergunta a seguir; se o cliente na verdade quis registrar um gasto, oriente-o a enviar no formato curto (ex.: "Padaria 12") SEM criar nada agora]: ${message}`
        }
      }

      // 2. Fluxo Conversacional de Cancelamento / Substituição (Item 23) no simulate
      if (
        !agentReply &&
        !isConsultaMode &&
        isRegistered &&
        message &&
        reliabilityHelperSim &&
        typeof reliabilityHelperSim.handleCancellationFlow === 'function'
      ) {
        try {
          const cancelRes = reliabilityHelperSim.handleCancellationFlow(
            $app,
            activeUserId,
            contact,
            message,
          )
          if (cancelRes && cancelRes.handled && cancelRes.reply) {
            agentReply = cancelRes.reply
            console.log(
              '[whatsapp_bridge] [simulate] Fluxo de cancelamento interceptado:',
              agentReply,
            )
          }
        } catch (cFlowErr) {
          console.log(
            '[whatsapp_bridge] [simulate] Erro no fluxo de cancelamento seguro:',
            cFlowErr,
          )
        }
      }

      // 2.1 Fluxo Conversacional de Escolha Obrigatória de Caixinha no simulate (Item 29 / v0.0.56 / v0.0.69)
      // Executado primariamente via localHandleCaixinhaFlow inline no callback (padrão localXxx sem require)
      if (
        !agentReply &&
        !isConsultaMode &&
        isRegistered &&
        message &&
        typeof localHandleCaixinhaFlow === 'function'
      ) {
        try {
          const caixinhaRes = localHandleCaixinhaFlow(
            $app,
            activeUserId,
            message,
            contact,
            todayStr,
            'whatsapp_text',
          )
          if (caixinhaRes && caixinhaRes.handled && caixinhaRes.reply) {
            agentReply = caixinhaRes.reply
            console.log(
              '[whatsapp_bridge] [simulate] Fluxo de escolha de caixinha (inline) executado:',
              agentReply,
            )
          }
        } catch (cxFlowErr) {
          console.log(
            '[whatsapp_bridge] [simulate] Erro no fluxo de escolha de caixinha (inline):',
            cxFlowErr,
          )
        }
      } else if (
        !agentReply &&
        !isConsultaMode &&
        isRegistered &&
        message &&
        reliabilityHelperSim &&
        typeof reliabilityHelperSim.handleCaixinhaFlow === 'function'
      ) {
        try {
          const caixinhaRes = reliabilityHelperSim.handleCaixinhaFlow(
            $app,
            activeUserId,
            message,
            contact,
            todayStr,
            'whatsapp_text',
          )
          if (caixinhaRes && caixinhaRes.handled && caixinhaRes.reply) {
            agentReply = caixinhaRes.reply
            console.log(
              '[whatsapp_bridge] [simulate] Fluxo de escolha de caixinha executado (fallback helper):',
              agentReply,
            )
          }
        } catch (cxFlowErr) {
          console.log(
            '[whatsapp_bridge] [simulate] Erro no fluxo de escolha de caixinha:',
            cxFlowErr,
          )
        }
      }

      // 3. Detecção e Ajuste de Data Retroativa (Item 28) no simulate
      if (
        !agentReply &&
        !isConsultaMode &&
        message &&
        reliabilityHelperSim &&
        typeof reliabilityHelperSim.parseRetroactiveDate === 'function'
      ) {
        try {
          const retroactiveInfo = reliabilityHelperSim.parseRetroactiveDate(message, todayStr)
          if (retroactiveInfo && retroactiveInfo.isRetroactive && retroactiveInfo.targetDateStr) {
            promptForAgent =
              `[ATENÇÃO: LANÇAMENTO RETROATIVO DETECTADO. O cliente informou expressamente que o gasto ocorreu em: ${retroactiveInfo.targetDateStr} (frase: "${retroactiveInfo.matchedPhrase}"). REGISTRE com campo 'date' = '${retroactiveInfo.targetDateStr}', 'is_retroactive' = true, 'status' = 'active'. Na confirmação, cite expressamente a data retroativa no formato "contabilizado em ${retroactiveInfo.matchedPhrase} (${retroactiveInfo.targetDateStr.slice(8, 10)}/${retroactiveInfo.targetDateStr.slice(5, 7)})"]: ` +
              promptForAgent
          }
        } catch (retErr) {
          console.log('[whatsapp_bridge] [simulate] Erro ao interpretar data retroativa:', retErr)
        }
      }

      // MOTOR DETERMINÍSTICO DE RESUMO no simulate — SEM REQUIRE (padrão
      // comprovado: require de módulos de hook falha com "GoError: Invalid
      // module"). Resolução idêntica à do webhook.
      const resolveCaixinhasEngineSim = function () {
        try {
          if (
            typeof globalThis !== 'undefined' &&
            globalThis.__caixinhasInlineEngine &&
            typeof globalThis.__caixinhasInlineEngine.isCaixinhasOverviewIntent === 'function' &&
            typeof globalThis.__caixinhasInlineEngine.buildCaixinhasSummaryForUser === 'function' &&
            typeof globalThis.__caixinhasInlineEngine.buildCaixinhasContextPrompt === 'function'
          ) {
            return globalThis.__caixinhasInlineEngine
          }
        } catch (_) {}
        try {
          if (
            typeof inlineIsCaixinhasOverviewIntent === 'function' &&
            typeof inlineBuildCaixinhasSummaryForUser === 'function' &&
            typeof inlineBuildCaixinhasContextPrompt === 'function'
          ) {
            return {
              isCaixinhasOverviewIntent: inlineIsCaixinhasOverviewIntent,
              buildCaixinhasSummaryForUser: inlineBuildCaixinhasSummaryForUser,
              buildCaixinhasContextPrompt: inlineBuildCaixinhasContextPrompt,
            }
          }
        } catch (_) {}
        return null
      }
      const caixinhasEngineSim = resolveCaixinhasEngineSim()
      if (!caixinhasEngineSim) {
        console.error(
          '[whatsapp_bridge] [simulate] ATENÇÃO: motor determinístico de resumo INDISPONÍVEL (sem require). Resumo responderá mensagem honesta de instabilidade — NUNCA via IA.',
        )
      }
      let isCaixinhasOverview = false
      if (isRegistered && message) {
        try {
          if (
            caixinhasEngineSim &&
            typeof caixinhasEngineSim.isCaixinhasOverviewIntent === 'function'
          ) {
            isCaixinhasOverview = caixinhasEngineSim.isCaixinhasOverviewIntent(message)
          }
        } catch (intentErr) {
          console.log(
            '[whatsapp_bridge] [simulate] Erro na checagem de intenção de resumo:',
            intentErr,
          )
        }
      }

      if (isCaixinhasOverview) {
        console.log(
          `[whatsapp_bridge] [simulate] Interceptação determinística de resumo (inline) para usuário ${activeUserId}. Montando resumo DIRETO da base (SEM IA)...`,
        )
        try {
          if (!caixinhasEngineSim) {
            throw new Error('motor determinístico de resumo não resolvido (sem require)')
          }
          const summary = caixinhasEngineSim.buildCaixinhasSummaryForUser(
            $app,
            activeUserId,
            todayStr.slice(0, 7),
          )
          if (summary) {
            agentReply = summary
            console.log(
              `[whatsapp_bridge] [simulate] Resumo visual das caixinhas montado com sucesso (tamanho=${agentReply.length}).`,
            )
          } else {
            agentReply =
              'Não consegui carregar suas caixinhas no momento. Por favor, tente novamente em alguns instantes ou consulte pelo app!'
          }
        } catch (sumErr) {
          console.error(
            '[whatsapp_bridge] [simulate] Falha ao construir resumo visual das caixinhas:',
            sumErr,
          )
          agentReply =
            'Ocorreu uma instabilidade ao consultar suas caixinhas na base de dados agora. Por favor, tente novamente em alguns instantes ou acesse pelo app!'
        }
      }

      const isConvNotFoundError = function (err) {
        if (!err) return false
        const errStr = String(err).toLowerCase()
        return (
          errStr.includes('conversation not found') ||
          errStr.includes('conversation_not_found') ||
          (err.message && /conversation not found/i.test(err.message))
        )
      }

      if (activeUserId && !agentReply) {
        // INJEÇÃO DE CONTEXTO DETERMINÍSTICO DE CAIXINHAS ATIVAS (Anti-alucinação) no simulate:
        // Motor determinístico SEM REQUIRE via caixinhasEngineSim (globalThis/closure).
        if (isRegistered) {
          try {
            if (
              !caixinhasEngineSim ||
              typeof caixinhasEngineSim.buildCaixinhasContextPrompt !== 'function'
            ) {
              throw new Error('motor determinístico de contexto não resolvido (sem require)')
            }
            const caixinhasContext = caixinhasEngineSim.buildCaixinhasContextPrompt(
              $app,
              activeUserId,
              todayStr.slice(0, 7),
            )
            if (caixinhasContext) {
              promptForAgent = `${caixinhasContext}\n\n${promptForAgent}`
            }
          } catch (ctxErr) {
            console.log(
              '[whatsapp_bridge] [simulate] Erro ao injetar contexto fresco de caixinhas no prompt:',
              ctxErr,
            )
          }
        }
        const maxSimAttempts = 3
        let simAttempt = 0
        let currentConvIdForSim = existingConvId

        while (simAttempt < maxSimAttempts && !agentReply) {
          simAttempt++
          try {
            console.log(
              `[whatsapp_bridge] [simulate] Chamando $ai.agent('financeiro-whatsapp').chat (tentativa ${simAttempt}/${maxSimAttempts}) user_id=${activeUserId}, conv_id=${currentConvIdForSim || 'null'}`,
            )
            const agentResult = $ai.agent('financeiro-whatsapp').chat({
              user_id: activeUserId,
              conversation_id: currentConvIdForSim,
              message: promptForAgent,
            })
            agentReply = agentResult.content || ''
            newConvId = agentResult.conversation_id || currentConvIdForSim
          } catch (aErr) {
            console.error(
              `[whatsapp_bridge] [simulate] Falha ao executar agente na tentativa ${simAttempt}/${maxSimAttempts}:`,
              aErr,
            )

            if (currentConvIdForSim && isConvNotFoundError(aErr)) {
              console.log(
                `[whatsapp_bridge] [simulate] Conversation_id inválido (${currentConvIdForSim}). Resetando para conversa limpa na próxima tentativa...`,
              )
              currentConvIdForSim = null
            } else if (
              /context canceled|context deadline|gateway call|timeout|deadline exceeded/i.test(
                String(aErr),
              )
            ) {
              console.warn(
                `[whatsapp_bridge] [simulate] Falha transitória de gateway/timeout detectada na tentativa ${simAttempt}. Tentando conversa limpa e backoff...`,
              )
              currentConvIdForSim = null
              if (simAttempt < maxSimAttempts) {
                const backoffMs = simAttempt * 700
                try {
                  if (typeof $sleep === 'function') {
                    $sleep(backoffMs)
                  } else {
                    const sStart = Date.now()
                    while (Date.now() - sStart < backoffMs) {}
                  }
                } catch (_) {}
              }
            } else {
              currentConvIdForSim = null
            }
          }
        }
      }

      // Funções de fallback 100% INLINE dentro do callback de simulação
      const isSpendingMessageSimInline = function (rawText) {
        if (!rawText) return false
        const t = String(rawText)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        const hasNumber = /\d+([.,]\d{1,2})?/.test(t)
        if (hasNumber) {
          if (
            t.includes('real') ||
            t.includes('reais') ||
            t.includes('r$') ||
            t.includes('gastei') ||
            t.includes('comprei') ||
            t.includes('paguei') ||
            t.includes('custou') ||
            t.includes('despesa') ||
            t.includes('almo') ||
            t.includes('uber') ||
            t.includes('mercado') ||
            t.includes('padaria') ||
            t.includes('farmacia') ||
            t.includes('cafe') ||
            t.includes('gasolina') ||
            t.includes('lanche') ||
            t.includes('pizza') ||
            t.includes('jantar') ||
            t.includes('ifood') ||
            t.includes('combustivel')
          ) {
            return true
          }
          if (/^[a-z\s]{3,20}\s+\d+([.,]\d{1,2})?$/.test(t)) {
            return true
          }
        }
        if (
          t.startsWith('gastei ') ||
          t.startsWith('paguei ') ||
          t.startsWith('comprei ') ||
          t.includes(' novo gasto') ||
          t.includes('registrar gasto') ||
          t.includes('registra gasto') ||
          t.includes('lancar gasto') ||
          t.includes('lança gasto')
        ) {
          return true
        }
        return false
      }

      const buildGracefulFallbackSimInline = function (rawText) {
        const raw = String(rawText || '').trim()
        const isSpending = isSpendingMessageSimInline(raw)
        if (isSpending) {
          return 'Olá! Não consegui processar seu gasto agora no Consciente devido a uma oscilação momentânea. Por favor, envie novamente com o valor e a categoria (ex: "Almoço 35 reais") para eu registrar na sua caixinha!'
        }
        const lower = raw.toLowerCase()
        if (
          lower.includes('deu certo') ||
          lower.includes('conseguiu') ||
          lower.includes('registrou') ||
          lower.includes('salvou') ||
          lower.includes('gravou')
        ) {
          return 'Olá! O Consciente está aqui com você! 👋\nTivemos uma oscilação rápida agora há pouco e sua última solicitação pode não ter sido concluída. Você pode me mandar novamente o que gostaria de registrar ou checar? Se foi um gasto, pode mandar o valor e a caixinha (ex: "Almoço 35").'
        }
        if (
          lower === 'oi' ||
          lower === 'ola' ||
          lower === 'olá' ||
          lower.startsWith('oi ') ||
          lower.startsWith('ola ') ||
          lower.startsWith('olá ') ||
          lower.startsWith('bom dia') ||
          lower.startsWith('boa tarde') ||
          lower.startsWith('boa noite') ||
          lower.includes('tudo bem') ||
          lower.includes('e agora')
        ) {
          return 'Olá! Eu sou o Consciente - Seu parceiro nas finanças! 👋\nComo posso te ajudar agora? Você pode registrar um gasto (ex: "Almoço 35"), ver o resumo das caixinhas enviando "resumo", ou tirar uma dúvida financeira!'
        }
        return 'Olá! O Consciente está conectado com você! 👋\nTivemos uma oscilação momentânea e não consegui interpretar sua mensagem agora. Como posso te ajudar? Você pode me enviar um gasto para registrar (ex: "Mercado 120") ou mandar "resumo" para ver suas caixinhas!'
      }

      if (!agentReply) {
        if (isConsultaMode) {
          // MODO CONSULTA: falha do agente NUNCA pede reenvio de gasto —
          // responde com instabilidade de CONSULTA e aponta para o app.
          agentReply =
            'Tive uma instabilidade ao consultar seus dados na base agora. 🙏\nPor favor, tente perguntar novamente em alguns instantes — ou confira seus lançamentos e caixinhas direto no app, que sempre mostram o estado mais atual.'
        } else if (!isRegistered) {
          agentReply =
            'Olá! Eu sou o Consciente - Seu parceiro nas finanças no WhatsApp. 👋\n\nSeu número ainda não está vinculado a uma conta no app. Acesse o link oficial ' +
            LOCAL_APP_ACCESS_LINK +
            ' — ele serve para acessar, logar ou criar sua conta — e defina suas caixinhas para controlar seus custos diários em tempo real!'
        } else if (
          reliabilityHelperSim &&
          typeof reliabilityHelperSim.buildGracefulFallbackReply === 'function'
        ) {
          try {
            agentReply = reliabilityHelperSim.buildGracefulFallbackReply(message, false)
          } catch (relSimErr) {
            console.error(
              '[whatsapp_bridge] [simulate] Erro ao chamar reliabilityHelperSim, usando inline:',
              relSimErr,
            )
            agentReply = buildGracefulFallbackSimInline(message)
          }
        } else {
          // Fallback interno 100% inline no handler
          agentReply = buildGracefulFallbackSimInline(message)
        }
      }

      // Atualiza contato
      try {
        const currentCount = contact.getInt('messages_count') || 0
        contact.set('messages_count', currentCount + 1)
        contact.set('last_message_at', new Date().toISOString())
        if (newConvId) {
          contact.set('conversation_id', newConvId)
        }
        $app.save(contact)
      } catch (_) {}

      // Envia via Meta Cloud API se solicitado
      let remoteSent = false
      let remoteError = null

      if (sendRemote && agentReply) {
        const metaRes = sendMetaMessage(phoneDigits, agentReply)
        remoteSent = metaRes.success
        remoteError = metaRes.error || null
      }

      return e.json(200, {
        success: true,
        simulation: true,
        phone: phoneDigits,
        user_id: activeUserId,
        user_name: matchedUser ? matchedUser.getString('name') : 'Visitante',
        is_registered: isRegistered,
        conversation_id: newConvId,
        reply: agentReply,
        remote_sent: remoteSent,
        remote_error: remoteError,
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro na rota de simulação:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 6. Rota para consultar status do canal WhatsApp oficial
// O token NUNCA é retornado no JSON — apenas token_configurado: boolean
// RESTRITA A ADMIN: Cliente comum recebe 403 para não vazar IDs/webhooks da Meta
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/whatsapp/status',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let sttKey = $os.getenv('GROQ_API_KEY') || $os.getenv('OPENAI_API_KEY') || ''
      let userConfiguredPhone = '+55 11 94998-9868'
      let userWaActive = true
      let wabaId = '1888947369148112'
      let appName = 'Consciente'
      let verifyToken = 'agente-financeiro'
      let lastSendStatus = ''
      let lastSendError = ''
      let lastSendAt = ''

      try {
        const filterStr = authUser ? `owner = '${authUser.id}'` : ''
        const wsList = $app.findRecordsByFilter('whatsapp_status', filterStr, '-created', 1, 0)
        if (wsList.length > 0) {
          const rec = wsList[0]
          userConfiguredPhone = rec.getString('phone_number') || userConfiguredPhone
          userWaActive = rec.getBool('connected')
          activePhoneId = rec.getString('phone_number_id') || activePhoneId
          wabaId = rec.getString('waba_id') || wabaId
          appName = rec.getString('app_name') || appName
          verifyToken = rec.getString('verify_token') || verifyToken
          lastSendStatus = rec.getString('last_send_status')
          lastSendError = rec.getString('last_send_error')
          lastSendAt = rec.getString('last_send_at')
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          const recSttKey = rec.getString('stt_api_key')
          if (recSttKey && !sttKey) {
            sttKey = recSttKey
          }
        }
      } catch (_) {}

      // Fallback para encontrar se há qualquer token ou chave stt configurados na coleção
      if (!token || !sttKey) {
        try {
          const anyWs = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
          for (let i = 0; i < anyWs.length; i++) {
            if (!token) {
              const tk = anyWs[i].getString('access_token')
              if (tk) token = tk
            }
            if (!sttKey) {
              const sk = anyWs[i].getString('stt_api_key')
              if (sk) sttKey = sk
            }
            if (token && sttKey) break
          }
        } catch (_) {}
      }

      const hasToken = !!token
      const hasSttKey = !!sttKey

      const instanceUrl =
        $os.getenv('PB_INSTANCE_URL') ||
        'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'

      const webhookUrl = `${instanceUrl}/backend/v1/whatsapp/webhook`

      return e.json(200, {
        owner_connected: hasToken,
        token_configurado: hasToken,
        stt_configurado: hasSttKey,
        owner_phone: userConfiguredPhone,
        phone_number_id: activePhoneId,
        waba_id: wabaId,
        app_name: appName,
        verify_token: verifyToken,
        user_phone: userConfiguredPhone,
        user_connected: userWaActive,
        last_send_status: lastSendStatus,
        last_send_error: lastSendError,
        last_send_at: lastSendAt,
        webhook_url: webhookUrl,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 7. Rota para listar contatos que interagiram pelo WhatsApp - RESTRITA A ADMIN
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/whatsapp/contacts',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }
      const contacts = $app.findRecordsByFilter(
        'whatsapp_contacts',
        '',
        '-last_message_at,-created',
        100,
        0,
      )
      const list = []
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i]
        const userId = c.getString('user')
        let userName = ''
        if (userId) {
          try {
            const u = $app.findRecordById('_pb_users_auth_', userId)
            userName = u.getString('name') || u.getString('email')
          } catch (_) {}
        }

        list.push({
          id: c.id,
          phone_number: c.getString('phone_number'),
          name: c.getString('name'),
          user_id: userId,
          user_name: userName,
          is_registered: !!userId,
          conversation_id: c.getString('conversation_id'),
          messages_count: c.getInt('messages_count'),
          last_message_at: c.getString('last_message_at'),
          created: c.getString('created'),
        })
      }
      return e.json(200, { contacts: list })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 7.1 Rota de Diagnóstico de Transcrição de Áudio (Admin)
// ----------------------------------------------------

// ----------------------------------------------------
// 8. Rota para vincular contato a um usuário
// ----------------------------------------------------

// ----------------------------------------------------
// 9. Rota para Atualizar Foto do Perfil do WhatsApp via API da Meta (ITEM 20) - RESTRITA A ADMIN
// Utiliza o Resumable Upload da Meta para obter o upload handle e
// em seguida atualiza o perfil via POST /{phone_number_id}/whatsapp_business_profile com profile_picture_handle.
// O token NUNCA é exposto ao frontend.
// ----------------------------------------------------
routerAdd('GET', '/backend/v1/whatsapp/test-decoder', (e) => {
  try {
    // 1x1 JPEG de teste válido padrão (SOI: FF D8, APP0: FF E0, etc.)
    const sampleJpegB64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

    const query = e.requestInfo().query || {}
    const rawB64 = query.b64 || sampleJpegB64
    const cleanB64 = rawB64.replace(/^data:[^;]+;base64,/, '').replace(/[\s\r\n]+/g, '')

    if (!cleanB64 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(cleanB64)) {
      return e.json(400, { success: false, error: 'A string fornecida não é um Base64 válido.' })
    }

    const decodedArray = $security.base64Decode(cleanB64)
    const outputLen = decodedArray.length
    const byte0 = outputLen > 0 ? decodedArray[0] : 0
    const byte1 = outputLen > 1 ? decodedArray[1] : 0
    const isJpegMagic = byte0 === 0xff && byte1 === 0xd8

    console.log(
      `[whatsapp_bridge] [test-decoder] Decodificados ${outputLen} bytes. byte0=0x${(byte0 || 0).toString(16)}, byte1=0x${(byte1 || 0).toString(16)}, isJpegMagic=${isJpegMagic}`,
    )

    return e.json(200, {
      success: true,
      length: outputLen,
      byte0_hex: (byte0 || 0).toString(16),
      byte1_hex: (byte1 || 0).toString(16),
      isJpegMagic: isJpegMagic,
      first_8_bytes: Array.from(decodedArray.slice(0, 8)),
    })
  } catch (err) {
    return e.json(500, { success: false, error: String(err) })
  }
})

// ----------------------------------------------------
// 8.b Rota de diagnóstico do resumo determinístico de caixinhas (Admin)
// Valida que o módulo carrega e que o resumo é montado direto da base.
// ----------------------------------------------------
routerAdd('GET', '/backend/v1/whatsapp/diag-summary', (e) => {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
        authUser.getString('role') === 'admin')
    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    const result = {
      module_loaded: false,
      module_error: '',
      module_source: 'globalthis_or_inline_no_require',
      summary_preview: '',
      summary_error: '',
      active_user_id: '',
    }

    // Motor determinístico SEM REQUIRE (mesma resolução do webhook/simulate):
    // valida o carregamento e a prévia do resumo direto da base.
    const resolveCaixinhasEngineDiag = function () {
      try {
        if (
          typeof globalThis !== 'undefined' &&
          globalThis.__caixinhasInlineEngine &&
          typeof globalThis.__caixinhasInlineEngine.isCaixinhasOverviewIntent === 'function' &&
          typeof globalThis.__caixinhasInlineEngine.buildCaixinhasSummaryForUser === 'function' &&
          typeof globalThis.__caixinhasInlineEngine.buildCaixinhasContextPrompt === 'function'
        ) {
          return globalThis.__caixinhasInlineEngine
        }
      } catch (_) {}
      try {
        if (
          typeof inlineIsCaixinhasOverviewIntent === 'function' &&
          typeof inlineBuildCaixinhasSummaryForUser === 'function' &&
          typeof inlineBuildCaixinhasContextPrompt === 'function'
        ) {
          return {
            isCaixinhasOverviewIntent: inlineIsCaixinhasOverviewIntent,
            buildCaixinhasSummaryForUser: inlineBuildCaixinhasSummaryForUser,
            buildCaixinhasContextPrompt: inlineBuildCaixinhasContextPrompt,
          }
        }
      } catch (_) {}
      return null
    }

    try {
      const engineDiag = resolveCaixinhasEngineDiag()
      result.module_loaded =
        !!engineDiag && typeof engineDiag.buildCaixinhasSummaryForUser === 'function'
      if (engineDiag && typeof engineDiag.isCaixinhasOverviewIntent === 'function') {
        result.intent_resumo = engineDiag.isCaixinhasOverviewIntent('Resumo')
        result.intent_visao_geral = engineDiag.isCaixinhasOverviewIntent(
          'Me envie uma visão geral das minhas caixinhas',
        )
        result.intent_negativo = engineDiag.isCaixinhasOverviewIntent('Gastei 50 reais no mercado')
      }
      if (result.module_loaded) {
        let activeUserId = ''
        try {
          const realUsers = $app.findRecordsByFilter(
            '_pb_users_auth_',
            "email != 'whatsapp-visitante@agente.internal'",
            '-created',
            10,
            0,
          )
          if (realUsers.length > 0) activeUserId = realUsers[0].id
        } catch (_) {}
        result.active_user_id = activeUserId
        const now = new Date()
        const monthStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2)
        const summary = engineDiag.buildCaixinhasSummaryForUser($app, activeUserId, monthStr)
        result.summary_preview = summary || ''
        result.summary_error = summary ? '' : 'resumo vazio'
      } else if (!result.module_error) {
        result.summary_error = 'motor determinístico não resolvido (sem require)'
      }
    } catch (modErr) {
      result.module_error = String(modErr)
      result.module_loaded = false
    }

    return e.json(200, result)
  } catch (err) {
    return e.json(500, { success: false, error: String(err) })
  }
})

routerAdd(
  'POST',
  '/backend/v1/whatsapp/profile-picture',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      // Lê arquivo ou base64 enviado no corpo
      const req = e.requestInfo()
      const body = req.body || {}

      let fileBytes = null
      let fileType = 'image/jpeg'
      let fileName = 'profile_picture.jpg'

      // Suporte a multipart/form-data
      try {
        const uploadedFiles =
          (e.findUploadedFiles && (e.findUploadedFiles('file') || e.findUploadedFiles('image'))) ||
          []
        const uploadedFile =
          (uploadedFiles && uploadedFiles[0]) ||
          (e.findUploadedFile && (e.findUploadedFile('file') || e.findUploadedFile('image')))
        if (uploadedFile) {
          fileName =
            uploadedFile.name || uploadedFile.originalName || uploadedFile.filename || fileName
          if (uploadedFile.size && uploadedFile.reader) {
            let r = null
            try {
              r = uploadedFile.reader.open()
              const buf = new Uint8Array(uploadedFile.size)
              r.read(buf)
              fileBytes = buf
            } catch (rErr) {
              console.log('[whatsapp_bridge] [profile-picture] Falha ao ler reader:', rErr)
            } finally {
              if (r && r.close) {
                try {
                  r.close()
                } catch (_) {}
              }
            }
          }
          if (!fileBytes && typeof uploadedFile.bytes === 'function') {
            fileBytes = uploadedFile.bytes()
          }
          const possibleType = uploadedFile.header?.get('Content-Type') || uploadedFile.contentType
          if (possibleType) fileType = possibleType
        }
      } catch (mpErr) {
        console.log('[whatsapp_bridge] [profile-picture] Erro ao extrair multipart:', mpErr)
      }

      // Suporte a JSON com base64
      if (!fileBytes && body.image_base64) {
        let rawB64 = String(body.image_base64)
        if (rawB64.includes(',')) {
          const match = rawB64.match(/^data:([^;]+);base64,/)
          if (match && match[1]) {
            fileType = match[1]
          }
          rawB64 = rawB64.split(',')[1]
        }
        if (body.file_type) fileType = String(body.file_type)
        if (body.file_name) fileName = String(body.file_name)

        try {
          // Decodificador Base64 puro para Goja / PocketBase v0.36
          // Verifica se há método nativo no runtime como preferencial
          if (typeof $security !== 'undefined' && typeof $security.base64Decode === 'function') {
            fileBytes = $security.base64Decode(rawB64)
          } else {
            // Decodificador puro JS com validação estrita
            const cleanB64 = rawB64.replace(/[\s\r\n]+/g, '')
            if (!cleanB64 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(cleanB64)) {
              throw new Error('A string fornecida não é um Base64 válido.')
            }

            const b64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
            const b64Lookup = {}
            for (let idx = 0; idx < b64Alphabet.length; idx++) {
              b64Lookup[b64Alphabet[idx]] = idx
            }
            b64Lookup['-'] = 62
            b64Lookup['_'] = 63

            let padCount = 0
            if (cleanB64.endsWith('==')) padCount = 2
            else if (cleanB64.endsWith('=')) padCount = 1

            const b64Len = cleanB64.length
            const outputLen = Math.floor((b64Len * 3) / 4) - padCount
            if (outputLen <= 0) {
              throw new Error('Conteúdo Base64 vazio.')
            }

            const decodedArray = new Uint8Array(outputLen)
            let outIdx = 0

            for (let i = 0; i < b64Len; i += 4) {
              const b0 = b64Lookup[cleanB64[i]]
              const b1 = i + 1 < b64Len ? b64Lookup[cleanB64[i + 1]] : undefined
              const b2 =
                i + 2 < b64Len && cleanB64[i + 2] !== '=' ? b64Lookup[cleanB64[i + 2]] : undefined
              const b3 =
                i + 3 < b64Len && cleanB64[i + 3] !== '=' ? b64Lookup[cleanB64[i + 3]] : undefined

              if (b0 === undefined || b1 === undefined) {
                throw new Error('Caractere Base64 corrompido na posição ' + i)
              }

              const triple =
                (b0 << 18) |
                (b1 << 12) |
                ((b2 !== undefined ? b2 : 0) << 6) |
                (b3 !== undefined ? b3 : 0)

              if (outIdx < outputLen) decodedArray[outIdx++] = (triple >> 16) & 255
              if (b2 !== undefined && outIdx < outputLen)
                decodedArray[outIdx++] = (triple >> 8) & 255
              if (b3 !== undefined && outIdx < outputLen) decodedArray[outIdx++] = triple & 255
            }

            fileBytes = decodedArray
          }
        } catch (b64Err) {
          return e.json(400, {
            success: false,
            error:
              'Formato de imagem inválido (base64 inválido): ' + String(b64Err.message || b64Err),
          })
        }
      }

      // Diagnóstico: com multipart/form-data do browser, findUploadedFiles pode não
      // popular na JSVM (mesmo padrão de bug do cenário do Item 36, lado multipart).
      if (!fileBytes) {
        console.log(
          '[whatsapp_bridge] [profile-picture] multipart vazio/ilegível; body keys=',
          JSON.stringify(Object.keys(body || {})),
        )
      }

      if (!fileBytes || fileBytes.length === 0) {
        return e.json(400, {
          success: false,
          error: 'Nenhum dado de imagem recebido pelo servidor. Tente reenviar a imagem.',
        })
      }

      const fileLength = fileBytes.length
      console.log(
        `[whatsapp_bridge] [profile-picture] Recebida imagem: ${fileName}, tipo=${fileType}, tamanho=${fileLength} bytes, bytesIniciais=${(fileBytes[0] || 0).toString(16)} ${(fileBytes[1] || 0).toString(16)}`,
      )

      // Validação de tipo suportado pela Meta (tolerante a extensões e variações de MIME como image/pjpeg)
      const cleanMime = (fileType || '').toLowerCase()
      const cleanName = (fileName || '').toLowerCase()
      const isAccepted =
        cleanMime.includes('jpeg') ||
        cleanMime.includes('jpg') ||
        cleanMime.includes('png') ||
        cleanMime.includes('pjpeg') ||
        cleanName.endsWith('.jpg') ||
        cleanName.endsWith('.jpeg') ||
        cleanName.endsWith('.png')

      if (!isAccepted) {
        return e.json(400, {
          success: false,
          error: `Formato de imagem não suportado (${fileType || fileName}). A Meta aceita apenas imagens JPEG ou PNG.`,
        })
      }

      // NOVO v0.0.121: sniff dos magic bytes — se o arquivo é JPEG ou PNG de verdade,
      // a Meta decide pelo CONTEÚDO e não pelo Content-Type declarado. Envia o
      // file_type real do conteúdo (doc Meta: para foto de perfil a Meta aceita JPEG).
      // Detecta WebP (RIFF....WEBP) e avisa em PT que a Meta não aceita para perfil.
      if (fileBytes.length > 12) {
        const b0 = fileBytes[0]
        const b1 = fileBytes[1]
        const b2 = fileBytes[2]
        const b3 = fileBytes[3]
        if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) {
          fileType = 'image/jpeg'
        } else if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) {
          fileType = 'image/png'
        } else if (
          b0 === 0x52 &&
          b1 === 0x49 &&
          b2 === 0x46 &&
          b3 === 0x46 &&
          fileBytes[8] === 0x57 &&
          fileBytes[9] === 0x45 &&
          fileBytes[10] === 0x42 &&
          fileBytes[11] === 0x50
        ) {
          return e.json(400, {
            success: false,
            error:
              'A imagem enviada está em formato WebP, que a Meta NÃO aceita para foto de perfil do WhatsApp Business. Converta a imagem para JPEG (ex.: abrir em qualquer editor e salvar como .jpg) e tente novamente.',
          })
        }
      }

      // Normaliza o MIME para o que a Meta espera
      if (cleanMime.includes('png') || cleanName.endsWith('.png')) {
        fileType = 'image/png'
      } else {
        fileType = 'image/jpeg'
      }

      if (fileLength > 5 * 1024 * 1024) {
        return e.json(400, {
          success: false,
          error:
            'A imagem tem ' +
            Math.round(fileLength / (1024 * 1024)) +
            ' MB. A Meta aceita no máximo 5 MB para foto de perfil — escolha uma imagem menor (ou uma captura de tela redimensionada) e tente novamente.',
        })
      }

      // 1. Obtém credenciais oficiais salvas em whatsapp_status (o token NUNCA é exposto)
      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let wabaId = '1888947369148112'

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          if (rec.getString('waba_id')) {
            wabaId = rec.getString('waba_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
            break
          }
        }
      } catch (_) {}

      if (!token) {
        return e.json(400, {
          success: false,
          error:
            'Token Permanente da Meta não configurado. Salve seu Token em Minha Conta > Canal Oficial WhatsApp Business antes de alterar a foto.',
        })
      }

      // 2. Descobre o APP_ID da Meta para o Resumable Upload
      // O Resumable Upload exige POST /{APP_ID}/uploads.
      // Tentativas em ordem:
      // (a) $os.getenv('META_APP_ID')
      // (b) Consulta /app com o access_token
      // (c) Consulta /debug_token
      // (d) Consulta waba_id?fields=owner_business_info,primary_business_location ou /me
      let metaAppId = $os.getenv('META_APP_ID') || ''

      if (!metaAppId) {
        try {
          console.log('[whatsapp_bridge] [profile-picture] Consultando App ID via /app...')
          const appRes = $http.send({
            url: 'https://graph.facebook.com/v21.0/app',
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
            },
            timeout: 15,
          })
          if (appRes.statusCode >= 200 && appRes.statusCode < 300) {
            const appJson = appRes.json || (appRes.rawText ? JSON.parse(appRes.rawText) : {})
            if (appJson.id) {
              metaAppId = String(appJson.id)
              console.log('[whatsapp_bridge] [profile-picture] App ID obtido via /app:', metaAppId)
            }
          } else {
            console.log(
              '[whatsapp_bridge] [profile-picture] /app retornou HTTP ' +
                appRes.statusCode +
                ': ' +
                (appRes.rawText || JSON.stringify(appRes.json || '')).slice(0, 200),
            )
          }
        } catch (appErr) {
          console.log('[whatsapp_bridge] [profile-picture] Falha ao consultar /app:', appErr)
        }
      }

      if (!metaAppId) {
        try {
          console.log('[whatsapp_bridge] [profile-picture] Consultando /debug_token...')
          const dbgRes = $http.send({
            url: `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
            method: 'GET',
            timeout: 15,
          })
          if (dbgRes.statusCode >= 200 && dbgRes.statusCode < 300) {
            const dbgJson = dbgRes.json || (dbgRes.rawText ? JSON.parse(dbgRes.rawText) : {})
            if (dbgJson.data && dbgJson.data.app_id) {
              metaAppId = String(dbgJson.data.app_id)
              console.log(
                '[whatsapp_bridge] [profile-picture] App ID obtido via /debug_token:',
                metaAppId,
              )
            }
          } else {
            console.log(
              '[whatsapp_bridge] [profile-picture] /debug_token retornou HTTP ' +
                dbgRes.statusCode +
                ': ' +
                (dbgRes.rawText || JSON.stringify(dbgRes.json || '')).slice(0, 200),
            )
          }
        } catch (dbgErr) {
          console.log('[whatsapp_bridge] [profile-picture] Falha em debug_token:', dbgErr)
        }
      }

      // Lista de alvos possíveis para iniciar sessão de uploads caso metaAppId falhe
      const candidateTargets = []
      if (metaAppId) candidateTargets.push(metaAppId)
      if (activePhoneId && !candidateTargets.includes(activePhoneId))
        candidateTargets.push(activePhoneId)
      if (wabaId && !candidateTargets.includes(wabaId)) candidateTargets.push(wabaId)

      console.log(
        `[whatsapp_bridge] [profile-picture] Candidatos para Resumable Upload:`,
        JSON.stringify(candidateTargets),
      )

      // 3. PASSO 1 DO RESUMABLE UPLOAD: Criar Sessão de Upload
      let uploadSessionId = null
      let lastSessionErrorMsg = ''
      let lastSessionMetaError = null

      for (let tIdx = 0; tIdx < candidateTargets.length; tIdx++) {
        const targetId = candidateTargets[tIdx]
        const sessionUrl = `https://graph.facebook.com/v21.0/${targetId}/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(fileType)}&file_name=${encodeURIComponent(fileName)}`

        try {
          const sRes = $http.send({
            url: sessionUrl,
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
            },
            timeout: 25,
          })

          const sStatus = sRes.statusCode
          const sJson = sRes.json || (sRes.rawText ? JSON.parse(sRes.rawText) : {})
          console.log(
            `[whatsapp_bridge] [profile-picture] Tentativa sessão no alvo ${targetId}: HTTP ${sStatus}, retorno=`,
            (sRes.rawText || JSON.stringify(sRes.json || '')).slice(0, 300),
          )

          if (sStatus >= 200 && sStatus < 300 && sJson.id) {
            uploadSessionId = sJson.id
            console.log(
              `[whatsapp_bridge] [profile-picture] Sessão criada com sucesso no alvo ${targetId}: ${uploadSessionId}`,
            )
            break
          } else {
            lastSessionErrorMsg = sJson.error?.message || sRes.rawText || `HTTP ${sStatus}`
            if (!sRes.rawText) {
              try {
                lastSessionErrorMsg =
                  sJson.error?.message || JSON.stringify(sJson) || `HTTP ${sStatus}`
              } catch (_) {}
            }
            lastSessionMetaError = sJson.error || null
          }
        } catch (netErr) {
          lastSessionErrorMsg = netErr.message || String(netErr)
        }
      }

      if (!uploadSessionId) {
        return e.json(400, {
          success: false,
          error: `Meta recusou a criação da sessão de upload: ${lastSessionErrorMsg}`,
          meta_error: lastSessionMetaError,
        })
      }

      console.log(
        `[whatsapp_bridge] [profile-picture] Sessão pronta para envio de bytes: ${uploadSessionId}`,
      )

      // 4. PASSO 2 DO RESUMABLE UPLOAD: Enviar os bytes da imagem
      // POST https://graph.facebook.com/v21.0/{uploadSessionId}
      // Header: file_offset: 0
      // Body: bytes da imagem (raw binary)
      const uploadBytesUrl = `https://graph.facebook.com/v21.0/${uploadSessionId}`

      let uploadBytesRes = null
      try {
        uploadBytesRes = $http.send({
          url: uploadBytesUrl,
          method: 'POST',
          headers: {
            Authorization: 'OAuth ' + token,
            file_offset: '0',
            'Content-Type': 'application/octet-stream',
          },
          body: fileBytes,
          timeout: 40,
        })
      } catch (upNetErr) {
        return e.json(500, {
          success: false,
          error:
            'Erro de conexão ao enviar bytes da imagem para a Meta: ' +
            (upNetErr ? upNetErr.message || String(upNetErr) : ''),
        })
      }

      const uploadBytesStatus = uploadBytesRes.statusCode
      const uploadBytesJson =
        uploadBytesRes.json || (uploadBytesRes.rawText ? JSON.parse(uploadBytesRes.rawText) : {})

      console.log(
        `[whatsapp_bridge] [profile-picture] Passo 2 (Enviar bytes): HTTP ${uploadBytesStatus}, retorno=`,
        (uploadBytesRes.rawText || JSON.stringify(uploadBytesJson || '')).slice(0, 300),
      )

      if (uploadBytesStatus < 200 || uploadBytesStatus >= 300 || !uploadBytesJson.h) {
        const metaUpErr =
          uploadBytesJson.error?.message ||
          uploadBytesRes.rawText ||
          JSON.stringify(uploadBytesJson || '') ||
          `Erro HTTP ${uploadBytesStatus} no envio de bytes`
        return e.json(400, {
          success: false,
          error: `Falha ao transmitir imagem para a Meta: ${metaUpErr}`,
          meta_error: uploadBytesJson.error || null,
        })
      }

      const profilePictureHandle = uploadBytesJson.h // Handle do upload concluído
      console.log(
        `[whatsapp_bridge] [profile-picture] Handle da foto gerado com sucesso: ${profilePictureHandle}`,
      )

      // 5. PASSO 3: Atualizar o Perfil Comercial do WhatsApp com a foto
      // POST https://graph.facebook.com/v21.0/{phone_number_id}/whatsapp_business_profile
      // Body: { messaging_product: 'whatsapp', profile_picture_handle: profilePictureHandle }
      const profileEndpoint = `https://graph.facebook.com/v21.0/${activePhoneId}/whatsapp_business_profile`
      const profilePayload = {
        messaging_product: 'whatsapp',
        profile_picture_handle: profilePictureHandle,
      }

      let profileRes = null
      try {
        profileRes = $http.send({
          url: profileEndpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profilePayload),
          timeout: 25,
        })
      } catch (profNetErr) {
        return e.json(500, {
          success: false,
          error:
            'Erro ao vincular foto ao perfil do WhatsApp na Meta: ' +
            (profNetErr ? profNetErr.message || String(profNetErr) : ''),
        })
      }

      const profileStatus = profileRes.statusCode
      const profileJson =
        profileRes.json || (profileRes.rawText ? JSON.parse(profileRes.rawText) : {})

      console.log(
        `[whatsapp_bridge] [profile-picture] Passo 3 (Atualizar Perfil): HTTP ${profileStatus}, retorno=`,
        (profileRes.rawText || JSON.stringify(profileJson || '')).slice(0, 300),
      )

      if (profileStatus >= 200 && profileStatus < 300) {
        // Atualiza carimbo no whatsapp_status
        try {
          const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
          if (wsList.length > 0) {
            const rec = wsList[0]
            rec.set('last_send_error', '')
            $app.save(rec)
          }
        } catch (_) {}

        return e.json(200, {
          success: true,
          message:
            'Foto atualizada com sucesso — pode levar alguns minutos para aparecer para os clientes.',
          phone_number_id: activePhoneId,
        })
      }

      const metaProfErr =
        profileJson.error?.message ||
        profileRes.rawText ||
        JSON.stringify(profileJson || '') ||
        `Erro HTTP ${profileStatus} ao atualizar perfil`

      return e.json(profileStatus || 400, {
        success: false,
        error: `Meta recusou a alteração da foto: ${metaProfErr}`,
        meta_error: profileJson.error || null,
      })
    } catch (err) {
      console.log('[whatsapp_bridge] [profile-picture] Exceção inesperada:', err)
      return e.json(500, {
        success: false,
        error: 'Erro interno ao processar atualização da foto: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/whatsapp/link-contact',
  (e) => {
    try {
      const normalizeDigits = function (raw) {
        if (!raw) return ''
        let digits = String(raw).replace(/\D/g, '')
        if (digits.length === 10 || digits.length === 11) {
          digits = '55' + digits
        }
        return digits
      }

      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      const body = e.requestInfo().body || {}
      const contactId = body.contact_id
      const phone = body.phone_number

      let contact = null
      if (contactId) {
        try {
          contact = $app.findRecordById('whatsapp_contacts', contactId)
        } catch (_) {}
      } else if (phone) {
        const cleanPhone = normalizeDigits(phone)
        try {
          contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', cleanPhone)
        } catch (_) {}
      }

      if (!contact) {
        return e.json(404, { error: 'Contato não encontrado' })
      }

      contact.set('user', authUser.id)
      if (authUser.getString('name') && !contact.getString('name')) {
        contact.set('name', authUser.getString('name'))
      }
      $app.save(contact)

      // Atualiza também o telefone do usuário se não tiver
      try {
        if (!authUser.getString('phone')) {
          authUser.set('phone', contact.getString('phone_number'))
          $app.save(authUser)
        }
      } catch (_) {}

      return e.json(200, { success: true, contact_id: contact.id, user_id: authUser.id })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
