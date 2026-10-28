/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const wsCol = app.findCollectionByNameOrId('whatsapp_status')

    if (!wsCol.fields.getByName('access_token')) {
      wsCol.fields.add(
        new TextField({
          name: 'access_token',
          required: false,
          hidden: true,
        }),
      )
    }

    if (!wsCol.fields.getByName('last_send_error')) {
      wsCol.fields.add(
        new TextField({
          name: 'last_send_error',
          required: false,
        }),
      )
    }

    if (!wsCol.fields.getByName('last_send_status')) {
      wsCol.fields.add(
        new TextField({
          name: 'last_send_status',
          required: false,
        }),
      )
    }

    if (!wsCol.fields.getByName('last_send_at')) {
      wsCol.fields.add(
        new TextField({
          name: 'last_send_at',
          required: false,
        }),
      )
    }

    app.save(wsCol)
  },
  (app) => {
    try {
      const wsCol = app.findCollectionByNameOrId('whatsapp_status')
      const f1 = wsCol.fields.getByName('access_token')
      if (f1) wsCol.fields.remove(f1)
      const f2 = wsCol.fields.getByName('last_send_error')
      if (f2) wsCol.fields.remove(f2)
      const f3 = wsCol.fields.getByName('last_send_status')
      if (f3) wsCol.fields.remove(f3)
      const f4 = wsCol.fields.getByName('last_send_at')
      if (f4) wsCol.fields.remove(f4)
      app.save(wsCol)
    } catch (_) {}
  },
)
