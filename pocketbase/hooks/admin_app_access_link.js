/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// v0.0.177 — LINK DE ACESSO AO APP como configuração editável no backoffice.
// GET  /backend/v1/admin/app-access-link  → { key, value, updated }
// PUT  /backend/v1/admin/app-access-link  → { value } salva em app_settings
// Padronizado na v0.0.173: cheque de admin INLINE dentro de cada callback
// (helpers fora do callback causam ReferenceError no pool JSVM).
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

      let value = 'consciente.goskip.app'
      let updated = ''
      try {
        const rec = $app.findFirstRecordByFilter('app_settings', "key = 'app_access_link'", '')
        if (rec) {
          value = rec.getString('value') || value
          updated = rec.getString('updated') || ''
        }
      } catch (_) {}

      return e.json(200, { key: 'app_access_link', value: value, updated: updated })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'PUT',
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

      const body = (e.requestInfo() && e.requestInfo().body) || {}
      const rawValue = String(body.value || '').trim()

      // Normalização: aceita com ou sem https://, remove barra final e espaços
      let value = rawValue.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
      if (!value || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
        return e.json(400, {
          error: 'Informe um domínio válido (ex.: consciente.goskip.app).',
        })
      }

      let rec = null
      try {
        rec = $app.findFirstRecordByFilter('app_settings', "key = 'app_access_link'", '')
      } catch (_) {}

      if (rec) {
        rec.set('value', value)
        $app.save(rec)
      } else {
        const col = $app.findCollectionByNameOrId('app_settings')
        const newRec = new Record(col)
        newRec.set('key', 'app_access_link')
        newRec.set('value', value)
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
        key: 'app_access_link',
        value: value,
        updated: rec.getString('updated') || '',
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
