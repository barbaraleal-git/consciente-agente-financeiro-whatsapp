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
 * v0.0.106: a rota POST /backend/v1/admin/billing/plans (billing_stripe.js)
 * executa a MESMA checagem inline (fonte única para o Backoffice) — este hook
 * cobre gravações diretas na coleção (painel PocketBase/backup).
 *
 * Regras JSVM: lógica 100% inline nos callbacks (sem require top-level, sem
 * variável declarada em try usada fora do bloco).
 */

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
  }
  e.next()
}, 'subscription_plans')
