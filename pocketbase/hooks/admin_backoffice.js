/// <reference path="../pb_data/types.d.ts" />

// Rotas de Backoffice Administrativo (exclusivas para admin)

// 1. Visão geral (métricas) e lista de clientes
routerAdd(
  'GET',
  '/backend/v1/admin/overview',
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

      // Usuários reais
      const allUsers = $app.findRecordsByFilter(
        '_pb_users_auth_',
        "email != 'whatsapp-visitante@agente.internal'",
        '-created',
        500,
        0,
      )

      const totalClients = allUsers.length

      // Data de 7 e 30 dias atrás
      const now = new Date()
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ')
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ')

      // Total de transações
      const allTransactions = $app.findRecordsByFilter('transactions', '', '-created', 1000, 0)
      const totalTransactions = allTransactions.length

      // Transações recentes para calcular clientes ativos
      const active7Set = {}
      const active30Set = {}

      for (let i = 0; i < allTransactions.length; i++) {
        const tx = allTransactions[i]
        const txOwner = tx.getString('owner')
        const created = tx.getString('created')
        if (created >= d7 && txOwner) active7Set[txOwner] = true
        if (created >= d30 && txOwner) active30Set[txOwner] = true
      }

      // Mensagens recentes do WhatsApp para clientes ativos
      const allWaMsgs = $app.findRecordsByFilter('whatsapp_messages', '', '-created', 1000, 0)
      for (let i = 0; i < allWaMsgs.length; i++) {
        const msg = allWaMsgs[i]
        const msgOwner = msg.getString('owner')
        const created = msg.getString('created')
        if (created >= d7 && msgOwner) active7Set[msgOwner] = true
        if (created >= d30 && msgOwner) active30Set[msgOwner] = true
      }

      const activeClients7d = Object.keys(active7Set).length
      const activeClients30d = Object.keys(active30Set).length

      // Conversas ativas no WhatsApp (contatos que interagiram)
      const waContacts = $app.findRecordsByFilter(
        'whatsapp_contacts',
        '',
        '-last_interaction',
        500,
        0,
      )
      const activeWhatsappConversations = waContacts.length

      // Mapeamento de contatos por user id e por telefone
      const contactByUser = {}
      for (let i = 0; i < waContacts.length; i++) {
        const c = waContacts[i]
        const uId = c.getString('user')
        if (uId) {
          contactByUser[uId] = c
        }
      }

      // Caixinhas e transações por usuário
      const allBudgets = $app.findRecordsByFilter('budgets', '', '-created', 1000, 0)
      const budgetsByUser = {}
      for (let i = 0; i < allBudgets.length; i++) {
        const b = allBudgets[i]
        const uId = b.getString('owner')
        if (uId) {
          budgetsByUser[uId] = (budgetsByUser[uId] || 0) + 1
        }
      }

      const txByUser = {}
      for (let i = 0; i < allTransactions.length; i++) {
        const tx = allTransactions[i]
        const uId = tx.getString('owner')
        if (uId) {
          txByUser[uId] = (txByUser[uId] || 0) + 1
        }
      }

      // Monta lista de clientes para a visão geral
      const clientsList = []
      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i]
        const uId = u.id
        const userPhone = u.getString('phone') || ''
        const linkedContact = contactByUser[uId]
        const hasWaLinked = !!(linkedContact || userPhone)

        clientsList.push({
          id: uId,
          name: u.getString('name') || 'Sem nome',
          email: u.getString('email'),
          phone: userPhone || (linkedContact ? linkedContact.getString('phone_number') : ''),
          role: u.getString('role') || 'client',
          created: u.getString('created'),
          updated: u.getString('updated'),
          onboarding_completed: u.getBool('onboarding_completed'),
          has_whatsapp_linked: hasWaLinked,
          whatsapp_contact_id: linkedContact ? linkedContact.id : '',
          caixinhas_count: budgetsByUser[uId] || 0,
          transactions_count: txByUser[uId] || 0,
        })
      }

      return e.json(200, {
        metrics: {
          total_clients: totalClients,
          active_clients_7d: activeClients7d,
          active_clients_30d: activeClients30d,
          total_transactions: totalTransactions,
          active_whatsapp_conversations: activeWhatsappConversations,
        },
        clients: clientsList,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// 2. Detalhe de um cliente específico (caixinhas, transações, situação WhatsApp, histórico recente)
routerAdd(
  'GET',
  '/backend/v1/admin/clients/{id}',
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

      const clientId = e.request.pathValue('id')
      if (!clientId) {
        return e.json(400, { error: 'ID do cliente obrigatório' })
      }

      const client = $app.findRecordById('_pb_users_auth_', clientId)
      if (!client || client.getString('email') === 'whatsapp-visitante@agente.internal') {
        return e.json(404, { error: 'Cliente não encontrado' })
      }

      // Caixinhas (budgets + categoria vinculada)
      const budgets = $app.findRecordsByFilter(
        'budgets',
        `owner = '${clientId}'`,
        '-created',
        100,
        0,
      )
      const categories = $app.findRecordsByFilter(
        'categories',
        `owner = '${clientId}'`,
        '-created',
        100,
        0,
      )
      const catMap = {}
      for (let i = 0; i < categories.length; i++) {
        const c = categories[i]
        catMap[c.id] = {
          id: c.id,
          name: c.getString('name'),
          icon: c.getString('icon'),
          color: c.getString('color'),
          type: c.getString('type'),
        }
      }

      const caixinhas = []
      for (let i = 0; i < budgets.length; i++) {
        const b = budgets[i]
        const catId = b.getString('category')
        const cat = catMap[catId] || { name: 'Sem categoria', icon: 'tag', color: '#64748b' }
        caixinhas.push({
          id: b.id,
          category_id: catId,
          category_name: cat.name,
          icon: cat.icon,
          color: cat.color,
          limit_cents: b.getInt('limit_cents'),
          spent_cents: b.getInt('spent_cents'),
          period: b.getString('period'),
        })
      }

      // Últimas 20 transações
      const transactions = $app.findRecordsByFilter(
        'transactions',
        `owner = '${clientId}'`,
        '-created',
        20,
        0,
      )
      const recentTransactions = []
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i]
        const catId = tx.getString('category')
        const cat = catMap[catId]
        recentTransactions.push({
          id: tx.id,
          amount_cents: tx.getInt('amount_cents'),
          type: tx.getString('type'),
          description: tx.getString('description'),
          category_name: cat ? cat.name : 'Outros',
          date: tx.getString('date'),
          created: tx.getString('created'),
          is_recurring: tx.getBool('is_recurring'),
        })
      }

      // Vínculo WhatsApp
      let linkedContact = null
      try {
        const contacts = $app.findRecordsByFilter(
          'whatsapp_contacts',
          `user = '${clientId}'`,
          '-last_interaction',
          1,
          0,
        )
        if (contacts.length > 0) linkedContact = contacts[0]
      } catch (_) {}

      // Se não encontrou por user, tenta por telefone
      const userPhone = client.getString('phone')
      if (!linkedContact && userPhone) {
        const cleanPhone = String(userPhone).replace(/\D/g, '')
        try {
          const contacts = $app.findRecordsByFilter(
            'whatsapp_contacts',
            `phone_number ~ '${cleanPhone.slice(-8)}'`,
            '-last_interaction',
            1,
            0,
          )
          if (contacts.length > 0) linkedContact = contacts[0]
        } catch (_) {}
      }

      const whatsappDetails = {
        phone: userPhone || (linkedContact ? linkedContact.getString('phone_number') : ''),
        is_linked: !!linkedContact || !!userPhone,
        contact_id: linkedContact ? linkedContact.id : null,
        contact_name: linkedContact ? linkedContact.getString('name') : null,
        contact_phone: linkedContact ? linkedContact.getString('phone_number') : null,
        last_interaction: linkedContact ? linkedContact.getString('last_interaction') : null,
        thread_id: linkedContact ? linkedContact.getString('thread_id') : null,
      }

      // Histórico recente da conversa WhatsApp (últimas 30 mensagens)
      const messages = $app.findRecordsByFilter(
        'whatsapp_messages',
        `owner = '${clientId}' || from_number ~ '${whatsappDetails.phone.slice(-8)}'`,
        '-created',
        30,
        0,
      )
      const conversationHistory = []
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]
        conversationHistory.push({
          id: m.id,
          direction: m.getString('direction'),
          message_text: m.getString('message_text'),
          status: m.getString('status'),
          created: m.getString('created'),
        })
      }
      // Ordena cronológica crescente
      conversationHistory.reverse()

      return e.json(200, {
        client: {
          id: client.id,
          name: client.getString('name'),
          email: client.getString('email'),
          phone: client.getString('phone'),
          role: client.getString('role') || 'client',
          onboarding_completed: client.getBool('onboarding_completed'),
          created: client.getString('created'),
          updated: client.getString('updated'),
        },
        caixinhas: caixinhas,
        recent_transactions: recentTransactions,
        whatsapp: whatsappDetails,
        conversation_history: conversationHistory,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// 3. Ação de suporte: Zerar o fio de conversa (thread) do cliente
routerAdd(
  'POST',
  '/backend/v1/admin/clients/{id}/reset-thread',
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

      const clientId = e.request.pathValue('id')
      if (!clientId) {
        return e.json(400, { error: 'ID do cliente obrigatório' })
      }

      const client = $app.findRecordById('_pb_users_auth_', clientId)
      if (!client) {
        return e.json(404, { error: 'Cliente não encontrado' })
      }

      let resetContactsCount = 0
      // Procura contatos do WhatsApp vinculados a este usuário
      try {
        const contacts = $app.findRecordsByFilter(
          'whatsapp_contacts',
          `user = '${clientId}'`,
          '-created',
          10,
          0,
        )
        for (let i = 0; i < contacts.length; i++) {
          const c = contacts[i]
          c.set('thread_id', '')
          $app.save(c)
          resetContactsCount++
        }
      } catch (_) {}

      // Se tiver telefone cadastrado, procura também pelo número
      const userPhone = client.getString('phone')
      if (userPhone) {
        const clean = String(userPhone).replace(/\D/g, '')
        try {
          const contacts = $app.findRecordsByFilter(
            'whatsapp_contacts',
            `phone_number ~ '${clean.slice(-8)}'`,
            '-created',
            10,
            0,
          )
          for (let i = 0; i < contacts.length; i++) {
            const c = contacts[i]
            c.set('thread_id', '')
            $app.save(c)
            resetContactsCount++
          }
        } catch (_) {}
      }

      console.log(
        `[admin] Fio de conversa resetado com sucesso para o cliente ${clientId} (${client.getString('email')}). Contatos atualizados: ${resetContactsCount}`,
      )

      return e.json(200, {
        success: true,
        message: 'Fio de conversa resetado com sucesso',
        contacts_reset: resetContactsCount,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// 4. Ação de suporte: Religar ou desvincular o número WhatsApp do cliente
routerAdd(
  'POST',
  '/backend/v1/admin/clients/{id}/toggle-whatsapp',
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

      const clientId = e.request.pathValue('id')
      if (!clientId) {
        return e.json(400, { error: 'ID do cliente obrigatório' })
      }

      const client = $app.findRecordById('_pb_users_auth_', clientId)
      if (!client) {
        return e.json(404, { error: 'Cliente não encontrado' })
      }

      const body = e.requestInfo().body || {}
      const action = body.action || 'toggle' // 'link', 'unlink' ou 'toggle'
      const customPhone = body.phone ? String(body.phone).trim() : ''

      const currentPhone = client.getString('phone')
      let newPhone = currentPhone

      if (action === 'unlink') {
        newPhone = ''
        // Desvincula registros de whatsapp_contacts
        try {
          const contacts = $app.findRecordsByFilter(
            'whatsapp_contacts',
            `user = '${clientId}'`,
            '-created',
            10,
            0,
          )
          for (let i = 0; i < contacts.length; i++) {
            const c = contacts[i]
            c.set('user', null)
            $app.save(c)
          }
        } catch (_) {}
      } else if (action === 'link') {
        newPhone = customPhone || currentPhone
        if (newPhone) {
          const clean = newPhone.replace(/\D/g, '')
          try {
            const contacts = $app.findRecordsByFilter(
              'whatsapp_contacts',
              `phone_number ~ '${clean.slice(-8)}'`,
              '-created',
              1,
              0,
            )
            if (contacts.length > 0) {
              const c = contacts[0]
              c.set('user', clientId)
              $app.save(c)
            }
          } catch (_) {}
        }
      } else {
        // Toggle
        if (currentPhone) {
          newPhone = ''
          try {
            const contacts = $app.findRecordsByFilter(
              'whatsapp_contacts',
              `user = '${clientId}'`,
              '-created',
              10,
              0,
            )
            for (let i = 0; i < contacts.length; i++) {
              const c = contacts[i]
              c.set('user', null)
              $app.save(c)
            }
          } catch (_) {}
        } else if (customPhone) {
          newPhone = customPhone
        }
      }

      client.set('phone', newPhone)
      $app.save(client)

      console.log(
        `[admin] Vínculo WhatsApp alterado para o cliente ${clientId}. Action: ${action}, novo phone: "${newPhone}"`,
      )

      return e.json(200, {
        success: true,
        phone: newPhone,
        is_linked: !!newPhone,
        message: newPhone
          ? 'Número do WhatsApp vinculado com sucesso'
          : 'Número do WhatsApp desvinculado com sucesso',
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
