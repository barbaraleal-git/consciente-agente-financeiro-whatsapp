// pocketbase/migrations/0052_create_subscription_plans_audit.js
/// <reference path="../pb_data/types.d.ts" />

/**
 * v0.0.112 — trilha de auditoria por plano (Pedido 4 da dona).
 *
 * Coleção subscription_plans_audit: uma linha por alteração em
 * subscription_plans, gravada INLINE pelas rotas admin do backoffice
 * (pocketbase/hooks/billing_stripe.js — criar / editar / definir_vigencia /
 * importar). Leitura restrita a admins; ninguém cria/edita pela API.
 *
 * Formato de export corrigido: migrate((app) => {...}, (app) => {...})
 * (a versão anterior passava um nome de migração como 1º parâmetro e quebrava
 * o apply com "could not convert 0052_create_subscription_plans_audit to
 * func(core.App)").
 */
migrate(
  (app) => {
    let existing = null
    try {
      existing = app.findCollectionByNameOrId('subscription_plans_audit')
    } catch (_) {}

    if (existing) {
      console.log('[migration 0052] Coleção subscription_plans_audit já existe — no-op.')
      return
    }

    const plansCol = app.findCollectionByNameOrId('subscription_plans')

    const collection = new Collection({
      name: 'subscription_plans_audit',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'plan',
          type: 'relation',
          required: true,
          collectionId: plansCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'plan_name', type: 'text' },
        {
          name: 'action',
          type: 'select',
          required: true,
          values: ['criar', 'editar', 'definir_vigencia', 'importar'],
          maxSelect: 1,
        },
        { name: 'actor_email', type: 'text' },
        { name: 'changes', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_subscription_plans_audit_plan ON subscription_plans_audit (plan, created)',
      ],
    })
    app.save(collection)
    console.log('[migration 0052] Coleção subscription_plans_audit criada.')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('subscription_plans_audit')
      if (col) {
        app.delete(col)
        console.log('[migration 0052] Coleção subscription_plans_audit removida.')
      }
    } catch (err) {
      console.log('[migration 0052] Revert error:', err)
    }
  },
)
