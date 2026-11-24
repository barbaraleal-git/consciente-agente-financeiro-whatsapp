/// <reference path="../pb_data/types.d.ts" />

/**
 * proactive_crons.js — v0.0.116
 *
 * Registro dos 3 crons proativos (horários e ids EXATAMENTE como eram antes):
 *   - proactive_nightly_reminder : 30 23 * * * (20h30 BRT) — lembrete noturno
 *   - proactive_precharge_email  : 0 12 * * *  (09h00 BRT) — e-mail pré-cobrança 3d/1d (anual recorrente 7d/1d)
 *   - proactive_pix_renewal      : 30 13 * * * (10h30 BRT) — aviso renovação Pix 30d/7d
 *
 * v0.0.116 — CORREÇÃO do aborto "engine indisponível — job abortado": os crons
 * viviam em proactive_notifications.js e resolviam a engine SÓ via
 * globalThis.__proactiveEngine (publicado por proactive_notifications_engine.js).
 * A JSVM do PocketBase NÃO compartilha o globalThis de forma confiável entre
 * módulos/hooks em todos os pools de VM (mesma família do bug
 * "Object has no member '__vigenciaCobertura'" corrigido na v0.0.115) — quando o
 * pool que disparava o cron não tinha carregado a engine, o job abortava sem
 * enviar nada. Padrão aplicado (o mesmo da v0.0.116 na rota de planos):
 * resolução DEFENSIVA (typeof + try) + FALLBACK 100% INLINE com a MESMA lógica
 * da engine. Fonte única da lógica segue sendo proactive_notifications_engine.js
 * (usada quando o pool a carregou); o fallback inline existe para o job NUNCA
 * mais abortar por ordem de carregamento.
 *
 * Regras JSVM respeitadas: nada de require() em callbacks; toda variável usada
 * fora de um try é declarada com var ANTES do bloco; lógica 100% inline no
 * corpo do callback. Por isso este arquivo é grande e autocontido: callbacks de
 * cronAdd não enxergam declarações de NENHUM outro arquivo (nem do próprio).
 */

