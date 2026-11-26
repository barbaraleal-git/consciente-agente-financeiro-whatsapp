/// <reference path="../pb_data/types.d.ts" />
/**
 * 0070 — app_settings: created/updated obrigatórios (Skip Cloud/PocketBase).
 *
 * Causa-raiz do sintoma 2 (link errado via WhatsApp) identificado nesta rodada:
 * a coleção app_settings foi criada SEM os campos autodate `created`/`updated`
 * (regra da plataforma: toda coleção base precisa deles). Consequências:
 *  - Qualquer leitura com sort '-updated'/'-created' falha com HTTP 400
 *    ("Something went wrong while processing your request") — incluindo o
 *    fetch do backoffice da dona e a leitura RUNTIME do whatsapp_bridge.
 *  - A leitura runtime do link no bridge tem try/catch silencioso com fallback
 *    hardcoded → quando a leitura falha, o prompt herdava o domínio antigo
 *    (consciente.goskip.app) das memórias/histórico do agente.
 *
 * Correção: adicionar os campos autodate (idempotente — se já existirem,
 * nenhuma mutação é feita) e retroalimentar `updated` com o maior timestamp
 * plausível por chave, para que '-updated' selecione o registro da dona
 * (consciente.net.br, id yqn40aseppavp58) e não um seed antigo.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('app_settings')
    let changed = false
    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      changed = true
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      changed = true
    }
    if (changed) {
      app.save(col)
      console.log('[0070] app_settings: campos autodate created/updated ADICIONADOS')
    } else {
      console.log('[0070] app_settings: created/updated já existem — nada a fazer')
    }

    // Retroalimentação: dá a cada registro um `updated` determinístico e ordenável.
    // O registro vigente da dona (consciente.net.br) recebe o timestamp mais alto.
    try {
      app
        .db()
        .newQuery(
          "UPDATE app_settings SET updated = '2026-11-26 02:00:00.000Z', created = COALESCE(created, '2026-11-26 02:00:00.000Z') WHERE id = {:id}",
        )
        .bind({ id: 'yqn40aseppavp58' })
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE app_settings SET updated = '2026-11-25 00:00:00.000Z', created = COALESCE(created, '2026-11-25 00:00:00.000Z') WHERE key = 'app_access_link' AND value_text != 'consciente.net.br'",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE app_settings SET updated = '2026-11-24 00:00:00.000Z', created = COALESCE(created, '2026-11-24 00:00:00.000Z') WHERE key = 'email'",
        )
        .execute()
      console.log('[0070] app_settings: retroalimentação de created/updated aplicada')
    } catch (backfillErr) {
      console.log('[0070] Aviso na retroalimentação de created/updated: ' + backfillErr)
    }

    // Prova observável da ordem que o bridge lê: o PRIMEIRO registro de
    // ORDER BY updated DESC deve ser o valor canônico consciente.net.br.
    try {
      const ordered = app.findRecordsByFilter('app_settings', '', '-updated', 3, 0)
      for (let i = 0; i < ordered.length; i++) {
        console.log(
          '[0070] prova ORDER BY -updated [' +
            i +
            '] key=' +
            ordered[i].getString('key') +
            ' value=' +
            ordered[i].getString('value_text'),
        )
      }
    } catch (proofErr) {
      console.log('[0070] Falha na prova de leitura ordenada: ' + proofErr)
    }
  },
  (app) => {
    // Down: não remove os campos (toda coleção base precisa deles); no-op seguro.
    console.log('[0070] down: sem reversão (created/updated são obrigatórios na plataforma)')
  },
)
