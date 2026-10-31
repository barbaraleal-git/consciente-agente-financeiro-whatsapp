/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Limpa os conversation_ids órfãos/inválidos que causavam "conversation not found"
    // Isso garante que o próximo envio pelo WhatsApp inicie com uma conversa nova e limpa
    try {
      const contacts = app.findRecordsByFilter('whatsapp_contacts', '', '-created', 100, 0)
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        contact.set('conversation_id', '')
        app.save(contact)
      }
      console.log('[migration 0013] Limpeza de conversation_id em whatsapp_contacts concluída')
    } catch (e) {
      console.log('[migration 0013] Nota ao limpar conversation_ids:', e)
    }

    // 2. Garante que os números das usuárias conhecidas estejam estritamente vinculados
    const knownLinks = [
      {
        email: 'barbara.ferreira.leal@gmail.com',
        phone: '5511976729458',
        name: 'Barbara Leal',
      },
      {
        email: 'lygialeal2014@gmail.com',
        phone: '5511972327157',
        name: 'Lygia Leal',
      },
      {
        email: 'kellylidiane@yahoo.com.br',
        phone: '5511973426061',
        name: 'Kelly Lidiane',
      },
    ]

    for (let i = 0; i < knownLinks.length; i++) {
      const link = knownLinks[i]
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', link.email)
        u.set('phone', link.phone)
        u.set('onboarding_completed', true)
        app.save(u)

        try {
          const contact = app.findFirstRecordByData('whatsapp_contacts', 'phone_number', link.phone)
          contact.set('user', u.id)
          contact.set('conversation_id', '')
          if (!contact.getString('name')) {
            contact.set('name', link.name)
          }
          app.save(contact)
        } catch (_) {}
      } catch (err) {
        console.log('[migration 0013] Nota ao vincular usuária ' + link.email + ':', err)
      }
    }
  },
  (app) => {
    // Reversão
  },
)
