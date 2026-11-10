// pocketbase/hooks/proactive_notifications_engine.js
/// <reference path="../pb_data/types.d.ts" />

/**
 * Motor isolado das Notificações Proativas do Consciente (CommonJS module).
 * Carregado via require('./proactive_notifications_engine.js') dentro dos callbacks da JSVM.
 */

const NIGHTLY_REMINDER_TEMPLATE = {
  name: 'consciente_lembrete_noturno_v1',
  language: 'pt_BR',
  category: 'UTILITY',
  description:
    'Lembrete noturno amigável enviado quando o cliente ativo não registrou nenhum gasto no dia.',
  body_example:
    'Oi, {{1}}! Passando rapidinho para saber se está tudo bem por aí. Notei que você não lançou nenhum gasto hoje. Foi um dia sem despesas ou quer aproveitar para anotar agora? É só me mandar por aqui! 🌙✨',
}

function getBrtDateStr(dateObj) {
  const d = dateObj || new Date()
  const brtTime = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const yyyy = brtTime.getUTCFullYear()
  const mm = String(brtTime.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(brtTime.getUTCDate()).padStart(2, '0')
  return yyyy + '-' + mm + '-' + dd
}

function normalizePhoneDigits(phone) {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '')
}

function isUserEligibleForProactive(userRec) {
  if (!userRec) return { eligible: false, reason: 'usuário nulo' }

  const email = userRec.getString('email') || ''
  if (email === 'whatsapp-visitante@agente.internal') {
    return { eligible: false, reason: 'conta_visitante' }
  }

  const subStatus = userRec.getString('subscription_status') || 'trial'
  const accessUntil = userRec.getString('access_until') || ''
  const carenciaUntil = userRec.getString('carencia_until') || ''
  const nowMs = Date.now()

  if (subStatus === 'active') {
    return { eligible: true, reason: 'status_active' }
  }

  if (subStatus === 'trial') {
    return { eligible: true, reason: 'status_trial' }
  }

  if (subStatus === 'cancelado') {
    if (accessUntil) {
      const accessMs = new Date(accessUntil).getTime()
      if (accessMs > nowMs) {
        return { eligible: true, reason: 'cancelado_com_vigencia' }
      }
    }
    return { eligible: false, reason: 'cancelado_sem_vigencia' }
  }

  if (subStatus === 'carencia') {
    if (carenciaUntil && new Date(carenciaUntil).getTime() > nowMs) {
      return { eligible: true, reason: 'carencia_vigente' }
    }
    return { eligible: false, reason: 'carencia_expirada' }
  }

  return { eligible: false, reason: 'status_' + subStatus }
}

