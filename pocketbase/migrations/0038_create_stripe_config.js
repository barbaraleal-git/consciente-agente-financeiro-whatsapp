/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0038 — Configuração Stripe administrável (padrão Meta).
 *
 * Cria a coleção `stripe_config`, onde a administração cola a chave secreta
 * de PRODUÇÃO da Stripe (sk_live_... ou chave restrita) e o signing secret do
 * webhook. A integração passa a ser DIRETA à API REST da Stripe
 * (https://api.stripe.com) via $http do hook — mesmo padrão já usado com a
 * Meta Cloud API (token salvo em whatsapp_status + envio direto pelo hook).
 *
 * Regras de segurança:
 * - listRule/viewRule vazios: nenhum cliente lista/lê registros pela API REST
 *   do PocketBase (a leitura mascarada acontece só nos endpoints admin do
 *   hook, que validam o papel de admin).
 * - create/update/delete: só admin (role admin ou e-mail da dona).
 * - A chave NUNCA é devolvida ao frontend: o hook responde sempre mascarada
 *   (ex.: sk_live_***abc) e nunca a registra em console.log.
 * - Idempotente: se a coleção já existir, apenas garante índice e sai.
 */
migrate(
  (app) => {
    try {
      let configCol = null
      try {
        configCol = app.findCollectionByNameOrId('stripe_config')
      } catch (_) {}

      if (!configCol) {
        configCol = new Collection({
          name: 'stripe_config',
          type: 'base',
          listRule: '',
          viewRule: '',
          createRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          updateRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          deleteRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          fields: [
            {
              name: 'secret_key',
              type: 'text',
              required: true,
            },
            { name: 'webhook_signing_secret', type: 'text' },
            { name: 'mode', type: 'text' },
            { name: 'updated_by', type: 'text' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
        })
        app.save(configCol)
        console.log('[migration 0038] Coleção stripe_config criada.')
      } else {
        console.log('[migration 0038] Coleção stripe_config já existe — nada a fazer.')
      }
    } catch (err) {
      console.log('[migration 0038] Erro: ' + err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('stripe_config')
      app.delete(col)
    } catch (_) {}
  },
)
