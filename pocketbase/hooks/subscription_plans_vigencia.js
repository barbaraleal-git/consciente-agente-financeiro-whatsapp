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
    // Avança o cursor para o fim desta janela (a mais distante vista até aqui).
    if (iv.until === '') {
      cursor = ''
    } else if (cursor === '' || iv.until > cursor) {
      cursor = iv.until
    }
  }

  // 4. A trilha precisa terminar numa linha ABERTA (em diante) que cubra o
  //    futuro: cursor vazio aqui significa que o último intervalo processado
  //    tinha valid_until vazio.
  if (cursor === '') {
    return ''
  }
  return (
    'A trilha ' +
    planType +
    ' terminaria em ' +
    cursor +
    ' e ficaria SEM cobertura a partir do dia seguinte — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante), para que todo o futuro continue coberto.'
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
    // rota admin; implementação ÚNICA em globalThis.__vigenciaCobertura, que
    // este módulo registra ao carregar — na hora do evento já existe).
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
    var localCoberturaErr = globalThis.__vigenciaCobertura(localPlanType, localCoberturaRows)
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
    // rota admin; implementação ÚNICA em globalThis.__vigenciaCobertura, que
    // este módulo registra ao carregar — na hora do evento já existe).
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
    var localCoberturaErr = globalThis.__vigenciaCobertura(localPlanType, localCoberturaRows)
    if (localCoberturaErr) {
      throw new BadRequestError(localCoberturaErr)
    }
  }
  e.next()
}, 'subscription_plans')
