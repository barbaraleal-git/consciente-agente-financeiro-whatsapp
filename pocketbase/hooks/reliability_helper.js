/// <reference path="../pb_data/types.d.ts" />

/**
 * Helper com regras de negócio do Lote 4:
 * - Guardrail de temas (Item 22)
 * - Interpretação e parser de datas retroativas (Item 28)
 * - Fluxo conversacional de cancelamento/substituição de lançamentos (Item 23)
 * - Normalização e filtros de status (Item 27)
 */

// ---------------------------------------------------------------------------
// 1. Guardrail de Temas (Item 22)
// ---------------------------------------------------------------------------

const OFF_TOPIC_GUARDRAIL_REPLY =
  'Essa fugiu do meu especialista 😄 — sou especialista nas suas finanças e caixinhas no Consciente! Quer ver o resumo das suas caixinhas ou registrar um gasto?'

/**
 * Detecta se uma mensagem de usuário é explicitamente fora do escopo de finanças/app.
 * Não bloqueia saudações ("oi", "bom dia"), perguntas sobre o app ("como funciona", "quem é você")
 * ou comandos financeiros ("quanto gastei", "cancela", "almoço 35").
 */
function isOffTopicQuery(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // Se tem número monetário ou palavras claramente financeiras, NÃO é off-topic
  if (
    /\d+([.,]\d{1,2})?/.test(t) &&
    (t.includes('real') ||
      t.includes('reais') ||
      t.includes('gastei') ||
      t.includes('comprei') ||
      t.includes('paguei') ||
      t.includes('almo') ||
      t.includes('uber') ||
      t.includes('mercado') ||
      t.includes('r$'))
  ) {
    return false
  }

  const financialKeywords = [
    'gasto',
    'gastei',
    'gastar',
    'despesa',
    'receita',
    'salario',
    'caixinha',
    'orcamento',
    'teto',
    'limite',
    'saldo',
    'quanto',
    'extrato',
    'resumo',
    'fatura',
    'cartao',
    'lancamento',
    'lançamento',
    'cancel',
    'substitui',
    'apaga',
    'deleta',
    'invest',
    'dinheiro',
    'poupanca',
    'economi',
    'consciente',
    'app',
    'conta',
    'login',
    'cadastro',
    'senha',
    'perfil',
    'ajuda',
    'como funciona',
    'ola',
    'oi',
    'bom dia',
    'boa tarde',
    'boa noite',
    'tudo bem',
    'obrigad',
    'valeu',
    'quem e voce',
    'o que voce faz',
    'me ajuda',
  ]

  // Se for apenas uma saudação curta ou frase financeira conhecida, não é off-topic
  for (let i = 0; i < financialKeywords.length; i++) {
    const kw = financialKeywords[i]
    if (t === kw || t.startsWith(kw + ' ') || t.endsWith(' ' + kw) || t.includes(' ' + kw + ' ')) {
      // Se tiver palavra financeira essencial, já não é off-topic
      if (
        kw === 'gasto' ||
        kw === 'gastei' ||
        kw === 'despesa' ||
        kw === 'caixinha' ||
        kw === 'orcamento' ||
        kw === 'saldo' ||
        kw === 'extrato' ||
        kw === 'resumo' ||
        kw === 'cancel' ||
        kw === 'substitui' ||
        kw === 'apaga' ||
        kw === 'deleta' ||
        kw === 'lancamento' ||
        kw === 'cartao' ||
        kw === 'dinheiro'
      ) {
        return false
      }
    }
  }

  // Padrões de curiosidades gerais, conhecimentos enciclopédicos, política, esportes, fofoca, etc.
  const offTopicPatterns = [
    /quem\s+(descobriu|inventou|criou|fundou|escreveu|pintou|matou|ganhou|e\s+o\s+presidente|e\s+o\s+governador|e\s+o\s+prefeito)\b/,
    /qual\s+(e\s+)?(a\s+capital|o\s+pais|o\s+maior|o\s+menor|a\s+populacao|o\s+resultado|a\s+formula|a\s+distancia|o\s+significado\s+de)\b/,
    /(quanto\s+e|quanto\s+da)\s+\d+\s*[\+\-\*\/x]\s*\d+/, // contas matemáticas aleatórias fora de finanças
    /(receita\s+de\s+bolo|como\s+fazer\s+(bolo|pao|picanha|arroz|cerveja|cafe))\b/,
    /(previsao\s+do\s+tempo|vai\s+chover|temperatura\s+em|clima\s+em)\b/,
    /(quem\s+ganhou\s+o\s+jogo|resultado\s+do\s+jogo|tabela\s+do\s+brasileirao|escalacao\s+do|flamengo|corinthians|palmeiras|sao\s+paulo\s+futebol)\b/,
    /(historia\s+do\s+brasil|segunda\s+guerra|descobrimento\s+do\s+brasil|independencia\s+do\s+brasil)\b/,
    /(piada|conta\s+uma\s+piada|me\s+conta\s+uma\s+historia|poema|canta\s+uma\s+musica)\b/,
    /(quem\s+e\s+(neymar|messi|cr7|anitta|lula|bolsonaro|trump|biden))\b/,
    /(filme|cinema|serie|netflix|novela|bbb|big\s+brother)\b/,
    /(horoscopo|signo\s+de|astrologia|tarot)\b/,
  ]

  for (let i = 0; i < offTopicPatterns.length; i++) {
    if (offTopicPatterns[i].test(t)) {
      return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// 2. Parser de Datas Retroativas (Item 28)
// ---------------------------------------------------------------------------

/**
 * Interpreta menções a datas relativas ou absolutas no texto (ex.: "ontem", "anteontem",
 * "na sexta", "dia 10", "10/06", "dia 15 de maio").
 * Retorna { isRetroactive: boolean, targetDateStr: string (YYYY-MM-DD), matchedPhrase: string } ou null.
 */
function parseRetroactiveDate(text, referenceDate) {
  if (!text) return null
  const now = referenceDate ? new Date(referenceDate) : new Date()
  const refYear = now.getFullYear()
  const refMonth = now.getMonth() // 0-11
  const refDay = now.getDate()

  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const formatYmd = function (d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const todayYmd = formatYmd(now)

  // 1. "anteontem"
  if (/\banteontem\b/.test(t)) {
    const target = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    return {
      isRetroactive: true,
      targetDateStr: formatYmd(target),
      matchedPhrase: 'anteontem',
    }
  }

  // 2. "ontem"
  if (/\bontem\b/.test(t)) {
    const target = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    return {
      isRetroactive: true,
      targetDateStr: formatYmd(target),
      matchedPhrase: 'ontem',
    }
  }

  // 3. Dias da semana: "na sexta", "na quinta", "na quarta", "na terca", "na segunda", "no sabado", "no domingo"
  // ou "sexta-feira", "terca passada", etc.
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
      if (diff <= 0) {
        diff += 7
      }
      // Se for hoje mesmo, diff seria 7 (semana passada)
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

  // 4. Data DD/MM ou DD/MM/AAAA (ex: "10/06", "10/06/2026")
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

  // 5. "dia X" ou "no dia X" ou "dia X de [mes]" (ex: "dia 10", "dia 15 de maio")
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
    } else {
      // Se não especificou mês e o dia é maior que o dia atual do mês, infere mês passado
      if (dNum > refDay) {
        mNum = refMonth === 0 ? 11 : refMonth - 1
      }
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

  // 6. "X dias atras" (ex: "3 dias atras", "2 dias atras")
  const daysAgoMatch = t.match(/\b(\d{1,2})\s+dias?\s+atras\b/)
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10)
    if (days > 0) {
      const target = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      return {
        isRetroactive: true,
        targetDateStr: formatYmd(target),
        matchedPhrase: daysAgoMatch[0],
      }
    }
  }

  return null
}

function formatDatePtBr(ymdStr) {
  if (!ymdStr || ymdStr.length < 10) return ''
  const parts = ymdStr.slice(0, 10).split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return ymdStr
}

// ---------------------------------------------------------------------------
// 3. Cancelar / Substituir Lançamento (Item 23 + Item 27)
// ---------------------------------------------------------------------------

function isCancellationIntent(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  const patterns = [
    /\b(cancela|cancelar|cancele|estorna|estornar|estorne)\b/,
    /\b(apaga|apagar|apague|deleta|deletar|delete)\s+(o|a|meu|minha|esse|essa|ultim[ao])\b/,
    /\b(exclui|excluir|exclua)\s+(o|a|meu|minha|ultim[ao])\b/,
    /\b(errei\s+o\s+lancamento|lancei\s+errado|valor\s+errado)\b/,
    /\b(cancela\s+(o\s+)?ultimo|cancela\s+o\s+almoco|cancela\s+esse)\b/,
  ]

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(t)) return true
  }

  return false
}