cronAdd('proactive_nightly_reminder', '30 23 * * *', () => {
  console.log('[cron:proactive_nightly_reminder] Disparo automático iniciado.')

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (localResolveErr) {
    console.log(
      '[cron:proactive_nightly_reminder] globalThis.__proactiveEngine indisponível (' +
        localResolveErr +
        ') — usando fallback inline v0.0.116.',
    )
  }

  // ---------------------------------------------------------------
  // FALLBACK 100% INLINE (v0.0.116) — MESMA lógica da engine
  // (proactive_notifications_engine.js: sendMetaProactiveMessage,
  // isUserEligibleForProactive e runNightlyReminderJob).
  // ---------------------------------------------------------------
  var localFallbackSendWhats = function (toNumber, firstName, templateTextFallback) {
    var fbCleanTo = String(toNumber || '').replace(/\D/g, '')
    if (!fbCleanTo) return { success: false, error: 'Número de telefone inválido' }

    var fbActivePhoneId = '1314873981716321'
    var fbToken = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''

    try {
      var fbWsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
      for (var fbW = 0; fbW < fbWsList.length; fbW++) {
        var fbRec = fbWsList[fbW]
        if (fbRec.getString('phone_number_id')) {
          fbActivePhoneId = fbRec.getString('phone_number_id')
        }
        var fbRecToken = fbRec.getString('access_token')
        if (fbRecToken && !fbToken) {
          fbToken = fbRecToken
        }
        if (fbRecToken) break
      }
    } catch (fbWsErr) {
      console.log('[proactive][fallback] Erro ao buscar whatsapp_status: ' + fbWsErr)
    }

    if (!fbToken) {
      return { success: false, error: 'Token da Meta ausente em whatsapp_status' }
    }

    var fbEndpoint = 'https://graph.facebook.com/v21.0/' + fbActivePhoneId + '/messages'
    var fbSafeName = firstName || 'amigo(a)'
    var fbTemplatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: fbCleanTo,
      type: 'template',
      template: {
        name: 'consciente_lembrete_noturno_v1',
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: fbSafeName }] }],
      },
    }

    var fbRes = null
    var fbUsedMode = 'template'
    try {
      fbRes = $http.send({
        url: fbEndpoint,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + fbToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fbTemplatePayload),
        timeout: 30,
      })
    } catch (fbHttpErr) {
      return {
        success: false,
        error:
          'Exceção $http.send (template): ' +
          (fbHttpErr ? fbHttpErr.message || String(fbHttpErr) : ''),
      }
    }

    var fbStatusCode = fbRes.statusCode
    var fbRawBody = fbRes.body || ''
    var fbResponseJson = {}
    try {
      fbResponseJson = JSON.parse(fbRawBody)
    } catch (_) {
      fbResponseJson = { raw: fbRawBody }
    }

    var fbMetaErr = fbResponseJson.error || {}
    var fbMetaCode = fbMetaErr.code
    if (
      fbStatusCode >= 400 &&
      (fbMetaCode === 132001 || /template/i.test(fbMetaErr.message || '') || fbMetaCode === 100)
    ) {
      console.log(
        '[proactive][fallback] Template consciente_lembrete_noturno_v1 não aprovado na Meta ainda (code ' +
          fbMetaCode +
          '). Tentando fallback texto livre...',
      )
      var fbTextBody =
        templateTextFallback ||
        'Oi, ' +
          fbSafeName +
          '! Passando rapidinho para saber se está tudo bem por aí. Notei que você não lançou nenhum gasto hoje. Foi um dia sem despesas ou quer aproveitar para anotar agora? É só me mandar por aqui! 🌙✨'

      var fbTextPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: fbCleanTo,
        type: 'text',
        text: { preview_url: false, body: fbTextBody },
      }

      try {
        var fbResText = $http.send({
          url: fbEndpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + fbToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fbTextPayload),
          timeout: 30,
        })
        fbStatusCode = fbResText.statusCode
        fbRawBody = fbResText.body || ''
        try {
          fbResponseJson = JSON.parse(fbRawBody)
        } catch (_) {
          fbResponseJson = { raw: fbRawBody }
        }
        fbUsedMode = 'text_fallback'
      } catch (fbFbErr) {
        return { success: false, error: 'Erro no fallback texto: ' + String(fbFbErr) }
      }
    }

    if (fbStatusCode >= 200 && fbStatusCode < 300) {
      var fbMsgId =
        fbResponseJson.messages && fbResponseJson.messages[0] ? fbResponseJson.messages[0].id : null
      return {
        success: true,
        mode: fbUsedMode,
        message_id: fbMsgId,
        status_code: fbStatusCode,
        data: fbResponseJson,
      }
    }

    return {
      success: false,
      mode: fbUsedMode,
      status_code: fbStatusCode,
      error:
        (fbResponseJson.error && fbResponseJson.error.message) ||
        fbRawBody ||
        'HTTP ' + fbStatusCode,
      meta_code: fbResponseJson.error && fbResponseJson.error.code,
    }
  }

  var localFallbackRunJob = function (targetDateStr, dryRun) {
    var fbTodayStr = targetDateStr || ''
    if (!fbTodayStr) {
      var fbNow = new Date()
      var fbBrt = new Date(fbNow.getTime() - 3 * 60 * 60 * 1000)
      fbTodayStr =
        fbBrt.getUTCFullYear() +
        '-' +
        String(fbBrt.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(fbBrt.getUTCDate()).padStart(2, '0')
    }

    var fbResults = {
      target_date: fbTodayStr,
      dry_run: !!dryRun,
      candidates: 0,
      eligible: 0,
      already_sent: 0,
      has_spending: 0,
      sent_success: 0,
      sent_failed: 0,
      details: [],
    }

    console.log(
      '[proactive][fallback] Iniciando Lembrete Noturno para data ' +
        fbTodayStr +
        ' (dryRun=' +
        dryRun +
        ')',
    )

    var fbContacts = []
    try {
      fbContacts = $app.findRecordsByFilter('whatsapp_contacts', "user != ''", '-created', 1000, 0)
    } catch (fbContactsErr) {
      console.log('[proactive][fallback] Erro ao buscar whatsapp_contacts: ' + fbContactsErr)
      return fbResults
    }

    fbResults.candidates = fbContacts.length

    for (var fbI = 0; fbI < fbContacts.length; fbI++) {
      var fbContact = fbContacts[fbI]
      var fbUserId = fbContact.getString('user')
      var fbPhone = fbContact.getString('phone_number')

      if (!fbUserId || !fbPhone) continue

      var fbUserRec = null
      try {
        fbUserRec = $app.findRecordById('_pb_users_auth_', fbUserId)
      } catch (_) {}

      if (!fbUserRec) continue

      // isUserEligibleForProactive (cópia inline da engine)
      var fbEligible = false
      var fbEligibleReason = ''
      var fbUserEmail = fbUserRec.getString('email') || ''
      var fbSubStatus = fbUserRec.getString('subscription_status') || 'trial'
      var fbAccessUntil = fbUserRec.getString('access_until') || ''
      var fbCarenciaUntil = fbUserRec.getString('carencia_until') || ''
      var fbNowMs = Date.now()

      if (fbUserEmail === 'whatsapp-visitante@agente.internal') {
        fbEligibleReason = 'conta_visitante'
      } else if (fbSubStatus === 'active' || fbSubStatus === 'trial') {
        fbEligible = true
        fbEligibleReason = 'status_' + fbSubStatus
      } else if (fbSubStatus === 'cancelado') {
        if (fbAccessUntil && new Date(fbAccessUntil).getTime() > fbNowMs) {
          fbEligible = true
          fbEligibleReason = 'cancelado_com_vigencia'
        } else {
          fbEligibleReason = 'cancelado_sem_vigencia'
        }
      } else if (fbSubStatus === 'carencia') {
        if (fbCarenciaUntil && new Date(fbCarenciaUntil).getTime() > fbNowMs) {
          fbEligible = true
          fbEligibleReason = 'carencia_vigente'
        } else {
          fbEligibleReason = 'carencia_expirada'
        }
      } else {
        fbEligibleReason = 'status_' + fbSubStatus
      }

      if (!fbEligible) {
        fbResults.details.push({
          user_id: fbUserId,
          phone: fbPhone,
          status: 'skipped',
          reason: fbEligibleReason,
        })
        continue
      }

      fbResults.eligible++

      var fbDedupeKey = 'nightly:' + fbUserId + ':' + fbTodayStr
      var fbExistingLog = null
      try {
        fbExistingLog = $app.findFirstRecordByData('proactive_logs', 'dedupe_key', fbDedupeKey)
      } catch (_) {}

      if (fbExistingLog && fbExistingLog.getString('status') === 'sent') {
        fbResults.already_sent++
        fbResults.details.push({
          user_id: fbUserId,
          phone: fbPhone,
          status: 'already_sent',
        })
        continue
      }

      var fbHasExpenseToday = false
      try {
        var fbFilterExpr =
          "owner = '" +
          fbUserId +
          "' && type = 'despesa' && (status = 'active' || status = '') && date ~ '" +
          fbTodayStr +
          "'"
        var fbTxs = $app.findRecordsByFilter('transactions', fbFilterExpr, '-created', 1, 0)
        if (fbTxs && fbTxs.length > 0) {
          fbHasExpenseToday = true
        }
      } catch (fbTxErr) {
        console.log(
          '[proactive][fallback] Erro ao verificar transações do usuário ' +
            fbUserId +
            ': ' +
            fbTxErr,
        )
      }

      if (fbHasExpenseToday) {
        fbResults.has_spending++
        fbResults.details.push({
          user_id: fbUserId,
          phone: fbPhone,
          status: 'has_spending',
        })
        continue
      }

      var fbClientName =
        fbContact.getString('name') ||
        fbUserRec.getString('name') ||
        fbUserRec.getString('full_name') ||
        ''
      var fbFirstName = fbClientName.trim().split(/\s+/)[0] || 'amigo(a)'

      if (dryRun) {
        fbResults.details.push({
          user_id: fbUserId,
          phone: fbPhone,
          first_name: fbFirstName,
          status: 'dry_run_candidate',
        })
        continue
      }

      var fbSendRes = localFallbackSendWhats(fbPhone, fbFirstName)
      var fbLogCol = $app.findCollectionByNameOrId('proactive_logs')
      var fbLogRec = fbExistingLog || new Record(fbLogCol)

      fbLogRec.set('user', fbUserId)
      fbLogRec.set('channel', 'whatsapp')
      fbLogRec.set('kind', 'nightly_reminder')
      fbLogRec.set('dedupe_key', fbDedupeKey)
      fbLogRec.set('recipient', fbPhone)
      fbLogRec.set('status', fbSendRes.success ? 'sent' : 'failed')
      fbLogRec.set('error', fbSendRes.success ? '' : String(fbSendRes.error || '').slice(0, 500))
      fbLogRec.set('details', {
        meta_response: fbSendRes,
        first_name: fbFirstName,
        date: fbTodayStr,
        mode: fbSendRes.mode,
      })

      try {
        $app.save(fbLogRec)
      } catch (fbSaveErr) {
        console.log('[proactive][fallback] Erro ao salvar proactive_logs: ' + fbSaveErr)
      }

      if (fbSendRes.success) {
        fbResults.sent_success++
        fbResults.details.push({
          user_id: fbUserId,
          phone: fbPhone,
          status: 'sent',
          mode: fbSendRes.mode,
          msg_id: fbSendRes.message_id,
        })
      } else {
        fbResults.sent_failed++
        fbResults.details.push({
          user_id: fbUserId,
          phone: fbPhone,
          status: 'failed',
          error: fbSendRes.error,
          meta_code: fbSendRes.meta_code,
        })
      }
    }

    console.log(
      '[proactive][fallback] Lembrete Noturno concluído: enviados=' +
        fbResults.sent_success +
        ', falhas=' +
        fbResults.sent_failed +
        ', já tinham gasto=' +
        fbResults.has_spending,
    )

    return fbResults
  }

  var localRunJob = null
  if (localEngine && typeof localEngine.runNightlyReminderJob === 'function') {
    localRunJob = localEngine.runNightlyReminderJob
  }
  if (!localRunJob) {
    localRunJob = localFallbackRunJob
    console.log(
      '[cron:proactive_nightly_reminder] engine não carregada neste pool — executando fallback inline v0.0.116 (mesma lógica).',
    )
  }

  try {
    var jobRes = localRunJob('', false)
    console.log('[cron:proactive_nightly_reminder] Concluído: ' + JSON.stringify(jobRes))
  } catch (jobErr) {
    console.log(
      '[cron:proactive_nightly_reminder] Engine falhou (' +
        jobErr +
        ') — tentando fallback inline v0.0.116.',
    )
    try {
      var jobResFb = localFallbackRunJob('', false)
      console.log(
        '[cron:proactive_nightly_reminder] Fallback inline concluído: ' + JSON.stringify(jobResFb),
      )
    } catch (fbJobErr) {
      console.log(
        '[cron:proactive_nightly_reminder] Erro na execução (engine e fallback): ' +
          jobErr +
          ' / ' +
          fbJobErr,
      )
    }
  }
})

