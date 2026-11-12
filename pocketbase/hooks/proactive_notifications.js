// pocketbase/hooks/proactive_notifications.js
/// <reference path="../pb_data/types.d.ts" />

/**
 * Módulo de Notificações Proativas do Consciente:
 * 1. Lembrete Noturno Amigável via WhatsApp (Item 1 / ex-Item 38)
 * 2. E-mail de Aviso Pré-Cobrança (Item 2 / ex-Item 42)
 *
 * Cada callback carrega o engine internamente com require('./proactive_notifications_engine.js')
 * com try/catch e fallback, respeitando o isolamento de escopo da JSVM do PocketBase.
 */

// 1. Lembrete Noturno Amigável: todo dia às 20h30 BRT (23:30 UTC)
cronAdd('proactive_nightly_reminder', '30 23 * * *', () => {
  try {
    console.log('[cron:proactive_nightly_reminder] Disparo automático iniciado.')
    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    if (engine && engine.runNightlyReminderJob) {
      engine.runNightlyReminderJob(null, false)
    }
  } catch (err) {
    console.log('[cron:proactive_nightly_reminder] Erro na execução:', err)
  }
})

// 2. E-mail de Aviso Pré-Cobrança: todo dia às 09h00 BRT (12:00 UTC)
cronAdd('proactive_precharge_email', '0 12 * * *', () => {
  try {
    console.log('[cron:proactive_precharge_email] Disparo automático iniciado.')
    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    if (engine && engine.runPrechargeEmailJob) {
      engine.runPrechargeEmailJob(false)
    }
  } catch (err) {
    console.log('[cron:proactive_precharge_email] Erro na execução:', err)
  }
})

// 3. Aviso de RENOVAÇÃO do plano anual à vista (Pix, one_time): e-mail + WhatsApp
//    30 dias e 7 dias antes da validade. Todo dia às 10h30 BRT (13:30 UTC),
//    logo após o pré-cobrança, para não competir com o job das 09h.
cronAdd('proactive_pix_renewal', '30 13 * * *', () => {
  try {
    console.log('[cron:proactive_pix_renewal] Disparo automático iniciado.')
    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    if (engine && engine.runPixRenewalJob) {
      engine.runPixRenewalJob(false)
    }
  } catch (err) {
    console.log('[cron:proactive_pix_renewal] Erro na execução:', err)
  }
})

// -----------------------------------------------------------------------------
// ROTAS DE DIAGNÓSTICO E DISPARO MANUAL (ADMIN ONLY)
// -----------------------------------------------------------------------------

routerAdd('GET', '/backend/v1/proactive/status', (e) => {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('role') === 'admin' ||
        authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')

    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    const todayStr = engine.getBrtDateStr(new Date())

    let logsCount = 0
    let recentLogs = []
    try {
      recentLogs = $app.findRecordsByFilter('proactive_logs', '', '-created', 10, 0)
      logsCount = recentLogs.length
    } catch (_) {}

    return e.json(200, {
      success: true,
      current_brt_date: todayStr,
      template_info: engine.NIGHTLY_REMINDER_TEMPLATE,
      recent_logs_count: logsCount,
      recent_logs: recentLogs.map((l) => ({
        id: l.id,
        user: l.getString('user'),
        channel: l.getString('channel'),
        kind: l.getString('kind'),
        dedupe_key: l.getString('dedupe_key'),
        status: l.getString('status'),
        created: l.getString('created'),
      })),
      scheduled_crons: [
        {
          id: 'proactive_nightly_reminder',
          schedule: '30 23 * * * (20h30 BRT)',
          description: 'Lembrete noturno de lançamento via WhatsApp',
        },
        {
          id: 'proactive_precharge_email',
          schedule: '0 12 * * * (09h00 BRT)',
          description: 'E-mail de aviso pré-cobrança (3d e 1d antes)',
        },
        {
          id: 'proactive_pix_renewal',
          schedule: '30 13 * * * (10h30 BRT)',
          description: 'Aviso de renovação Pix (one_time) 30d/7d antes da validade',
        },
      ],
    })
  } catch (err) {
    return e.json(500, { error: 'Erro no status proativo: ' + String(err) })
  }
})

routerAdd('POST', '/backend/v1/proactive/trigger-nightly', (e) => {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('role') === 'admin' ||
        authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')

    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const dryRun = body.dry_run !== false && body.dry_run !== 'false'
    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    const targetDate = body.target_date || engine.getBrtDateStr(new Date())

    const res = engine.runNightlyReminderJob(targetDate, dryRun)
    return e.json(200, {
      success: true,
      dry_run: dryRun,
      results: res,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao acionar lembrete noturno: ' + String(err) })
  }
})

routerAdd('POST', '/backend/v1/proactive/trigger-precharge', (e) => {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('role') === 'admin' ||
        authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')

    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const dryRun = body.dry_run !== false && body.dry_run !== 'false'
    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    const res = engine.runPrechargeEmailJob(dryRun)

    return e.json(200, {
      success: true,
      dry_run: dryRun,
      results: res,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao acionar aviso pré-cobrança: ' + String(err) })
  }
})

routerAdd('POST', '/backend/v1/proactive/trigger-pix-renewal', (e) => {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('role') === 'admin' ||
        authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')

    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const dryRun = body.dry_run !== false && body.dry_run !== 'false'
    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    const res = engine.runPixRenewalJob(dryRun)

    return e.json(200, {
      success: true,
      dry_run: dryRun,
      results: res,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao acionar aviso de renovação Pix: ' + String(err) })
  }
})

routerAdd('POST', '/backend/v1/proactive/test-email', (e) => {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('role') === 'admin' ||
        authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')

    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    const engine = require(`${__hooks}/proactive_notifications_engine.js`)
    const targetEmail = body.to || authUser.getString('email') || ''
    const daysAhead = Number(body.days_ahead) === 1 ? 1 : 3
    const chargeDate = body.charge_date || engine.formatDateBrt(new Date().toISOString())

    const sendRes = engine.sendPrechargeEmail(
      targetEmail,
      authUser.getString('name') || 'Administradora Bárbara',
      daysAhead,
      chargeDate,
      1990,
      'Plano Mensal Recorrente',
    )

    return e.json(sendRes.success ? 200 : 500, {
      success: sendRes.success,
      details: sendRes,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro no teste de e-mail: ' + String(err) })
  }
})
