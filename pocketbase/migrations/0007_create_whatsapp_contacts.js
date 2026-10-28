/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCollection.id

    // 1. Ensure a shared guest/visitor user for anonymous WhatsApp numbers
    const guestEmail = 'whatsapp-visitante@agente.internal'
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', guestEmail)
    } catch (_) {
      const guest = new Record(usersCollection)
      guest.setEmail(guestEmail)
      guest.setPassword($security.randomString(28))
      guest.setVerified(true)
      guest.set('name', 'Visitante WhatsApp')
      guest.set('onboarding_completed', true)
      app.save(guest)
    }

    // 2. Create whatsapp_contacts collection
    const whatsappContacts = new Collection({
      name: 'whatsapp_contacts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'phone_number',
          type: 'text',
          required: true,
        },
        {
          name: 'user',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'conversation_id',
          type: 'text',
        },
        {
          name: 'last_message_at',
          type: 'text',
        },
        {
          name: 'messages_count',
          type: 'number',
          onlyInt: true,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_whatsapp_contacts_phone ON whatsapp_contacts (phone_number)',
        'CREATE INDEX idx_whatsapp_contacts_user ON whatsapp_contacts (user)',
      ],
    })
    app.save(whatsappContacts)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('whatsapp_contacts')
      app.delete(col)
    } catch (_) {}
  },
)
