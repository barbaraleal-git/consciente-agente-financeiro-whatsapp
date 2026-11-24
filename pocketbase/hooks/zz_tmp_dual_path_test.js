/// <reference path="../pb_data/types.d.ts" />

// ⚠️ HOOK EFÊMERO (padrão v0.0.153/159/160) — disparo ÚNICO dos 3 e-mails de
// teste da v0.0.161: 2 de cobrança (precharge + pix_renewal) + 1 de SISTEMA
// (recuperação de senha, comprovado via nativo), TODOS pelo caminho duplo
// (globalThis.__mailDelivery.sendDualPath) com modo atual 'platform'.
// Auto-removido: cronRemove no 1º tick + sumirá no próximo deploy limpo.

cronAdd('zz_tmp_dual_path_test', '*/2 * * * *', () => {
  try {
    cronRemove('zz_tmp_dual_path_test')
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
    console.log('[zz] __mailDelivery indisponível — abortando disparos de teste')
    return
  }

  // Modo atual (prova de que o toggle governa):
  var currentMode = 'platform'
  try {
    currentMode = mail.getDeliveryMode()
  } catch (modeErr) {
    console.log('[zz] getDeliveryMode falhou: ' + String(modeErr))
  }
  console.log('[zz] modo ativo no disparo: ' + currentMode)

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
  var clientName = adminUser.getString('name') || 'Administração (teste)'
  console.log('[zz] admin alvo: ' + toEmail)

  var results = []

  // ---------- 1. Pré-cobrança recorrente (3 dias) ----------
  var preSubject = 'Aviso: renovação da sua assinatura Consciente em 3 dias'
  var preHtml =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <title>Aviso da sua próxima mensalidade Consciente</title>\n</head>\n<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px;">\n  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">\n    <div style="text-align:center; padding-bottom: 24px;"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n    <div style="font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px;">Sua próxima mensalidade vence em 3 dias</div>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Olá, <strong>' +
    clientName +
    '</strong>!</p>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Estamos passando com transparência para avisar que a renovação da sua assinatura do Consciente será processada <strong>em 3 dias</strong>, no dia <strong>27/11/2026</strong>.</p>\n    <div style="background: #F8F3E3; border: 1px solid #E7DFC9; border-radius: 8px; padding: 16px; margin: 20px 0;">\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2;"><span>Plano:</span><span>Plano Mensal Recorrente</span></div>\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2;"><span>Data prevista:</span><span>27/11/2026</span></div>\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: 600; color: #2A5F6E;"><span>Valor:</span><span>R$ 29,90</span></div>\n    </div>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Nenhuma ação é necessária da sua parte caso deseje continuar cuidando do seu dinheiro e registrando seus gastos pelo WhatsApp com a gente.</p>\n    <div style="text-align: center; margin: 24px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" style="display: inline-block; background-color: #2A5F6E; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Acessar Minha Conta</a></div>\n    <div style="font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center;"><p style="font-size: 12px; color: #1E4A5A; font-weight: 600; margin: 0 0 4px 0;">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso transparente porque possui uma assinatura ativa no Consciente.</div>\n  </div>\n</body>\n</html>'

  try {
    var preRes = mail.sendDualPath(toEmail, preSubject, preHtml, 'precharge')
    console.log('[zz] precharge (dual-path) -> ' + JSON.stringify(preRes))
    results.push({ kind: 'precharge', res: preRes })
  } catch (pErr) {
    console.log('[zz] precharge ERRO: ' + String(pErr))
    results.push({ kind: 'precharge', res: { success: false, error: String(pErr) } })
  }

  // ---------- 2. Renovação Pix anual (faltam 30 dias) ----------
  var pixSubject = 'Faltam 30 dias: renove seu plano anual Consciente'
  var pixHtml =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <title>Renovação do seu plano anual Consciente</title>\n</head>\n<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 24px;">\n  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E7DFC9; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">\n    <div style="text-align:center; padding-bottom: 24px;"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></div>\n    <div style="font-size: 18px; font-weight: 600; color: #1E4A5A; margin-bottom: 16px;">Seu plano anual vence em 30 dias</div>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Olá, <strong>' +
    clientName +
    '</strong>!</p>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Você assinou o Consciente com pagamento único via Pix. Seu acesso atual vence <strong>em 30 dias</strong>, no dia <strong>24/12/2026</strong>.</p>\n    <div style="background: #FDF1EA; border: 1px solid #F2C9B6; border-radius: 8px; padding: 16px; margin: 20px 0;">\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2;"><span>Plano:</span><span>Anual (pagamento único)</span></div>\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #D8CDB2;"><span>Validade atual:</span><span>24/12/2026</span></div>\n      <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: 600; color: #D96B47;"><span>Renovação à vista:</span><span>R$ 214,90</span></div>\n    </div>\n    <p style="font-size: 15px; line-height: 1.6; color: #33475A; margin-bottom: 16px;">Para continuar acompanhando seus gastos pelo WhatsApp sem interrupção, basta renovar clicando no botão abaixo — por Pix à vista ou assinatura anual recorrente, como preferir.</p>\n    <div style="text-align: center; margin: 24px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/settings?section=assinatura" style="display: inline-block; background-color: #2A5F6E; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Renovar meu plano</a></div>\n    <div style="font-size: 12px; color: #8A94A0; margin-top: 32px; border-top: 1px solid #E7DFC9; padding-top: 16px; text-align: center;"><p style="font-size: 12px; color: #1E4A5A; font-weight: 600; margin: 0 0 4px 0;">Seu parceiro nas finanças</p>Consciente • BFL Soluções em Tecnologia LTDA<br />Você recebeu este aviso porque seu plano anual à vista está próximo do vencimento.</div>\n  </div>\n</body>\n</html>'

  try {
    var pixRes = mail.sendDualPath(toEmail, pixSubject, pixHtml, 'pix_renewal')
    console.log('[zz] pix_renewal (dual-path) -> ' + JSON.stringify(pixRes))
    results.push({ kind: 'pix_renewal', res: pixRes })
  } catch (xErr) {
    console.log('[zz] pix_renewal ERRO: ' + String(xErr))
    results.push({ kind: 'pix_renewal', res: { success: false, error: String(xErr) } })
  }

  // ---------- 3. E-mail de SISTEMA (recuperação de senha, branded) ----------
  var sysSubject = 'Redefina sua senha do Consciente'
  var sysHtml =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <title>Redefina sua senha do Consciente</title>\n</head>\n<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A; margin: 0; padding: 40px 16px;">\n  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F3E3; padding: 40px 16px;"><tr><td align="center">\n    <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #E7DFC9; padding: 32px; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">\n      <tr><td align="center" style="padding-bottom: 24px;"><img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></td></tr>\n      <tr><td style="color: #33475A; font-size: 16px; line-height: 24px;"><h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1E4A5A; font-weight: 600;">Recuperação de Senha</h2>\n      <p style="margin: 0 0 16px 0; color: #33475A;">Olá, <strong>' +
    clientName +
    '</strong>!</p>\n      <p style="margin: 0 0 24px 0; color: #33475A;">Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para cadastrar uma nova senha:</p></td></tr>\n      <tr><td align="center" style="padding: 8px 0 28px 0;"><a href="https://agente-financeiro-whatsapp-37fd3.goskip.app/reset-password?token=teste-v0161" target="_blank" style="display: inline-block; background-color: #2A5F8E; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">Redefinir minha senha</a></td></tr>\n      <tr><td style="border-top: 1px solid #E7DFC9; padding-top: 20px; font-size: 12px; line-height: 18px; color: #6B7A88;"><p style="margin: 0 0 4px 0; font-weight: 600; color: #1E4A5A;">Seu parceiro nas finanças</p><p style="margin: 0;">© Consciente. Todos os direitos reservados.</p></td></tr>\n    </table>\n  </td></tr></table>\n</body>\n</html>'

  try {
    var sysRes = mail.sendDualPath(toEmail, sysSubject, sysHtml, 'password_reset')
    console.log('[zz] password_reset (dual-path) -> ' + JSON.stringify(sysRes))
    results.push({ kind: 'password_reset', res: sysRes })
  } catch (sErr) {
    console.log('[zz] password_reset ERRO: ' + String(sErr))
    results.push({ kind: 'password_reset', res: { success: false, error: String(sErr) } })
  }

  console.log('[zz] RESUMO final: ' + JSON.stringify(results))
})
