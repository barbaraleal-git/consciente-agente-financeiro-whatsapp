/// <reference path="../pb_data/types.d.ts" />
/**
 * v0.0.115 — Lógica de cobertura contínua por trilha, como FUNÇÃO PURA JS
 * (sem $app, sem globalThis): o corpo dela é COLADO dentro de cada callback
 * consumidor (rota POST /admin/billing/plans, rota de diagnóstico /coverage
 * em billing_stripe.js e hooks onRecordCreate/onRecordUpdate em
 * subscription_plans_vigencia.js), porque na JSVM do PocketBase o globalThis
 * NÃO é compartilhado de forma confiável entre módulos/hooks em todas as VMs
 * de pool — a prova real da dona em v0.0.114 quebrou com 500 cru
 * "Object has no member '__vigenciaCobertura'". Este arquivo é a REFERÊNCIA
 * de leitura da lógica (fonte única conceitual); NÃO é carregado em runtime
 * pelo PocketBase (sem routerAdd, sem cronAdd, sem side effect).
 *
 * REGRA (definição expressa da dona, v0.0.114): da data corrente em diante,
 * nenhum dia futuro pode ficar sem plano ativo definido na trilha (mensal e
 * anual separadamente). A linha de vigências ativas da trilha é simulada
 * (a linha em edição JÁ INCLUÍDA, com { name, from, until }) e qualquer
 * lacuna de datas >= 1 dia entre "hoje ou depois" e o fim da trilha é
 * rejeitada — a trilha precisa SEMPRE terminar numa linha aberta
 * (valid_until vazio) que cubra o futuro. Fronteira INCLUSIVA: termina
 * 30/11 + começa 01/12 = SEM buraco. Rascunhos (linhas inativas) e
 * user_override ficam FORA da checagem.
 *
 * IMPORTANTE: qualquer alteração na regra deve ser feita NOS TRÊS pontos
 * colados (aqui como referência + os dois callbacks consumidores), com o
 * mesmo texto de mensagem amigável em português.
 */

function vigenciaCoberturaReference(planType, rows) {
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
