/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de integridade de vigência da coleção subscription_plans (v0.0.106).
 *
 * Regra (definição expressa da usuária): dentro do MESMO plan_type (mensal vs
 * anual), janelas INCLUSIVAS nas duas pontas [valid_from, valid_until] NÃO
 * podem se sobrepor — nem a data de início nem a data de fim podem coincidir.
 * Se uma linha termina em 01/12/2026 e outra começa em 01/12/2026, há um dia
 * com DUAS vigências ativas e isso é CONFLITO (rejeitado). Na prática, janelas
 * consecutivas devem deixar no mínimo um dia de diferença na fronteira
 * (ex.: termina 30/11/2026, começa 01/12/2026). valid_until vazio = "em
 * diante". Linhas inativas (active = false) e linhas com user_override ficam
 * FORA da checagem; edição da própria linha não conflita consigo mesma.
 *
 * v0.0.114 — COBERTURA CONTÍNUA POR TRILHA (pedido expresso da dona): da data
 * corrente em diante, nenhum dia futuro pode ficar sem plano ativo definido na
 * trilha (mensal e anual separadamente). A linha de vigências ativas da trilha
 * é simulada e qualquer lacuna de datas (>= 1 dia) entre "hoje ou depois" e o
 * fim da trilha é rejeitada — a trilha precisa SEMPRE terminar numa linha
 * aberta (valid_until vazio) que cubra o futuro. Fronteira INCLUSIVA: termina
 * 30/11 + começa 01/12 = SEM buraco (janelas semiabertas [from, until)).
 *
 * v0.0.106: a rota POST /backend/v1/admin/billing/plans (billing_stripe.js)
 * executa a MESMA checagem inline (fonte única para o Backoffice) — este hook
 * cobre gravações diretas na coleção (painel PocketBase/backup).
 *
 * v0.0.114: nova rota de diagnóstico GET
 * /backend/v1/admin/billing/plans/coverage (billing_stripe.js) lê a MESMA
 * função globalThis.__vigenciaCobertura para mostrar à dona, por trilha, se a
 * linha de vigências ativas está contínua a partir de hoje (sem gravar nada).
 *
 * v0.0.114: a simulação de cobertura contínua é definida em globalThis
 * (__vigenciaCobertura) a partir deste arquivo — o mesmo padrão do
 * __proactiveEngine: "module.exports = { f: f }" no fim do arquivo registra a
 * função em globalThis quando o módulo carrega (top-level do arquivo é o
 * escopo do módulo, permitido; só callbacks é que não enxergam declarações
 * top-level). Os consumidores (onRecordCreate/onRecordUpdate aqui e a rota
 * POST /admin/billing/plans em billing_stripe.js) chamam
 * "globalThis.__vigenciaCobertura(...)" DIRETAMENTE no corpo do callback — na
 * hora do evento o módulo já carregou. Fonte única: qualquer alteração na
 * lógica é feita AQUI.
 *
 * v0.0.115 — CORREÇÃO do bug "Object has no member '__vigenciaCobertura'":
 * na v0.0.114 a rota POST /admin/billing/plans chamava a função DIRETAMENTE
 * no corpo do callback e, quando o callback rodava em um POOL de VM que não
 * tinha carregado este módulo (o globalThis NÃO é compartilhado entre todos
 * os hooks do PocketBase em todos os pools — a prova real da dona quebrou
 * com 500 em inglês), o 500 cru vazou para o toast do Backoffice. Regra nova
 * (memória do projeto): lógica compartilhada entre hooks/rotas NUNCA pode
 * depender de ordem de carregamento — o CONSUMIDOR resolve a função de forma
 * DEFENSIVA (typeof + fallback 100% inline com a MESMA lógica copiada aqui e
 * marcada v0.0.115) e NUNCA dá ReferenceError/TypeError cru. A fonte única
 * da lógica segue sendo ESTE arquivo; o fallback do consumidor existe só
 * para garantir 400 amigável em PT quando o globalThis não estiver lá.
 *
 * Regras JSVM: lógica 100% inline nos callbacks (sem require top-level, sem
 * variável declarada em try usada fora do bloco).
 */