function isConfirmationYes(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return (
    t === 'sim' ||
    t === 's' ||
    t === 'pode cancelar' ||
    t === 'confirmo' ||
    t === 'isso' ||
    t === 'cancela sim' ||
    t === 'pode' ||
    t === 'com certeza' ||
    t === '1'
  )
}

function isConfirmationNo(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
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

/**
 * Processa intenções de cancelamento de transação para um usuário.
 * Retorna { handled: boolean, reply: string }
 */
function handleCancellationFlow(app, userId, arg3, arg4) {
  // Suporta tanto (app, userId, contactRecord, text) quanto (app, userId, text, contactRecord)
  let text = ''
  let contactRecord = null
  if (typeof arg3 === 'string') {
    text = arg3
    contactRecord = arg4 || null
  } else {
    contactRecord = arg3 || null
    text = typeof arg4 === 'string' ? arg4 : ''
  }

  if (!app || !userId || !text) {
    return { handled: false, reply: '' }
  }

  const cleanText = String(text).trim()

  // 1. Verifica se há cancelamento pendente aguardando desambiguação/confirmação
  let pendingCancelData = null
  if (contactRecord) {
    const rawPending = contactRecord.getString('pending_cancel')
    if (rawPending) {
      try {
        pendingCancelData = JSON.parse(rawPending)
      } catch (_) {}
    }
  }

  // Se havia confirmação pendente de um lançamento específico
  if (pendingCancelData && pendingCancelData.transaction_id) {
    if (isConfirmationYes(cleanText)) {
      try {
        const tx = app.findRecordById('transactions', pendingCancelData.transaction_id)
        if (tx && tx.getString('owner') === userId) {
          tx.set('status', 'cancelled')
          app.save(tx)

          // Limpa pendência no contato
          contactRecord.set('pending_cancel', '')
          app.save(contactRecord)

          const desc = tx.getString('description') || 'Lançamento'
          const valFmt = formatCentsToBrl(tx.getInt('amount'))
          const dtFmt = formatDatePtBr(tx.getString('date'))

          return {
            handled: true,
            reply:
              `Pronto! Cancelei o lançamento de *${desc}* (${valFmt} em ${dtFmt}) ✅\n\n` +
              `Ele já foi removido das suas caixinhas e não conta mais nos seus totais. Se quiser registrar o valor correto, é só me mandar!`,
          }
        }
      } catch (err) {
        console.log('[reliability_helper] Erro ao cancelar transação pendente:', err)
      }
    } else if (isConfirmationNo(cleanText)) {
      contactRecord.set('pending_cancel', '')
      app.save(contactRecord)
      return {
        handled: true,
        reply:
          'Entendido! Mantive o lançamento como está sem alterações. Se precisar de mais alguma coisa, estou por aqui! 😊',
      }
    }
  }

  // Se havia escolha entre múltiplas opções (ex: escolheu "1" ou "2")
  if (pendingCancelData && Array.isArray(pendingCancelData.candidate_ids)) {
    const chosenIdx = parseInt(cleanText, 10)
    if (
      !isNaN(chosenIdx) &&
      chosenIdx >= 1 &&
      chosenIdx <= pendingCancelData.candidate_ids.length
    ) {
      const chosenId = pendingCancelData.candidate_ids[chosenIdx - 1]
      try {
        const tx = app.findRecordById('transactions', chosenId)
        if (tx && tx.getString('owner') === userId) {
          tx.set('status', 'cancelled')
          app.save(tx)

          contactRecord.set('pending_cancel', '')
          app.save(contactRecord)

          const desc = tx.getString('description') || 'Lançamento'
          const valFmt = formatCentsToBrl(tx.getInt('amount'))
          const dtFmt = formatDatePtBr(tx.getString('date'))

          return {
            handled: true,
            reply:
              `Pronto! Cancelei o lançamento ${chosenIdx}: *${desc}* (${valFmt} em ${dtFmt}) ✅\n\n` +
              `Ele já foi desconsiderado das suas caixinhas. Se quiser, já pode me mandar o novo registro!`,
          }
        }
      } catch (cErr) {
        console.log('[reliability_helper] Erro ao cancelar item escolhido:', cErr)
      }
    } else if (isConfirmationNo(cleanText)) {
      contactRecord.set('pending_cancel', '')
      app.save(contactRecord)
      return {
        handled: true,
        reply: 'Cancelamento desconsiderado. Seus lançamentos continuam intactos!',
      }
    }
  }

  // 2. Se a mensagem expressa nova intenção de cancelamento
  if (isCancellationIntent(cleanText)) {
    // Busca os lançamentos ativos mais recentes do usuário
    let recentActiveTxs = []
    try {
      recentActiveTxs = app.findRecordsByFilter(
        'transactions',
        `owner = '${userId}' && (status = 'active' || status = '')`,
        '-created',
        10,
        0,
      )
    } catch (fErr) {
      console.log('[reliability_helper] Erro ao buscar transações para cancelamento:', fErr)
    }

    if (recentActiveTxs.length === 0) {
      return {
        handled: true,
        reply:
          'Não encontrei nenhum lançamento ativo recente na sua conta para cancelar. Deseja registrar um novo gasto?',
      }
    }

    // Se o pedido foi específico para "o último" ou "cancela o último"
    const isExplicitLast =
      /\bultim[ao]\b/i.test(cleanText) ||
      cleanText === 'cancela' ||
      cleanText === 'cancelar' ||
      cleanText === 'cancela esse' ||
      cleanText === 'cancele'

    // Tenta encontrar filtro por descrição mencionada (ex: "cancela o almoco", "cancela uber")
    let matchedTxs = []
    const tLow = cleanText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (!isExplicitLast) {
      for (let i = 0; i < recentActiveTxs.length; i++) {
        const tx = recentActiveTxs[i]
        const desc = (tx.getString('description') || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        if (desc && tLow.includes(desc)) {
          matchedTxs.push(tx)
        }
      }
    }

    // Se não filtrou por descrição ou se pediu expressamente o último
    if (isExplicitLast || matchedTxs.length === 0) {
      // O último lançamento mais recente
      const targetTx = recentActiveTxs[0]

      // Salva pending_cancel e executa cancelamento seguro
      targetTx.set('status', 'cancelled')
      app.save(targetTx)

      if (contactRecord) {
        contactRecord.set('pending_cancel', '')
        try {
          app.save(contactRecord)
        } catch (_) {}
      }

      const desc = targetTx.getString('description') || 'Lançamento'
      const valFmt = formatCentsToBrl(targetTx.getInt('amount'))
      const dtFmt = formatDatePtBr(targetTx.getString('date'))

      return {
        handled: true,
        reply:
          `Cancelei seu último lançamento: *${desc}* de ${valFmt} (${dtFmt}) ✅\n\n` +
          `O valor foi retirado da sua caixinha. Pode me enviar o gasto correto quando quiser!`,
      }
    }

    // Se encontrou exatamente 1 com a descrição
    if (matchedTxs.length === 1) {
      const targetTx = matchedTxs[0]
      targetTx.set('status', 'cancelled')
      app.save(targetTx)

      if (contactRecord) {
        contactRecord.set('pending_cancel', '')
        try {
          app.save(contactRecord)
        } catch (_) {}
      }

      const desc = targetTx.getString('description') || 'Lançamento'
      const valFmt = formatCentsToBrl(targetTx.getInt('amount'))
      const dtFmt = formatDatePtBr(targetTx.getString('date'))

      return {
        handled: true,
        reply:
          `Cancelei o lançamento: *${desc}* de ${valFmt} (${dtFmt}) ✅\n\n` +
          `Ele foi removido das suas caixinhas. Se quiser registrar outro no lugar, é só me mandar!`,
      }
    }

    // Se houver ambiguidade (mais de 1 lançamento parecido recente), pergunta qual
    if (matchedTxs.length > 1) {
      const candidateIds = []
      let optionsList = ''
      for (let i = 0; i < Math.min(3, matchedTxs.length); i++) {
        const tx = matchedTxs[i]
        candidateIds.push(tx.id)
        const desc = tx.getString('description') || 'Gasto'
        const valFmt = formatCentsToBrl(tx.getInt('amount'))
        const dtFmt = formatDatePtBr(tx.getString('date'))
        optionsList += `*${i + 1}*. ${desc} — ${valFmt} (${dtFmt})\n`
      }

      if (contactRecord) {
        contactRecord.set(
          'pending_cancel',
          JSON.stringify({
            candidate_ids: candidateIds,
            created_at: new Date().toISOString(),
          }),
        )
        try {
          app.save(contactRecord)
        } catch (_) {}
      }

      return {
        handled: true,
        reply:
          `Encontrei mais de um lançamento parecido. Qual deles você quer cancelar?\n\n` +
          optionsList +
          `\nResponda apenas com o número (1, 2...) ou envie "não" para cancelar.`,
      }
    }
  }

  return { handled: false, reply: '' }
}

/**
 * Detecta se uma mensagem de texto aparenta ser um lançamento de gasto/despesa
 * (contém valor numérico ou palavras típicas de consumo/compra/almoço/mercado/etc.).
 */
function isSpendingExpenseMessage(text) {
  if (!text) return false
  const t = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // Presença explícita de valor monetário (ex: "35", "R$ 50", "42,90", "120 reais")
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
    // Formato abreviado padrão: [categoria/nome] [número] (ex: "Almoço 35", "Mercado 120", "Uber 25,50")
    if (/^[a-z\s]{3,20}\s+\d+([.,]\d{1,2})?$/.test(t)) {
      return true
    }
  }

  // Palavras de gasto explícito mesmo sem número identificado imediatamente
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

/**
 * Gera mensagem de fallback adequada e empática baseada no contexto da mensagem
 * quando a IA do agente falha temporariamente por timeout ou oscilação.
 */
function buildGracefulFallbackReply(text, isAudio) {
  // Se for áudio que chegou a transcrever algo ou foi áudio com falha no agente
  if (isAudio) {
    return 'Recebi seu áudio aqui no Consciente! 🎙️\nTivemos uma oscilação momentânea no processamento agora. Se você puder mandar novamente ou digitar rapidinho em texto (ex: "Almoço 35"), já registro direto na sua caixinha!'
  }

  const raw = String(text || '').trim()
  const isSpending = isSpendingExpenseMessage(raw)

  if (isSpending) {
    return 'Olá! Não consegui processar seu gasto agora no Consciente devido a uma oscilação momentânea. Por favor, envie novamente com o valor e a categoria (ex: "Almoço 35 reais") para eu registrar na sua caixinha!'
  }

  // Se for pergunta, saudação ou conversa comum (ex: "Oi, deu certo?", "tudo bem?", "como você está?")
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
    lower.startsWith('bom dia') ||
    lower.startsWith('boa tarde') ||
    lower.startsWith('boa noite') ||
    lower.includes('tudo bem')
  ) {
    return 'Olá! Eu sou o Consciente - Seu parceiro nas finanças! 👋\nComo posso te ajudar agora? Você pode registrar um gasto (ex: "Almoço 35"), ver o resumo das caixinhas enviando "resumo", ou tirar uma dúvida financeira!'
  }

  // Fallback geral gentil de parceiro financeiro (NUNCA assume que era um gasto)
  return 'Olá! O Consciente está conectado com você! 👋\nTivemos uma oscilação momentânea e não consegui interpretar sua mensagem agora. Como posso te ajudar? Você pode me enviar um gasto para registrar (ex: "Mercado 120") ou mandar "resumo" para ver suas caixinhas!'
}

/**
 * Normaliza string para comparação sem acentos e minúscula.
 */
function normalizeStr(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Tenta extrair detalhes de um gasto a partir de uma mensagem de texto:
 * { amount: number (cents), description: string, categoryId: string, categoryName: string, date: string, isRetroactive: boolean, matchedPhrase?: string } ou null.
 */
function tryParseSpendingExpense(app, userId, text, referenceDateYmd) {
  if (!app || !userId || !text) return null
  const raw = String(text).trim()
  if (!isSpendingExpenseMessage(raw)) return null

  // 1. Extração do valor em centavos
  // Padrões como: R$ 190,00, R$190, 190 reais, 190,50, 190
  const norm = normalizeStr(raw)
  let cents = 0

  // Regex para valor: busca "r$ X", "X reais" ou apenas número isolado
  const valMatch =
    raw.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/i) ||
    raw.match(/(\d+(?:[.,]\d{1,2})?)\s*reais/i) ||
    raw.match(/\b(\d+(?:[.,]\d{1,2})?)\b/)

  if (!valMatch) return null

  const numStr = valMatch[1].replace(',', '.')
  const floatVal = parseFloat(numStr)
  if (isNaN(floatVal) || floatVal <= 0) return null
  cents = Math.round(floatVal * 100)

  // 2. Data (retroativa ou hoje)
  let dateYmd = referenceDateYmd || new Date().toISOString().slice(0, 10)
  let isRetroactive = false
  let matchedPhrase = ''
  const retro = parseRetroactiveDate(raw, dateYmd)
  if (retro && retro.isRetroactive && retro.targetDateStr) {
    dateYmd = retro.targetDateStr
    isRetroactive = true
    matchedPhrase = retro.matchedPhrase
  }

  // 3. Busca categorias de despesa do usuário (ou globais)
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
      userCategories = app.findRecordsByFilter('categories', `type = 'despesa'`, '-created', 100, 0)
    } catch (_) {}
  }

  // 4. Mapeamento de intenção/palavras-chave para achar a categoria
  let matchedCategory = null
  let matchedCategoryScore = 0

  // Remove valor e palavras comuns para isolar o termo descritivo
  let cleanedTerm = norm
    .replace(valMatch[0].toLowerCase(), '')
    .replace(
      /\b(gastei|comprei|paguei|custou|no|na|de|em|para|com|reais|r\$|ontem|anteontem)\b/g,
      ' ',
    )
    .trim()

  for (let c = 0; c < userCategories.length; c++) {
    const cat = userCategories[c]
    const cName = normalizeStr(cat.getString('name'))
    let score = 0

    if (norm.includes(cName)) {
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

    if (score > matchedCategoryScore) {
      matchedCategoryScore = score
      matchedCategory = cat
    }
  }

  // Se não achou categoria com score alto, busca a primeira de despesa ou com nome 'Outros'/'Alimentação'
  if (!matchedCategory && userCategories.length > 0) {
    matchedCategory =
      userCategories.find((c) => normalizeStr(c.getString('name')).includes('outros')) ||
      userCategories[0]
  }

  if (!matchedCategory) return null

  // Descrição amigável
  let desc = cleanedTerm
    ? cleanedTerm.charAt(0).toUpperCase() + cleanedTerm.slice(1)
    : matchedCategory.getString('name')

  // Se a descrição ficou muito curta ou genérica, usa o nome da categoria
  if (desc.length < 3) {
    desc = matchedCategory.getString('name')
  }

  return {
    amount: cents,
    description: desc,
    categoryId: matchedCategory.id,
    categoryName: matchedCategory.getString('name'),
    date: dateYmd,
    isRetroactive,
    matchedPhrase,
  }
}

