/// <reference path="../pb_data/types.d.ts" />
/**
 * proactive_notifications.js — v0.0.116
 *
 * Rotas admin das Notificações Proativas (auditoria e disparo manual):
 *   - Rotas admin: /status, /trigger-nightly, /trigger-precharge,
 *                  /trigger-pix-renewal e /test-email
 *
 * v0.0.116 — os 3 crons proativos (proactive_nightly_reminder 30 23 * * *,
 * proactive_precharge_email 0 12 * * * e proactive_pix_renewal 30 13 * * *,
 * horários inalterados) MUDARAM para pocketbase/hooks/proactive_crons.js, com
 * resolução defensiva do globalThis + fallback inline (mesma lógica da engine)
 * — correção do aborto "engine indisponível — job abortado". Este arquivo fica
 * SÓ com as rotas admin; nenhum cron é registrado aqui.
 *
 * REGRA DE SCOPING DA JSVM (v0.0.101): callbacks (cronAdd/routerAdd) NÃO têm
 * acesso a NENHUMA declaração top-level — nem de outros módulos, nem do
 * PRÓPRIO arquivo (causa "Hook scoping error" / "GoError: Invalid module").
 * POR ISSO:
 *   1. NADA de require() aqui: além do Invalid module, o empacotador de hooks
 *      interpreta require('nome') como dependência npm e quebra o deploy.
 *   2. NENHUMA função/variável top-level é referenciada dentro dos callbacks:
 *      toda a lógica de cada job é 100% inline no corpo do callback, e a
 *      engine é resolvida lendo globalThis.__proactiveEngine (publicado pela
 *      engine no boot dela — padrão do projeto, ver reliability_helper.js).
 *   3. Variáveis locais são declaradas com var ANTES de blocos try
 *      (padrão localXxx — bugs v0.0.66/v0.0.91 da JSVM).
 *
 * API da engine:
 *   runNightlyReminderJob(targetDateStr, dryRun)
 *   runPrechargeEmailJob(dryRun)
 *   runPixRenewalJob(dryRun)
 *   sendPrechargeEmail(to, name, daysAhead, dateStr, amountCents, planLabel)
 */

// -------------------------------------------------------------
// Rotas admin (auditoria e disparo manual com dry-run)
// Autenticação: role='admin' ou e-mail da dona (padrão admin_backoffice.js).
// Toda verificação é inline — nenhum helper top-level é referenciado aqui.
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/proactive/status', (e) => {
  var authUser = e.auth
  var isAdmin = !!(
    authUser &&
    (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
      authUser.getString('role') === 'admin')
  )
  if (!isAdmin) {
    return e.json(403, { error: 'Acesso restrito a administradores.' })
  }

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e1) {}
  var engineLoaded = !!(localEngine && typeof localEngine.runNightlyReminderJob === 'function')

  var recentLogs = []
  var totalLogs = 0
  try {
    var recs = $app.findRecordsByFilter('proactive_logs', '', '-created', 20, 0)
    totalLogs = $app.countRecords('proactive_logs')
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i]
      recentLogs.push({
        kind: r.getString('kind'),
        channel: r.getString('channel'),
        status: r.getString('status'),
        recipient: r.getString('recipient'),
        dedupe_key: r.getString('dedupe_key'),
        error: r.getString('error'),
        created: r.getString('created'),
      })
    }
  } catch (logErr) {
    console.log('[proactive:status] Erro ao consultar proactive_logs: ' + logErr)
  }

  return e.json(200, {
    version: '0.0.101',
    engine_loaded: engineLoaded,
    engine_source: 'globalThis.__proactiveEngine (publicado pela engine no boot)',
    crons: {
      proactive_nightly_reminder: '30 23 * * * (20h30 BRT)',
      proactive_precharge_email: '0 12 * * * (09h00 BRT)',
      proactive_pix_renewal: '30 13 * * * (10h30 BRT)',
    },
    total_logs: totalLogs,
    recent_logs: recentLogs,
  })
})

routerAdd('POST', '/backend/v1/proactive/trigger-nightly', (e) => {
  var authUser = e.auth
  var isAdmin = !!(
    authUser &&
    (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
      authUser.getString('role') === 'admin')
  )
  if (!isAdmin) {
    return e.json(403, { error: 'Acesso restrito a administradores.' })
  }

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e1) {}
  if (!localEngine || typeof localEngine.runNightlyReminderJob !== 'function') {
    return e.json(500, { error: 'engine proativa indisponível' })
  }

  var body = {}
  try {
    body = e.readBody({}) || {}
  } catch (bErr) {
    body = {}
  }
  var dryRun = body.dry_run === true

  try {
    var jobRes = localEngine.runNightlyReminderJob('', dryRun)
    return e.json(200, jobRes)
  } catch (jobErr) {
    console.log('[proactive:trigger-nightly] Erro: ' + jobErr)
    return e.json(500, { error: 'Erro no job de lembrete noturno: ' + jobErr })
  }
})

