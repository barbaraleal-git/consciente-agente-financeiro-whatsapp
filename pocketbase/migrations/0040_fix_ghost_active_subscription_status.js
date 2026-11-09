/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0040 — Correção do status de assinatura "fantasma".
 *
 * Origem do bug: a migração 0036 (seção 5) marcou a usuária admin como
 * subscription_status='active' sem nenhum pagamento real (sem
 * stripe_subscription_id). Isso fazia o front exibir "Assinatura Ativa
 * (Mensal)" mesmo sem checkout concluído.
 *
 * Correção idempotente (no-op em base vazia / sem caso do bug):
 * - Qualquer usuário com subscription_status='active' mas SEM
 *   stripe_subscription_id e SEM stripe_customer_id é rebaixado para 'trial',
 *   com expiration do trial renovada em +7 dias.
 * - Usuários com stripe_subscription_id (ativados de verdade pelo webhook
 *   checkout.session.completed) NÃO são tocados — o fluxo real permanece
 *   intacto.
 * - Registra o evento em subscriptions_history (status_from='active',
 *   status_to='trial') para rastreabilidade.
 *
 * NOTA: a origem do problema (seção 5 da 0036, isAdmin ? 'active' : 'trial')
 * é imutável — não pode ser editada. Esta migração corrige o estado resultante.
 * Uma nova rodada de seeds que reative admins sem pagamento recriaria o bug,
 * então o gate real do fluxo passa a ser: status 'active' só via webhook
 * Stripe ou sync-session (código em billing_stripe.js, já correto).
 */
migrate(
  (app) => {
    // Seleciona SOMENTE os casos do bug: 'active' sem nenhuma evidência Stripe.
    const ghosts = app.findRecordsByFilter(
      '_pb_users_auth_',
      "subscription_status = 'active' && stripe_subscription_id = '' && stripe_customer_id = ''",
      '-created',
      500,
      0,
    )

    if (ghosts.length === 0) {
      console.log('[migration 0040] Nenhum usuário "active" sem assinatura Stripe — nada a fazer.')
      return
    }

    const histCol = app.findCollectionByNameOrId('subscriptions_history')

    for (let i = 0; i < ghosts.length; i++) {
      const u = ghosts[i]
      const previous = u.getString('subscription_status')
      const trialDays = 7
      const trialUntil = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()

      u.set('subscription_status', 'trial')
      u.set('subscription_expires_at', trialUntil)
      app.save(u)

      try {
        const rec = new Record(histCol)
        rec.set('user', u.id)
        rec.set('event_type', 'billing.fix.ghost_active_to_trial')
        rec.set('plan_type', u.getString('subscription_plan') || 'mensal')
        rec.set('status_from', previous)
        rec.set('status_to', 'trial')
        rec.set('details', {
          reason: 'status active sem stripe_subscription_id e sem stripe_customer_id',
          stripe_customer_id: '',
          stripe_subscription_id: '',
        })
        app.save(rec)
      } catch (hErr) {
        console.log('[migration 0040] Falha ao registrar subscriptions_history: ' + hErr)
      }

      console.log(
        '[migration 0040] Usuário ' + u.getString('email') + ' corrigido: active → trial.',
      )
    }
  },
  (app) => {
    // Reversão: não faz nada — corrigir de volta para um estado falso seria
    // recriar o bug reportado. Migração forward-only por design.
    console.log('[migration 0040] down: no-op (correção forward-only).')
  },
)
