/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Garantir que o usuário de serviço permanente para visitantes/WhatsApp exista
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'whatsapp-visitante@agente.internal')
    } catch (_) {
      const guest = new Record(users)
      guest.setEmail('whatsapp-visitante@agente.internal')
      guest.setPassword('Skip@Pass123!')
      guest.setVerified(true)
      guest.set('name', 'Visitante WhatsApp')
      guest.set('onboarding_completed', true)
      app.save(guest)
      console.log('[migration 0016] Usuário de serviço whatsapp-visitante@agente.internal criado.')
    }

    // 2. Garantir que a usuária Barbara Leal exista (caso tenha sido zerada na limpeza)
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'barbara.ferreira.leal@gmail.com')
    } catch (_) {
      const barbara = new Record(users)
      barbara.setEmail('barbara.ferreira.leal@gmail.com')
      barbara.setPassword('Skip@Pass')
      barbara.setVerified(true)
      barbara.set('name', 'Bárbara Leal')
      barbara.set('phone', '5511976729458')
      barbara.set('onboarding_completed', true)
      app.save(barbara)
      console.log('[migration 0016] Usuária barbara.ferreira.leal@gmail.com recriada com sucesso.')
    }

    // 3. Vincular contato existente da Barbara se já estiver no banco
    try {
      const contact = app.findFirstRecordByData(
        'whatsapp_contacts',
        'phone_number',
        '5511976729458',
      )
      const barbaraUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'barbara.ferreira.leal@gmail.com',
      )
      if (!contact.getString('user')) {
        contact.set('user', barbaraUser.id)
        if (!contact.getString('name')) {
          contact.set('name', 'Bárbara Leal')
        }
        app.save(contact)
        console.log('[migration 0016] Contato da Barbara vinculado ao usuário recriado.')
      }
    } catch (_) {}

    // 4. Vincular owner de whatsapp_status à Barbara se estiver vazio
    try {
      const barbaraUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'barbara.ferreira.leal@gmail.com',
      )
      const statusRecords = app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
      if (statusRecords.length > 0) {
        const ws = statusRecords[0]
        if (!ws.getString('owner')) {
          ws.set('owner', barbaraUser.id)
          app.save(ws)
          console.log('[migration 0016] whatsapp_status vinculado ao usuário da Barbara.')
        }
      }
    } catch (_) {}
  },
  (app) => {
    // down migration: no-op to preserve accounts
  },
)
