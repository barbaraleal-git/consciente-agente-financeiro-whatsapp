/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Integridade de Vigência dos Planos de Assinatura (subscription_plans) — v0.0.103.
 *
 * Regras:
 *  a) Dentro do MESMO plan_type (mensal × anual são trilhas independentes),
 *     duas linhas de preço geral (sem user_override) ATIVAS não podem ter
 *     janelas de vigência sobrepostas. valid_until vazio = janela aberta.
 *  b) Janela inválida: valid_until preenchido e <= valid_from é rejeitado.
 *  c) Na edição, a própria linha é desconsiderada na comparação.
 *  d) Mensagens de erro amigáveis em português citando o plano conflitante e o
 *     período (ex.: "Já existe um plano mensal válido no período 01/12/2026 em
 *     diante: Mensal Padrão.").
 *
 * REGRA DE SCOPING DA JSVM: callbacks (onRecordCreate/onRecordUpdate) NÃO têm
 * acesso a NENHUMA declaração top-level — nem de outros módulos, nem do
 * PRÓPRIO arquivo (causa "Hook scoping error" / "GoError: Invalid module").
 * POR ISSO toda a lógica de validação é 100% inline no corpo de cada callback
 * e as variáveis locais usam padrão localXxx (declaração antes do try — bugs
 * v0.0.66/v0.0.91 da JSVM).
 */

onRecordCreate((e) => {
  var localRecord = null
  try {
    localRecord = e.record
  } catch (recErr) {
    console.log('[planos_vigencia] Falha ao ler record: ' + String(recErr))
  }
  if (!localRecord) {
    return e.next()
  }

  var localApp = e.app
  var localId = localRecord.id || ''
  var localPlanType = localRecord.getString('plan_type')
  var localName = localRecord.getString('name')
  var localValidFrom = localRecord.getString('valid_from')
  var localValidUntil = localRecord.getString('valid_until')
  var localIsActive = localRecord.getBool('active')
  var localUserOverride = localRecord.getString('user_override')

  // Converte 'YYYY-MM-DD' para 'DD/MM/YYYY' nas mensagens (formato BR)
  var localFromBr = localValidFrom
  var localUntilBr = localValidUntil
  try {
    if (localValidFrom && localValidFrom.length >= 10) {
      localFromBr =
        localValidFrom.slice(8, 10) +
        '/' +
        localValidFrom.slice(5, 7) +
        '/' +
        localValidFrom.slice(0, 4)
    }
    if (localValidUntil && localValidUntil.length >= 10) {
      localUntilBr =
        localValidUntil.slice(8, 10) +
        '/' +
        localValidUntil.slice(5, 7) +
        '/' +
        localValidUntil.slice(0, 4)
    }
  } catch (fmtErr) {
    localFromBr = localValidFrom
    localUntilBr = localValidUntil
  }

  // Regra (b): janela inválida
  if (localValidFrom && localValidUntil && localValidUntil <= localValidFrom) {
    throw new BadRequestError(
      'Vigência inválida no plano ' +
        (localName || localPlanType) +
        ': a data "Vigência até" (' +
        localUntilBr +
        ') deve ser posterior à data "Vigência de" (' +
        localFromBr +
        ').',
    )
  }

  // Regras (a), (c) e (e): sobreposição dentro do MESMO plan_type,
  // considerando apenas linhas ATIVAS de preço geral (sem user_override).
  if (localIsActive && !localUserOverride && localPlanType) {
    var localOthers = []
    try {
      localOthers = localApp.findRecordsByFilter(
        'subscription_plans',
        "plan_type = '" + localPlanType + "' && active = true && user_override = ''",
        '-updated',
        200,
        0,
      )
    } catch (findErr) {
      console.log('[planos_vigencia] Falha ao buscar planos: ' + String(findErr))
      localOthers = []
    }

    for (var localI = 0; localI < localOthers.length; localI++) {
      var localOther = localOthers[localI]
      if (localOther.id === localId) {
        continue // regra (c): desconsidera a própria linha em edição
      }
      var localOtherFrom = localOther.getString('valid_from')
      var localOtherUntil = localOther.getString('valid_until')
      if (localOther.getString('user_override')) {
        continue // overrides por cliente podem conviver com a trilha geral
      }

      // Sobreposição de janelas [from, until): Black November termina em
      // 30/11 e a Padrão começa em 01/12 — sem sobreposição (e = vazio é
      // janela aberta/infinita). Quatro casos de NÃO-sobreposição:
      //   - a linha atual termina antes da outra começar;
      //   - a outra termina antes da linha atual começar;
      //   - janelas idênticas vazias: tratadas abaixo como sobreposição.
      var localOverlap = false
      if (localValidFrom && localOtherFrom) {
        var localAE = localValidUntil
        var localBE = localOtherUntil
        var localAAfterB = localOtherUntil && localValidFrom >= localOtherUntil
        var localBAfterA = localValidUntil && localOtherFrom >= localValidUntil
        if (!localAAfterB && !localBAfterA) {
          localOverlap = true
        }
      }

      if (localOverlap) {
        var localOtherFromBr = localOtherFrom
        var localOtherUntilBr = localOtherUntil
        try {
          if (localOtherFrom && localOtherFrom.length >= 10) {
            localOtherFromBr =
              localOtherFrom.slice(8, 10) +
              '/' +
              localOtherFrom.slice(5, 7) +
              '/' +
              localOtherFrom.slice(0, 4)
          }
          if (localOtherUntil && localOtherUntil.length >= 10) {
            localOtherUntilBr =
              localOtherUntil.slice(8, 10) +
              '/' +
              localOtherUntil.slice(5, 7) +
              '/' +
              localOtherUntil.slice(0, 4)
          }
        } catch (fmtErr2) {
          localOtherFromBr = localOtherFrom
          localOtherUntilBr = localOtherUntil
        }
        var localPeriodo = localOtherUntil
          ? localOtherFromBr + ' até ' + localOtherUntilBr
          : localOtherFromBr + ' em diante'
        var localTipo = localPlanType === 'anual' ? 'anual' : 'mensal'
        var localConflito = localOther.getString('name') || 'Plano ' + localTipo
        throw new BadRequestError(
          'Já existe um plano ' +
            localTipo +
            ' válido no período ' +
            localPeriodo +
            ': ' +
            localConflito +
            '. Ajuste a vigência para não sobrepor essa linha.',
        )
      }
    }
  }

  return e.next()
}, 'subscription_plans')

onRecordUpdate((e) => {
  var localRecord = null
  try {
    localRecord = e.record
  } catch (recErr2) {
    console.log('[planos_vigencia] Falha ao ler record (update): ' + String(recErr2))
  }
  if (!localRecord) {
    return e.next()
  }

  var localAppUpd = e.app
  var localIdUpd = localRecord.id || ''
  var localPlanTypeUpd = localRecord.getString('plan_type')
  var localNameUpd = localRecord.getString('name')
  var localValidFromUpd = localRecord.getString('valid_from')
  var localValidUntilUpd = localRecord.getString('valid_until')
  var localIsActiveUpd = localRecord.getBool('active')
  var localUserOverrideUpd = localRecord.getString('user_override')

  // Converte 'YYYY-MM-DD' para 'DD/MM/YYYY' nas mensagens (formato BR)
  var localFromBrUpd = localValidFromUpd
  var localUntilBrUpd = localValidUntilUpd
  try {
    if (localValidFromUpd && localValidFromUpd.length >= 10) {
      localFromBrUpd =
        localValidFromUpd.slice(8, 10) +
        '/' +
        localValidFromUpd.slice(5, 7) +
        '/' +
        localValidFromUpd.slice(0, 4)
    }
    if (localValidUntilUpd && localValidUntilUpd.length >= 10) {
      localUntilBrUpd =
        localValidUntilUpd.slice(8, 10) +
        '/' +
        localValidUntilUpd.slice(5, 7) +
        '/' +
        localValidUntilUpd.slice(0, 4)
    }
  } catch (fmtErr3) {
    localFromBrUpd = localValidFromUpd
    localUntilBrUpd = localValidUntilUpd
  }

  // Regra (b): janela inválida
  if (localValidFromUpd && localValidUntilUpd && localValidUntilUpd <= localValidFromUpd) {
    throw new BadRequestError(
      'Vigência inválida no plano ' +
        (localNameUpd || localPlanTypeUpd) +
        ': a data "Vigência até" (' +
        localUntilBrUpd +
        ') deve ser posterior à data "Vigência de" (' +
        localFromBrUpd +
        ').',
    )
  }

  if (localIsActiveUpd && !localUserOverrideUpd && localPlanTypeUpd) {
    var localOthersUpd = []
    try {
      localOthersUpd = localAppUpd.findRecordsByFilter(
        'subscription_plans',
        "plan_type = '" + localPlanTypeUpd + "' && active = true && user_override = ''",
        '-updated',
        200,
        0,
      )
    } catch (findErr2) {
      console.log('[planos_vigencia] Falha ao buscar planos (update): ' + String(findErr2))
      localOthersUpd = []
    }

    for (var localJ = 0; localJ < localOthersUpd.length; localJ++) {
      var localOtherUpd = localOthersUpd[localJ]
      if (localOtherUpd.id === localIdUpd) {
        continue // regra (c)
      }
      var localOtherFromUpd = localOtherUpd.getString('valid_from')
      var localOtherUntilUpd = localOtherUpd.getString('valid_until')
      if (localOtherUpd.getString('user_override')) {
        continue
      }

      var localOverlapUpd = false
      if (localValidFromUpd && localOtherFromUpd) {
        var localAAfterBUpd = localOtherUntilUpd && localValidFromUpd >= localOtherUntilUpd
        var localBAfterAUpd = localValidUntilUpd && localOtherFromUpd >= localValidUntilUpd
        if (!localAAfterBUpd && !localBAfterAUpd) {
          localOverlapUpd = true
        }
      }

      if (localOverlapUpd) {
        var localOtherFromBrUpd = localOtherFromUpd
        var localOtherUntilBrUpd = localOtherUntilUpd
        try {
          if (localOtherFromUpd && localOtherFromUpd.length >= 10) {
            localOtherFromBrUpd =
              localOtherFromUpd.slice(8, 10) +
              '/' +
              localOtherFromUpd.slice(5, 7) +
              '/' +
              localOtherFromUpd.slice(0, 4)
          }
          if (localOtherUntilUpd && localOtherUntilUpd.length >= 10) {
            localOtherUntilBrUpd =
              localOtherUntilUpd.slice(8, 10) +
              '/' +
              localOtherUntilUpd.slice(5, 7) +
              '/' +
              localOtherUntilUpd.slice(0, 4)
          }
        } catch (fmtErr4) {
          localOtherFromBrUpd = localOtherFromUpd
          localOtherUntilBrUpd = localOtherUntilUpd
        }
        var localPeriodoUpd = localOtherUntilUpd
          ? localOtherFromBrUpd + ' até ' + localOtherUntilBrUpd
          : localOtherFromBrUpd + ' em diante'
        var localTipoUpd = localPlanTypeUpd === 'anual' ? 'anual' : 'mensal'
        var localConflitoUpd = localOtherUpd.getString('name') || 'Plano ' + localTipoUpd
        throw new BadRequestError(
          'Já existe um plano ' +
            localTipoUpd +
            ' válido no período ' +
            localPeriodoUpd +
            ': ' +
            localConflitoUpd +
            '. Ajuste a vigência para não sobrepor essa linha.',
        )
      }
    }
  }

  return e.next()
}, 'subscription_plans')
