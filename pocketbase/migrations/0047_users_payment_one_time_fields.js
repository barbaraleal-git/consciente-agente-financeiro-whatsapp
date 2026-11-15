/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0047 — Campos de pagamento único (one_time Pix/cartão) em users
 * (v0.0.106).
 *
 * A rota GET /backend/v1/admin/billing/subscriptions (billing_stripe.js) lê
 * u.getString('billing_mode') / u.getInt('payment_amount_cents') /
 * u.getString('payment_paid_at') para o Backoffice não exibir "Sem assinatura
 * Stripe" em cliente com pagamento único via Pix. Se os campos não existirem
 * na coleção, a leitura lança e a aba Assinaturas cai no catch (erro 500).
 * Migração idempotente seguindo o padrão da 0041.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const desired = [
      { name: 'billing_mode', type: 'text' },
      { name: 'payment_amount_cents', type: 'number' },
      { name: 'payment_paid_at', type: 'date' },
    ]
    for (let d = 0; d < desired.length; d++) {
      let hasField = false
      try {
        for (let i = 0; i < users.fields.length; i++) {
          if (users.fields[i].name === desired[d].name) {
            hasField = true
            break
          }
        }
      } catch (fErr) {
        console.log('[migration 0047] Falha ao inspecionar campos: ' + fErr)
      }
      if (!hasField) {
        users.fields.add(
          new Field({
            name: desired[d].name,
            type: desired[d].type,
            required: false,
          }),
        )
        app.save(users)
        console.log('[migration 0047] Campo ' + desired[d].name + ' adicionado a users.')
      } else {
        console.log('[migration 0047] Campo ' + desired[d].name + ' já existe — nada a fazer.')
      }
    }

    // Backfill idempotente: clientes 'active' sem stripe_subscription_id e com
    // access_until no futuro são o pagamento único (Pix) — grava billing_mode.
    let backfilled = 0
    const nowIso = new Date().toISOString()
    try {
      const oneTimeCandidates = app.findRecordsByFilter(
        '_pb_users_auth_',
        "subscription_status = 'active'",
        '-created',
        500,
        0,
      )
      for (let i = 0; i < oneTimeCandidates.length; i++) {
        const u = oneTimeCandidates[i]
        const subId = u.getString('stripe_subscription_id') || ''
        const access = u.getString('access_until') || ''
        if (subId || !access || access <= nowIso) continue
        if ((u.getString('billing_mode') || '') !== '') continue
        u.set('billing_mode', 'one_time')
        // Preenche valor/data do pagamento a partir do histórico de checkout
        // (o one-time é sempre Pix/cartão mode=payment — v0.0.95).
        try {
          const pays = app.findRecordsByFilter(
            'subscriptions_history',
            "user = '" +
              u.id +
              "' && (event_type = 'stripe.checkout.session.completed' || event_type = 'checkout.completed') && amount_cents > 0",
            '-created',
            1,
            0,
          )
          if (pays.length > 0) {
            u.set('payment_amount_cents', pays[0].getInt('amount_cents'))
            u.set('payment_paid_at', pays[0].getString('created'))
          }
        } catch (hpErr) {
          console.log('[migration 0047] Falha ao buscar pagamento de ' + u.id + ': ' + hpErr)
        }
        app.save(u)
        backfilled++
      }
    } catch (bErr) {
      console.log('[migration 0047] Falha no backfill de billing_mode: ' + bErr)
    }
    console.log('[migration 0047] Backfill concluído: ' + backfilled + ' registro(s).')
  },
  (app) => {
    // Reversão: remove apenas os campos adicionados (backfill é forward-only).
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const fields = users.fields
      for (let i = fields.length - 1; i >= 0; i--) {
        if (
          fields[i].name === 'billing_mode' ||
          fields[i].name === 'payment_amount_cents' ||
          fields[i].name === 'payment_paid_at'
        ) {
          fields.remove(i)
        }
      }
      app.save(users)
      console.log('[migration 0047] down: campos de pagamento único removidos.')
    } catch (dErr) {
      console.log('[migration 0047] down: falha ao remover campos: ' + dErr)
    }
  },
)
