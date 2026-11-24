/// <reference path="../pb_data/types.d.ts" />

// v0.0.159 — CAMINHO DUPLO DE E-MAIL (toggle no backoffice admin).
//
// DIAGNÓSTICO PROVADO EM LOGS (não re-diagnosticar): o egress SMTP do cluster
// está BLOQUEADO — smtp.gmail.com dá connection timed out nas portas 465 e 587
// (34 tentativas). O ÚNICO caminho que comprovadamente funcionou (e-mail
// recebido pela dona em 2/nov, remetente noreply@mail.goskip.dev) é o
// RETRANSMISSOR NATIVO da plataforma Skip, que o PocketBase usa quando NENHUMA
// configuração SMTP está definida. As migrações 0055/0056/0057 (segredos
// SKIP_SMTP_* -> Gmail) SOBREPÔRAM e QUEBRARAM esse caminho funcional.
//
// Esta migração:
//  1. DESLIGA a configuração SMTP manual (smtp.enabled = false) — o PocketBase
//     volta ao retransmissor nativo (noreply@mail.goskip.dev) imediatamente,
//     restaurando hoje o que funcionava. Idempotente: se já estiver desligado,
//     não resalva nada. Os segredos SKIP_SMTP_* continuam existindo (nada é
//     apagado), mas deixam de ser aplicados: o modo 'platform' não lê SMTP.
//  2. GARANTE a coleção app_settings com o campo email_delivery_mode
//     (select: platform | resend), criando a coleção se ela não existir.
//     'platform' é o DEFAULT — coleção nova e coleção existente sem o campo.
//
// O down NÃO religa o SMTP do Gmail (caminho provadamente quebrado): restaura
// apenas o remetente nativo, mantendo o retransmissor da plataforma.

migrate(
  (app) => {
    // ---- 1. Restaura o caminho nativo (platform) ----
    try {
      const s = app.settings()
      const smtp = s.smtp || {}
      if (smtp.enabled || smtp.host || smtp.username || smtp.password) {
        s.smtp.enabled = false
        s.smtp.host = ''
        s.smtp.port = 0
        s.smtp.username = ''
        s.smtp.password = ''
        s.smtp.authMethod = ''
        s.smtp.tls = false
        s.meta.senderAddress = 'noreply@mail.goskip.dev'
        s.meta.senderName = 'Consciente - Seu parceiro nas finanças'
        app.save(s)
        console.log(
          '[0058] SMTP manual DESLIGADO — PocketBase volta ao retransmissor nativo Skip (noreply@mail.goskip.dev). Modo ativo: platform.',
        )
      } else {
        console.log('[0058] SMTP já desligado — caminho platform nativo ativo (idempotente).')
      }
    } catch (e) {
      console.log('[0058] Nota ao desligar SMTP: ' + e)
    }

    // ---- 2. Coleção app_settings + campo email_delivery_mode ----
    let col = null
    try {
      col = app.findCollectionByNameOrId('app_settings')
    } catch (_) {
      col = null
    }

    if (!col) {
      col = new Collection({
        name: 'app_settings',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'key',
            type: 'text',
            required: true,
            presentable: true,
          },
          {
            name: 'value_text',
            type: 'text',
          },
          {
            name: 'email_delivery_mode',
            type: 'select',
            maxSelect: 1,
            values: ['platform', 'resend'],
          },
          {
            name: 'updated_by',
            type: 'text',
          },
        ],
      })
      app.save(col)
      console.log('[0058] Coleção app_settings criada (regras fechadas — só via hooks admin).')
    } else if (!col.fields.getByName('email_delivery_mode')) {
      col.fields.add(
        new Field({
          name: 'email_delivery_mode',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['platform', 'resend'],
        }),
      )
      app.save(col)
      console.log('[0058] Campo email_delivery_mode adicionado a app_settings existente.')
    } else {
      console.log('[0058] app_settings.email_delivery_mode já existe (idempotente).')
    }

    // ---- 3. Linha de configuração com DEFAULT 'platform' ----
    let settingsRec = null
    try {
      const found = app.findRecordsByFilter('app_settings', "key = 'email'", '-created', 1, 0)
      settingsRec = found && found.length > 0 ? found[0] : null
    } catch (_) {
      settingsRec = null
    }

    if (!settingsRec) {
      settingsRec = new Record(app.findCollectionByNameOrId('app_settings'))
      settingsRec.set('key', 'email')
      settingsRec.set('email_delivery_mode', 'platform')
      settingsRec.set('value_text', 'caminho duplo de e-mail (v0.0.159)')
      settingsRec.set('updated_by', 'migration-0058')
      app.save(settingsRec)
      console.log(
        "[0058] app_settings 'email' criado com email_delivery_mode='platform' (default).",
      )
    } else if (!settingsRec.getString('email_delivery_mode')) {
      settingsRec.set('email_delivery_mode', 'platform')
      settingsRec.set('updated_by', 'migration-0058')
      app.save(settingsRec)
      console.log("[0058] email_delivery_mode vazio preenchido com 'platform' (default).")
    } else {
      console.log('[0058] Modo ativo preservado: ' + settingsRec.getString('email_delivery_mode'))
    }
  },
  (app) => {
    // down: volta ao remetente nativo (NÃO religa o SMTP do Gmail, caminho
    // provadamente bloqueado no cluster).
    try {
      const s = app.settings()
      s.meta.senderAddress = 'noreply@mail.goskip.dev'
      s.meta.senderName = 'Consciente - Seu parceiro nas finanças'
      app.save(s)
      console.log('[0058/down] Remetente nativo restaurado; SMTP segue desligado.')
    } catch (e) {
      console.log('[0058/down] Nota: ' + e)
    }
  },
)
