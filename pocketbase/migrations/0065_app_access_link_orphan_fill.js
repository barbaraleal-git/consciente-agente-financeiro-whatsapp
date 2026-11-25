/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// v0.0.179 — CORRETIVA: registro órfão do link de acesso em app_settings.
// No banco vivo existe a linha id=e3qcq1pyjgggkso com key='app_access_link' e
// value_text VAZIO (detrito legado da 0062). Os hooks admin_app_access_link.js
// e whatsapp_bridge.js ordenam por '-created' e pegam o registro mais recente;
// se o órfão tiver created mais novo, o backoffice exibiria um link em branco.
// Ação: se a linha ainda existir e value_text estiver vazio, HERDA o valor do
// registro mais recente preenchido (a dona editou 'consciente.goskip.app' no
// backoffice) — e não um default fixo. Idempotente: no-op em base nova e
// quando a linha não existe mais ou já está preenchida. NÃO apaga registros
// (a dona pode revisar no painel Collections, critério da v0.0.178).
// ----------------------------------------------------

migrate(
  (app) => {
    const ORPHAN_ID = 'e3qcq1pyjgggkso'

    let rec = null
    try {
      rec = app.findRecordById('app_settings', ORPHAN_ID)
    } catch (_) {
      console.log('[0065] Registro órfão ' + ORPHAN_ID + ' não existe mais (ok, idempotente).')
      rec = null
    }

    if (rec) {
      const current = String(rec.getString('value_text') || '').trim()
      if (current) {
        console.log('[0065] Órfão já preenchido (' + current + ') — nada a fazer.')
      } else {
        let inherited = ''
        try {
          const filled = app.findRecordsByFilter(
            'app_settings',
            "key = 'app_access_link' && value_text != ''",
            '-created',
            1,
            0,
          )
          if (filled && filled.length > 0) {
            inherited = String(filled[0].getString('value_text') || '').trim()
          }
        } catch (_) {}

        if (!inherited) {
          inherited = 'consciente.goskip.app'
          console.log('[0065] Nenhum registro preenchido encontrado — usando default ' + inherited)
        }

        rec.set('value_text', inherited)
        app.save(rec)
        console.log(
          '[0065] value_text VAZIO preenchido por herança: ' + ORPHAN_ID + ' = ' + inherited,
        )
      }
    }
  },
  (app) => {
    // down: no-op seguro (corrige detrito legado; reverter deixaria o vazio)
  },
)
