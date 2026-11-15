/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de integridade de vigência da coleção subscription_plans (v0.0.105).
 *
 * Regra: dentro do MESMO plan_type (mensal vs anual), janelas semiabertas
 * [valid_from, valid_until) NÃO podem se sobrepor. valid_until vazio = "em
 * diante". Sequências válidas (fim dia X, início >= X) são permitidas; linhas
 * inativas (active = false) e linhas com user_override ficam FORA da checagem;
 * edição da própria linha não conflita consigo mesma (comparação por id).
 *
 * v0.0.105: a rota POST /backend/v1/admin/billing/plans (billing_stripe.js)
 * executa a MESMA checagem inline — este hook cobre gravações diretas na
 * coleção (painel PocketBase/backup), fora da rota do Backoffice.
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
          ') deve ser posterior à data inicial (' +
          localVFrom +
          ').',
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
      var localNewStartsInRow = !localRowUntil || localVFrom < localRowUntil
      var localRowStartsInNew = !localVUntil || localRowFrom < localVUntil
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
            '. Ajuste a vigência para não sobrepor essa linha.',
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
          ') deve ser posterior à data inicial (' +
          localVFrom +
          ').',
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
      var localNewStartsInRow = !localRowUntil || localVFrom < localRowUntil
      var localRowStartsInNew = !localVUntil || localRowFrom < localVUntil
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
            '. Ajuste a vigência para não sobrepor essa linha.',
        )
      }
    }
  }
  e.next()
}, 'subscription_plans')