// v0.0.114 — simulação de cobertura contínua POR TRILHA (pedido expresso da
// dona): recebe o plan_type e a lista de janelas ativas da trilha (a linha em
// edição JÁ INCLUÍDA, com { name, from, until }), simula a linha de vigências
// a partir da data corrente e devolve '' (ok) ou a mensagem amigável de erro.
// Exportada em globalThis para a rota admin do billing_stripe.js (padrão
// __proactiveEngine, visto que require() de hooks dentro de callbacks falha
// na JSVM).
function vigenciaCobertura(planType, rows) {
  var today = new Date().toISOString().slice(0, 10)

  // 1. Filtra e normaliza: só janelas com from; janelas totalmente passadas
  //    (until < hoje) saem; as demais entram com from >= hoje.
  var intervals = []
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    if (!r.from) continue
    if (r.until && r.until < today) continue
    intervals.push({ from: r.from > today ? r.from : today, until: r.until || '' })
  }
  if (intervals.length === 0) {
    return (
      'A trilha ' +
      planType +
      ' ficaria SEM nenhum plano ativo a partir de hoje (' +
      today +
      ') — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível.'
    )
  }

  // 2. Ordena por from (strings ISO ordenam lexicograficamente).
  intervals.sort(function (a, b) {
    if (a.from < b.from) return -1
    if (a.from > b.from) return 1
    return 0
  })

  // 3. Varre a linha do tempo: cursor = primeiro dia SEM plano garantido.
  var cursor = ''
  for (var j = 0; j < intervals.length; j++) {
    var iv = intervals[j]
    if (cursor === '') {
      // Primeiro intervalo: precisa começar em hoje ou antes.
      if (iv.from > today) {
        return (
          'A trilha ' +
          planType +
          ' ficaria SEM nenhum plano ativo de hoje (' +
          today +
          ') até ' +
          iv.from +
          ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível. Inicie a nova vigência em ' +
          today +
          ' ou antes.'
        )
      }
    } else if (iv.from > cursor) {
      // Buraco: [cursor, iv.from) sem plano. Fronteira INCLUSIVA: um termina
      // 30/11 e o próximo começa 01/12 é SEM buraco (from === cursor + 1 dia).
      return (
        'A trilha ' +
        planType +
        ' ficaria SEM cobertura entre ' +
        cursor +
        ' e ' +
        iv.from +
        ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar nesse período (ex.: 03/12/2026) não encontraria plano disponível. Ajuste as vigências para que a trilha seja contínua (ex.: uma termina 30/11 e a próxima começa 01/12).'
      )
    }
    // v0.0.115 — avança o cursor para o PRIMEIRO dia SEM plano garantido (o
    // dia seguinte ao fim desta janela). Fronteira INCLUSIVA: termina 30/11 →
    // primeiro dia sem plano é 01/12; a próxima janela começando 01/12 é
    // contígua (SEM buraco). Cursor vazio = a trilha cobre todo o futuro com
    // linha aberta (valid_until vazio).
    if (iv.until === '') {
      cursor = ''
    } else {
      var ivNextDate = new Date(iv.until + 'T00:00:00Z')
      ivNextDate.setUTCDate(ivNextDate.getUTCDate() + 1)
      var ivNextStr = ivNextDate.toISOString().slice(0, 10)
      if (cursor === '' || ivNextStr > cursor) {
        cursor = ivNextStr
      }
    }
  }

  // 4. A trilha precisa terminar numa linha ABERTA (em diante) que cubra o
  //    futuro: cursor vazio aqui significa que o último intervalo processado
  //    tinha valid_until vazio.
  if (cursor === '') {
    return ''
  }
  var lastCoveredDate = new Date(cursor + 'T00:00:00Z')
  lastCoveredDate.setUTCDate(lastCoveredDate.getUTCDate() - 1)
  return (
    'A trilha ' +
    planType +
    ' terminaria em ' +
    lastCoveredDate.toISOString().slice(0, 10) +
    ' e ficaria SEM cobertura a partir de ' +
    cursor +
    ' — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante), para que todo o futuro continue coberto.'
  )
}

