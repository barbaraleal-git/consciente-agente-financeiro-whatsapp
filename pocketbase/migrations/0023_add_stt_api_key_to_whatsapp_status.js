/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const wsCol = app.findCollectionByNameOrId('whatsapp_status')

    if (!wsCol.fields.getByName('stt_api_key')) {
      wsCol.fields.add(
        new TextField({
          name: 'stt_api_key',
          required: false,
          hidden: true,
        }),
      )
    }

    app.save(wsCol)
  },
  (app) => {
    try {
      const wsCol = app.findCollectionByNameOrId('whatsapp_status')
      const field = wsCol.fields.getByName('stt_api_key')
      if (field) {
        wsCol.fields.remove(field)
        app.save(wsCol)
      }
    } catch (_) {}
  },
)
