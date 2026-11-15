/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0052 — LIMPEZA do auto-teste temporário de vigência (v0.0.109).
 *
 * Remove os resíduos da rodada v0.0.107 de teste da regra de vigência:
 *  - o hook/cron temporário 'vigencia_selftest' já foi apagado do código
 *    (pocketbase/hooks/vigencia_selftest_tmp.js excluído) — o cron desaparece
 *    com o deploy;
 *  - a rota de diagnóstico GET /backend/v1/admin/billing/test-vigencia foi
 *    removida de billing_stripe.js;
 *  - este arquivo apaga o USUÁRIO admin de teste criado pela migração 0051
 *    (test.vigencia@consciente-teste.internal) e os registros de auditoria
 *    'vigencia_selftest' deixados em proactive_logs.
 *
 * A LÓGICA REAL de validação de vigência NÃO é tocada: permanece 100% na rota
 * POST /backend/v1/admin/billing/plans (checagem inline) e no hook de coleção
 * subscription_plans_vigencia.js — fronteira INCLUSIVA comprovada via API real
 * (v0.0.107/v0.0.108): fim 30/11 + início 01/12 exige 1 dia de folga; mesmo dia
 * de fronteira é CONFLITO rejeitado com 400 e mensagem amigável.
 *
 * Idempotente: rodar de novo não encontra nada e não faz nada.
 */
migrate(
  (app) => {
    // 1. Remove registros de auditoria do self-test em proactive_logs.
    let logsRemovidos = 0
    try {
      const logs = app.findRecordsByFilter(
        'proactive_logs',
        "kind = 'vigencia_selftest'",
        '',
        1000,
        0,
      )
      for (let i = 0; i < logs.length; i++) {
        app.delete(logs[i])
        logsRemovidos++
      }
    } catch (err) {
      console.log('[migration 0052] proactive_logs: ' + err)
    }

    // 2. Remove o usuário admin de teste criado pela migração 0051.
    let usuarioRemovido = false
    try {
      const testUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'test.vigencia@consciente-teste.internal',
      )
      if (testUser) {
        app.delete(testUser)
        usuarioRemovido = true
      }
    } catch (_) {
      // Usuário já não existe — idempotente.
    }

    console.log(
      '[migration 0052] Limpeza do self-test de vigência: ' +
        logsRemovidos +
        ' log(s) vigencia_selftest removido(s); usuário de teste removido: ' +
        (usuarioRemovido ? 'sim' : 'não existia') +
        '. Cron vigencia_selftest e rota test-vigencia já removidos do código.',
    )
  },
  (app) => {
    console.log('[migration 0052] down: no-op (limpeza é forward-only).')
  },
)
