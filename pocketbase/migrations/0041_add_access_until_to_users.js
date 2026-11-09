/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0041 — Campo `access_until` (fim do período já pago após cancelamento).
 *
 * Filosofia de cancelamento decidida pela usuária: a assinatura na Stripe é
 * encerrada IMEDIATAMENTE (sem cobranças futuras), mas o cliente continua
 * usando o app até o fim do período que já pagou. O status vira 'cancelado'
 * na hora, e a data final de acesso fica sempre visível em Minha Conta.
 *
 * Idempotente (no-op em base vazia / já migrada):
 * - Adiciona o campo `access_until` (date, opcional) à coleção users.
 * - Backfill: usuários já 'cancelado' que ainda tenham vigência paga futura
 *   (subscription_expires_at no futuro) recebem access_until = essa vigência.
 * - Usuários 'cancelado' com vigência já expirada recebem access_until vazio
 *   (caem no fluxo normal de não-assinante, como já faziam).
 * - Demais usuários: access_until permanece vazio.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Campo access_until (idempotente)
    let hasField = false
    try {
      for (let i = 0; i < users.fields.length; i++) {
        if (users.fields[i].name === 'access_until') {
          hasField = true
          break
        }
      }
    } catch (fErr) {
      console.log('[migration 0041] Falha ao inspecionar campos: ' + fErr)
    }
    if (!hasField) {
      users.fields.add(
        new Field({
          name: 'access_until',
          type: 'date',
          required: false,
        }),
      )
      app.save(users)
      console.log('[migration 0041] Campo access_until adicionado a users.')
    } else {
      console.log('[migration 0041] Campo access_until já existe — nada a fazer.')
    }

    // 2. Backfill dos cancelados com vigência paga futura
    let backfilled = 0
    const nowIso = new Date().toISOString()
    try {
      const cancelled = app.findRecordsByFilter(
        '_pb_users_auth_',
        "subscription_status = 'cancelado'",
        '-created',
        500,
        0,
      )
      for (let i = 0; i < cancelled.length; i++) {
        const u = cancelled[i]
        const access = u.getString('access_until') || ''
        if (access) {
          // Se o acesso já expirou, limpa o campo para o cliente cair no fluxo
          // normal de não-assinante.
          if (access < nowIso) {
            u.set('access_until', '')
            app.save(u)
            backfilled++
          }
          continue
        }
        const expires = u.getString('subscription_expires_at') || ''
        if (expires && expires > nowIso) {
          u.set('access_until', expires)
          app.save(u)
          backfilled++
        }
      }
    } catch (bErr) {
      console.log('[migration 0041] Falha no backfill de access_until: ' + bErr)
    }
    console.log('[migration 0041] Backfill concluído: ' + backfilled + ' registro(s).')
  },
  (app) => {
    // Reversão: remove apenas o campo adicionado (backfill é forward-only).
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      let removed = false
      const fields = users.fields
      for (let i = fields.length - 1; i >= 0; i--) {
        if (fields[i].name === 'access_until') {
          fields.remove(i)
          removed = true
          break
        }
      }
      if (removed) app.save(users)
      console.log('[migration 0041] down: campo access_until removido.')
    } catch (dErr) {
      console.log('[migration 0041] down: falha ao remover campo: ' + dErr)
    }
  },
)
