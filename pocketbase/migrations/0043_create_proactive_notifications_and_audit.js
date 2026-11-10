// pocketbase/migrations/0043_create_proactive_notifications_and_audit.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let existing = null
    try {
      existing = app.findCollectionByNameOrId('proactive_logs')
    } catch (_) {}

    if (!existing) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const usersId = usersCol.id

      const collection = new Collection({
        name: 'proactive_logs',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: usersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'channel',
            type: 'select',
            required: true,
            values: ['whatsapp', 'email'],
            maxSelect: 1,
          },
          {
            name: 'kind',
            type: 'text',
            required: true, // 'nightly_reminder', 'precharge_3d', 'precharge_1d'
          },
          {
            name: 'dedupe_key',
            type: 'text',
            required: true, // ex: 'nightly:user123:2026-11-10' ou 'precharge_3d:user123:2026-11-15'
          },
          {
            name: 'recipient',
            type: 'text',
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['sent', 'failed', 'skipped'],
            maxSelect: 1,
          },
          {
            name: 'error',
            type: 'text',
          },
          {
            name: 'details',
            type: 'json',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_proactive_logs_dedupe ON proactive_logs (dedupe_key)',
          'CREATE INDEX idx_proactive_logs_user_kind ON proactive_logs (user, kind)',
          'CREATE INDEX idx_proactive_logs_created ON proactive_logs (created)',
        ],
      })
      app.save(collection)
      console.log('[migration 0043] Coleção proactive_logs criada com sucesso.')
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('proactive_logs')
      if (col) {
        app.delete(col)
        console.log('[migration 0043] Coleção proactive_logs removida.')
      }
    } catch (err) {
      console.log('[migration 0043] Revert error:', err)
    }
  },
)
