/// <reference path="../pb_data/types.d.ts" />

// v0.0.173 — ROTAS ADMIN DO CAMINHO DUPLO DE E-MAIL (toggle da dona).
//
// CORREÇÃO do bug v0.0.159: `isAdminRequest is not defined` (500 nas rotas).
// Causa: as funções viviam dentro de uma IIFE de escopo de carregamento — o pool
// JSVM do projeto não preserva esse escopo quando o callback da rota executa
// (padrão conhecido: require só em routerAdd, lógica INLINE dentro de cada
// handler, nada dependente do escopo do carregamento). Aqui o cheque de admin e
// a busca do registro de modo ficam DENTRO de cada handler, como em
// admin_backoffice.js.
//
// Rotas:
//  - GET  /backend/v1/admin/email-delivery/mode — modo ativo + disponibilidade
//  - POST /backend/v1/admin/email-delivery/mode — troca o modo (platform|resend)

// ---------- GET: modo ativo + disponibilidade do Resend ----------
routerAdd(
  'GET',
  '/backend/v1/admin/email-delivery/mode',
  (e) => {
    // Cheque de admin INLINE (padrão JSVM — nada de escopo externo)
    let isAdmin = false
    try {
      const authUser = e.auth
      isAdmin = !!(
        authUser &&
        (authUser.getString('role') === 'admin' ||
          authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')
      )
    } catch (_) {
      isAdmin = false
    }
    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }
    try {
      // Registro do modo INLINE (era a helper getModeRecord da IIFE)
      let rec = null
      try {
        const recs = $app.findRecordsByFilter('app_settings', "key = 'email'", '-created', 1, 0)
        if (recs && recs.length > 0) rec = recs[0]
      } catch (_) {
        rec = null
      }

      const md = globalThis.__mailDelivery
      const mode = md
        ? md.getDeliveryMode()
        : rec && rec.getString('email_delivery_mode') === 'resend'
          ? 'resend'
          : 'platform'
      const resendKeySet = md ? md.hasResendKey() : false
      let sender = md ? md.senderInfo().address : 'noreply@mail.goskip.dev'
      let smtpEnabled = false
      try {
        smtpEnabled = !!$app.settings().smtp.enabled
      } catch (_) {}
      return e.json(200, {
        mode: mode,
        resend_key_configured: resendKeySet,
        sender_address: sender,
        smtp_enabled: smtpEnabled,
        updated_at: rec ? rec.getString('updated') : '',
        updated_by: rec ? rec.getString('updated_by') : '',
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ---------- POST: alterna o modo ----------
routerAdd(
  'POST',
  '/backend/v1/admin/email-delivery/mode',
  (e) => {
    // Cheque de admin INLINE (padrão JSVM — nada de escopo externo)
    let isAdmin = false
    try {
      const authUser = e.auth
      isAdmin = !!(
        authUser &&
        (authUser.getString('role') === 'admin' ||
          authUser.getString('email') === 'barbara.ferreira.leal@gmail.com')
      )
    } catch (_) {
      isAdmin = false
    }
    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }
    try {
      const body = e.requestInfo().body || {}
      const requested = String(body.mode || '').trim()
      if (requested !== 'platform' && requested !== 'resend') {
        return e.json(400, {
          error: "Modo inválido. Use 'platform' (contingência) ou 'resend' (domínio próprio).",
        })
      }

      // Registro do modo INLINE (era a helper getModeRecord da IIFE)
      let rec = null
      try {
        const recs = $app.findRecordsByFilter('app_settings', "key = 'email'", '-created', 1, 0)
        if (recs && recs.length > 0) rec = recs[0]
      } catch (_) {
        rec = null
      }
      const col = $app.findCollectionByNameOrId('app_settings')
      if (!rec) {
        rec = new Record(col)
        rec.set('key', 'email')
      }
      rec.set('email_delivery_mode', requested)
      rec.set('updated_by', 'admin:' + (e.auth ? e.auth.getString('email') : ''))

      // Se a dona escolheu 'resend' sem a chave configurada, AVISA mas não
      // bloqueia: o envio cai automaticamente para platform (fallback no
      // mail_delivery.js) — nenhum e-mail se perde.
      const md = globalThis.__mailDelivery
      const resendKeySet = md ? md.hasResendKey() : false
      if (requested === 'resend' && !resendKeySet) {
        rec.set('value_text', 'resend sem RESEND_API_KEY — fallback automático p/ platform')
      } else {
        rec.set('value_text', 'caminho duplo de e-mail (v0.0.159)')
      }

      $app.save(rec)

      console.log(
        '[admin][email-delivery] Modo de envio alterado para "' +
          requested +
          '" por ' +
          (e.auth ? e.auth.getString('email') : '?') +
          ' (resend_key_configured=' +
          resendKeySet +
          ')',
      )

      return e.json(200, {
        success: true,
        mode: requested,
        resend_key_configured: resendKeySet,
        warning:
          requested === 'resend' && !resendKeySet
            ? 'RESEND_API_KEY não configurada — enquanto isso, os e-mails saem automaticamente pelo caminho Plataforma (fallback).'
            : '',
        message:
          requested === 'platform'
            ? 'Modo Plataforma ativo: envio pelo retransmissor nativo do Skip (noreply@mail.goskip.dev).'
            : 'Modo Resend ativo: envio pela API HTTPS do Resend (com fallback para Plataforma em falha).',
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
