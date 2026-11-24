/// <reference path="../pb_data/types.d.ts" />

// ⚠️ HOOK EFÊMERO (padrão v0.0.153/159/160/161) — prova viva v0.0.162.
// Cron */2: dispara para a dona admin os 2 e-mails de cobrança branded
// (pré-cobrança recorrente 3 dias + renovação Pix anual 30 dias) via
// sendDualPath, loga [zz] com o resultado e auto-remove-se (cronRemove)
// APENAS se os 2 disparos concluíram.
//
// REGRA JSVM v0.0.163 (comprovada nos logs 06:24–06:28 da v0.0.162):
// globalThis NÃO preserva estado entre o LOAD do arquivo e a EXECUÇÃO do
// cron (pool isolado por execução) — o IIFE de topo publicava o módulo, mas
// o pool do callback do cronAdd partia de globalThis VAZIO. Correção: o
// builder completo do módulo foi movido PARA DENTRO do callback — se
// globalThis.__mailDelivery não existir (ou estiver incompleto), o callback
// reconstrói o módulo ali mesmo e só então usa. Nada no topo publica nada.

cronAdd('zz_tmp_dual_path_test', '*/2 * * * *', () => {
  // ---------------------------------------------------------------------
  // BUILDER INLINE DO MÓDULO (v0.0.163) — cópia fiel de mail_delivery.js.
  // Idempotente: se outro arquivo do pool já publicou um sendDualPath,
  // usa o publicado; senão constrói e publica AGORA, dentro do callback.
  // ---------------------------------------------------------------------
  var mail = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__mailDelivery) {
      mail = globalThis.__mailDelivery
    }
  } catch (mErr) {
    console.log('[zz] lookup __mailDelivery falhou: ' + String(mErr))
  }

  if (!mail || typeof mail.sendDualPath !== 'function') {
    console.log('[zz] __mailDelivery ausente no pool — construindo módulo inline (v0.0.163)')

    function getDeliveryMode() {
      try {
        var recs = $app.findRecordsByFilter('app_settings', "key = 'email'", '-created', 1, 0)
        if (recs && recs.length > 0) {
          var mode = recs[0].getString('email_delivery_mode')
          if (mode === 'resend') return 'resend'
        }
      } catch (e) {
        console.log('[mail_delivery] nota ao ler modo (usando platform): ' + e)
      }
      return 'platform'
    }

    function hasResendKey() {
      try {
        return !!($os.getenv('RESEND_API_KEY') || '').trim()
      } catch (_) {
        return false
      }
    }

    function senderInfo() {
      var addr = 'noreply@mail.goskip.dev'
      var name = 'Consciente - Seu parceiro nas finanças'
      try {
        var s = $app.settings()
        if (s && s.meta) {
          if (s.meta.senderAddress) addr = s.meta.senderAddress
          if (s.meta.senderName) name = s.meta.senderName
        }
      } catch (_) {}
      return { address: addr, name: name }
    }

    function sendViaPlatform(to, subject, html, from) {
      var msg = new MailerMessage({
        from: { address: from.address, name: from.name },
        to: [{ address: to }],
        subject: subject,
        html: html,
      })
      $app.newMailClient().send(msg)
    }

    function sendViaResend(to, subject, html, from) {
      var apiKey = ''
      try {
        apiKey = ($os.getenv('RESEND_API_KEY') || '').trim()
      } catch (_) {
        apiKey = ''
      }
      if (!apiKey) return { ok: false, reason: 'RESEND_API_KEY ausente' }

      var resp = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          from: from.name + ' <' + from.address + '>',
          to: [to],
          subject: subject,
          html: html,
        }),
        timeout: 30,
      })

      var ok = resp.statusCode >= 200 && resp.statusCode < 300
      if (!ok) {
        var bodyPreview = ''
        try {
          bodyPreview = (resp.raw || JSON.stringify(resp.json) || '').slice(0, 300)
        } catch (_) {
          bodyPreview = ''
        }
        return { ok: false, reason: 'Resend HTTP ' + resp.statusCode + ': ' + bodyPreview }
      }
      return { ok: true, provider: 'resend', statusCode: resp.statusCode }
    }

    function sendDualPath(to, subject, html, kind) {
      if (!to || String(to).indexOf('@') === -1) {
        return { success: false, error: 'E-mail de destinatário inválido' }
      }
      var mode = getDeliveryMode()
      var from = senderInfo()

      if (mode === 'resend') {
        if (!hasResendKey()) {
          console.log(
            '[mail_delivery] modo=resend sem RESEND_API_KEY — FALLBACK para platform | kind=' +
              kind +
              ' to=' +
              to,
          )
          sendViaPlatform(to, subject, html, from)
          return {
            success: true,
            path: 'platform (fallback: resend sem chave)',
            to: to,
            subject: subject,
          }
        }
        var rRes = sendViaResend(to, subject, html, from)
        if (rRes.ok) {
          console.log(
            '[mail_delivery] ENVIADO via resend | kind=' +
              kind +
              ' to=' +
              to +
              ' subject="' +
              subject +
              '"',
          )
          return { success: true, path: 'resend', to: to, subject: subject }
        }
        console.log(
          '[mail_delivery] FALHA no resend (' +
            rRes.reason +
            ') — FALLBACK para platform | kind=' +
            kind +
            ' to=' +
            to,
        )
        try {
          sendViaPlatform(to, subject, html, from)
          return {
            success: true,
            path: 'platform (fallback: ' + rRes.reason.slice(0, 120) + ')',
            to: to,
            subject: subject,
          }
        } catch (fbErr) {
          console.log(
            '[mail_delivery] FALHOU também no platform | kind=' +
              kind +
              ' to=' +
              to +
              ' erro=' +
              fbErr,
          )
          return {
            success: false,
            error: 'resend: ' + rRes.reason + ' | platform: ' + String(fbErr),
          }
        }
      }

      try {
        sendViaPlatform(to, subject, html, from)
        console.log(
          '[mail_delivery] ENVIADO via platform | kind=' +
            kind +
            ' to=' +
            to +
            ' subject="' +
            subject +
            '"',
        )
        return { success: true, path: 'platform', to: to, subject: subject }
      } catch (pErr) {
        console.log(
          '[mail_delivery] FALHOU no platform | kind=' + kind + ' to=' + to + ' erro=' + pErr,
        )
        return { success: false, error: String(pErr) }
      }
    }

    mail = {
      getDeliveryMode: getDeliveryMode,
      hasResendKey: hasResendKey,
      senderInfo: senderInfo,
      sendViaPlatform: sendViaPlatform,
      sendViaResend: sendViaResend,
      sendDualPath: sendDualPath,
    }
    try {
      if (typeof globalThis !== 'undefined') globalThis.__mailDelivery = mail
    } catch (pubErr) {
      console.log('[zz] publicação no globalThis falhou (usando módulo local): ' + String(pubErr))
    }
  }

  // ---------------------------------------------------------------------
  // A partir daqui o callback é autossuficiente: `mail` SEMPRE tem
  // sendDualPath (publicado por outro arquivo OU construído acima).
  // ---------------------------------------------------------------------

  var currentMode = 'platform'
  try {
    currentMode = mail.getDeliveryMode()
  } catch (modeErr) {
    console.log('[zz] getDeliveryMode falhou: ' + String(modeErr))
  }
  console.log('[zz] modo ativo no disparo: ' + currentMode)

  var adminUser = null
  try {
    var admins = $app.findRecordsByFilter('users', "role = 'admin'", 'created', 1, 0)
    if (admins && admins.length > 0) adminUser = admins[0]
  } catch (fErr) {
    console.log('[zz] findRecordsByFilter users/admin falhou: ' + String(fErr))
  }
  if (!adminUser) {
    console.log('[zz] nenhum usuário admin na base — tentando de novo no próximo tick')
    return
  }
  var toEmail = adminUser.getString('email')
  var clientName = adminUser.getString('name') || 'Administração (teste)'
  console.log('[zz] admin alvo: ' + toEmail)

  var APP_URL = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
  var LOGO_URL = APP_URL + '/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg'
  var results = []
  var allDone = true

  // ---------- 1. Pré-cobrança recorrente (3 dias) ----------
  var preSubject = 'Aviso: renovação da sua assinatura Consciente em 3 dias'
  var preHtml =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <title>Aviso da sua próxima mensalidade Consciente</title>\n</head>\n<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px;">\n  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">\n    <div style="text-align:center; padding-bottom: 24px;"><img src="' +
    LOGO_URL +
    '" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n    <div style="font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px;">Sua próxima mensalidade vence em 3 dias</div>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Olá, <strong>' +
    clientName +
    '</strong>!</p>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Este é um aviso de teste da v0.0.162: a renovação da sua assinatura do Consciente seria processada <strong>em 3 dias</strong>.</p>\n    <div style="background: #F8F3E3; border: 1px solid #E7DFC9; border-radius: 8px; padding: 16px; margin: 20px 0;">\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2;"><span>Plano:</span><span>Plano Mensal Recorrente</span></div>\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: 600; color: #2A5F6E;"><span>Valor:</span><span>R$ 29,90</span></div>\n    </div>\n    <div style="text-align: center; margin: 24px 0;"><a href="' +
    APP_URL +
    '/settings?section=assinatura" style="display: inline-block; background-color: #2A5F6E; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Acessar Minha Conta</a></div>\n    <div style="font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center;"><p style="font-size: 12px; color: #1E4A5A; font-weight: 600; margin: 0 0 4px 0;">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso transparente porque possui uma assinatura ativa no Consciente.</div>\n  </div>\n</body>\n</html>'

  var preRes = null
  try {
    preRes = mail.sendDualPath(toEmail, preSubject, preHtml, 'precharge')
    console.log('[zz] precharge (dual-path) -> ' + JSON.stringify(preRes))
    results.push({ kind: 'precharge', res: preRes })
    if (!preRes || !preRes.success) allDone = false
  } catch (pErr) {
    console.log('[zz] precharge ERRO: ' + String(pErr))
    results.push({ kind: 'precharge', res: { success: false, error: String(pErr) } })
    allDone = false
  }

  // ---------- 2. Renovação Pix anual (faltam 30 dias) ----------
  var pixSubject = 'Faltam 30 dias: renove seu plano anual Consciente'
  var pixHtml =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <title>Renovação do seu plano anual Consciente</title>\n</head>\n<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px;">\n  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">\n    <div style="text-align:center; padding-bottom: 24px;"><img src="' +
    LOGO_URL +
    '" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n    <div style="font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px;">Seu plano anual vence em 30 dias</div>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Olá, <strong>' +
    clientName +
    '</strong>!</p>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Este é um aviso de teste da v0.0.162: seu acesso anual venceria <strong>em 30 dias</strong>.</p>\n    <div style="background: #FDF1EA; border: 1px solid #F2C9B6; border-radius: 8px; padding: 16px; margin: 20px 0;">\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2;"><span>Plano:</span><span>Anual (pagamento único)</span></div>\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: 600; color: #D96B47;"><span>Renovação à vista:</span><span>R$ 214,90</span></div>\n    </div>\n    <div style="text-align: center; margin: 24px 0;"><a href="' +
    APP_URL +
    '/settings?section=assinatura" style="display: inline-block; background-color: #2A5F6E; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Renovar meu plano</a></div>\n    <div style="font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center;"><p style="font-size: 12px; color: #1E4A5A; font-weight: 600; margin: 0 0 4px 0;">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso porque seu plano anual à vista está próximo do vencimento.</div>\n  </div>\n</body>\n</html>'

  var pixRes = null
  try {
    pixRes = mail.sendDualPath(toEmail, pixSubject, pixHtml, 'pix_renewal')
    console.log('[zz] pix_renewal (dual-path) -> ' + JSON.stringify(pixRes))
    results.push({ kind: 'pix_renewal', res: pixRes })
    if (!pixRes || !pixRes.success) allDone = false
  } catch (xErr) {
    console.log('[zz] pix_renewal ERRO: ' + String(xErr))
    results.push({ kind: 'pix_renewal', res: { success: false, error: String(xErr) } })
    allDone = false
  }

  console.log('[zz] RESUMO final: ' + JSON.stringify(results))

  // Auto-remove-se APENAS com os 2 disparos concluídos com sucesso.
  if (allDone) {
    try {
      cronRemove('zz_tmp_dual_path_test')
      console.log('[zz] cron zz_tmp_dual_path_test auto-removido após disparos concluídos.')
    } catch (cErr) {
      console.log('[zz] cronRemove falhou: ' + String(cErr))
    }
  } else {
    console.log('[zz] disparos incompletos — cron mantido para retry no próximo tick')
  }
})
