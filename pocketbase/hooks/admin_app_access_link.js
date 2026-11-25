/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// v0.0.178 — LINK DE ACESSO AO APP como configuração editável no backoffice.
// GET   /backend/v1/admin/app-access-link → { key, value, source, updated }
// POST  /backend/v1/admin/app-access-link → { value } salva em app_settings
// PUT   /backend/v1/admin/app-access-link → alias do POST
// Campo REAL da coleção app_settings: value_text (value NÃO existe —
// descoberto na v0.0.177 e corrigido aqui na v0.0.178).
// Leitura determinística: se houver mais de um registro com a mesma key
// (sucedeu na v0.0.177), prevalece o com updated MAIS RECENTE — o mesmo
// critério adotado no bridge e na migração 0064.
// Padronizado na v0.0.173: cheque de admin INLINE dentro de cada callback
// (helpers fora do callback causam ReferenceError no pool JSVM).
// ----------------------------------------------------

const normalizeAppAccessLinkValue = (rawValue) => {
  let value = String(rawValue || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
  return value
}

// Pega o registro com updated mais recente (critério único de desempate —
// mesmo critério do bridge e da migração 0064).
const findLatestAppAccessLinkRecord = (app) => {
  const list = app.findRecordsByFilter('app_settings', "key = 'app_access_link'", '-updated', 1, 0)
  return list && list.length > 0 ? list[0] : null
}

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
        const rec = findLatestAppAccessLinkRecord($app)
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

const saveAppAccessLink = (e) => {
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
    const value = normalizeAppAccessLinkValue(body.value)

    if (!value || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value)) {
      return e.json(400, {
        error: 'Informe um domínio válido (ex.: consciente.goskip.app).',
      })
    }

    let rec = null
    try {
      rec = findLatestAppAccessLinkRecord($app)
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

routerAdd('POST', '/backend/v1/admin/app-access-link', saveAppAccessLink, $apis.requireAuth())
routerAdd('PUT', '/backend/v1/admin/app-access-link', saveAppAccessLink, $apis.requireAuth())
