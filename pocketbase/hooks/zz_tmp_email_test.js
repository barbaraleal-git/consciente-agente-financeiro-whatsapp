/// <reference path="../pb_data/types.d.ts" />

// ⚠️ HOOK EFÊMERO (padrão v0.0.153) — disparo de e-mails de teste (v0.0.159)
// via cron de disparo único. Auto-removido no próximo deploy (delete + deploy).
// NÃO deixar no deploy final.

cronAdd('zz_tmp_email_test', '*/2 * * * *', () => {
  try {
    // remove o próprio cron para não re-disparar
    cronRemove('zz_tmp_email_test')
  } catch (cErr) {
    console.log('[zz] cronRemove falhou: ' + String(cErr))
  }

  // ---- (a) caminho nativo: request-password-reset (caso Kelly) ----
  var BACKEND_URL = $os.getenv('PB_INSTANCE_URL') || ''
  var ADMIN_TOKEN = $os.getenv('PB_SUPERUSER_TOKEN') || ''
  if (!BACKEND_URL) {
    console.log('[zz] PB_INSTANCE_URL ausente — abortando')
    return
  }
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

  try {
    var sysCall = $http.send({
      url:
        BACKEND_URL.replace(/\/+$/, '') + '/api/collections/users/request-password-reset',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ADMIN_TOKEN,
      },
      body: JSON.stringify({ email: toEmail }),
      timeout: 30,
    })
    console.log('[zz] system -> status=' + sysCall.statusCode)
  } catch (sysErr) {
    console.log('[zz] system request-password-reset ERRO: ' + String(sysErr))
  }

  // ---- (b)(c) cobrança: precharge + pix_renewal via engine (caminho duplo) ----
  var engine = null
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__proactiveEngine) {
      engine = globalThis.__proactiveEngine
    }
  } catch (e1) {
    console.log('[zz] engine lookup falhou: ' + String(e1))
  }
  if (!engine) {
    console.log('[zz] engine proativa indisponível — abortando disparos de cobrança')
    return
  }

  try {
    var pixRes = engine.sendPixRenewalEmail(
      toEmail,
      'Administração (teste)',
      30,
      '05/12/2026',
      21490,
    )
    console.log('[zz] pix_renewal -> ' + JSON.stringify(pixRes))
  } catch (pErr) {
    console.log('[zz] pix_renewal ERRO: ' + String(pErr))
  }

  try {
    var preRes = engine.sendPrechargeEmail(
      toEmail,
      'Administração (teste)',
      3,
      '01/12/2026',
      1990,
      'Plano Mensal Recorrente',
    )
    console.log('[zz] precharge -> ' + JSON.stringify(preRes))
  } catch (prErr) {
    console.log('[zz] precharge ERRO: ' + String(prErr))
  }
})