function sendMetaProactiveMessage(toNumber, firstName, templateTextFallback) {
  let cleanTo = normalizePhoneDigits(toNumber)
  if (!cleanTo) return { success: false, error: 'Número de telefone inválido' }

  let activePhoneId = '1314873981716321'
  let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''

  try {
    const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
    for (let idx = 0; idx < wsList.length; idx++) {
      const rec = wsList[idx]
      if (rec.getString('phone_number_id')) {
        activePhoneId = rec.getString('phone_number_id')
      }
      const recToken = rec.getString('access_token')
      if (recToken && !token) {
        token = recToken
      }
      if (recToken) break
    }
  } catch (err) {
    console.log('[proactive] Erro ao buscar whatsapp_status:', err)
  }

  if (!token) {
    return { success: false, error: 'Token da Meta ausente em whatsapp_status' }
  }

  const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
  const safeName = firstName || 'amigo(a)'
  const templatePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'template',
    template: {
      name: NIGHTLY_REMINDER_TEMPLATE.name,
      language: {
        code: NIGHTLY_REMINDER_TEMPLATE.language,
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: safeName,
            },
          ],
        },
      ],
    },
  }

  let res = null
  let usedMode = 'template'
  try {
    res = $http.send({
      url: endpoint,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templatePayload),
      timeout: 30,
    })
  } catch (httpErr) {
    return {
      success: false,
      error:
        'Exceção $http.send (template): ' + (httpErr ? httpErr.message || String(httpErr) : ''),
    }
  }

  let statusCode = res.statusCode
  let rawBody = res.rawText || ''
  let responseJson = {}
  try {
    responseJson = JSON.parse(rawBody)
  } catch (_) {
    responseJson = { raw: rawBody }
  }

  const metaErr = responseJson.error || {}
  const metaCode = metaErr.code
  if (
    statusCode >= 400 &&
    (metaCode === 132001 || /template/i.test(metaErr.message || '') || metaCode === 100)
  ) {
    console.log(
      '[proactive] Template ' +
        NIGHTLY_REMINDER_TEMPLATE.name +
        ' não aprovado na Meta ainda (code ' +
        metaCode +
        '). Tentando fallback texto livre...',
    )
    const textBody =
      templateTextFallback ||
      'Oi, ' +
        safeName +
        '! Passando rapidinho para saber se está tudo bem por aí. Notei que você não lançou nenhum gasto hoje. Foi um dia sem despesas ou quer aproveitar para anotar agora? É só me mandar por aqui! 🌙✨'

    const textPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: textBody,
      },
    }

    try {
      const resText = $http.send({
        url: endpoint,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textPayload),
        timeout: 30,
      })
      statusCode = resText.statusCode
      rawBody = resText.rawText || ''
      try {
        responseJson = JSON.parse(rawBody)
      } catch (_) {
        responseJson = { raw: rawBody }
      }
      usedMode = 'text_fallback'
    } catch (fbErr) {
      return { success: false, error: 'Erro no fallback texto: ' + String(fbErr) }
    }
  }

  if (statusCode >= 200 && statusCode < 300) {
    const msgId =
      responseJson.messages && responseJson.messages[0] ? responseJson.messages[0].id : null
    return {
      success: true,
      mode: usedMode,
      message_id: msgId,
      status_code: statusCode,
      data: responseJson,
    }
  }

  return {
    success: false,
    mode: usedMode,
    status_code: statusCode,
    error: (responseJson.error && responseJson.error.message) || rawBody || 'HTTP ' + statusCode,
    meta_code: responseJson.error && responseJson.error.code,
  }
}

