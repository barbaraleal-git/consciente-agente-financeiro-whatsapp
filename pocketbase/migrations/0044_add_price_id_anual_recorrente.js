/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0044 — Campo price_id_anual_recorrente na coleção stripe_config.
 *
 * Contexto (v0.0.98): a dona decidiu que a ASSINATURA ANUAL volta a ter
 * cobrança RECORRENTE (Price novo na Stripe, "Por ano", R$ 214,90/ano),
 * coexistindo com o Pix à vista (one_time) que segue disponível.
 *
 * Regra permanente (v0.0.95): o campo antigo price_id_anual NÃO é reutilizado —
 * ele aponta para um Price recorrente MENSAL de valor menor (bug histórico) e
 * segue intocado apenas como referência. O novo campo recebe o Price com
 * billing period "Por ano" criado no Dashboard da Stripe.
 *
 * Idempotente: só adiciona o campo se ele ainda não existir.
 */
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('stripe_config')
      if (!col.fields.getByName('price_id_anual_recorrente')) {
        col.fields.add(
          new TextField({
            name: 'price_id_anual_recorrente',
          }),
        )
        app.save(col)
        console.log('[migration 0044] Campo price_id_anual_recorrente adicionado a stripe_config.')
      } else {
        console.log('[migration 0044] Campo price_id_anual_recorrente já existe — nada a fazer.')
      }
    } catch (err) {
      console.log('[migration 0044] Erro: ' + err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('stripe_config')
      col.fields.removeByName('price_id_anual_recorrente')
      app.save(col)
    } catch (_) {}
  },
)
