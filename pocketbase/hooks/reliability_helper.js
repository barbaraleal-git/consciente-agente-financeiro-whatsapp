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
function handleCancellationFlow(app, userId, text, contactRecord) {
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

module.exports = {
  OFF_TOPIC_GUARDRAIL_REPLY,
  isOffTopicQuery,
  parseRetroactiveDate,
  formatDatePtBr,
  isCancellationIntent,
  handleCancellationFlow,
  formatCentsToBrl,
}
