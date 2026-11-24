/// <reference path="../pb_data/types.d.ts" />

// v0.0.159 — CAMINHO DUPLO DE ENVIO DE E-MAIL (plataforma | resend).
//
// PONTO ÚNICO DE DECISÃO do modo. Como require() de hooks dentro de callbacks
// falha na JSVM ("Invalid module"), este arquivo publica globalThis
// .__mailDelivery (padrão comprovado do projeto, como __proactiveEngine) e os
// outros hooks o consomem.
//
// Caminhos:
//  - 'platform': retransmissor NATIVO da plataforma Skip (comprovado: e-mail
//    recebido em 2/nov, remetente noreply@mail.goskip.dev). Envia via
//    $app.newMailClient() SEM configuração SMTP manual — a migração 0058
//    desligou o SMTP do Gmail (egress do cluster bloqueado, ports 465/587).
//  - 'resend': API HTTPS do Resend (POST https://api.resend.com/emails,
//    Bearer RESEND_API_KEY) via $http.send — caminho pronto para o domínio
//    próprio da dona. Fica inativo enquanto o segredo não existir.
//
// REGRA DE OURO: NUNCA deixar de enviar. Se o modo for 'resend' mas o segredo
// não existir ou a API falhar, cai AUTOMATICAMENTE para o caminho platform e
// registra o motivo (console.log) — o e-mail chega pelo nativo.
//
// Segurança: RESEND_API_KEY é lida apenas server-side ($os.getenv) e NUNCA
// logada. Destinatários sempre vêm da base (nenhum e-mail fixo aqui além do
// fallback de teste da rota admin, que herda o padrão da v0.0.153).

;(function () {
  var APP_URL = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
  var LOGO_URL = APP_URL + '/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg'

  function log() {
    var parts = ['[mail_delivery]']
    for (var i = 0; i < arguments.length; i++) parts.push(String(arguments[i]))
    console.log(parts.join(' '))
  }

  // Modo ativo: app_settings.email (linha única). Default 'platform' em
  // qualquer falha — nunca bloquear envio por erro de leitura.
  function getDeliveryMode() {
    try {
      var recs = $app.findRecordsByFilter('app_settings', "key = 'email'", '-created', 1, 0)
      if (recs && recs.length > 0) {
        var mode = recs[0].getString('email_delivery_mode')
        if (mode === 'resend') return 'resend'
      }
    } catch (e) {
      log('nota ao ler modo (usando platform): ' + e)
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

  // ---- Caminho platform: cliente de e-mail nativo do PocketBase ----
  // (newMailClient() lê o settings da plataforma — NÃO é conexão SMTP manual,
  // que travava na 465.)
  function sendViaPlatform(to, subject, html, from) {
    var msg = new MailerMessage({
      from: { address: from.address, name: from.name },
      to: [{ address: to }],
      subject: subject,
      html: html,
    })
    $app.newMailClient().send(msg)
  }

  // ---- Caminho resend: API HTTPS (egress HTTP do cluster funciona) ----
  // Retorno comprovado da JSVM: { statusCode, headers, cookies, body, raw, json }.
  function sendViaResend(to, subject, html, from) {
    var apiKey = ''
    try {
      apiKey = ($os.getenv('RESEND_API_KEY') || '').trim()
    } catch (_) {
      apiKey = ''
    }
    if (!apiKey) {
      return { ok: false, reason: 'RESEND_API_KEY ausente' }
    }

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
      return {
        ok: false,
        reason: 'Resend HTTP ' + resp.statusCode + ': ' + bodyPreview,
      }
    }
    return { ok: true, provider: 'resend', statusCode: resp.statusCode }
  }

  // ---- Ponto único de envio com fallback garantido ----
  // Usado por cobrança (engine + crons) e disponível para testes admin.
  // Templates/HTML chegam PRONTOS (branded) — aqui só se decide o caminho.
  function sendDualPath(to, subject, html, kind) {
    if (!to || String(to).indexOf('@') === -1) {
      return { success: false, error: 'E-mail de destinatário inválido' }
    }

    var mode = getDeliveryMode()
    var from = senderInfo()
    var res = null

    if (mode === 'resend') {
      if (!hasResendKey()) {
        log('modo=resend sem RESEND_API_KEY — FALLBACK para platform | kind=' + kind + ' to=' + to)
        res = sendViaPlatform(to, subject, html, from)
        return {
          success: true,
          path: 'platform (fallback: resend sem chave)',
          to: to,
          subject: subject,
        }
      }
      var rRes = sendViaResend(to, subject, html, from)
      if (rRes.ok) {
        log('ENVIADO via resend | kind=' + kind + ' to=' + to + ' subject="' + subject + '"')
        return { success: true, path: 'resend', to: to, subject: subject }
      }
      log(
        'FALHA no resend (' +
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
        log('FALHOU também no platform | kind=' + kind + ' to=' + to + ' erro=' + fbErr)
        return {
          success: false,
          error: 'resend: ' + rRes.reason + ' | platform: ' + String(fbErr),
        }
      }
    }

    // modo platform (default)
    try {
      sendViaPlatform(to, subject, html, from)
      log('ENVIADO via platform | kind=' + kind + ' to=' + to + ' subject="' + subject + '"')
      return { success: true, path: 'platform', to: to, subject: subject }
    } catch (pErr) {
      log('FALHOU no platform | kind=' + kind + ' to=' + to + ' erro=' + pErr)
      return { success: false, error: String(pErr) }
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__mailDelivery = {
      APP_URL: APP_URL,
      LOGO_URL: LOGO_URL,
      getDeliveryMode: getDeliveryMode,
      hasResendKey: hasResendKey,
      senderInfo: senderInfo,
      sendViaPlatform: sendViaPlatform,
      sendViaResend: sendViaResend,
      sendDualPath: sendDualPath,
    }
  }
})()
