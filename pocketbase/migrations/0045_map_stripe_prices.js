/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0045 — Mapeamento DEFINITIVO dos 4 Prices da Stripe.
 *
 * Contexto (v0.0.102): mapa REAL obtido da API da Stripe
 * (GET /v1/prices?product=prod_Va2uSpOiSeedcC, secret key da stripe_config):
 *   R$ 19,90/mês  → price_1UZ11R31gAsdzIHftUWaEJB0  (recurring month)
 *   R$ 29,90/mês  → price_1UZ11Q31gAsdzIHfLP1oZJKS  (recurring month)
 *   R$ 214,90/ano → price_1UZ11Q31gAsdzIHfGEinrGPA  (recurring year, "Por ano")
 *   R$ 322,90/ano → price_1UZ11O31gAsdzIHfNapN7q6b  (recurring year, "Por ano")
 *
 * Estado anterior INCORRETO nas 4 linhas de subscription_plans: as linhas de
 * valor PADRÃO apontavam para os price_ids PROMOCIONAIS (R$29,90 com o price de
 * R$19,90; R$322,90 com o price de R$214,90).stripe_config.price_id_mensal
 * (R$19,90) e price_id_anual (R$214,90, "Por ano") já estavam corretos;
 * price_id_anual_recorrente estava VAZIO e recebe o Price anual "Por ano".
 *
 * Nota (v0.0.95/0.98): price_id_anual NÃO é usado pelo checkout recorrente
 * (o botão anual recorrente usa EXCLUSIVAMENTE price_id_anual_recorrente) e o
 * Pix à vista (mode=payment) usa price_data com o valor do plano — nenhum
 * price_id. O price_id_anual segue como referência documental.
 *
 * Idempotente: atualiza somente quando o valor gravado difere do correto.
 */
migrate(
  (app) => {
    try {
      const PRICE_MENSAL_PROMO = 'price_1UZ11R31gAsdzIHftUWaEJB0' // R$ 19,90/mês
      const PRICE_MENSAL_PADRAO = 'price_1UZ11Q31gAsdzIHfLP1oZJKS' // R$ 29,90/mês
      const PRICE_ANUAL_PROMO = 'price_1UZ11Q31gAsdzIHfGEinrGPA' // R$ 214,90/ano
      const PRICE_ANUAL_PADRAO = 'price_1UZ11O31gAsdzIHfNapN7q6b' // R$ 322,90/ano

      let changed = 0

      // (a) subscription_plans — 1 linha por (name, price_cents), corrigida
      //     apenas se o stripe_price_id gravado divergir do mapa real.
      const targets = [
        { name: 'Mensal (Black November)', cents: 1990, priceId: PRICE_MENSAL_PROMO },
        { name: 'Mensal Padrão', cents: 2990, priceId: PRICE_MENSAL_PADRAO },
        { name: 'Anual (Black November)', cents: 21490, priceId: PRICE_ANUAL_PROMO },
        { name: 'Anual Padrão', cents: 32290, priceId: PRICE_ANUAL_PADRAO },
      ]
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]
        let rows = []
        try {
          rows = app.findRecordsByFilter(
            'subscription_plans',
            "name = '" + t.name + "' && price_cents = " + t.cents,
            '-created',
            10,
            0,
          )
        } catch (rowErr) {
          console.log('[migration 0045] Falha ao buscar plano "' + t.name + '": ' + String(rowErr))
          continue
        }
        for (let r = 0; r < rows.length; r++) {
          const rec = rows[r]
          const current = rec.getString('stripe_price_id') || ''
          if (current !== t.priceId) {
            rec.set('stripe_price_id', t.priceId)
            rec.set('stripe_product_id', 'prod_Va2uSpOiSeedcC')
            rec.set(
              'notes',
              rec.getString('notes') + ' | price_id corrigido na v0.0.102 (mapa real da Stripe)',
            )
            app.save(rec)
            changed++
            console.log(
              '[migration 0045] Plano "' +
                t.name +
                '": ' +
                (current || '(vazio)') +
                ' → ' +
                t.priceId,
            )
          }
        }
      }

      // (b) stripe_config — price_id_anual_recorrente recebe o Price anual
      //     recorrente "Por ano" (R$ 214,90). price_id_mensal e price_id_anual
      //     só são corrigidos se divergirem do mapa real.
      let cfgRows = []
      try {
        cfgRows = app.findRecordsByFilter('stripe_config', '', '-created', 10, 0)
      } catch (cfgErr) {
        console.log('[migration 0045] Falha ao buscar stripe_config: ' + String(cfgErr))
      }
      for (let c = 0; c < cfgRows.length; c++) {
        const cfg = cfgRows[c]
        const want = {
          price_id_mensal: PRICE_MENSAL_PROMO,
          price_id_anual: PRICE_ANUAL_PROMO,
          price_id_anual_recorrente: PRICE_ANUAL_PROMO,
        }
        const fields = ['price_id_mensal', 'price_id_anual', 'price_id_anual_recorrente']
        let cfgChanged = false
        for (let f = 0; f < fields.length; f++) {
          const fieldName = fields[f]
          let current = ''
          try {
            current = cfg.getString(fieldName) || ''
          } catch (fieldErr) {
            // campo pode não existir em bases antigas — ignora
            continue
          }
          if (current !== want[fieldName]) {
            cfg.set(fieldName, want[fieldName])
            cfgChanged = true
            changed++
            console.log(
              '[migration 0045] stripe_config.' +
                fieldName +
                ': ' +
                (current || '(vazio)') +
                ' → ' +
                want[fieldName],
            )
          }
        }
        if (cfgChanged) {
          app.save(cfg)
        }
      }

      console.log('[migration 0045] Concluída — ' + changed + ' campo(s) corrigido(s).')
    } catch (err) {
      console.log('[migration 0045] Erro: ' + String(err))
    }
  },
  (app) => {
    // Down: não restaura valores errados conhecidos — seria reintroduzir o bug.
    // Operação reversa intencionalmente vazia (idempotente e sem efeito colateral).
  },
)
