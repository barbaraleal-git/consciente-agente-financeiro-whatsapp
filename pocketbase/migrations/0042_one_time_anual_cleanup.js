/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0042 — Consolidação do ANUAL VIA PIX (pagamento único) nos dados.
 *
 * Contexto (v0.0.95): a primeira cliente pagou R$ 214,90 à vista (Pix) e o
 * webhook corretamente NÃO gravou stripe_subscription_id novo — mas sobrou no
 * registro dela o subId da assinatura MENSAL antiga (cancelada na véspera),
 * fazendo /billing/status reportar has_stripe_subscription=true. Com isso a
 * tela Minha Conta exibia "Gerenciar assinatura" (portal com a fatura antiga
 * de R$ 19,90) para um cliente que pagou o anual à vista e não tem o que
 * gerenciar.
 *
 * Idempotente (no-op em base vazia / já migrada):
 * - Perfil one-time (status 'active' + plan 'anual' + access_until no futuro
 *   + stripe_subscription_id preenchido): LIMPA o subId obsoleto — um
 *   pagamento único nunca tem assinatura recorrente associada.
 * - Demais perfis (recorrentes ativos, cancelados, trial): intocados.
 */
migrate(
  (app) => {
    let cleaned = 0
    const nowIso = new Date().toISOString()
    try {
      const actives = app.findRecordsByFilter(
        '_pb_users_auth_',
        "subscription_status = 'active' && subscription_plan = 'anual' && stripe_subscription_id != ''",
        '-created',
        500,
        0,
      )
      for (let i = 0; i < actives.length; i++) {
        const u = actives[i]
        const access = u.getString('access_until') || ''
        if (access && access > nowIso) {
          const subId = u.getString('stripe_subscription_id')
          u.set('stripe_subscription_id', '')
          app.save(u)
          cleaned++
          console.log(
            '[migration 0042] one-time sem assinatura: usuário ' +
              u.id +
              ' — subId obsoleto removido (' +
              subId +
              ').',
          )
          try {
            const histCol = app.findCollectionByNameOrId('subscriptions_history')
            const histRec = new Record(histCol)
            histRec.set('user', u.id)
            histRec.set('event_type', 'billing.one_time_cleanup')
            histRec.set('plan_type', 'anual')
            histRec.set('status_from', 'active')
            histRec.set('status_to', 'active')
            histRec.set('details', {
              reason: 'stripe_subscription_id obsoleto removido de perfil one_time',
              removed_subscription_id: subId,
            })
            app.save(histRec)
          } catch (hErr) {
            console.log('[migration 0042] Falha ao registrar histórico: ' + hErr)
          }
        }
      }
    } catch (bErr) {
      console.log('[migration 0042] Falha no backfill one-time: ' + bErr)
    }
    console.log('[migration 0042] Concluída: ' + cleaned + ' registro(s) limpo(s).')
  },
  (app) => {
    // Reversão forward-only: a limpeza de subId obsoleto não é revertida
    // (regravar um subId cancelado reintroduziria o bug). No-op documentado.
    console.log('[migration 0042] down: no-op (limpeza é forward-only).')
  },
)