cronAdd('proactive_precharge_email', '0 12 * * *', () => {
  console.log('[cron:proactive_precharge_email] Disparo automático iniciado.')

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (localResolveErr) {
    console.log(
      '[cron:proactive_precharge_email] globalThis.__proactiveEngine indisponível (' +
        localResolveErr +
        ') — usando fallback inline v0.0.116.',
    )
  }

  // ---------------------------------------------------------------
  // FALLBACK 100% INLINE (v0.0.116) — MESMA lógica da engine
  // (runPrechargeEmailJob + sendPrechargeEmail + buildPrechargeEmailHtml).
  // ---------------------------------------------------------------
  var localFallbackRunJob = function (dryRun) {
    var fbResults = {
      dry_run: !!dryRun,
      candidates: 0,
      recurring_active: 0,
      window_3d: 0,
      window_7d: 0,
      window_1d: 0,
      already_sent: 0,
      sent_success: 0,
      sent_failed: 0,
      skipped: 0,
      details: [],
    }

    console.log(
      '[proactive][fallback] Iniciando Job de E-mail Pré-Cobrança (dryRun=' + dryRun + ')',
    )

    var fbUsers = []
    try {
      fbUsers = $app.findRecordsByFilter(
        '_pb_users_auth_',
        "subscription_status = 'active'",
        '-created',
        500,
        0,
      )
    } catch (fbUsersErr) {
      console.log('[proactive][fallback] Erro ao buscar usuários ativos: ' + fbUsersErr)
      return fbResults
    }

    fbResults.candidates = fbUsers.length
    var fbNowMs = Date.now()

    for (var fbI = 0; fbI < fbUsers.length; fbI++) {
      var fbU = fbUsers[fbI]
      var fbUserId = fbU.id
      var fbUserEmail = fbU.getString('email') || ''
      var fbSubId = fbU.getString('stripe_subscription_id') || ''
      var fbPlan = fbU.getString('subscription_plan') || 'mensal'

      if (!fbSubId) {
        fbResults.skipped++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'skipped_no_active_stripe_subscription',
          plan: fbPlan,
        })
        continue
      }

      fbResults.recurring_active++

      var fbExpiresAt = fbU.getString('subscription_expires_at') || ''
      if (!fbExpiresAt) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'skipped_no_expiry_date',
        })
        continue
      }

      var fbExpMs = new Date(fbExpiresAt).getTime()
      if (isNaN(fbExpMs) || fbExpMs < fbNowMs) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'skipped_expired_or_invalid_date',
          expires_at: fbExpiresAt,
        })
        continue
      }

      var fbDiffHours = (fbExpMs - fbNowMs) / (1000 * 60 * 60)
      var fbDiffDays = fbDiffHours / 24

      var fbWindow3dDays = fbPlan === 'anual' ? 7 : 3

      var fbKind = null
      var fbDaysAhead = 0

      if (fbDiffDays >= fbWindow3dDays - 1.0 && fbDiffDays <= fbWindow3dDays + 0.5) {
        fbKind = 'precharge_' + fbWindow3dDays + 'd'
        fbDaysAhead = fbWindow3dDays
        if (fbPlan === 'anual') {
          fbResults.window_7d++
        } else {
          fbResults.window_3d++
        }
      } else if (fbDiffDays >= 0.5 && fbDiffDays <= 1.5) {
        fbKind = 'precharge_1d'
        fbDaysAhead = 1
        fbResults.window_1d++
      }

      if (!fbKind) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'outside_window',
          diff_days: Number(fbDiffDays.toFixed(2)),
          expires_at: fbExpiresAt,
        })
        continue
      }

      // formatDateBrt (cópia inline da engine)
      var fbChargeDateFormatted = ''
      try {
        var fbExpDate = new Date(fbExpiresAt)
        fbChargeDateFormatted =
          String(fbExpDate.getUTCDate()).padStart(2, '0') +
          '/' +
          String(fbExpDate.getUTCMonth() + 1).padStart(2, '0') +
          '/' +
          fbExpDate.getUTCFullYear()
      } catch (_) {
        fbChargeDateFormatted = String(fbExpiresAt).slice(0, 10)
      }

      var fbDedupeDateKey = fbChargeDateFormatted.replace(/\//g, '-')
      var fbDedupeKey = fbKind + ':' + fbUserId + ':' + fbDedupeDateKey

      var fbExistingLog = null
      try {
        fbExistingLog = $app.findFirstRecordByData('proactive_logs', 'dedupe_key', fbDedupeKey)
      } catch (_) {}

      if (fbExistingLog && fbExistingLog.getString('status') === 'sent') {
        fbResults.already_sent++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          kind: fbKind,
          status: 'already_sent',
        })
        continue
      }

      var fbClientName = fbU.getString('name') || fbU.getString('full_name') || ''

      if (dryRun) {
        fbResults.sent_success++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          kind: fbKind,
          charge_date: fbChargeDateFormatted,
          status: 'dry_run_candidate',
        })
        continue
      }

      var fbIsAnualRec = fbPlan === 'anual'
      var fbAmountCents = fbIsAnualRec ? 21490 : 1990
      var fbPlanLabel = fbIsAnualRec ? 'Plano Anual Recorrente' : 'Plano Mensal Recorrente'

      // sendPrechargeEmail + buildPrechargeEmailHtml (cópias inline da engine)
      var fbEmailRes = { success: false, error: 'não inicializado' }
      if (!fbUserEmail || fbUserEmail.indexOf('@') === -1) {
        fbEmailRes = { success: false, error: 'E-mail de destinatário inválido' }
      } else {
        var fbSubject =
          fbDaysAhead === 1
            ? 'Amanhã: renovação da sua assinatura Consciente'
            : 'Aviso: renovação da sua assinatura Consciente em ' + fbDaysAhead + ' dias'

        var fbValFormatted =
          fbAmountCents && fbAmountCents > 0
            ? 'R$ ' + (fbAmountCents / 100).toFixed(2).replace('.', ',')
            : 'R$ 19,90'
        var fbTimeLabel = fbDaysAhead === 1 ? 'amanhã' : 'em ' + fbDaysAhead + ' dias'
        var fbSafeName = fbClientName || 'Cliente'

        var fbHtmlBody = [
          '<!DOCTYPE html>',
          '<html lang="pt-BR"><head><meta charset="utf-8" />',
          '<title>Aviso da sua próxima mensalidade Consciente</title>',
          "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#F8F3E3;color:#1E4A5A;margin:0;padding:24px;}.card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E7DFC9;box-shadow:0 6px 18px rgba(30,74,90,0.10);}.brand{margin-bottom:24px;text-align:center;}.title{font-size:18px;font-weight:600;color:#1E4A5A;margin-bottom:16px;}.p{font-size:15px;line-height:1.6;color:#33475A;margin-bottom:16px;}.info-box{background:#F8F3E3;border:1px solid #E7DFC9;border-radius:8px;padding:16px;margin:20px 0;}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px dashed #D8CDB2;}.info-row:last-child{border-bottom:none;font-weight:600;color:#2A5F6E;}.btn{display:inline-block;background-color:#2A5F6E;color:#fff !important;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:12px;}.footer{font-size:12px;color:#8A94A0;margin-top:32px;border-top:1px solid #E7DFC9;padding-top:16px;text-align:center;}.tagline{font-size:12px;color:#1E4A5A;font-weight:600;margin:0 0 4px 0;}</style>",
          '</head><body><div class="card">',
          '<div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>',
          '<div class="title">' +
            (fbPlanLabel === 'Plano Anual Recorrente'
              ? 'Sua próxima anuidade vence'
              : 'Sua próxima mensalidade vence') +
            ' ' +
            fbTimeLabel +
            '</div>',
          '<p class="p">Olá, <strong>' + fbSafeName + '</strong>!</p>',
          '<p class="p">Estamos passando com transparência para avisar que a renovação da sua assinatura do Consciente será processada <strong>' +
            fbTimeLabel +
            '</strong>, no dia <strong>' +
            fbChargeDateFormatted +
            '</strong>.</p>',
          '<div class="info-box">',
          '<div class="info-row"><span>Plano:</span><span>' + fbPlanLabel + '</span></div>',
          '<div class="info-row"><span>Data prevista:</span><span>' +
            fbChargeDateFormatted +
            '</span></div>',
          '<div class="info-row"><span>Valor:</span><span>' + fbValFormatted + '</span></div>',
          '</div>',
          '<p class="p">Nenhuma ação é necessária da sua parte caso deseje continuar cuidando do seu dinheiro e registrando seus gastos pelo WhatsApp com a gente.</p>',
          '<p class="p">Se precisar atualizar seu cartão ou conferir os detalhes da sua conta, basta acessar seu painel no link abaixo:</p>',
          '<div style="text-align: center; margin: 24px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Acessar Minha Conta</a></div>',
          '<p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>',
          '<div class="footer"><p class="tagline">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso transparente porque possui uma assinatura ativa no Consciente.</div>',
          '</div></body></html>',
        ].join('')

        var fbSenderAddr = 'suporte@agente-financeiro-whatsapp-37fd3.goskip.app'
        var fbSenderName = 'Consciente'
        try {
          var fbSettings = $app.settings()
          if (fbSettings && fbSettings.meta) {
            if (fbSettings.meta.senderAddress) fbSenderAddr = fbSettings.meta.senderAddress
            if (fbSettings.meta.senderName) fbSenderName = fbSettings.meta.senderName
          }
        } catch (_) {}

        try {
          var fbMsg = new MailerMessage({
            from: { address: fbSenderAddr, name: fbSenderName },
            to: [{ address: fbUserEmail }],
            subject: fbSubject,
            html: fbHtmlBody,
          })
          $app.newMailClient().send(fbMsg)
          console.log(
            '[proactive][fallback] precharge ENVIADO -> to=' +
              fbUserEmail +
              ' subject="' +
              fbSubject +
              '"',
          )
          fbEmailRes = { success: true, to: fbUserEmail, subject: fbSubject }
        } catch (fbMailErr) {
          console.log(
            '[proactive][fallback] precharge FALHOU -> to=' + fbUserEmail + ' erro=' + fbMailErr,
          )
          fbEmailRes = { success: false, error: String(fbMailErr) }
        }
      }

      var fbLogCol = $app.findCollectionByNameOrId('proactive_logs')
      var fbLogRec = fbExistingLog || new Record(fbLogCol)

      fbLogRec.set('user', fbUserId)
      fbLogRec.set('channel', 'email')
      fbLogRec.set('kind', fbKind)
      fbLogRec.set('dedupe_key', fbDedupeKey)
      fbLogRec.set('recipient', fbUserEmail)
      fbLogRec.set('status', fbEmailRes.success ? 'sent' : 'failed')
      fbLogRec.set('error', fbEmailRes.success ? '' : String(fbEmailRes.error || '').slice(0, 500))
      fbLogRec.set('details', {
        days_ahead: fbDaysAhead,
        charge_date: fbChargeDateFormatted,
        expires_at: fbExpiresAt,
        diff_days: fbDiffDays,
        send_result: fbEmailRes,
      })

      try {
        $app.save(fbLogRec)
      } catch (fbSaveErr) {
        console.log('[proactive][fallback] Erro ao salvar proactive_logs (email): ' + fbSaveErr)
      }

      if (fbEmailRes.success) {
        fbResults.sent_success++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          kind: fbKind,
          status: 'sent',
        })
      } else {
        fbResults.sent_failed++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          kind: fbKind,
          status: 'failed',
          error: fbEmailRes.error,
        })
      }
    }

    console.log(
      '[proactive][fallback] Job de Pré-Cobrança concluído: enviados=' +
        fbResults.sent_success +
        ', falhas=' +
        fbResults.sent_failed +
        ', 3d=' +
        fbResults.window_3d +
        ', 1d=' +
        fbResults.window_1d,
    )

    return fbResults
  }

  var localRunJob = null
  if (localEngine && typeof localEngine.runPrechargeEmailJob === 'function') {
    localRunJob = localEngine.runPrechargeEmailJob
  }
  if (!localRunJob) {
    localRunJob = localFallbackRunJob
    console.log(
      '[cron:proactive_precharge_email] engine não carregada neste pool — executando fallback inline v0.0.116 (mesma lógica).',
    )
  }

  try {
    var jobRes = localRunJob(false)
    console.log('[cron:proactive_precharge_email] Concluído: ' + JSON.stringify(jobRes))
  } catch (jobErr) {
    console.log(
      '[cron:proactive_precharge_email] Engine falhou (' +
        jobErr +
        ') — tentando fallback inline v0.0.116.',
    )
    try {
      var jobResFb = localFallbackRunJob(false)
      console.log(
        '[cron:proactive_precharge_email] Fallback inline concluído: ' + JSON.stringify(jobResFb),
      )
    } catch (fbJobErr) {
      console.log(
        '[cron:proactive_precharge_email] Erro na execução (engine e fallback): ' +
          jobErr +
          ' / ' +
          fbJobErr,
      )
    }
  }
})

