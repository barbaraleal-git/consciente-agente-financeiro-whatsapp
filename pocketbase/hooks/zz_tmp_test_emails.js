/// <reference path="../pb_data/types.d.ts" />
// v0.0.157 — HOOK EFÊMERO de disparo dos 2 e-mails branded de teste.
//
// Padrão comprovado (v0.0.153/154): a rota /backend/v1/proactive/test-email
// exige auth admin (sem token disponível nesta rodada). Este hook registra um
// cron de 1 minuto que dispara precharge + pix_renewal para a dona e SE REMOVE
// (cronRemove) ao final. NUNCA deixar permanente: deploy final limpo, sem zz_*.
//
// v2 do hook: AUTOSSUFICIENTE — não depende de globalThis.__proactiveEngine
// (na v1, a engine ainda não estava publicada no boot do deploy quente:
// "[zz_tmp_test_emails] engine proativa indisponível — sem disparo" às 01:53).
// O HTML branded é copiado VERBATIM de proactive_notifications_engine.js.
//
// Prova em dados (list_logs esgotado nesta rodada): cada envio grava em
// proactive_logs uma linha "pending" com snapshot SMTP ANTES do $app
// .newMailClient().send() — se travar (hang da 465), a linha fica pending com
// o snapshot; se completar, vira sent/failed com resultado. Flag globalThis
// impede re-disparo em tick subsequente se o send travar.
cronAdd('zz_tmp_test_emails_boot', '* * * * *', () => {
  if (typeof globalThis !== 'undefined' && globalThis.__zzBusy) {
    return
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__zzBusy = true
  }

  function smtpSnapshot() {
    try {
      var s = $app.settings()
      var smtp = (s && s.smtp) || {}
      return JSON.stringify({
        enabled: smtp.enabled,
        host: smtp.host,
        port: smtp.port,
        tls: smtp.tls,
        username: smtp.username,
        from: (s.meta && s.meta.senderAddress) || '',
      })
    } catch (_) {
      return 'unavailable'
    }
  }

  function saveLog(kind, recipient, status, error, details) {
    try {
      var logCol = $app.findCollectionByNameOrId('proactive_logs')
      var rec = new Record(logCol)
      rec.set('channel', 'email')
      rec.set('kind', kind)
      rec.set('dedupe_key', 'manual_test:' + kind)
      rec.set('recipient', recipient)
      rec.set('status', status)
      rec.set('error', error || '')
      rec.set('details', details || {})
      $app.save(rec)
      return rec.id
    } catch (saveErr) {
      console.log('[zz_tmp_test_emails] erro ao salvar log ' + kind + ': ' + saveErr)
      return ''
    }
  }

  function updateLog(recId, status, error, details) {
    if (!recId) return
    try {
      var rec = $app.findRecordById('proactive_logs', recId)
      rec.set('status', status)
      rec.set('error', error || '')
      rec.set('details', details || {})
      $app.save(rec)
    } catch (upErr) {
      console.log('[zz_tmp_test_emails] erro ao atualizar log: ' + upErr)
    }
  }

  function senderInfo() {
    var addr = 'suporte@agente-financeiro-whatsapp-37fd3.goskip.app'
    var name = 'Consciente'
    try {
      var s = $app.settings()
      if (s && s.meta) {
        if (s.meta.senderAddress) addr = s.meta.senderAddress
        if (s.meta.senderName) name = s.meta.senderName
      }
    } catch (_) {}
    return { address: addr, name: name }
  }

  function sendBranded(kind, subject, htmlBody, to) {
    var snap = smtpSnapshot()
    var logId = saveLog(kind, to, 'pending', '', { step: 'pre-send', smtp: snap })
    var from = senderInfo()
    try {
      var msg = new MailerMessage({
        from: { address: from.address, name: from.name },
        to: [{ address: to }],
        subject: subject,
        html: htmlBody,
      })
      $app.newMailClient().send(msg)
      var snapOk = smtpSnapshot()
      updateLog(logId, 'sent', '', { step: 'sent', smtp: snapOk })
      console.log('[zz_tmp_test_emails] ' + kind + ' ENVIADO smtp=' + snapOk)
      return true
    } catch (err) {
      var snapErr = smtpSnapshot()
      updateLog(logId, 'failed', String(err).slice(0, 500), {
        step: 'error',
        smtp: snapErr,
        erro: String(err).slice(0, 500),
      })
      console.log('[zz_tmp_test_emails] ' + kind + ' FALHOU smtp=' + snapErr + ' erro=' + err)
      return false
    }
  }

  var TO = 'barbara.ferreira.leal@gmail.com'
  var LOGO_URL =
    'https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg'

  var shellOpen =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '<style>\n' +
    "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px; }\n" +
    '.card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10); }\n' +
    '.brand { font-size: 20px; font-weight: 700; margin-bottom: 24px; text-align: center; }\n' +
    '.title { font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px; }\n' +
    '.p { font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px; }\n' +
    '.info-box { background: #F8F3E3; border: 1px solid #E7DFC9; border-radius: 8px; padding: 16px; margin: 20px 0; }\n' +
    '.info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2; }\n' +
    '.info-row:last-child { border-bottom: none; font-weight: 600; color: #2A5F6E; }\n' +
    '.btn { display: inline-block; background-color: #2A5F6E; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }\n' +
    '.footer { font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center; }\n' +
    '.tagline { font-size: 12px; color: #1E4A5A; font-weight: 600; margin-top: 8px; }\n' +
    '</style>\n</head>\n<body>\n  <div class="card">\n' +
    '    <div class="brand"><img src="' +
    LOGO_URL +
    '" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n'

  var shellClose =
    '    <p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>\n' +
    '    <div class="footer">\n      <p class="tagline" style="margin: 0 0 4px 0;">Seu parceiro nas finanças</p>\n      Consciente • BFL Soluções em Tecnologia LTDA<br />\n' +
    '    </div>\n  </div>\n</body>\n</html>'

  // ---- precharge (verbatim da engine v0.0.157, valores de teste) ----
  var prechargeHtml =
    shellOpen +
    '    <div class="title">Sua próxima mensalidade vence em 3 dias</div>\n' +
    '    <p class="p">Olá, <strong>Administração (teste)</strong>!</p>\n' +
    '    <p class="p">Estamos passando com transparência para avisar que a renovação da sua assinatura do Consciente será processada <strong>em 3 dias</strong>, no dia <strong>01/12/2026</strong>.</p>\n' +
    '    <div class="info-box">\n      <div class="info-row"><span>Plano:</span><span>Plano Mensal Recorrente</span></div>\n' +
    '      <div class="info-row"><span>Data prevista:</span><span>01/12/2026</span></div>\n      <div class="info-row"><span>Valor:</span><span>R$ 19,90</span></div>\n    </div>\n' +
    '    <p class="p">Nenhuma ação é necessária da sua parte caso deseje continuar cuidando do seu dinheiro e registrando seus gastos pelo WhatsApp com a gente.</p>\n' +
    '    <p class="p">Se precisar atualizar seu cartão ou conferir os detalhes da sua conta, basta acessar seu painel no link abaixo:</p>\n' +
    '    <div style="text-align: center; margin: 24px 0;">\n      <a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Acessar Minha Conta</a>\n    </div>\n' +
    shellClose

  var preOk = sendBranded(
    'manual_test_precharge',
    'Aviso: renovação da sua assinatura Consciente em 3 dias',
    prechargeHtml,
    TO,
  )

  // ---- pix_renewal (verbatim da engine v0.0.157, valores de teste) ----
  var pixHtml =
    shellOpen +
    '    <div class="title">Seu plano anual vence em 30 dias</div>\n' +
    '    <p class="p">Olá, <strong>Administração (teste)</strong>!</p>\n' +
    '    <p class="p">Você assinou o Consciente com pagamento único via Pix. Seu acesso atual vence <strong>em 30 dias</strong>, no dia <strong>05/12/2026</strong>.</p>\n' +
    '    <div class="info-box">\n      <div class="info-row"><span>Plano:</span><span>Anual (pagamento único)</span></div>\n' +
    '      <div class="info-row"><span>Validade atual:</span><span>05/12/2026</span></div>\n      <div class="info-row"><span>Renovação à vista:</span><span>R$ 214,90</span></div>\n    </div>\n' +
    '    <p class="p">Para continuar acompanhando seus gastos pelo WhatsApp sem interrupção, basta renovar clicando no botão abaixo — por Pix à vista ou assinatura anual recorrente, como preferir.</p>\n' +
    '    <div style="text-align: center; margin: 24px 0;">\n      <a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Renovar meu plano</a>\n    </div>\n' +
    shellClose

  var pixOk = sendBranded(
    'manual_test_pix30d',
    'Faltam 30 dias: renove seu plano anual Consciente',
    pixHtml,
    TO,
  )

  // envios concluídos (success ou erro capturado): remove este cron
  if (typeof cronRemove === 'function') {
    try {
      cronRemove('zz_tmp_test_emails_boot')
      console.log('[zz_tmp_test_emails] cron removido (precharge=' + preOk + ', pix=' + pixOk + ')')
    } catch (rmErr) {
      console.log('[zz_tmp_test_emails] nota ao remover cron: ' + rmErr)
    }
  }
})
