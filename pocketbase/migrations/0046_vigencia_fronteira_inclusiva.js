/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0046 — Regra de vigência com FRONTEIRA INCLUSIVA (v0.0.106).
 *
 * Definição expressa da usuária: nem a data de início nem a data de fim de
 * assinaturas mensais (ou anuais) podem se sobrepor — janelas inclusivas nas
 * duas pontas [valid_from, valid_until]. Se a promo termina em 01/12/2026 e a
 * Padrão começa em 01/12/2026, há um dia com DUAS vigências ativas e isso é
 * conflito. Janelas consecutivas devem deixar no mínimo um dia de diferença na
 * fronteira (ex.: termina 30/11/2026, começa 01/12/2026).
 *
 * Os dados de produção estavam conflitantes com a regra nova na trilha MENSAL:
 * - Mensal (Black November): valid_until = 2026-12-01 vs Mensal Padrão: valid_from = 2026-12-01
 * - Anual (Black November): valid_until = 2026-11-30 — já ok (dia antes da virada)
 * Ajuste escolhido (nunca deletar registros): valid_until da promo recua para o
 * último dia ANTES da vigência seguinte do mesmo tipo. Assim, em 01/12/2026 só
 * existe UMA vigência por trilha (a Padrão) e nenhum cliente novo cadastrado
 * nesse dia vê dois planos.
 *
 * Idempotente (no-op em base vazia / já migrada): só grava quando newUntil é
 * diferente do atual e posterior ao valid_from da própria linha.
 */
migrate(
  (app) => {
    let adjusted = 0
    try {
      const rows = app.findRecordsByFilter(
        'subscription_plans',
        "active = true && (user_override = '' || user_override = null)",
        '-created',
        200,
        0,
      )
      for (let i = 0; i < rows.length; i++) {
        const promo = rows[i]
        const promoType = promo.getString('plan_type') || ''
        const promoUntil = String(promo.getString('valid_until') || '').slice(0, 10)
        const promoFrom = String(promo.getString('valid_from') || '').slice(0, 10)
        if (!promoType || !promoUntil || !promoFrom) continue

        // Acha a PRÓXIMA vigência do mesmo tipo que começa DEPOIS do início
        // desta linha (a trilha é ordenada; linhas inativas/overrides fora).
        const seguintes = app.findRecordsByFilter(
          'subscription_plans',
          "plan_type = '" +
            promoType +
            "' && active = true && id != '" +
            promo.id +
            "' && valid_from > '" +
            promoFrom +
            "' && (user_override = '' || user_override = null)",
          'valid_from',
          1,
          0,
        )
        if (seguintes.length === 0) continue
        const seguinteFrom = String(seguintes[0].getString('valid_from') || '').slice(0, 10)
        if (!seguinteFrom || seguinteFrom <= promoUntil) continue

        // Recua valid_until da promo para o último dia ANTES da fronteira.
        const d = new Date(seguinteFrom + 'T00:00:00.000Z')
        d.setUTCDate(d.getUTCDate() - 1)
        const newUntil = d.toISOString().slice(0, 10)

        if (newUntil && newUntil !== promoUntil && newUntil > promoFrom) {
          promo.set('valid_until', newUntil)
          app.save(promo)
          adjusted++
          console.log(
            '[migration 0046] ' +
              promo.getString('name') +
              ' (' +
              promoType +
              '): valid_until ' +
              promoUntil +
              ' -> ' +
              newUntil +
              ' (fronteira inclusiva — sem duas vigências no mesmo dia).',
          )
        }
      }
    } catch (bErr) {
      console.log('[migration 0046] Falha no ajuste de vigências: ' + bErr)
    }
    console.log('[migration 0046] Concluída: ' + adjusted + ' vigência(s) ajustada(s).')
  },
  (app) => {
    // Reversão forward-only: mover valid_until de volta para o dia da virada
    // recriaria o conflito de fronteira. No-op documentado.
    console.log('[migration 0046] down: no-op (ajuste de fronteira é forward-only).')
  },
)
