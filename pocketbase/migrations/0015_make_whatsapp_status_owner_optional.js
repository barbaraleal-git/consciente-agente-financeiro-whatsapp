/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const wsCol = app.findCollectionByNameOrId('whatsapp_status')
    const ownerField = wsCol.fields.getByName('owner')
    if (ownerField) {
      ownerField.required = false
      app.save(wsCol)
    }
  },
  (app) => {
    try {
      const wsCol = app.findCollectionByNameOrId('whatsapp_status')
      const ownerField = wsCol.fields.getByName('owner')
      if (ownerField) {
        ownerField.required = true
        app.save(wsCol)
      }
    } catch (_) {}
  },
)
