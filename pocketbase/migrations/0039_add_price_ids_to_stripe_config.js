/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0039 — Campos de Price IDs na coleção stripe_config.
 *
 * Permite parametrizar os IDs de preço criados pela cliente na Stripe:
 * - price_id_mensal (ex.: price_1Q...)
 * - price_id_anual (ex.: price_1Q...)
 *
 * Idempotente: só adiciona se os campos ainda não existirem.
 */
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('stripe_config')
      let changed = false

      if (!col.fields.getByName('price_id_mensal')) {
        col.fields.add(
          new TextField({
            name: 'price_id_mensal',
          }),
        )
        changed = true
      }

      if (!col.fields.getByName('price_id_anual')) {
        col.fields.add(
          new TextField({
            name: 'price_id_anual',
          }),
        )
        changed = true
      }

      if (changed) {
        app.save(col)
        console.log(
          '[migration 0039] Campos price_id_mensal e price_id_anual adicionados a stripe_config.',
        )
      }
    } catch (err) {
      console.log('[migration 0039] Erro: ' + err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('stripe_config')
      col.fields.removeByName('price_id_mensal')
      col.fields.removeByName('price_id_anual')
      app.save(col)
    } catch (_) {}
  },
)