if (typeof globalThis !== 'undefined') {
  globalThis.__vigenciaCobertura = vigenciaCobertura
}

module.exports = {
  vigenciaCobertura: vigenciaCobertura,
}

onRecordCreate((e) => {
  var localVFrom = String(e.record.getString('valid_from') || '').slice(0, 10)
  var localVUntil = String(e.record.getString('valid_until') || '').slice(0, 10)
  var localPlanType = String(e.record.getString('plan_type') || '')
  var localOverride = String(e.record.getString('user_override') || '')
  var localActive = e.record.getBool('active')

  if (localPlanType && localActive && localOverride === '') {
    if (localVFrom && localVUntil && localVUntil <= localVFrom) {
      throw new BadRequestError(
        'Vigência inválida: a data final (' +
          localVUntil +
          ') deve ser POSTERIOR à data inicial (' +
          localVFrom +
          ') — as duas datas não podem coincidir.',
      )
    }
    var localConflicts = $app.findRecordsByFilter(
      'subscription_plans',
      "plan_type = '" +
        localPlanType +
        "' && active = true && (user_override = '' || user_override = null)",
      '-created',
      100,
      0,
    )
    for (var localCi = 0; localCi < localConflicts.length; localCi++) {
      var localRow = localConflicts[localCi]
      var localRowFrom = String(localRow.getString('valid_from') || '').slice(0, 10)
      var localRowUntil = String(localRow.getString('valid_until') || '').slice(0, 10)
      // Fronteira INCLUSIVA nas duas pontas (v0.0.106): sobreposição exige
      // newFrom <= rowUntil E rowFrom <= newUntil — terminar/começar no MESMO
      // dia é conflito (dois planos vigentes no mesmo dia).
      var localNewStartsInRow = !localRowUntil || localVFrom <= localRowUntil
      var localRowStartsInNew = !localVUntil || localRowFrom <= localVUntil
      if (localNewStartsInRow && localRowStartsInNew) {
        throw new BadRequestError(
          'Já existe um plano ' +
            localPlanType +
            ' vigente no período ' +
            (localRowFrom || 'início aberto') +
            ' até ' +
            (localRowUntil || 'em diante (sem data final)') +
            ': ' +
            (localRow.getString('name') || 'sem nome') +
            '. As janelas não podem se tocar (nem o início nem o fim podem coincidir) — deixe no mínimo um dia de diferença na fronteira (ex.: termina 30/11, começa 01/12).',
        )
      }
    }

    // v0.0.114 — simulação de cobertura contínua da trilha (mesma regra da
    // rota admin; resolução DEFENSIVA de globalThis.__vigenciaCobertura com
    // fallback inline v0.0.115 — nunca depende de ordem de carregamento).
    var localCoberturaRows = []
    for (var localCk = 0; localCk < localConflicts.length; localCk++) {
      localCoberturaRows.push({
        name: String(localConflicts[localCk].getString('name') || 'sem nome'),
        from: String(localConflicts[localCk].getString('valid_from') || '').slice(0, 10),
        until: String(localConflicts[localCk].getString('valid_until') || '').slice(0, 10),
      })
    }
    localCoberturaRows.push({
      name: String(e.record.getString('name') || 'novo plano'),
      from: localVFrom,
      until: localVUntil,
    })
    var localCoberturaErr = ''
    // v0.0.115 — resolução DEFENSIVA (nunca depende de ordem de
    // carregamento de arquivos): resolve globalThis.__vigenciaCobertura
    // com typeof + try; indisponível, usa FALLBACK 100% INLINE com a
    // MESMA lógica (referência legível em
    // pocketbase/hooks/vigencia_cobertura_reference.js) — a JSVM não
    // compartilha o globalThis de forma confiável entre módulos/hooks em
    // todos os pools de VM (bug da prova real da dona em v0.0.114).
    var localFallbackCobertura = function (fallbackPlanType, fallbackRows) {
      var today = new Date().toISOString().slice(0, 10)
      var intervals = []
      for (var fi = 0; fi < fallbackRows.length; fi++) {
        var fr = fallbackRows[fi]
        if (!fr.from) continue
        if (fr.until && fr.until < today) continue
        intervals.push({ from: fr.from > today ? fr.from : today, until: fr.until || '' })
      }
      if (intervals.length === 0) {
        return (
          'A trilha ' +
          fallbackPlanType +
          ' ficaria SEM nenhum plano ativo a partir de hoje (' +
          today +
          ') — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível.'
        )
      }
      intervals.sort(function (a, b) {
        if (a.from < b.from) return -1
        if (a.from > b.from) return 1
        return 0
      })
      var cursor = ''
      for (var fj = 0; fj < intervals.length; fj++) {
        var fiv = intervals[fj]
        if (cursor === '') {
          if (fiv.from > today) {
            return (
              'A trilha ' +
              fallbackPlanType +
              ' ficaria SEM nenhum plano ativo de hoje (' +
              today +
              ') até ' +
              fiv.from +
              ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível. Inicie a nova vigência em ' +
              today +
              ' ou antes.'
            )
          }
        } else if (fiv.from > cursor) {
          return (
            'A trilha ' +
            fallbackPlanType +
            ' ficaria SEM cobertura entre ' +
            cursor +
            ' e ' +
            fiv.from +
            ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar nesse período (ex.: 03/12/2026) não encontraria plano disponível. Ajuste as vigências para que a trilha seja contínua (ex.: uma termina 30/11 e a próxima começa 01/12).'
          )
        }
        // v0.0.115 — cursor = PRIMEIRO dia SEM plano (dia seguinte ao fim da
        // janela): a fronteira inclusiva 30/11 + 01/12 fica SEM buraco.
        if (fiv.until === '') {
          cursor = ''
        } else {
          var fivNextDate = new Date(fiv.until + 'T00:00:00Z')
          fivNextDate.setUTCDate(fivNextDate.getUTCDate() + 1)
          var fivNextStr = fivNextDate.toISOString().slice(0, 10)
          if (cursor === '' || fivNextStr > cursor) {
            cursor = fivNextStr
          }
        }
      }
      if (cursor === '') {
        return ''
      }
      var fbLastCoveredDate = new Date(cursor + 'T00:00:00Z')
      fbLastCoveredDate.setUTCDate(fbLastCoveredDate.getUTCDate() - 1)
      return (
        'A trilha ' +
        fallbackPlanType +
        ' terminaria em ' +
        fbLastCoveredDate.toISOString().slice(0, 10) +
        ' e ficaria SEM cobertura a partir de ' +
        cursor +
        ' — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante), para que todo o futuro continue coberto.'
      )
    }
    var localCoberturaFn = null
    try {
      if (
        typeof globalThis !== 'undefined' &&
        typeof globalThis.__vigenciaCobertura === 'function'
      ) {
        localCoberturaFn = globalThis.__vigenciaCobertura
      }
    } catch (localCoberturaResolveErr) {
      console.log(
        '[vigencia] globalThis.__vigenciaCobertura indisponível (' +
          localCoberturaResolveErr +
          ') — usando fallback inline v0.0.115.',
      )
    }
    if (!localCoberturaFn || typeof localCoberturaFn !== 'function') {
      localCoberturaFn = localFallbackCobertura
    }
    try {
      localCoberturaErr = localCoberturaFn(localPlanType, localCoberturaRows) || ''
    } catch (localCoberturaCallErr) {
      console.log(
        '[vigencia] __vigenciaCobertura falhou ao executar (' +
          localCoberturaCallErr +
          ') — usando fallback inline v0.0.115.',
      )
      localCoberturaErr = localFallbackCobertura(localPlanType, localCoberturaRows) || ''
    }
    if (localCoberturaErr) {
      throw new BadRequestError(localCoberturaErr)
    }
  }
  e.next()
}, 'subscription_plans')