cronAdd('proactive_pix_renewal', '30 13 * * *', () => {
  console.log('[cron:proactive_pix_renewal] Disparo automático iniciado.')

  var localEngine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      localEngine = globalThis.__proactiveEngine
    }
  } catch (localResolveErr) {
    console.log(
      '[cron:proactive_pix_renewal] globalThis.__proactiveEngine indisponível (' +
        localResolveErr +
        ') — usando fallback inline v0.0.116.',
    )
  }

  // ---------------------------------------------------------------
  // FALLBACK 100% INLINE (v0.0.116) — MESMA lógica da engine
  // (runPixRenewalJob + sendPixRenewalEmail + sendPixRenewalWhatsapp).
  // ---------------------------------------------------------------
  var localFallbackRunJob = function (dryRun) {
    var fbResults = {
      dry_run: !!dryRun,
      candidates: 0,
      eligible_one_time: 0,
      window_30d: 0,
      window_7d: 0,
      already_sent: 0,
      skipped_recurring: 0,
      emails_sent: 0,
      emails_failed: 0,
      whats_sent: 0,
      whats_failed: 0,
      details: [],
    }

    console.log(
      '[proactive][fallback] Iniciando Job de Renovação Pix (30d/7d) (dryRun=' + dryRun + ')',
    )

    var fbUsers = []
    try {
      fbUsers = $app.findRecordsByFilter(
        '_pb_users_auth_',
        "subscription_status = 'active' && subscription_plan = 'anual' && access_until != ''",
        '-created',
        500,
        0,
      )
    } catch (fbUsersErr) {
      console.log('[proactive][fallback] Erro ao buscar usuários one_time: ' + fbUsersErr)
      return fbResults
    }

    fbResults.candidates = fbUsers.length
    var fbNowMs = Date.now()

    for (var fbI = 0; fbI < fbUsers.length; fbI++) {
      var fbU = fbUsers[fbI]
      var fbUserId = fbU.id
      var fbUserEmail = fbU.getString('email') || ''
      var fbSubId = fbU.getString('stripe_subscription_id') || ''
      var fbAccessUntil = fbU.getString('access_until') || ''

      // REGRA BLINDADA (v0.0.95): recorrente NUNCA recebe renovação Pix.
      if (fbSubId) {
        fbResults.skipped_recurring++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'skipped_recurring',
        })
        continue
      }

      if (!fbAccessUntil) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'skipped_no_access_until',
        })
        continue
      }

      var fbExpMs = new Date(fbAccessUntil).getTime()
      if (isNaN(fbExpMs) || fbExpMs < fbNowMs) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'skipped_expired_or_invalid_date',
          access_until: fbAccessUntil,
        })
        continue
      }

      fbResults.eligible_one_time++

      var fbDiffDays = (fbExpMs - fbNowMs) / (1000 * 60 * 60 * 24)

      var fbKind = null
      var fbDaysAhead = 0

      if (fbDiffDays >= 29.25 && fbDiffDays <= 30.75) {
        fbKind = 'renewal_30d'
        fbDaysAhead = 30
        fbResults.window_30d++
      } else if (fbDiffDays >= 6.25 && fbDiffDays <= 7.75) {
        fbKind = 'renewal_7d'
        fbDaysAhead = 7
        fbResults.window_7d++
      }

      if (!fbKind) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          status: 'outside_window',
          diff_days: Number(fbDiffDays.toFixed(2)),
          access_until: fbAccessUntil,
        })
        continue
      }

      // formatDateOnly (cópia inline da engine)
      var fbExpiryFormatted = ''
      try {
        var fbExpDate = new Date(fbAccessUntil)
        fbExpiryFormatted =
          String(fbExpDate.getUTCDate()).padStart(2, '0') +
          '/' +
          String(fbExpDate.getUTCMonth() + 1).padStart(2, '0') +
          '/' +
          fbExpDate.getUTCFullYear()
      } catch (_) {
        fbExpiryFormatted = String(fbAccessUntil).slice(0, 10)
      }

      var fbDedupeDateKey = fbExpiryFormatted.replace(/\//g, '-')
      var fbDedupeEmailKey = fbUserId + ':renewal_' + fbDaysAhead + 'd:email:' + fbDedupeDateKey
      var fbDedupeWhatsKey = fbUserId + ':renewal_' + fbDaysAhead + 'd:whatsapp:' + fbDedupeDateKey

      var fbExistingEmailLog = null
      var fbExistingWhatsLog = null
      try {
        fbExistingEmailLog = $app.findFirstRecordByData(
          'proactive_logs',
          'dedupe_key',
          fbDedupeEmailKey,
        )
      } catch (_) {}
      try {
        fbExistingWhatsLog = $app.findFirstRecordByData(
          'proactive_logs',
          'dedupe_key',
          fbDedupeWhatsKey,
        )
      } catch (_) {}

      var fbEmailAlreadySent =
        fbExistingEmailLog && fbExistingEmailLog.getString('status') === 'sent'
      var fbWhatsAlreadySent =
        fbExistingWhatsLog && fbExistingWhatsLog.getString('status') === 'sent'

      if (fbEmailAlreadySent && fbWhatsAlreadySent) {
        fbResults.already_sent++
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          kind: fbKind,
          status: 'already_sent',
        })
        continue
      }

      var fbClientName = fbU.getString('name') || fbU.getString('full_name') || ''
      var fbFirstName = fbClientName.trim().split(/\s+/)[0] || 'amigo(a)'

      var fbPhone = ''
      try {
        var fbContacts = $app.findRecordsByFilter(
          'whatsapp_contacts',
          "user = '" + fbUserId + "'",
          '-created',
          1,
          0,
        )
        if (fbContacts.length > 0) {
          fbPhone = fbContacts[0].getString('phone_number') || ''
        }
      } catch (_) {}

      if (dryRun) {
        fbResults.details.push({
          user_id: fbUserId,
          email: fbUserEmail,
          phone: fbPhone,
          kind: fbKind,
          expiry: fbExpiryFormatted,
          email_already_sent: !!fbEmailAlreadySent,
          whatsapp_already_sent: !!fbWhatsAlreadySent,
          status: 'dry_run_candidate',
        })
        continue
      }

      var fbLogCol = $app.findCollectionByNameOrId('proactive_logs')

      // --- E-MAIL (sendPixRenewalEmail — cópia inline da engine) ---
      if (!fbEmailAlreadySent) {
        var fbEmailRes = { success: false, error: 'não inicializado' }
        if (!fbUserEmail || fbUserEmail.indexOf('@') === -1) {
          fbEmailRes = { success: false, error: 'E-mail de destinatário inválido' }
        } else {
          var fbSubject =
            fbDaysAhead === 7
              ? 'Faltam 7 dias: renove seu plano anual Consciente'
              : 'Faltam 30 dias: renove seu plano anual Consciente'

          var fbValFormatted = 'R$ 214,90'
          var fbTimeLabel = fbDaysAhead === 7 ? 'em 7 dias' : 'em 30 dias'
          var fbSafeName = fbClientName || 'Cliente'

          var fbHtmlBody = [
            '<!DOCTYPE html>',
            '<html lang="pt-BR"><head><meta charset="utf-8" />',
            '<title>Renovação do seu plano anual Consciente</title>',
            "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#F8F3E3;color:#1E4A5A;margin:0;padding:24px;}.card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E7DFC9;box-shadow:0 6px 18px rgba(30,74,90,0.10);}.brand{margin-bottom:24px;text-align:center;}.title{font-size:18px;font-weight:600;color:#1E4A5A;margin-bottom:16px;}.p{font-size:15px;line-height:1.6;color:#33475A;margin-bottom:16px;}.info-box{background:#FDF1EA;border:1px solid #F2C9B6;border-radius:8px;padding:16px;margin:20px 0;}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px dashed #D8CDB2;}.info-row:last-child{border-bottom:none;font-weight:600;color:#D96B47;}.btn{display:inline-block;background-color:#2A5F6E;color:#fff !important;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:12px;}.footer{font-size:12px;color:#8A94A0;margin-top:32px;border-top:1px solid #E7DFC9;padding-top:16px;text-align:center;}.tagline{font-size:12px;color:#1E4A5A;font-weight:600;margin:0 0 4px 0;}</style>",
            '</head><body><div class="card">',
            '<div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>',
            '<div class="title">Seu plano anual vence ' + fbTimeLabel + '</div>',
            '<p class="p">Olá, <strong>' + fbSafeName + '</strong>!</p>',
            '<p class="p">Você assinou o Consciente com pagamento único via Pix. Seu acesso atual vence <strong>' +
              fbTimeLabel +
              '</strong>, no dia <strong>' +
              fbExpiryFormatted +
              '</strong>.</p>',
            '<div class="info-box">',
            '<div class="info-row"><span>Plano:</span><span>Anual (pagamento único)</span></div>',
            '<div class="info-row"><span>Validade atual:</span><span>' +
              fbExpiryFormatted +
              '</span></div>',
            '<div class="info-row"><span>Renovação à vista:</span><span>' +
              fbValFormatted +
              '</span></div>',
            '</div>',
            '<p class="p">Para continuar acompanhando seus gastos pelo WhatsApp sem interrupção, basta renovar clicando no botão abaixo — por Pix à vista ou assinatura anual recorrente, como preferir.</p>',
            '<div style="text-align: center; margin: 24px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Renovar meu plano</a></div>',
            '<p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>',
            '<div class="footer"><p class="tagline">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso porque seu plano anual à vista está próximo do vencimento.</div>',
            '</div></body></html>',
          ].join('')

          var fbSenderAddr = 'suporte@agente-financeiro-whatsapp-37fd3.goskip.app'
          var fbSenderName = 'Consciente'
          try {
            var fbSettings = $app.settings()
            if (fbSettings && fbSettings.meta) {
              if (fbSettings.meta.senderAddress) fbSenderAddr = fbSettings.meta.senderAddress
              if (fbSettings.meta.senderName) fbSenderName = fbSettings.meta.senderName
            }
          } catch (_) {}

          try {
            var fbMsg = new MailerMessage({
              from: { address: fbSenderAddr, name: fbSenderName },
              to: [{ address: fbUserEmail }],
              subject: fbSubject,
              html: fbHtmlBody,
            })
            $app.newMailClient().send(fbMsg)
            console.log(
              '[proactive][fallback] pix_renewal ENVIADO -> to=' +
                fbUserEmail +
                ' subject="' +
                fbSubject +
                '"',
            )
            fbEmailRes = { success: true, to: fbUserEmail, subject: fbSubject }
          } catch (fbMailErr) {
            console.log(
              '[proactive][fallback] pix_renewal FALHOU -> to=' +
                fbUserEmail +
                ' erro=' +
                fbMailErr,
            )
            fbEmailRes = { success: false, error: String(fbMailErr) }
          }
        }

        var fbEmailLog = fbExistingEmailLog || new Record(fbLogCol)
        fbEmailLog.set('user', fbUserId)
        fbEmailLog.set('channel', 'email')
        fbEmailLog.set('kind', 'renewal_pix_' + fbDaysAhead + 'd')
        fbEmailLog.set('dedupe_key', fbDedupeEmailKey)
        fbEmailLog.set('recipient', fbUserEmail)
        fbEmailLog.set('status', fbEmailRes.success ? 'sent' : 'failed')
        fbEmailLog.set(
          'error',
          fbEmailRes.success ? '' : String(fbEmailRes.error || '').slice(0, 500),
        )
        fbEmailLog.set('details', {
          days_ahead: fbDaysAhead,
          access_until: fbAccessUntil,
          billing_mode: 'one_time',
          send_result: fbEmailRes,
        })
        try {
          $app.save(fbEmailLog)
        } catch (fbSaveErr) {
          console.log(
            '[proactive][fallback] Erro ao salvar proactive_logs (email renovação): ' + fbSaveErr,
          )
        }
        if (fbEmailRes.success) fbResults.emails_sent++
        else fbResults.emails_failed++
      } else {
        fbResults.details.push({
          user_id: fbUserId,
          kind: fbKind,
          channel: 'email',
          status: 'already_sent',
        })
      }

      // --- WHATSAPP (sendPixRenewalWhatsapp — cópia inline da engine) ---
      if (!fbWhatsAlreadySent && fbPhone) {
        var fbText =
          'Oi, ' +
          fbFirstName +
          '! Tudo bem? Passando para lembrar que seu plano anual do Consciente (pagamento único via Pix) vence ' +
          (fbDaysAhead === 7 ? '7 dias' : '30 dias') +
          ', no dia ' +
          fbExpiryFormatted +
          '. Para continuar registrando seus gastos por aqui sem interrupção, é só renovar em Minha Conta: https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura'

        var fbWhatsRes = localFallbackSendWhats(fbPhone, fbFirstName, fbText)

        var fbWhatsLog = fbExistingWhatsLog || new Record(fbLogCol)
        fbWhatsLog.set('user', fbUserId)
        fbWhatsLog.set('channel', 'whatsapp')
        fbWhatsLog.set('kind', 'renewal_pix_' + fbDaysAhead + 'd')
        fbWhatsLog.set('dedupe_key', fbDedupeWhatsKey)
        fbWhatsLog.set('recipient', fbPhone)
        fbWhatsLog.set('status', fbWhatsRes.success ? 'sent' : 'failed')
        fbWhatsLog.set(
          'error',
          fbWhatsRes.success ? '' : String(fbWhatsRes.error || '').slice(0, 500),
        )
        fbWhatsLog.set('details', {
          days_ahead: fbDaysAhead,
          access_until: fbAccessUntil,
          billing_mode: 'one_time',
          mode: fbWhatsRes.mode,
          send_result: fbWhatsRes,
        })
        try {
          $app.save(fbWhatsLog)
        } catch (fbSaveErr2) {
          console.log(
            '[proactive][fallback] Erro ao salvar proactive_logs (whats renovação): ' + fbSaveErr2,
          )
        }
        if (fbWhatsRes.success) fbResults.whats_sent++
        else fbResults.whats_failed++
      } else if (!fbPhone) {
        fbResults.details.push({
          user_id: fbUserId,
          kind: fbKind,
          channel: 'whatsapp',
          status: 'skipped_no_phone',
        })
      } else {
        fbResults.details.push({
          user_id: fbUserId,
          kind: fbKind,
          channel: 'whatsapp',
          status: 'already_sent',
        })
      }

      fbResults.details.push({
        user_id: fbUserId,
        email: fbUserEmail,
        kind: fbKind,
        status: 'processed',
        email_sent: fbEmailAlreadySent ? 'already' : fbResults.emails_sent,
        whatsapp_sent: fbWhatsAlreadySent ? 'already' : fbResults.whats_sent,
      })
    }

    console.log(
      '[proactive][fallback] Job de Renovação Pix concluído: e-mails=' +
        fbResults.emails_sent +
        ', whats=' +
        fbResults.whats_sent +
        ', 30d=' +
        fbResults.window_30d +
        ', 7d=' +
        fbResults.window_7d,
    )

    return fbResults
  }

  // sendMetaProactiveMessage — cópia inline da engine (usada pelo WhatsApp do
  // fallback de renovação Pix, com fallback texto livre).
  var localFallbackSendWhats = function (toNumber, firstName, templateTextFallback) {
    var fbCleanTo = String(toNumber || '').replace(/\D/g, '')
    if (!fbCleanTo) return { success: false, error: 'Número de telefone inválido' }

    var fbActivePhoneId = '1314873981716321'
    var fbToken = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''

    try {
      var fbWsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
      for (var fbW = 0; fbW < fbWsList.length; fbW++) {
        var fbRec = fbWsList[fbW]
        if (fbRec.getString('phone_number_id')) {
          fbActivePhoneId = fbRec.getString('phone_number_id')
        }
        var fbRecToken = fbRec.getString('access_token')
        if (fbRecToken && !fbToken) {
          fbToken = fbRecToken
        }
        if (fbRecToken) break
      }
    } catch (fbWsErr) {
      console.log('[proactive][fallback] Erro ao buscar whatsapp_status: ' + fbWsErr)
    }

    if (!fbToken) {
      return { success: false, error: 'Token da Meta ausente em whatsapp_status' }
    }

    var fbEndpoint = 'https://graph.facebook.com/v21.0/' + fbActivePhoneId + '/messages'
    var fbSafeName = firstName || 'amigo(a)'
    var fbTemplatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: fbCleanTo,
      type: 'template',
      template: {
        name: 'consciente_lembrete_noturno_v1',
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: fbSafeName }] }],
      },
    }

    var fbRes = null
    var fbUsedMode = 'template'
    try {
      fbRes = $http.send({
        url: fbEndpoint,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + fbToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fbTemplatePayload),
        timeout: 30,
      })
    } catch (fbHttpErr) {
      return {
        success: false,
        error:
          'Exceção $http.send (template): ' +
          (fbHttpErr ? fbHttpErr.message || String(fbHttpErr) : ''),
      }
    }

    var fbStatusCode = fbRes.statusCode
    var fbRawBody = fbRes.body || ''
    var fbResponseJson = {}
    try {
      fbResponseJson = JSON.parse(fbRawBody)
    } catch (_) {
      fbResponseJson = { raw: fbRawBody }
    }

    var fbMetaErr = fbResponseJson.error || {}
    var fbMetaCode = fbMetaErr.code
    if (
      fbStatusCode >= 400 &&
      (fbMetaCode === 132001 || /template/i.test(fbMetaErr.message || '') || fbMetaCode === 100)
    ) {
      var fbTextBody =
        templateTextFallback ||
        'Oi, ' +
          fbSafeName +
          '! Passando rapidinho para saber se está tudo bem por aí. Notei que você não lançou nenhum gasto hoje. Foi um dia sem despesas ou quer aproveitar para anotar agora? É só me mandar por aqui! 🌙✨'

      var fbTextPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: fbCleanTo,
        type: 'text',
        text: { preview_url: false, body: fbTextBody },
      }

      try {
        var fbResText = $http.send({
          url: fbEndpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + fbToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fbTextPayload),
          timeout: 30,
        })
        fbStatusCode = fbResText.statusCode
        fbRawBody = fbResText.body || ''
        try {
          fbResponseJson = JSON.parse(fbRawBody)
        } catch (_) {
          fbResponseJson = { raw: fbRawBody }
        }
        fbUsedMode = 'text_fallback'
      } catch (fbFbErr) {
        return { success: false, error: 'Erro no fallback texto: ' + String(fbFbErr) }
      }
    }

    if (fbStatusCode >= 200 && fbStatusCode < 300) {
      var fbMsgId =
        fbResponseJson.messages && fbResponseJson.messages[0] ? fbResponseJson.messages[0].id : null
      return {
        success: true,
        mode: fbUsedMode,
        message_id: fbMsgId,
        status_code: fbStatusCode,
        data: fbResponseJson,
      }
    }

    return {
      success: false,
      mode: fbUsedMode,
      status_code: fbStatusCode,
      error:
        (fbResponseJson.error && fbResponseJson.error.message) ||
        fbRawBody ||
        'HTTP ' + fbStatusCode,
      meta_code: fbResponseJson.error && fbResponseJson.error.code,
    }
  }

  var localRunJob = null
  if (localEngine && typeof localEngine.runPixRenewalJob === 'function') {
    localRunJob = localEngine.runPixRenewalJob
  }
  if (!localRunJob) {
    localRunJob = localFallbackRunJob
    console.log(
      '[cron:proactive_pix_renewal] engine não carregada neste pool — executando fallback inline v0.0.116 (mesma lógica).',
    )
  }

  try {
    var jobRes = localRunJob(false)
    console.log('[cron:proactive_pix_renewal] Concluído: ' + JSON.stringify(jobRes))
  } catch (jobErr) {
    console.log(
      '[cron:proactive_pix_renewal] Engine falhou (' +
        jobErr +
        ') — tentando fallback inline v0.0.116.',
    )
    try {
      var jobResFb = localFallbackRunJob(false)
      console.log(
        '[cron:proactive_pix_renewal] Fallback inline concluído: ' + JSON.stringify(jobResFb),
      )
    } catch (fbJobErr) {
      console.log(
        '[cron:proactive_pix_renewal] Erro na execução (engine e fallback): ' +
          jobErr +
          ' / ' +
          fbJobErr,
      )
    }
  }
})