function runNightlyReminderJob(targetDateStr, dryRun) {
  const todayStr = targetDateStr || getBrtDateStr(new Date())
  const results = {
    target_date: todayStr,
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
    '[proactive] Iniciando Lembrete Noturno para data ' + todayStr + ' (dryRun=' + dryRun + ')',
  )

  let contacts = []
  try {
    contacts = $app.findRecordsByFilter('whatsapp_contacts', "user != ''", '-created', 1000, 0)
  } catch (err) {
    console.log('[proactive] Erro ao buscar whatsapp_contacts:', err)
    return results
  }

  results.candidates = contacts.length

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]
    const userId = contact.getString('user')
    const phone = contact.getString('phone_number')

    if (!userId || !phone) continue

    let userRec = null
    try {
      userRec = $app.findRecordById('_pb_users_auth_', userId)
    } catch (_) {}

    if (!userRec) continue

    const elCheck = isUserEligibleForProactive(userRec)
    if (!elCheck.eligible) {
      results.details.push({
        user_id: userId,
        phone: phone,
        status: 'skipped',
        reason: elCheck.reason,
      })
      continue
    }

    results.eligible++

    const dedupeKey = 'nightly:' + userId + ':' + todayStr
    let existingLog = null
    try {
      existingLog = $app.findFirstRecordByData('proactive_logs', 'dedupe_key', dedupeKey)
    } catch (_) {}

    if (existingLog && existingLog.getString('status') === 'sent') {
      results.already_sent++
      results.details.push({
        user_id: userId,
        phone: phone,
        status: 'already_sent',
      })
      continue
    }

    let hasExpenseToday = false
    try {
      const filterExpr =
        "owner = '" +
        userId +
        "' && type = 'despesa' && (status = 'active' || status = '') && date ~ '" +
        todayStr +
        "'"
      const txs = $app.findRecordsByFilter('transactions', filterExpr, '-created', 1, 0)
      if (txs && txs.length > 0) {
        hasExpenseToday = true
      }
    } catch (txErr) {
      console.log('[proactive] Erro ao verificar transações do usuário ' + userId + ':', txErr)
    }

    if (hasExpenseToday) {
      results.has_spending++
      results.details.push({
        user_id: userId,
        phone: phone,
        status: 'has_spending',
      })
      continue
    }

    const clientName =
      contact.getString('name') || userRec.getString('name') || userRec.getString('full_name') || ''
    const firstName = clientName.trim().split(/\s+/)[0] || 'amigo(a)'

    if (dryRun) {
      results.sent_success++
      results.details.push({
        user_id: userId,
        phone: phone,
        first_name: firstName,
        status: 'dry_run_candidate',
      })
      continue
    }

    const sendRes = sendMetaProactiveMessage(phone, firstName)
    const logCol = $app.findCollectionByNameOrId('proactive_logs')
    const logRec = existingLog || new Record(logCol)

    logRec.set('user', userId)
    logRec.set('channel', 'whatsapp')
    logRec.set('kind', 'nightly_reminder')
    logRec.set('dedupe_key', dedupeKey)
    logRec.set('recipient', phone)
    logRec.set('status', sendRes.success ? 'sent' : 'failed')
    logRec.set('error', sendRes.success ? '' : String(sendRes.error || '').slice(0, 500))
    logRec.set('details', {
      meta_response: sendRes,
      first_name: firstName,
      date: todayStr,
      mode: sendRes.mode,
    })

    try {
      $app.save(logRec)
    } catch (saveErr) {
      console.log('[proactive] Erro ao salvar proactive_logs:', saveErr)
    }

    if (sendRes.success) {
      results.sent_success++
      results.details.push({
        user_id: userId,
        phone: phone,
        status: 'sent',
        mode: sendRes.mode,
        msg_id: sendRes.message_id,
      })
    } else {
      results.sent_failed++
      results.details.push({
        user_id: userId,
        phone: phone,
        status: 'failed',
        error: sendRes.error,
        meta_code: sendRes.meta_code,
      })
    }
  }

  console.log(
    '[proactive] Lembrete Noturno concluído: enviados=' +
      results.sent_success +
      ', falhas=' +
      results.sent_failed +
      ', já tinham gasto=' +
      results.has_spending,
  )

  return results
}

function formatDateBrt(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = d.getUTCFullYear()
    return dd + '/' + mm + '/' + yyyy
  } catch (_) {
    return isoStr.slice(0, 10)
  }
}