onRecordUpdate((e) => {
  var localVFrom = String(e.record.getString('valid_from') || '').slice(0, 10)
  var localVUntil = String(e.record.getString('valid_until') || '').slice(0, 10)
  var localPlanType = String(e.record.getString('plan_type') || '')
  var localOverride = String(e.record.getString('user_override') || '')
  var localActive = e.record.getBool('active')

  if (localPlanType && localActive && localOverride === '') {
    if (localVFrom && localVUntil && localVUntil <= localVFrom) {
      throw new BadRequestError(
        'Vigência inválida: a data final (' +
          localVUntil +
          ') deve ser POSTERIOR à data inicial (' +
          localVFrom +
          ') — as duas datas não podem coincidir.',
      )
    }
    var localConflicts = $app.findRecordsByFilter(
      'subscription_plans',
      "plan_type = '" +
        localPlanType +
        "' && active = true && (user_override = '' || user_override = null)",
      '-created',
      100,
      0,
    )
    for (var localCi = 0; localCi < localConflicts.length; localCi++) {
      var localRow = localConflicts[localCi]
      if (localRow.id === e.record.id) continue
      var localRowFrom = String(localRow.getString('valid_from') || '').slice(0, 10)
      var localRowUntil = String(localRow.getString('valid_until') || '').slice(0, 10)
      // Fronteira INCLUSIVA nas duas pontas (v0.0.106) — ver onRecordCreate.
      var localNewStartsInRow = !localRowUntil || localVFrom <= localRowUntil
      var localRowStartsInNew = !localVUntil || localRowFrom <= localVUntil
      if (localNewStartsInRow && localRowStartsInNew) {
        throw new BadRequestError(
          'Já existe um plano ' +
            localPlanType +
            ' vigente no período ' +
            (localRowFrom || 'início aberto') +
            ' até ' +
            (localRowUntil || 'em diante (sem data final)') +
            ': ' +
            (localRow.getString('name') || 'sem nome') +
            '. As janelas não podem se tocar (nem o início nem o fim podem coincidir) — deixe no mínimo um dia de diferença na fronteira (ex.: termina 30/11, começa 01/12).',
        )
      }
    }

    // v0.0.114 — simulação de cobertura contínua da trilha (mesma regra da
    // rota admin; resolução DEFENSIVA de globalThis.__vigenciaCobertura com
    // fallback inline v0.0.115 — nunca depende de ordem de carregamento).
    var localCoberturaRows = []
    for (var localCk2 = 0; localCk2 < localConflicts.length; localCk2++) {
      if (localConflicts[localCk2].id === e.record.id) continue
      localCoberturaRows.push({
        name: String(localConflicts[localCk2].getString('name') || 'sem nome'),
        from: String(localConflicts[localCk2].getString('valid_from') || '').slice(0, 10),
        until: String(localConflicts[localCk2].getString('valid_until') || '').slice(0, 10),
      })
    }
    localCoberturaRows.push({
      name: String(e.record.getString('name') || 'novo plano'),
      from: localVFrom,
      until: localVUntil,
    })
    var localCoberturaErr = ''
    // v0.0.115 — resolução DEFENSIVA idêntica à do onRecordCreate acima
    // (typeof + try + fallback 100% inline com a MESMA lógica — ver
    // pocketbase/hooks/vigencia_cobertura_reference.js): nunca depende de
    // ordem de carregamento de arquivos, nunca TypeError cru.
    var localFallbackCobertura = function (fallbackPlanType, fallbackRows) {
      var today = new Date().toISOString().slice(0, 10)
      var intervals = []
      for (var fi = 0; fi < fallbackRows.length; fi++) {
        var fr = fallbackRows[fi]
        if (!fr.from) continue
        if (fr.until && fr.until < today) continue
        intervals.push({ from: fr.from > today ? fr.from : today, until: fr.until || '' })
      }
      if (intervals.length === 0) {
        return (
          'A trilha ' +
          fallbackPlanType +
          ' ficaria SEM nenhum plano ativo a partir de hoje (' +
          today +
          ') — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível.'
        )
      }
      intervals.sort(function (a, b) {
        if (a.from < b.from) return -1
        if (a.from > b.from) return 1
        return 0
      })
      var cursor = ''
      for (var fj = 0; fj < intervals.length; fj++) {
        var fiv = intervals[fj]
        if (cursor === '') {
          if (fiv.from > today) {
            return (
              'A trilha ' +
              fallbackPlanType +
              ' ficaria SEM nenhum plano ativo de hoje (' +
              today +
              ') até ' +
              fiv.from +
              ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível. Inicie a nova vigência em ' +
              today +
              ' ou antes.'
            )
          }
        } else if (fiv.from > cursor) {
          return (
            'A trilha ' +
            fallbackPlanType +
            ' ficaria SEM cobertura entre ' +
            cursor +
            ' e ' +
            fiv.from +
            ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar nesse período (ex.: 03/12/2026) não encontraria plano disponível. Ajuste as vigências para que a trilha seja contínua (ex.: uma termina 30/11 e a próxima começa 01/12).'
          )
        }
        // v0.0.115 — cursor = PRIMEIRO dia SEM plano (dia seguinte ao fim da
        // janela): a fronteira inclusiva 30/11 + 01/12 fica SEM buraco.
        if (fiv.until === '') {
          cursor = ''
        } else {
          var fivNextDate = new Date(fiv.until + 'T00:00:00Z')
          fivNextDate.setUTCDate(fivNextDate.getUTCDate() + 1)
          var fivNextStr = fivNextDate.toISOString().slice(0, 10)
          if (cursor === '' || fivNextStr > cursor) {
            cursor = fivNextStr
          }
        }
      }
      if (cursor === '') {
        return ''
      }
      var fbLastCoveredDate = new Date(cursor + 'T00:00:00Z')
      fbLastCoveredDate.setUTCDate(fbLastCoveredDate.getUTCDate() - 1)
      return (
        'A trilha ' +
        fallbackPlanType +
        ' terminaria em ' +
        fbLastCoveredDate.toISOString().slice(0, 10) +
        ' e ficaria SEM cobertura a partir de ' +
        cursor +
        ' — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante), para que todo o futuro continue coberto.'
      )
    }
    var localCoberturaFn = null
    try {
      if (
        typeof globalThis !== 'undefined' &&
        typeof globalThis.__vigenciaCobertura === 'function'
      ) {
        localCoberturaFn = globalThis.__vigenciaCobertura
      }
    } catch (localCoberturaResolveErr) {
      console.log(
        '[vigencia] globalThis.__vigenciaCobertura indisponível (' +
          localCoberturaResolveErr +
          ') — usando fallback inline v0.0.115.',
      )
    }
    if (!localCoberturaFn || typeof localCoberturaFn !== 'function') {
      localCoberturaFn = localFallbackCobertura
    }
    try {
      localCoberturaErr = localCoberturaFn(localPlanType, localCoberturaRows) || ''
    } catch (localCoberturaCallErr) {
      console.log(
        '[vigencia] __vigenciaCobertura falhou ao executar (' +
          localCoberturaCallErr +
          ') — usando fallback inline v0.0.115.',
      )
      localCoberturaErr = localFallbackCobertura(localPlanType, localCoberturaRows) || ''
    }
    if (localCoberturaErr) {
      throw new BadRequestError(localCoberturaErr)
    }
  }
  e.next()
}, 'subscription_plans')
