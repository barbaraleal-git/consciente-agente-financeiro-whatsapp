/// <reference path="../pb_data/types.d.ts" />
/**
 * proactive_notifications.js — v0.0.101
 *
 * Orquestrador das Notificações Proativas: 3 crons + rotas admin.
 *   - proactive_nightly_reminder : 23h30 UTC (20h30 BRT) — lembrete noturno
 *   - proactive_precharge_email  : 12h00 UTC (09h00 BRT) — aviso pré-cobrança 3d/1d
 *   - proactive_pix_renewal      : 13h30 UTC (10h30 BRT) — aviso renovação Pix 30d/7d
 *   - Rotas admin: /status, /trigger-nightly, /trigger-precharge,
 *                  /trigger-pix-renewal e /test-email
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

cronAdd('proactive_nightly_reminder', '30 23 * * *', () => {
  console.log('[cron:proactive_nightly_reminder] Disparo automático iniciado.')

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e) {
    console.log('[cron:proactive_nightly_reminder] Falha ao resolver engine: ' + e)
  }
  if (!localEngine || typeof localEngine.runNightlyReminderJob !== 'function') {
    console.log('[cron:proactive_nightly_reminder] engine indisponível — job abortado.')
    return
  }

  try {
    var jobRes = localEngine.runNightlyReminderJob('', false)
    console.log('[cron:proactive_nightly_reminder] Concluído: ' + JSON.stringify(jobRes))
  } catch (jobErr) {
    console.log('[cron:proactive_nightly_reminder] Erro na execução: ' + jobErr)
  }
})

cronAdd('proactive_precharge_email', '0 12 * * *', () => {
  console.log('[cron:proactive_precharge_email] Disparo automático iniciado.')

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e) {
    console.log('[cron:proactive_precharge_email] Falha ao resolver engine: ' + e)
  }
  if (!localEngine || typeof localEngine.runPrechargeEmailJob !== 'function') {
    console.log('[cron:proactive_precharge_email] engine indisponível — job abortado.')
    return
  }

  try {
    var jobRes = localEngine.runPrechargeEmailJob(false)
    console.log('[cron:proactive_precharge_email] Concluído: ' + JSON.stringify(jobRes))
  } catch (jobErr) {
    console.log('[cron:proactive_precharge_email] Erro na execução: ' + jobErr)
  }
})

cronAdd('proactive_pix_renewal', '30 13 * * *', () => {
  console.log('[cron:proactive_pix_renewal] Disparo automático iniciado.')

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (e) {
    console.log('[cron:proactive_pix_renewal] Falha ao resolver engine: ' + e)
  }
  if (!localEngine || typeof localEngine.runPixRenewalJob !== 'function') {
    console.log('[cron:proactive_pix_renewal] engine indisponível — job abortado.')
    return
  }

  try {
    var jobRes = localEngine.runPixRenewalJob(false)
    console.log('[cron:proactive_pix_renewal] Concluído: ' + JSON.stringify(jobRes))
  } catch (jobErr) {
    console.log('[cron:proactive_pix_renewal] Erro na execução: ' + jobErr)
  }
})

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
  var to = body.to || 'barbara.ferreira.leal@gmail.com'
  var daysAhead = body.days_ahead === 1 ? 1 : 3

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
