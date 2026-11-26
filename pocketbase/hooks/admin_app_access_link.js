/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// v0.0.178 — LINK DE ACESSO AO APP como configuração editável no backoffice.
// GET   /backend/v1/admin/app-access-link → { key, value, source, updated }
// POST  /backend/v1/admin/app-access-link → { value } salva em app_settings
// PUT   /backend/v1/admin/app-access-link → alias do POST
// Campo REAL da coleção app_settings: value_text (value NÃO existe —
// descoberto na v0.0.177 e corrigido aqui na v0.0.178).
// v0.0.190 — leitura E escrita ordenadas por '-updated' (registro ATUALIZADO
// mais recente vence), alinhado com a migração 0064 e com o whatsapp_bridge.js
// (o comentário antigo, que dizia que '-updated' retorna 400, estava errado:
// a 0064 usa '-updated' nesta mesma coleção em produção sem erro).
// REGRA ESTRUTURAL PERMANENTE (JSVM): declarações top-level e globalThis NÃO
// sobrevivem ao pool de callbacks do PocketBase — TODA a lógica (incluindo a
// busca do registro mais recente) fica INLINE dentro do corpo de cada callback
// (mesmo padrão do admin_email_delivery.js v0.0.163/v0.0.174).
// Desempate: se houver mais de um registro com key='app_access_link',
// prevalece o de updated MAIS RECENTE (sort '-updated' — mesmo critério da
// migração 0064 e do whatsapp_bridge.js; v0.0.190: '-created' NÃO vale — a
// dona edita o registro mais antigo e o link novo não é lido por ninguém).
// ----------------------------------------------------

routerAdd(
  'GET',
  '/backend/v1/admin/app-access-link',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      let value = ''
      let updated = ''
      try {
        const list = $app.findRecordsByFilter(
          'app_settings',
          "key = 'app_access_link'",
          '-updated',
          1,
          0,
        )
        const rec = list && list.length > 0 ? list[0] : null
        if (rec) {
          value = String(rec.getString('value_text') || '').trim()
          updated = rec.getString('updated') || ''
        }
      } catch (_) {}

      return e.json(200, {
        key: 'app_access_link',
        value: value,
        source: value ? 'app_settings' : 'fallback',
        updated: updated,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

const saveAppAccessLinkHandler = function (e) {
  try {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
        authUser.getString('role') === 'admin')
    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }

    const body = (e.requestInfo() && e.requestInfo().body) || {}
    let value = String(body.value || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')

    if (!value || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value)) {
      return e.json(400, {
        error: 'Informe um domínio válido (ex.: consciente.goskip.app).',
      })
    }

    let rec = null
    try {
      const list = $app.findRecordsByFilter(
        'app_settings',
        "key = 'app_access_link'",
        '-updated',
        1,
        0,
      )
      rec = list && list.length > 0 ? list[0] : null
    } catch (_) {}

    if (rec) {
      rec.set('value_text', value)
      $app.save(rec)
    } else {
      const col = $app.findCollectionByNameOrId('app_settings')
      const newRec = new Record(col)
      newRec.set('key', 'app_access_link')
      newRec.set('value_text', value)
      $app.save(newRec)
      rec = newRec
    }

    console.log(
      '[admin_app_access_link] Link de acesso atualizado pela dona: ' +
        value +
        ' (por ' +
        (authUser.getString('email') || 'admin') +
        ')',
    )

    return e.json(200, {
      success: true,
      value: value,
      message: 'Link salvo. O bot do WhatsApp já usa este valor nas próximas mensagens.',
    })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
}

routerAdd(
  'POST',
  '/backend/v1/admin/app-access-link',
  saveAppAccessLinkHandler,
  $apis.requireAuth(),
)
routerAdd('PUT', '/backend/v1/admin/app-access-link', saveAppAccessLinkHandler, $apis.requireAuth())