routerAdd('POST', '/backend/v1/proactive/trigger-precharge', (e) => {
  var authUser = e.auth
  var isAdmin = !!(
    authUser &&
    (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
      authUser.getString('role') === 'admin')
  )
  if (!isAdmin) {
    return e.json(403, { error: 'Acesso restrito a administradores.' })
  }

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e1) {}
  if (!localEngine || typeof localEngine.runPrechargeEmailJob !== 'function') {
    return e.json(500, { error: 'engine proativa indisponível' })
  }

  var body = {}
  try {
    body = e.readBody({}) || {}
  } catch (bErr) {
    body = {}
  }
  var dryRun = body.dry_run === true

  try {
    var jobRes = localEngine.runPrechargeEmailJob(dryRun)
    return e.json(200, jobRes)
  } catch (jobErr) {
    console.log('[proactive:trigger-precharge] Erro: ' + jobErr)
    return e.json(500, { error: 'Erro no job de pré-cobrança: ' + jobErr })
  }
})

routerAdd('POST', '/backend/v1/proactive/trigger-pix-renewal', (e) => {
  var authUser = e.auth
  var isAdmin = !!(
    authUser &&
    (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
      authUser.getString('role') === 'admin')
  )
  if (!isAdmin) {
    return e.json(403, { error: 'Acesso restrito a administradores.' })
  }

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e1) {}
  if (!localEngine || typeof localEngine.runPixRenewalJob !== 'function') {
    return e.json(500, { error: 'engine proativa indisponível' })
  }

  var body = {}
  try {
    body = e.readBody({}) || {}
  } catch (bErr) {
    body = {}
  }
  var dryRun = body.dry_run === true

  try {
    var jobRes = localEngine.runPixRenewalJob(dryRun)
    return e.json(200, jobRes)
  } catch (jobErr) {
    console.log('[proactive:trigger-pix-renewal] Erro: ' + jobErr)
    return e.json(500, { error: 'Erro no job de renovação Pix: ' + jobErr })
  }
})

routerAdd('POST', '/backend/v1/proactive/test-email', (e) => {
  var authUser = e.auth
  var isAdmin = !!(
    authUser &&
    (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
      authUser.getString('role') === 'admin')
  )
  if (!isAdmin) {
    return e.json(403, { error: 'Acesso restrito a administradores.' })
  }

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e1) {}
  if (!localEngine || typeof localEngine.sendPrechargeEmail !== 'function') {
    return e.json(500, { error: 'engine proativa indisponível' })
  }

  var body = {}
  try {
    body = e.readBody({}) || {}
  } catch (bErr) {
    body = {}
  }

  // v0.0.152: parâmetro "type" para a rodada de branding (v0.0.150/0.0.151) —
  //   'precharge'    (default): e-mail de pré-cobrança recorrente (comportamento atual)
  //   'pix_renewal': e-mail de renovação Pix anual do engine (sendPixRenewalEmail),
  //                  forçado para o endereço informado, sem tocar em dedupe/crons
  //   'system':      e-mail de sistema do módulo mail_branding (redefinição de
  //                  senha) para o próprio usuário admin, gerando token REAL via
  //                  $mails.sendRecordPasswordReset (cai no onMailerRecordPasswordResetSend)
  var emailType = body.type ? String(body.type) : 'precharge'
  var to = body.to || 'barbara.ferreira.leal@gmail.com'
  var daysAhead = body.days_ahead === 1 ? 1 : 3

  if (emailType === 'pix_renewal') {
    if (typeof localEngine.sendPixRenewalEmail !== 'function') {
      return e.json(500, { error: 'sendPixRenewalEmail indisponível na engine proativa' })
    }
    var pixRes = localEngine.sendPixRenewalEmail(
      to,
      'Administração (teste)',
      30,
      '05/12/2026',
      21490,
    )
    return e.json(pixRes && pixRes.success ? 200 : 500, pixRes)
  }

  if (emailType === 'system') {
    var OWNER_EMAIL = 'barbara.ferreira.leal@gmail.com'
    var BACKEND_URL = $os.getenv('PB_INSTANCE_URL') || ''
    var ADMIN_TOKEN = $os.getenv('PB_SUPERUSER_TOKEN') || ''
    if (!BACKEND_URL) {
      return e.json(500, {
        error: 'PB_INSTANCE_URL ausente — não é possível disparar o e-mail de sistema',
      })
    }

    var sysCall = $http.send({
      url: BACKEND_URL.replace(/\/+$/, '') + '/api/collections/users/request-password-reset',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ADMIN_TOKEN,
      },
      body: JSON.stringify({ email: OWNER_EMAIL }),
      timeout: 30,
    })
    var sysOk = sysCall.statusCode >= 200 && sysCall.statusCode < 300
    var sysBodyStr = sysCall.raw || ''
    var sysData = null
    try {
      sysData = sysCall.json || JSON.parse(sysBodyStr)
    } catch (jErr) {
      sysData = null
    }
    console.log(
      '[proactive:test-email] system (request-password-reset) -> status=' +
        sysCall.statusCode +
        ' body=' +
        sysBodyStr.slice(0, 300),
    )
    return e.json(sysOk ? 200 : 502, {
      success: sysOk,
      to: OWNER_EMAIL,
      transport: 'PocketBase request-password-reset (onMailerRecordPasswordResetSend)',
      statusCode: sysCall.statusCode,
      body: sysData,
    })
  }

  var emailRes = localEngine.sendPrechargeEmail(
    to,
    'Administração (teste)',
    daysAhead,
    '01/12/2026',
    1990,
    'Plano Mensal Recorrente',
  )
  return e.json(emailRes && emailRes.success ? 200 : 500, emailRes)
})
