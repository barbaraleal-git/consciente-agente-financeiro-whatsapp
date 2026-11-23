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

  // JSVM: res.rawText NÃO existe — $http.send retorna { statusCode, headers, body, raw, json }
  let statusCode = res.statusCode
  let rawBody = res.body || ''
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
      rawBody = resText.body || ''
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
  // v0.0.98: rótulos também funcionam para a anual recorrente (7d/1d)
  const timeLabel = daysAhead === 1 ? 'amanhã' : 'em ' + daysAhead + ' dias'

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aviso da sua próxima mensalidade Consciente</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10); }
    .brand { font-size: 20px; font-weight: 700; margin-bottom: 24px; text-align: center; }
    .title { font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px; }
    .p { font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px; }
    .info-box { background: #F8F3E3; border: 1px solid #E7DFC9; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2; }
    .info-row:last-child { border-bottom: none; font-weight: 600; color: #2A5F6E; }
    .btn { display: inline-block; background-color: #2A5F6E; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }
    .footer { font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center; }
    .tagline { font-size: 12px; color: #1E4A5A; font-weight: 600; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>
    <div class="title">${planLabel === 'Plano Anual Recorrente' ? 'Sua próxima anuidade vence' : 'Sua próxima mensalidade vence'} ${timeLabel}</div>
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
      <p class="tagline" style="margin: 0 0 4px 0;">Seu parceiro nas finanças</p>
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
      ? 'Amanhã: renovação da sua assinatura Consciente'
      : 'Aviso: renovação da sua assinatura Consciente em ' + daysAhead + ' dias'

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

function formatDateOnly(isoStr) {
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

function buildPixRenewalEmailHtml(clientName, daysAhead, expiryDateStr, amountCents) {
  const safeName = clientName || 'Cliente'
  const valFormatted =
    amountCents && amountCents > 0
      ? 'R$ ' + (amountCents / 100).toFixed(2).replace('.', ',')
      : 'R$ 214,90'
  const timeLabel = daysAhead === 7 ? 'em 7 dias' : 'em 30 dias'

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Renovação do seu plano anual Consciente</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10); }
    .brand { font-size: 20px; font-weight: 700; margin-bottom: 24px; text-align: center; }
    .title { font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px; }
    .p { font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px; }
    .info-box { background: #FDF1EA; border: 1px solid #F2C9B6; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2; }
    .info-row:last-child { border-bottom: none; font-weight: 600; color: #D96B47; }
    .btn { display: inline-block; background-color: #2A5F6E; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }
    .footer { font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center; }
    .tagline { font-size: 12px; color: #1E4A5A; font-weight: 600; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>
    <div class="title">Seu plano anual vence ${timeLabel}</div>
    <p class="p">Olá, <strong>${safeName}</strong>!</p>
    <p class="p">Você assinou o Consciente com pagamento único via Pix. Seu acesso atual vence <strong>${timeLabel}</strong>, no dia <strong>${expiryDateStr}</strong>.</p>

    <div class="info-box">
      <div class="info-row"><span>Plano:</span><span>Anual (pagamento único)</span></div>
      <div class="info-row"><span>Validade atual:</span><span>${expiryDateStr}</span></div>
      <div class="info-row"><span>Renovação à vista:</span><span>${valFormatted}</span></div>
    </div>

    <p class="p">Para continuar acompanhando seus gastos pelo WhatsApp sem interrupção, basta renovar clicando no botão abaixo — por Pix à vista ou assinatura anual recorrente, como preferir.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Renovar meu plano</a>
    </div>

    <p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>

    <div class="footer">
      <p class="tagline" style="margin: 0 0 4px 0;">Seu parceiro nas finanças</p>
      Consciente • BFL Soluções em Tecnologia LTDA<br />
      Você recebeu este aviso porque seu plano anual à vista está próximo do vencimento.
    </div>
  </div>
</body>
</html>
  `.trim()
}

function sendPixRenewalEmail(toEmail, clientName, daysAhead, expiryDateStr, amountCents) {
  if (!toEmail || toEmail.indexOf('@') === -1) {
    return { success: false, error: 'E-mail de destinatário inválido' }
  }

  const subject =
    daysAhead === 7
      ? 'Faltam 7 dias: renove seu plano anual Consciente'
      : 'Faltam 30 dias: renove seu plano anual Consciente'

  const htmlBody = buildPixRenewalEmailHtml(clientName, daysAhead, expiryDateStr, amountCents)

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
    console.log('[proactive] Erro no $app.newMailClient().send (renovação Pix):', err)
    return { success: false, error: String(err) }
  }
}

function buildPixRenewalWhatsappText(firstName, daysAhead, expiryDateStr) {
  const safeName = firstName || 'amigo(a)'
  const timeLabel = daysAhead === 7 ? '7 dias' : '30 dias'
  return (
    'Oi, ' +
    safeName +
    '! Tudo bem? Passando para lembrar que seu plano anual do Consciente (pagamento único via Pix) vence ' +
    timeLabel +
    ', no dia ' +
    expiryDateStr +
    '. Para continuar registrando seus gastos por aqui sem interrupção, é só renovar em Minha Conta: https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura'
  )
}

function sendPixRenewalWhatsapp(toNumber, firstName, daysAhead, expiryDateStr) {
  const text = buildPixRenewalWhatsappText(firstName, daysAhead, expiryDateStr)
  return sendMetaProactiveMessage(toNumber, firstName, text)
}

function runPixRenewalJob(dryRun) {
  const results = {
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

  console.log('[proactive] Iniciando Job de Renovação Pix (30d/7d) (dryRun=' + dryRun + ')')

  let users = []
  try {
    users = $app.findRecordsByFilter(
      '_pb_users_auth_',
      "subscription_status = 'active' && subscription_plan = 'anual' && access_until != ''",
      '-created',
      500,
      0,
    )
  } catch (err) {
    console.log('[proactive] Erro ao buscar usuários one_time:', err)
    return results
  }

  results.candidates = users.length
  const nowMs = Date.now()

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    const userId = u.id
    const userEmail = u.getString('email') || ''
    const subId = u.getString('stripe_subscription_id') || ''
    const accessUntil = u.getString('access_until') || ''

    // REGRA BLINDADA (v0.0.95): quem tem stripe_subscription_id é recorrente —
    // já é coberto pelo e-mail pré-cobrança 3d/1d. NUNCA recebe renovação Pix.
    if (subId) {
      results.skipped_recurring++
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'skipped_recurring',
      })
      continue
    }

    if (!accessUntil) {
      results.details.push({ user_id: userId, email: userEmail, status: 'skipped_no_access_until' })
      continue
    }

    const expMs = new Date(accessUntil).getTime()
    if (isNaN(expMs) || expMs < nowMs) {
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'skipped_expired_or_invalid_date',
        access_until: accessUntil,
      })
      continue
    }

    results.eligible_one_time++

    const diffDays = (expMs - nowMs) / (1000 * 60 * 60 * 24)

    let kind = null
    let daysAhead = 0

    // Janela de 30 dias: de 30d6h até 29d18h antes do vencimento (± tolerância).
    if (diffDays >= 29.25 && diffDays <= 30.75) {
      kind = 'renewal_30d'
      daysAhead = 30
      results.window_30d++
    } else if (diffDays >= 6.25 && diffDays <= 7.75) {
      kind = 'renewal_7d'
      daysAhead = 7
      results.window_7d++
    }

    if (!kind) {
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'outside_window',
        diff_days: Number(diffDays.toFixed(2)),
        access_until: accessUntil,
      })
      continue
    }

    const expiryFormatted = formatDateOnly(accessUntil)
    const dedupeDateKey = expiryFormatted.replace(/\//g, '-')
    // Dedupe: user:renewal_30d:YYYY-MM-DD (chave única global em proactive_logs)
    const dedupeEmailKey = userId + ':renewal_' + daysAhead + 'd:email:' + dedupeDateKey
    const dedupeWhatsKey = userId + ':renewal_' + daysAhead + 'd:whatsapp:' + dedupeDateKey

    let existingEmailLog = null
    let existingWhatsLog = null
    try {
      existingEmailLog = $app.findFirstRecordByData('proactive_logs', 'dedupe_key', dedupeEmailKey)
    } catch (_) {}
    try {
      existingWhatsLog = $app.findFirstRecordByData('proactive_logs', 'dedupe_key', dedupeWhatsKey)
    } catch (_) {}

    const emailAlreadySent = existingEmailLog && existingEmailLog.getString('status') === 'sent'
    const whatsAlreadySent = existingWhatsLog && existingWhatsLog.getString('status') === 'sent'

    if (emailAlreadySent && whatsAlreadySent) {
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
    const firstName = clientName.trim().split(/\s+/)[0] || 'amigo(a)'

    // WhatsApp: buscar telefone no contato vinculado
    let phone = ''
    try {
      const contacts = $app.findRecordsByFilter(
        'whatsapp_contacts',
        "user = '" + userId + "'",
        '-created',
        1,
        0,
      )
      if (contacts.length > 0) {
        phone = contacts[0].getString('phone_number') || ''
      }
    } catch (_) {}

    if (dryRun) {
      results.details.push({
        user_id: userId,
        email: userEmail,
        phone: phone,
        kind: kind,
        expiry: expiryFormatted,
        email_already_sent: !!emailAlreadySent,
        whatsapp_already_sent: !!whatsAlreadySent,
        status: 'dry_run_candidate',
      })
      continue
    }

    const logCol = $app.findCollectionByNameOrId('proactive_logs')

    // --- E-MAIL ---
    if (!emailAlreadySent) {
      const emailRes = sendPixRenewalEmail(userEmail, clientName, daysAhead, expiryFormatted, 21490)
      const emailLog = existingEmailLog || new Record(logCol)
      emailLog.set('user', userId)
      emailLog.set('channel', 'email')
      emailLog.set('kind', 'renewal_pix_' + daysAhead + 'd')
      emailLog.set('dedupe_key', dedupeEmailKey)
      emailLog.set('recipient', userEmail)
      emailLog.set('status', emailRes.success ? 'sent' : 'failed')
      emailLog.set('error', emailRes.success ? '' : String(emailRes.error || '').slice(0, 500))
      emailLog.set('details', {
        days_ahead: daysAhead,
        access_until: accessUntil,
        billing_mode: 'one_time',
        send_result: emailRes,
      })
      try {
        $app.save(emailLog)
      } catch (saveErr) {
        console.log('[proactive] Erro ao salvar proactive_logs (email renovação):', saveErr)
      }
      if (emailRes.success) results.emails_sent++
      else results.emails_failed++
    } else {
      results.details.push({
        user_id: userId,
        kind: kind,
        channel: 'email',
        status: 'already_sent',
      })
    }

    // --- WHATSAPP ---
    if (!whatsAlreadySent && phone) {
      const whatsRes = sendPixRenewalWhatsapp(phone, firstName, daysAhead, expiryFormatted)
      const whatsLog = existingWhatsLog || new Record(logCol)
      whatsLog.set('user', userId)
      whatsLog.set('channel', 'whatsapp')
      whatsLog.set('kind', 'renewal_pix_' + daysAhead + 'd')
      whatsLog.set('dedupe_key', dedupeWhatsKey)
      whatsLog.set('recipient', phone)
      whatsLog.set('status', whatsRes.success ? 'sent' : 'failed')
      whatsLog.set('error', whatsRes.success ? '' : String(whatsRes.error || '').slice(0, 500))
      whatsLog.set('details', {
        days_ahead: daysAhead,
        access_until: accessUntil,
        billing_mode: 'one_time',
        mode: whatsRes.mode,
        send_result: whatsRes,
      })
      try {
        $app.save(whatsLog)
      } catch (saveErr) {
        console.log('[proactive] Erro ao salvar proactive_logs (whats renovação):', saveErr)
      }
      if (whatsRes.success) results.whats_sent++
      else results.whats_failed++
    } else if (!phone) {
      results.details.push({
        user_id: userId,
        kind: kind,
        channel: 'whatsapp',
        status: 'skipped_no_phone',
      })
    } else {
      results.details.push({
        user_id: userId,
        kind: kind,
        channel: 'whatsapp',
        status: 'already_sent',
      })
    }

    results.details.push({
      user_id: userId,
      email: userEmail,
      kind: kind,
      status: 'processed',
      email_sent: emailAlreadySent ? 'already' : results.emails_sent,
      whatsapp_sent: whatsAlreadySent ? 'already' : results.whats_sent,
    })
  }

  console.log(
    '[proactive] Job de Renovação Pix concluído: e-mails=' +
      results.emails_sent +
      ', whats=' +
      results.whats_sent +
      ', 30d=' +
      results.window_30d +
      ', 7d=' +
      results.window_7d,
  )

  return results
}

function runPrechargeEmailJob(dryRun) {
  const results = {
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

    // v0.0.98: a anual RECORRENTE (stripe_subscription_id ativo) DEVE ser
    // contemplada pelo mesmo portão do pré-cobrança 3d/1d. Só fica fora quem
    // não tem assinatura Stripe ativa (one_time/PIX e trials).
    if (!subId) {
      results.skipped++
      results.details.push({
        user_id: userId,
        email: userEmail,
        status: 'skipped_no_active_stripe_subscription',
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

    // v0.0.98: janela para a anual recorrente é 7d/1d (renovação a cada 12 meses,
    // carência de 7 dias no ciclo mensal não se aplica). Valores mantidos iguais
    // para o mensal (3d/1d) — ambos via mesmo job.
    const window3dDays = plan === 'anual' ? 7 : 3

    let kind = null
    let daysAhead = 0

    if (diffDays >= window3dDays - 1.0 && diffDays <= window3dDays + 0.5) {
      kind = 'precharge_' + window3dDays + 'd'
      daysAhead = window3dDays
      if (plan === 'anual') {
        results.window_7d++
      } else {
        results.window_3d++
      }
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

    // v0.0.98: rótulo e valor dependem do plano (mensal 19,90 / anual recorrente 214,90)
    const isAnualRec = plan === 'anual'
    const amountCents = isAnualRec ? 21490 : 1990
    const planLabel = isAnualRec ? 'Plano Anual Recorrente' : 'Plano Mensal Recorrente'

    const sendRes = sendPrechargeEmail(
      userEmail,
      clientName,
      daysAhead,
      chargeDateFormatted,
      amountCents,
      planLabel,
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

// Exporta também no globalThis (padrão comprovado da JSVM deste projeto): o
// require() de módulos de hook falha com "GoError: Invalid module" dentro de
// callbacks de cronAdd; os callbacks do proactive_notifications.js usam este
// objeto como fallback quando o require não está disponível.
if (typeof globalThis !== 'undefined') {
  globalThis.__proactiveEngine = {
    runNightlyReminderJob: runNightlyReminderJob,
    runPrechargeEmailJob: runPrechargeEmailJob,
    runPixRenewalJob: runPixRenewalJob,
    sendPrechargeEmail: sendPrechargeEmail,
    getBrtDateStr: getBrtDateStr,
    formatDateBrt: formatDateBrt,
    NIGHTLY_REMINDER_TEMPLATE: NIGHTLY_REMINDER_TEMPLATE,
  }
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
  // v0.0.98: aviso de renovação do anual à vista (Pix/one_time) 30d/7d antes
  runPixRenewalJob: runPixRenewalJob,
  sendPixRenewalEmail: sendPixRenewalEmail,
  buildPixRenewalWhatsappText: buildPixRenewalWhatsappText,
}
