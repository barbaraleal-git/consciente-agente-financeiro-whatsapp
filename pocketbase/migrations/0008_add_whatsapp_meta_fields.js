/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const wsCol = app.findCollectionByNameOrId('whatsapp_status')

    if (!wsCol.fields.getByName('phone_number_id')) {
      wsCol.fields.add(
        new TextField({
          name: 'phone_number_id',
          required: false,
        }),
      )
    }

    if (!wsCol.fields.getByName('waba_id')) {
      wsCol.fields.add(
        new TextField({
          name: 'waba_id',
          required: false,
        }),
      )
    }

    if (!wsCol.fields.getByName('app_name')) {
      wsCol.fields.add(
        new TextField({
          name: 'app_name',
          required: false,
        }),
      )
    }

    if (!wsCol.fields.getByName('verify_token')) {
      wsCol.fields.add(
        new TextField({
          name: 'verify_token',
          required: false,
        }),
      )
    }

    app.save(wsCol)

    // Atualiza registro existente de whatsapp_status para o usuário Bárbara Leal com os IDs da Meta
    try {
      const records = app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        rec.set('phone_number', '+55 11 94998-9868')
        rec.set('phone_number_id', '1314873981716321')
        rec.set('waba_id', '1888947369148112')
        rec.set('app_name', 'Eleva App')
        rec.set('verify_token', 'agente-financeiro')
        rec.set('connected', true)
        app.save(rec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const wsCol = app.findCollectionByNameOrId('whatsapp_status')
      const f1 = wsCol.fields.getByName('phone_number_id')
      if (f1) wsCol.fields.remove(f1)
      const f2 = wsCol.fields.getByName('waba_id')
      if (f2) wsCol.fields.remove(f2)
      const f3 = wsCol.fields.getByName('app_name')
      if (f3) wsCol.fields.remove(f3)
      const f4 = wsCol.fields.getByName('verify_token')
      if (f4) wsCol.fields.remove(f4)
      app.save(wsCol)
    } catch (_) {}
  },
)
