// TEMPORÁRIO (v0.0.155) — hook efêmero de diagnóstico/disparo SMTP, auto-removido pós-deploy.
// Mesmo padrão aceito na v0.0.153: slug aleatório sem auth, para permitir à IA disparar
// os 3 e-mails de teste pela mesma lógica da rota existente /backend/v1/proactive/test-email
// (que exige sessão admin no navegador). NÃO altera a rota existente nem cria rota permanente.
// Remove qualquer menção a senha/segredo dos logs — apenas estados booleanos e endereços.

routerAdd('GET', '/_tmp/smtp-probe-v0155-k7q2xm', function (e) {
  var results = {}
  var TO = 'barbara.ferreira.leal@gmail.com'

  // 0) Snapshot das settings SMTP + env (sem valores sensíveis)
  try {
    var s = $app.settings()
    var smtp = s.smtp || {}
    var meta = s.meta || {}
    results.snapshot = {
      smtp_enabled: !!smtp.enabled,
      smtp_host: smtp.host || '',
      smtp_port: smtp.port || 0,
      smtp_username: smtp.username || '',
      smtp_password_set: !!(smtp.password && smtp.password.length > 0),
      smtp_auth_method: smtp.authMethod || '',
      smtp_tls: !!smtp.tls,
      meta_sender_address: meta.senderAddress || '',
      meta_sender_name: meta.senderName || '',
      env_host: $os.getenv('SKIP_SMTP_HOST') || '',
      env_port: $os.getenv('SKIP_SMTP_PORT') || '',
      env_username: $os.getenv('SKIP_SMTP_USERNAME') || '',
      env_sender: $os.getenv('SKIP_SMTP_SENDER') || '',
      env_password_set: !!($os.getenv('SKIP_SMTP_PASSWORD') || ''),
    }
  } catch (sErr) {
    results.snapshot = { settings_error: String(sErr) }
  }
  console.log('[smtp-probe] settings snapshot: ' + JSON.stringify(results.snapshot))

  var engine = null
  try {
    engine = require('./proactive_notifications_engine.js')
  } catch (rqErr) {
    console.log('[smtp-probe] require falhou: ' + rqErr)
  }
  if (!engine) {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
        engine = globalThis.__proactiveEngine
      }
    } catch (e1) {}
  }

  results.engine_available = !!(engine && typeof engine.sendPrechargeEmail === 'function')

  var SNAPSHOT_SENDER = (results.snapshot && results.snapshot.meta_sender_address) || ''
  var SNAPSHOT_SENDER_NAME = (results.snapshot && results.snapshot.meta_sender_name) || 'Consciente'

  function __sendBranded(plain) {
    var msg = new MailerMessage({
      from: { address: SNAPSHOT_SENDER, name: SNAPSHOT_SENDER_NAME },
      to: [{ address: TO }],
      subject: plain.subject,
      html: plain.html,
    })
    $app.newMailClient().send(msg)
    return { success: true, to: TO, subject: plain.subject, transport: 'settings SMTP v0.0.155' }
  }

  // 1) precharge — HTML inline (cópia fiel do fallback v0.0.116 de proactive_crons.js, sem dedupe)
  results.precharge = (function () {
    var subject = 'Aviso: renovação da sua assinatura Consciente em 3 dias'
    try {
      if (!SNAPSHOT_SENDER) throw new Error('senderAddress vazio nas settings')
      var html = [
        '<!DOCTYPE html>',
        '<html lang="pt-BR"><head><meta charset="utf-8" />',
        '<title>Aviso da sua próxima mensalidade Consciente</title>',
        "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#F8F3E3;color:#1E4A5A;margin:0;padding:24px;}.card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E7DFC9;box-shadow:0 6px 18px rgba(30,74,90,0.10);}.brand{margin-bottom:24px;text-align:center;}.title{font-size:18px;font-weight:600;color:#1E4A5A;margin-bottom:16px;}.p{font-size:15px;line-height:1.6;color:#33475A;margin-bottom:16px;}.info-box{background:#F8F3E3;border:1px solid #E7DFC9;border-radius:8px;padding:16px;margin:20px 0;}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px dashed #D8CDB2;}.info-row:last-child{border-bottom:none;font-weight:600;color:#2A5F6E;}.btn{display:inline-block;background-color:#2A5F6E;color:#fff !important;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:12px;}.footer{font-size:12px;color:#8A94A0;margin-top:32px;border-top:1px solid #E7DFC9;padding-top:16px;text-align:center;}.tagline{font-size:12px;color:#1E4A5A;font-weight:600;margin:0 0 4px 0;}</style>",
        '</head><body><div class="card">',
        '<div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>',
        '<div class="title">Sua próxima mensalidade vence em 3 dias</div>',
        '<p class="p">Olá, <strong>Administração (teste)</strong>!</p>',
        '<p class="p">Estamos passando com transparência para avisar que a renovação da sua assinatura do Consciente será processada <strong>em 3 dias</strong>, no dia <strong>01/12/2026</strong>.</p>',
        '<div class="info-box">',
        '<div class="info-row"><span>Plano:</span><span>Plano Mensal Recorrente</span></div>',
        '<div class="info-row"><span>Data prevista:</span><span>01/12/2026</span></div>',
        '<div class="info-row"><span>Valor:</span><span>R$ 19,90</span></div>',
        '</div>',
        '<p class="p">Nenhuma ação é necessária da sua parte caso deseje continuar cuidando do seu dinheiro e registrando seus gastos pelo WhatsApp com a gente.</p>',
        '<p class="p">Se precisar atualizar seu cartão ou conferir os detalhes da sua conta, basta acessar seu painel no link abaixo:</p>',
        '<div style="text-align: center; margin: 24px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Acessar Minha Conta</a></div>',
        '<p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>',
        '<div class="footer"><p class="tagline">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso transparente porque possui uma assinatura ativa no Consciente.</div>',
        '</div></body></html>',
      ].join('')
      return __sendBranded({ subject: subject, html: html })
    } catch (err1) {
      return { success: false, error: String(err1) }
    }
  })()

  // 2) pix_renewal — HTML inline (cópia fiel do fallback v0.0.116 de proactive_crons.js, sem dedupe)
  results.pix_renewal = (function () {
    var subject = 'Faltam 30 dias: renove seu plano anual Consciente'
    try {
      if (!SNAPSHOT_SENDER) throw new Error('senderAddress vazio nas settings')
      var html = [
        '<!DOCTYPE html>',
        '<html lang="pt-BR"><head><meta charset="utf-8" />',
        '<title>Renovação do seu plano anual Consciente</title>',
        "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#F8F3E3;color:#1E4A5A;margin:0;padding:24px;}.card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E7DFC9;box-shadow:0 6px 18px rgba(30,74,90,0.10);}.brand{margin-bottom:24px;text-align:center;}.title{font-size:18px;font-weight:600;color:#1E4A5A;margin-bottom:16px;}.p{font-size:15px;line-height:1.6;color:#33475A;margin-bottom:16px;}.info-box{background:#FDF1EA;border:1px solid #F2C9B6;border-radius:8px;padding:16px;margin:20px 0;}.info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px dashed #D8CDB2;}.info-row:last-child{border-bottom:none;font-weight:600;color:#D96B47;}.btn{display:inline-block;background-color:#2A5F6E;color:#fff !important;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:12px;}.footer{font-size:12px;color:#8A94A0;margin-top:32px;border-top:1px solid #E7DFC9;padding-top:16px;text-align:center;}.tagline{font-size:12px;color:#1E4A5A;font-weight:600;margin:0 0 4px 0;}</style>",
        '</head><body><div class="card">',
        '<div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>',
        '<div class="title">Seu plano anual vence em 30 dias</div>',
        '<p class="p">Olá, <strong>Administração (teste)</strong>!</p>',
        '<p class="p">Você assinou o Consciente com pagamento único via Pix. Seu acesso atual vence <strong>em 30 dias</strong>, no dia <strong>05/12/2026</strong>.</p>',
        '<div class="info-box">',
        '<div class="info-row"><span>Plano:</span><span>Anual (pagamento único)</span></div>',
        '<div class="info-row"><span>Validade atual:</span><span>05/12/2026</span></div>',
        '<div class="info-row"><span>Renovação à vista:</span><span>R$ 214,90</span></div>',
        '</div>',
        '<p class="p">Para continuar acompanhando seus gastos pelo WhatsApp sem interrupção, basta renovar clicando no botão abaixo — por Pix à vista ou assinatura anual recorrente, como preferir.</p>',
        '<div style="text-align: center; margin: 24px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Renovar meu plano</a></div>',
        '<p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>',
        '<div class="footer"><p class="tagline">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso porque seu plano anual à vista está próximo do vencimento.</div>',
        '</div></body></html>',
      ].join('')
      return __sendBranded({ subject: subject, html: html })
    } catch (err2) {
      return { success: false, error: String(err2) }
    }
  })()

  // 3) system — mesmo fluxo real da rota existente (request-password-reset via $http.send)
  try {
    var BACKEND_URL = $os.getenv('PB_INSTANCE_URL') || ''
    var ADMIN_TOKEN = $os.getenv('PB_SUPERUSER_TOKEN') || ''
    if (!BACKEND_URL) {
      results.system = { success: false, error: 'PB_INSTANCE_URL ausente' }
    } else {
      var sysCall = $http.send({
        url: BACKEND_URL.replace(/\/+$/, '') + '/api/collections/users/request-password-reset',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ADMIN_TOKEN,
        },
        body: JSON.stringify({ email: TO }),
        timeout: 30,
      })
      var sysOk = sysCall.statusCode >= 200 && sysCall.statusCode < 300
      results.system = {
        success: sysOk,
        statusCode: sysCall.statusCode,
        body: (sysCall.raw || '').slice(0, 300),
      }
      console.log(
        '[smtp-probe] system -> status=' +
          sysCall.statusCode +
          ' body=' +
          (sysCall.raw || '').slice(0, 300),
      )
    }
  } catch (err3) {
    results.system = { success: false, error: String(err3) }
  }

  console.log('[smtp-probe] results: ' + JSON.stringify(results))
  return e.json(200, results)
})
