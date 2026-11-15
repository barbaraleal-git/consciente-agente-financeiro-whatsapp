/// <reference path="../pb_data/types.d.ts" />

/**
 * TEMPORÁRIO (v0.0.107) — Self-test one-shot da regra de vigência com
 * fronteira inclusiva, via API REAL (login HTTP + POST autenticado na rota
 * /backend/v1/admin/billing/plans). Roda a cada minuto até ser removido e
 * persiste o resultado em proactive_logs (kind='vigencia_selftest').
 * Este arquivo é REMOVIDO antes do commit; a rota GET
 * /backend/v1/admin/billing/test-vigencia (permanente, no billing_stripe.js)
 * reproduz o mesmo teste sob demanda autenticada.
 */
cronAdd('vigencia_selftest', '* * * * *', () => {
  const baseUrl = 'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'
  try {
    const loginRes = $http.send({
      url: baseUrl + '/api/collections/users/auth-with-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'test.vigencia@consciente-teste.internal',
        password: 'Vigencia107!Teste',
      }),
      timeout: 30,
    })
    const loginData = loginRes.json || {}
    const token = loginData.token || ''
    if (!token) {
      console.log(
        '[vigencia_selftest] FALHA no login do admin de teste. status=' + loginRes.statusCode,
      )
      return
    }
    console.log('[vigencia_selftest] login OK (status ' + loginRes.statusCode + ').')

    function inlinePostPlan(nome, payload) {
      const res = $http.send({
        url: baseUrl + '/backend/v1/admin/billing/plans',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
        timeout: 30,
      })
      const body = res.json || {}
      const linha =
        nome +
        ' => status=' +
        res.statusCode +
        ' | success=' +
        (body.success === true) +
        ' | erro=' +
        String(body.error || body.message || '')
      console.log('[vigencia_selftest] ' + linha)
      return linha
    }

    const resultados = []
    resultados.push(
      inlinePostPlan('CENARIO 1 mensal fronteira 30/11/2026 (deve 400)', {
        plan_type: 'mensal',
        name: 'TESTE fronteira mensal (auto-removido)',
        price_cents: 1,
        valid_from: '2026-11-30',
        valid_until: '2026-12-31',
        active: true,
      }),
    )
    resultados.push(
      inlinePostPlan('CENARIO 2 anual fronteira 30/11/2026 (deve 400)', {
        plan_type: 'anual',
        name: 'TESTE fronteira anual (auto-removido)',
        price_cents: 1,
        valid_from: '2026-11-30',
        valid_until: '2026-12-31',
        active: true,
      }),
    )
    resultados.push(
      inlinePostPlan('CENARIO 3 mensal 01/02/2027-28/02/2027 (deve 200)', {
        plan_type: 'mensal',
        name: 'TESTE vigencia valida (auto-removido)',
        price_cents: 1,
        valid_from: '2027-02-01',
        valid_until: '2027-02-28',
        active: true,
      }),
    )

    const lixeira = $app.findRecordsByFilter(
      'subscription_plans',
      "notes ~ 'auto-removido'",
      '-created',
      100,
      0,
    )
    let removidos = 0
    for (let i = 0; i < lixeira.length; i++) {
      $app.delete(lixeira[i])
      removidos++
    }
    console.log('[vigencia_selftest] limpeza: ' + removidos + ' registro(s) de teste removido(s).')

    // Persiste o resultado para consulta (db_query) sem depender dos logs.
    const col = $app.findCollectionByNameOrId('proactive_logs')
    const testUser = $app.findFirstRecordByFilter(
      'users',
      "email = 'test.vigencia@consciente-teste.internal'",
      '',
    )
    const rec = new Record(col)
    rec.set('user', testUser.id)
    rec.set('channel', 'whatsapp')
    rec.set('kind', 'vigencia_selftest')
    rec.set('dedupe_key', 'vigencia_selftest_' + new Date().toISOString())
    rec.set('recipient', 'internal')
    rec.set('status', 'sent')
    rec.set('details', JSON.stringify({ resultados: resultados, removidos: removidos }))
    $app.save(rec)
    console.log('[vigencia_selftest] FIM.')
  } catch (err) {
    console.log('[vigencia_selftest] ERRO: ' + err)
  }
})
