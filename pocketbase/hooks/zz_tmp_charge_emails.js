/// <reference path="../pb_data/types.d.ts" />

// ⚠️ HOOK EFÊMERO (padrão v0.0.153/159) — disparo ÚNICO dos 2 e-mails de
// cobrança de teste (v0.0.160) via cron de disparo único, direto pelo módulo
// de envio dual-path (globalThis.__mailDelivery.sendDualPath), SEM passar pela
// engine proativa (o pool do ambiente de teste não carrega a engine — bug
// conhecido da v0.0.159). Os templates branded são renderizados INLINE aqui
// (cópia fiel dos aprovados: logo real, creme #F8F3E3, botão petróleo #2A5F6E,
// títulos azul-escuro #1E4A5A, avisos terracota #D96B47, tagline oficial,
// zero 🌱 e zero "Finanças Sem Complicação"). Auto-removido no próximo deploy.

cronAdd('zz_tmp_charge_emails', '*/2 * * * *', () => {
  try {
    cronRemove('zz_tmp_charge_emails')
  } catch (cErr) {
    console.log('[zz] cronRemove falhou: ' + String(cErr))
  }

  var mail = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__mailDelivery) {
      mail = globalThis.__mailDelivery
    }
  } catch (mErr) {
    console.log('[zz] lookup __mailDelivery falhou: ' + String(mErr))
  }
  if (!mail || typeof mail.sendDualPath !== 'function') {
    console.log('[zz] __mailDelivery indisponível — abortando disparos de cobrança')
    return
  }

  // Destinatário: a dona admin da base (nunca fixo em código).
  var adminUser = null
  try {
    var admins = $app.findRecordsByFilter('users', "role = 'admin'", 'created', 1, 0)
    if (admins && admins.length > 0) adminUser = admins[0]
  } catch (fErr) {
    console.log('[zz] findRecordsByFilter users/admin falhou: ' + String(fErr))
  }
  if (!adminUser) {
    console.log('[zz] nenhum usuário admin na base — abortando')
    return
  }
  var toEmail = adminUser.getString('email')
  console.log('[zz] admin alvo: ' + toEmail)

  // ---------- Template 1: Pré-cobrança recorrente (3 dias) ----------
  function prechargeHtml() {
    var clientName = 'Administração (teste)'
    var daysAhead = 3
    var chargeDateStr = '01/12/2026'
    var amountCents = 1990
    var planLabel = 'Plano Mensal Recorrente'
    var valFormatted = 'R$ ' + (amountCents / 100).toFixed(2).replace('.', ',')
    var timeLabel = daysAhead === 1 ? 'amanhã' : 'em ' + daysAhead + ' dias'
    return (
      '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Aviso da sua próxima mensalidade Consciente</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px; }\n    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10); }\n    .brand { font-size: 20px; font-weight: 700; margin-bottom: 24px; text-align: center; }\n    .title { font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px; }\n    .p { font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px; }\n    .info-box { background: #F8F3E3; border: 1px solid #E7DFC9; border-radius: 8px; padding: 16px; margin: 20px 0; }\n    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2; }\n    .info-row:last-child { border-bottom: none; font-weight: 600; color: #2A5F6E; }\n    .btn { display: inline-block; background-color: #2A5F6E; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }\n    .footer { font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center; }\n    .tagline { font-size: 12px; color: #1E4A5A; font-weight: 600; margin-top: 8px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n    <div class="title">Sua próxima mensalidade vence ' +
      timeLabel +
      '</div>\n    <p class="p">Olá, <strong>' +
      clientName +
      '</strong>!</p>\n    <p class="p">Estamos passando com transparência para avisar que a renovação da sua assinatura do Consciente será processada <strong>' +
      timeLabel +
      '</strong>, no dia <strong>' +
      chargeDateStr +
      '</strong>.</p>\n\n    <div class="info-box">\n      <div class="info-row"><span>Plano:</span><span>' +
      planLabel +
      '</span></div>\n      <div class="info-row"><span>Data prevista:</span><span>' +
      chargeDateStr +
      '</span></div>\n      <div class="info-row"><span>Valor:</span><span>' +
      valFormatted +
      '</span></div>\n    </div>\n\n    <p class="p">Nenhuma ação é necessária da sua parte caso deseje continuar cuidando do seu dinheiro e registrando seus gastos pelo WhatsApp com a gente.</p>\n    <p class="p">Se precisar atualizar seu cartão ou conferir os detalhes da sua conta, basta acessar seu painel no link abaixo:</p>\n\n    <div style="text-align: center; margin: 24px 0;">\n      <a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Acessar Minha Conta</a>\n    </div>\n\n    <p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>\n\n    <div class="footer">\n      <p class="tagline" style="margin: 0 0 4px 0;">Seu parceiro nas finanças</p>\n      Consciente • BFL Soluções em Tecnologia LTDA<br />\n      Você recebeu este aviso transparente porque possui uma assinatura ativa no Consciente.\n    </div>\n  </div>\n</body>\n</html>'
    ).trim()
  }

  // ---------- Template 2: Renovação Pix anual (faltam 30 dias) ----------
  function pixRenewalHtml() {
    var clientName = 'Administração (teste)'
    var daysAhead = 30
    var expiryDateStr = '05/12/2026'
    var amountCents = 21490
    var valFormatted = 'R$ ' + (amountCents / 100).toFixed(2).replace('.', ',')
    var timeLabel = daysAhead === 7 ? 'em 7 dias' : 'em 30 dias'
    return (
      '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Renovação do seu plano anual Consciente</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px; }\n    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10); }\n    .brand { font-size: 20px; font-weight: 700; margin-bottom: 24px; text-align: center; }\n    .title { font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px; }\n    .p { font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px; }\n    .info-box { background: #FDF1EA; border: 1px solid #F2C9B6; border-radius: 8px; padding: 16px; margin: 20px 0; }\n    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2; }\n    .info-row:last-child { border-bottom: none; font-weight: 600; color: #D96B47; }\n    .btn { display: inline-block; background-color: #2A5F6E; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }\n    .footer { font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center; }\n    .tagline { font-size: 12px; color: #1E4A5A; font-weight: 600; margin-top: 8px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <div class="brand"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n    <div class="title">Seu plano anual vence ' +
      timeLabel +
      '</div>\n    <p class="p">Olá, <strong>' +
      clientName +
      '</strong>!</p>\n    <p class="p">Você assinou o Consciente com pagamento único via Pix. Seu acesso atual vence <strong>' +
      timeLabel +
      '</strong>, no dia <strong>' +
      expiryDateStr +
      '</strong>.</p>\n\n    <div class="info-box">\n      <div class="info-row"><span>Plano:</span><span>Anual (pagamento único)</span></div>\n      <div class="info-row"><span>Validade atual:</span><span>' +
      expiryDateStr +
      '</span></div>\n      <div class="info-row"><span>Renovação à vista:</span><span>' +
      valFormatted +
      '</span></div>\n    </div>\n\n    <p class="p">Para continuar acompanhando seus gastos pelo WhatsApp sem interrupção, basta renovar clicando no botão abaixo — por Pix à vista ou assinatura anual recorrente, como preferir.</p>\n\n    <div style="text-align: center; margin: 24px 0;">\n      <a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" class="btn" target="_blank" rel="noopener">Renovar meu plano</a>\n    </div>\n\n    <p class="p" style="font-size: 13px; color: #64748b;">Dúvidas? Responda a este e-mail ou mande uma mensagem para o nosso suporte oficial.</p>\n\n    <div class="footer">\n      <p class="tagline" style="margin: 0 0 4px 0;">Seu parceiro nas finanças</p>\n      Consciente • BFL Soluções em Tecnologia LTDA<br />\n      Você recebeu este aviso porque seu plano anual à vista está próximo do vencimento.\n    </div>\n  </div>\n</body>\n</html>'
    ).trim()
  }

  // ---------- Envio: direto pelo caminho duplo (sendDualPath) ----------
  var preSubject = 'Aviso: renovação da sua assinatura Consciente em 3 dias'
  var preHtml = prechargeHtml()

  var pixSubject = 'Faltam 30 dias: renove seu plano anual Consciente'
  var pixHtml = pixRenewalHtml()

  try {
    var pixRes = mail.sendDualPath(toEmail, pixSubject, pixHtml, 'pix_renewal')
    console.log('[zz] pix_renewal (dual-path direto) -> ' + JSON.stringify(pixRes))
  } catch (pErr) {
    console.log('[zz] pix_renewal ERRO: ' + String(pErr))
  }

  try {
    var preRes = mail.sendDualPath(toEmail, preSubject, preHtml, 'precharge')
    console.log('[zz] precharge (dual-path direto) -> ' + JSON.stringify(preRes))
  } catch (prErr) {
    console.log('[zz] precharge ERRO: ' + String(prErr))
  }
})