function buildPrechargeEmailHtml(clientName, daysAhead, chargeDateStr, amountCents, planName) {
  const safeName = clientName || 'Cliente'
  const valFormatted =
    amountCents && amountCents > 0
      ? 'R$ ' + (amountCents / 100).toFixed(2).replace('.', ',')
      : 'R$ 19,90'
  const planLabel = planName || 'Plano Mensal Recorrente'
  const timeLabel = daysAhead === 1 ? 'amanhã' : 'em 3 dias'

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aviso da sua próxima mensalidade Consciente</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .brand { color: #0f766e; font-size: 20px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
    .title { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .p { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 16px; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #cbd5e1; }
    .info-row:last-child { border-bottom: none; font-weight: 600; color: #0f766e; }
    .btn { display: inline-block; background-color: #0f766e; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }
    .footer { font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🌱 Consciente — Finanças Sem Complicação</div>
    <div class="title">Sua próxima mensalidade vence ${timeLabel}</div>
    <p class="p">Olá, <strong>${safeName}</strong>!</p>
    <p class="p">Estamos passando com transparência para avisar que a renovação da sua assinatura do Consciente será processada <strong>${timeLabel}</strong>, no dia <strong>${chargeDateStr}</strong>.</p>
    
    <div class="info-box">
      <div class="info-row"><span>Plano:</span><span>${planLabel}</span></div>
      <div class="info-row"><span>Data prevista:</span><span>${chargeDateStr}</span></div>
      <div class="info-row"><span>Valor:</span><span>${valFormatted}</span></div>
    </div>

    <p class="p">Nenhuma ação é necessária da sua parte caso deseje continuar cuidando do seu dinheiro e registrando seus gastos pelo WhatsApp com a gente.</p>
    <p class="p">Se precisar atualizar seu cartão ou conferir os detalhes da sua conta, basta acessar seu painel no link abaixo:</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Acessar Minha Conta</a>
    </div>

    <p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>

    <div class="footer">
      Consciente • BFL Soluções em Tecnologia LTDA<br />
      Você recebeu este aviso transparente porque possui uma assinatura ativa no Consciente.
    </div>
  </div>
</body>
</html>
  `.trim()
}

function sendPrechargeEmail(toEmail, clientName, daysAhead, chargeDateStr, amountCents, planName) {
  if (!toEmail || toEmail.indexOf('@') === -1) {
    return { success: false, error: 'E-mail de destinatário inválido' }
  }

  const subject =
    daysAhead === 1
      ? 'Amanhã: renovação da sua mensalidade Consciente'
      : 'Aviso: renovação da sua mensalidade Consciente em 3 dias'

  const htmlBody = buildPrechargeEmailHtml(
    clientName,
    daysAhead,
    chargeDateStr,
    amountCents,
    planName,
  )

  let senderAddr = 'suporte@agente-financeiro-whatsapp-37fd3.goskip.app'
  let senderName = 'Consciente'
  try {
    const s = $app.settings()
    if (s && s.meta) {
      if (s.meta.senderAddress) senderAddr = s.meta.senderAddress
      if (s.meta.senderName) senderName = s.meta.senderName
    }
  } catch (_) {}

  try {
    const msg = new MailerMessage({
      from: {
        address: senderAddr,
        name: senderName,
      },
      to: [{ address: toEmail }],
      subject: subject,
      html: htmlBody,
    })

    $app.newMailClient().send(msg)
    return { success: true, to: toEmail, subject: subject }
  } catch (err) {
    console.log('[proactive] Erro no $app.newMailClient().send:', err)
    return { success: false, error: String(err) }
  }
}

function runPrechargeEmailJob(dryRun) {
  const results = {
    dry_run: !!dryRun,
    candidates: 0,
    recurring_active: 0,
    window_3d: 0,
    window_1d: 0,
    already_sent: 0,
    sent_success: 0,
    sent_failed: 0,
    skipped: 0,
    details: [],
  }

  console.log('[proactive] Iniciando Job de E-mail Pré-Cobrança (dryRun=' + dryRun + ')')

  let users = []
  try {
    users = $app.findRecordsByFilter(
      '_pb_users_auth_',
      "subscription_status = 'active'",
      '-created',
      500,
      0,
    )
  } catch (err) {
    console.log('[proactive] Erro ao buscar usuários ativos:', err)
    return results
  }

  results.candidates = users.length
  const nowMs = Date.now()

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    const userId = u.id
    const userEmail = u.getString('email') || ''
    const subId = u.getString('stripe_subscription_id') || ''
    const plan = u.getString('subscription_plan') || 'mensal'

    if (!subId || plan === 'anual') {
      results.skipped++
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'skipped_one_time_or_no_sub',
        plan: plan,
      })
      continue
    }

    results.recurring_active++

    const expiresAt = u.getString('subscription_expires_at') || ''
    if (!expiresAt) {
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'skipped_no_expiry_date',
      })
      continue
    }

    const expDate = new Date(expiresAt)
    const expMs = expDate.getTime()
    if (isNaN(expMs) || expMs < nowMs) {
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'skipped_expired_or_invalid_date',
        expires_at: expiresAt,
      })
      continue
    }

    const diffHours = (expMs - nowMs) / (1000 * 60 * 60)
    const diffDays = diffHours / 24

    let kind = null
    let daysAhead = 0

    if (diffDays >= 2.0 && diffDays <= 3.5) {
      kind = 'precharge_3d'
      daysAhead = 3
      results.window_3d++
    } else if (diffDays >= 0.5 && diffDays <= 1.5) {
      kind = 'precharge_1d'
      daysAhead = 1
      results.window_1d++
    }

    if (!kind) {
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'outside_window',
        diff_days: Number(diffDays.toFixed(2)),
        expires_at: expiresAt,
      })
      continue
    }

    const chargeDateFormatted = formatDateBrt(expiresAt)
    const dedupeDateKey = chargeDateFormatted.replace(/\//g, '-')
    const dedupeKey = kind + ':' + userId + ':' + dedupeDateKey

    let existingLog = null
    try {
      existingLog = $app.findFirstRecordByData('proactive_logs', 'dedupe_key', dedupeKey)
    } catch (_) {}

    if (existingLog && existingLog.getString('status') === 'sent') {
      results.already_sent++
      results.details.push({
        user_id: userId,
        email: userEmail,
        kind: kind,
        status: 'already_sent',
      })
      continue
    }

    const clientName = u.getString('name') || u.getString('full_name') || ''

    if (dryRun) {
      results.sent_success++
      results.details.push({
        user_id: userId,
        email: userEmail,
        kind: kind,
        charge_date: chargeDateFormatted,
        status: 'dry_run_candidate',
      })
      continue
    }

    const sendRes = sendPrechargeEmail(
      userEmail,
      clientName,
      daysAhead,
      chargeDateFormatted,
      1990,
      'Plano Mensal Recorrente',
    )

    const logCol = $app.findCollectionByNameOrId('proactive_logs')
    const logRec = existingLog || new Record(logCol)

    logRec.set('user', userId)
    logRec.set('channel', 'email')
    logRec.set('kind', kind)
    logRec.set('dedupe_key', dedupeKey)
    logRec.set('recipient', userEmail)
    logRec.set('status', sendRes.success ? 'sent' : 'failed')
    logRec.set('error', sendRes.success ? '' : String(sendRes.error || '').slice(0, 500))
    logRec.set('details', {
      days_ahead: daysAhead,
      charge_date: chargeDateFormatted,
      expires_at: expiresAt,
      diff_days: diffDays,
      send_result: sendRes,
    })

    try {
      $app.save(logRec)
    } catch (saveErr) {
      console.log('[proactive] Erro ao salvar proactive_logs (email):', saveErr)
    }

    if (sendRes.success) {
      results.sent_success++
      results.details.push({
        user_id: userId,
        email: userEmail,
        kind: kind,
        status: 'sent',
      })
    } else {
      results.sent_failed++
      results.details.push({
        user_id: userId,
        email: userEmail,
        kind: kind,
        status: 'failed',
        error: sendRes.error,
      })
    }
  }

  console.log(
    '[proactive] Job de Pré-Cobrança concluído: enviados=' +
      results.sent_success +
      ', falhas=' +
      results.sent_failed +
      ', 3d=' +
      results.window_3d +
      ', 1d=' +
      results.window_1d,
  )

  return results
}

module.exports = {
  NIGHTLY_REMINDER_TEMPLATE: NIGHTLY_REMINDER_TEMPLATE,
  getBrtDateStr: getBrtDateStr,
  normalizePhoneDigits: normalizePhoneDigits,
  isUserEligibleForProactive: isUserEligibleForProactive,
  sendMetaProactiveMessage: sendMetaProactiveMessage,
  runNightlyReminderJob: runNightlyReminderJob,
  formatDateBrt: formatDateBrt,
  buildPrechargeEmailHtml: buildPrechargeEmailHtml,
  sendPrechargeEmail: sendPrechargeEmail,
  runPrechargeEmailJob: runPrechargeEmailJob,
}