/**
 * Busca as caixinhas candidatas vinculadas a uma categoria em category_caixinha_links.
 * Retorna Array<{ id: string, name: string, icon: string, amount: number }>
 */
function getCandidateBudgetsForCategory(app, userId, categoryId, categoryName, currentMonth) {
  const normCatName = normalizeStr(categoryName)
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

  // Filtra links que combinam com categoryId ou categoryName
  const matchingBudgetIds = []
  for (let l = 0; l < links.length; l++) {
    const lk = links[l]
    const lkCatId = lk.getString('category_id')
    const lkCatName = normalizeStr(lk.getString('category_name'))
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

  // Busca os budgets do usuário
  let userBudgets = []
  try {
    userBudgets = app.findRecordsByFilter('budgets', `owner = '${userId}'`, '-created', 100, 0)
  } catch (_) {}

  // Carrega categorias para pegar nome e ícone das caixinhas
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
      const bCat = catMap[bg.getString('category')]
      const bName = bCat ? bCat.getString('name') : 'Caixinha'
      const bIcon = bCat ? bCat.getString('icon') : ''
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

/**
 * Emite emoji numérico para listas (1️⃣, 2️⃣, etc.)
 */
function getNumberEmoji(index) {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
  return emojis[index] || `${index + 1}.`
}

/**
 * Fluxo de desambiguação e seleção de caixinha quando há pendência ou novo gasto.
 */
function handleCaixinhaFlow(app, userId, text, contactRecord, referenceDateYmd, sourceOverride) {
  if (!app || !userId || !text) {
    return { handled: false, reply: '' }
  }

  const cleanText = String(text).trim()
  const todayStr = referenceDateYmd || new Date().toISOString().slice(0, 10)
  const txSource = sourceOverride || 'whatsapp_text'

  // 1. VERIFICA SE EXISTE PENDÊNCIA AGUARDANDO RESPOSTA (pending_caixinha)
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
    // Se o cliente quiser desistir ou cancelar
    if (isConfirmationNo(cleanText) || cleanText.toLowerCase() === 'cancelar') {
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

    // Verifica se respondeu número (1, 2, ...)
    const numIdx = parseInt(cleanText, 10)
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= cands.length) {
      chosenBudget = cands[numIdx - 1]
    } else {
      // Verifica se respondeu pelo nome ou sufixo da caixinha (ex: "VA", "VR", "Alimentação VA")
      const normInput = normalizeStr(cleanText)
      for (let i = 0; i < cands.length; i++) {
        const cName = normalizeStr(cands[i].name)
        if (normInput === cName || cName.includes(normInput) || normInput.includes(cName)) {
          chosenBudget = cands[i]
          break
        }
        // Testa sufixos após hífen (ex.: "Alimentação - VA" -> "VA")
        const parts = cands[i].name.split('-').map((p) => normalizeStr(p))
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
      // Cria a transação com a caixinha escolhida!
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

      // Limpa a pendência no contato
      contactRecord.set('pending_caixinha', '')
      try {
        app.save(contactRecord)
      } catch (_) {}

      const valFmt = formatCentsToBrl(pendingData.amount)
      let retroPhrase = ''
      if (pendingData.is_retroactive && pendingData.date) {
        retroPhrase = ` (contabilizado em ${formatDatePtBr(pendingData.date)})`
      }

      return {
        handled: true,
        reply: `Perfeito! Registrei seu gasto de *${pendingData.description}* (${valFmt}) na caixinha *${chosenBudget.name}*${retroPhrase} ✅\n\nQualquer novo gasto, só mandar!`,
      }
    }

    // Se respondeu algo inválido, repete a pergunta gentilmente com a lista de opções
    let repeatList = ''
    for (let i = 0; i < cands.length; i++) {
      repeatList += `${getNumberEmoji(i)} ${cands[i].name}\n`
    }
    const valFmt = formatCentsToBrl(pendingData.amount)
    return {
      handled: true,
      reply: `Não entendi qual opção você escolheu para o gasto de *${valFmt}* (${pendingData.description}).\n\nPor favor, responda apenas com o número da caixinha:\n\n${repeatList}\nOu envie "cancelar" para desconsiderar.`,
    }
  }

  // 2. SE NÃO HÁ PENDÊNCIA, ANALISA SE A MENSAGEM É UM NOVO GASTO COM VÍNCULOS DE CAIXINHA
  const parsedExpense = tryParseSpendingExpense(app, userId, cleanText, todayStr)
  if (!parsedExpense) {
    return { handled: false, reply: '' }
  }

  // Busca candidatas em category_caixinha_links
  const candidates = getCandidateBudgetsForCategory(
    app,
    userId,
    parsedExpense.categoryId,
    parsedExpense.categoryName,
    todayStr.slice(0, 7),
  )

  // Caso 1: MAIS DE UMA CAIXINHA CANDIDATA (>1)
  // NÃO grava a transação ainda! Salva pendência e pergunta em qual caixinha lançar.
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
      optionsList += `${getNumberEmoji(i)} ${candidates[i].name}\n`
    }
    const valFmt = formatCentsToBrl(parsedExpense.amount)

    return {
      handled: true,
      reply: `Esse gasto de ${valFmt} (${parsedExpense.description}) entra em qual caixinha?\n\n${optionsList}\nResponda com o número ou nome da caixinha! 😊`,
    }
  }

  // Caso 2: UMA ÚNICA CAIXINHA CANDIDATA (=== 1)
  // Grava direto com o budget preenchido e confirma informando a caixinha!
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

    const valFmt = formatCentsToBrl(parsedExpense.amount)
    let retroPhrase = ''
    if (parsedExpense.isRetroactive && parsedExpense.date) {
      retroPhrase = ` (contabilizado em ${formatDatePtBr(parsedExpense.date)})`
    }

    return {
      handled: true,
      reply: `Registrei seu gasto de *${parsedExpense.description}* (${valFmt}) na caixinha *${singleBudget.name}*${retroPhrase} ✅`,
    }
  }

  // Caso 3: ZERO VÍNCULOS PARAMETRIZADOS (=== 0)
  // Retorna handled: false para que o fluxo normal da IA (com fallback) continue operando!
  return { handled: false, reply: '' }
}

// Exporta tanto em module.exports quanto no globalThis (PocketBase JSVM)
const reliabilityHelperExports = {
  OFF_TOPIC_GUARDRAIL_REPLY,
  isOffTopicQuery,
  isSpendingExpenseMessage,
  buildGracefulFallbackReply,
  parseRetroactiveDate,
  formatDatePtBr,
  isCancellationIntent,
  handleCancellationFlow,
  handleCaixinhaFlow,
  formatCentsToBrl,
}

if (typeof globalThis !== 'undefined') {
  globalThis.__reliabilityHelper = reliabilityHelperExports
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = reliabilityHelperExports
}
