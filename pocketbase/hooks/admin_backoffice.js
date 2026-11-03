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

      // Conversas do WhatsApp (contatos que interagiram)
      let waContacts = []
      try {
        waContacts = $app.findRecordsByFilter('whatsapp_contacts', '', '-last_message_at', 500, 0)
      } catch (_) {
        try {
          waContacts = $app.findRecordsByFilter('whatsapp_contacts', '', '-created', 500, 0)
        } catch (_) {}
      }

      for (let i = 0; i < waContacts.length; i++) {
        const c = waContacts[i]
        const uId = c.getString('user')
        const lastAt =
          c.getString('last_message_at') || c.getString('updated') || c.getString('created')
        if (uId && lastAt) {
          if (lastAt >= d7) active7Set[uId] = true
          if (lastAt >= d30) active30Set[uId] = true
        }
      }

      const activeClients7d = Object.keys(active7Set).length
      const activeClients30d = Object.keys(active30Set).length
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
      console.log('[admin] Erro em /backend/v1/admin/overview: ' + err)
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

      // Parâmetro opcional de mês de referência (YYYY-MM), padrão = mês atual
      const qMonth = e.requestInfo().query?.month || ''
      const targetMonthStr =
        qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : new Date().toISOString().slice(0, 7)

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
          '-last_message_at',
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
            '-last_message_at',
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
        last_interaction: linkedContact
          ? linkedContact.getString('last_message_at') || linkedContact.getString('updated')
          : null,
        thread_id: linkedContact ? linkedContact.getString('conversation_id') || null : null,
      }

      // Histórico de conversa WhatsApp:
      // O agente financeiro armazena o histórico em $ai.agents threads ou whatsapp_contacts.conversation_id
      // Se houver coleção whatsapp_messages no futuro, busca defensivamente; caso contrário retorna array vazio
      const conversationHistory = []
      try {
        const messages = $app.findRecordsByFilter(
          'whatsapp_messages',
          `owner = '${clientId}' || from_number ~ '${whatsappDetails.phone.slice(-8)}'`,
          '-created',
          30,
          0,
        )
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
        conversationHistory.reverse()
      } catch (_) {
        // Sem tabela whatsapp_messages; conversationHistory permanece []
      }

      // ----------------------------------------------------
      // Cálculo de Custo Estimado do Cliente no mês de referência
      // Modelagem de custos (R$):
      // - Transação via áudio WhatsApp: R$ 0,001 (Groq Whisper)
      // - Mensagem de IA do agente: R$ 0,02 (resposta gerada)
      // - Mensagem ativa/utility fora de 24h: R$ 0,04
      // - Mensagens de serviço (read/typing): R$ 0
      // ----------------------------------------------------
      const COST_AUDIO_TX = 0.001
      const COST_AI_MESSAGE = 0.02
      const COST_UTILITY_MSG = 0.04

      // 1. Transações do cliente no mês selecionado
      let clientMonthTx = []
      try {
        clientMonthTx = $app.findRecordsByFilter(
          'transactions',
          `owner = '${clientId}' && (date ~ '${targetMonthStr}' || created ~ '${targetMonthStr}')`,
          '-created',
          1000,
          0,
        )
      } catch (_) {
        try {
          clientMonthTx = $app.findRecordsByFilter(
            'transactions',
            `owner = '${clientId}'`,
            '-created',
            500,
            0,
          )
        } catch (_) {}
      }

      let txAudioMonth = 0
      let txTextMonth = 0
      let txManualMonth = 0

      for (let i = 0; i < clientMonthTx.length; i++) {
        const tx = clientMonthTx[i]
        const dStr = (tx.getString('date') || tx.getString('created') || '').slice(0, 7)
        if (dStr === targetMonthStr) {
          const s = tx.getString('source')
          if (s === 'whatsapp_audio') {
            txAudioMonth++
          } else if (s === 'whatsapp_text' || s === 'whatsapp') {
            txTextMonth++
          } else {
            txManualMonth++
          }
        }
      }

      // 2. Mensagens do Agente (respostas de IA) no mês selecionado
      let aiMessagesMonth = 0
      let utilityMessagesMonth = 0

      // Verifica histórico do agente nativo via conversations/messages
      let clientConvList = []
      try {
        clientConvList = $ai.agent('financeiro-whatsapp').listConversations({
          user_id: clientId,
          limit: 50,
        })
      } catch (_) {}

      if (Array.isArray(clientConvList) && clientConvList.length > 0) {
        for (let cIdx = 0; cIdx < clientConvList.length; cIdx++) {
          const conv = clientConvList[cIdx]
          try {
            const mList = $ai.agent('financeiro-whatsapp').listMessages({
              conversation_id: conv.id,
              user_id: clientId,
              limit: 200,
            })
            const msgs =
              mList && mList.messages ? mList.messages : Array.isArray(mList) ? mList : []
            for (let mIdx = 0; mIdx < msgs.length; mIdx++) {
              const msg = msgs[mIdx]
              const mDate = (msg.created || '').slice(0, 7)
              if (mDate === targetMonthStr && msg.role === 'assistant') {
                aiMessagesMonth++
              }
            }
          } catch (_) {}
        }
      }

      // Fallback/ajuste com whatsapp_contacts caso listMessages não cubra ou seja novo
      if (aiMessagesMonth === 0 && linkedContact) {
        const contactUpdatedMonth = (
          linkedContact.getString('last_message_at') ||
          linkedContact.getString('updated') ||
          ''
        ).slice(0, 7)
        if (contactUpdatedMonth === targetMonthStr) {
          // O total de mensagens gravadas é contato de entrada; cada entrada gera uma resposta de IA
          const contactMsgCount = linkedContact.getInt('messages_count') || 0
          aiMessagesMonth = contactMsgCount
        }
      }

      const costAudio = txAudioMonth * COST_AUDIO_TX
      const costAi = aiMessagesMonth * COST_AI_MESSAGE
      const costUtility = utilityMessagesMonth * COST_UTILITY_MSG
      const totalEstimatedCost = Math.round((costAudio + costAi + costUtility) * 10000) / 10000

      const estimatedCostData = {
        month: targetMonthStr,
        tx_audio_count: txAudioMonth,
        tx_text_count: txTextMonth,
        tx_manual_count: txManualMonth,
        tx_total_count: txAudioMonth + txTextMonth + txManualMonth,
        ai_messages_count: aiMessagesMonth,
        utility_messages_count: utilityMessagesMonth,
        cost_audio_brl: Math.round(costAudio * 10000) / 10000,
        cost_ai_brl: Math.round(costAi * 10000) / 10000,
        cost_utility_brl: Math.round(costUtility * 10000) / 10000,
        total_cost_brl: totalEstimatedCost,
      }

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
        estimated_cost: estimatedCostData,
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
          c.set('conversation_id', '')
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
            c.set('conversation_id', '')
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

// 5. Custos mensais acumulados por cliente (Item 9 das prioridades)
// Rota dedicada e segura: GET /backend/v1/admin/costs?month=YYYY-MM
// Modelagem de custos:
// - Áudio WhatsApp: R$ 0,001 (Groq Whisper)
// - Mensagens de IA (respostas geradas): R$ 0,02
// - Mensagens ativas/utility fora de 24h: R$ 0,04
// - Mensagens de serviço (read/typing): R$ 0
routerAdd(
  'GET',
  '/backend/v1/admin/costs',
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

      const qMonth = e.requestInfo().query?.month || ''
      const currentMonthStr = new Date().toISOString().slice(0, 7)
      const targetMonthStr = qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : currentMonthStr

      const COST_AUDIO_TX = 0.001
      const COST_AI_MESSAGE = 0.02
      const COST_UTILITY_MSG = 0.04

      // Lista de usuários reais (exclui o visitante técnico de serviço)
      const allUsers = $app.findRecordsByFilter(
        '_pb_users_auth_',
        "email != 'whatsapp-visitante@agente.internal'",
        '-created',
        500,
        0,
      )

      // Todas as transações para agregar por mês
      let allTransactions = []
      try {
        allTransactions = $app.findRecordsByFilter('transactions', '', '-created', 2000, 0)
      } catch (_) {}

      // Mapeamento de contatos do WhatsApp por user_id
      let waContacts = []
      try {
        waContacts = $app.findRecordsByFilter('whatsapp_contacts', '', '-last_message_at', 500, 0)
      } catch (_) {}

      const contactByUser = {}
      for (let i = 0; i < waContacts.length; i++) {
        const c = waContacts[i]
        const uId = c.getString('user')
        if (uId) {
          contactByUser[uId] = c
        }
      }

      // Agrega contagens de transações do mês por usuário
      const audioTxByUser = {}
      const textTxByUser = {}
      const manualTxByUser = {}

      for (let i = 0; i < allTransactions.length; i++) {
        const tx = allTransactions[i]
        const ownerId = tx.getString('owner')
        if (!ownerId) continue

        const dStr = (tx.getString('date') || tx.getString('created') || '').slice(0, 7)
        if (dStr === targetMonthStr) {
          const s = tx.getString('source')
          if (s === 'whatsapp_audio') {
            audioTxByUser[ownerId] = (audioTxByUser[ownerId] || 0) + 1
          } else if (s === 'whatsapp_text' || s === 'whatsapp') {
            textTxByUser[ownerId] = (textTxByUser[ownerId] || 0) + 1
          } else {
            manualTxByUser[ownerId] = (manualTxByUser[ownerId] || 0) + 1
          }
        }
      }

      // Agrega mensagens de IA por usuário no mês
      const aiMessagesByUser = {}
      const utilityMessagesByUser = {}

      for (let uIdx = 0; uIdx < allUsers.length; uIdx++) {
        const u = allUsers[uIdx]
        const uId = u.id
        let aiCount = 0

        // 1. Tenta listar mensagens do agente nativo
        let convs = []
        try {
          convs = $ai.agent('financeiro-whatsapp').listConversations({
            user_id: uId,
            limit: 50,
          })
        } catch (_) {}

        if (Array.isArray(convs) && convs.length > 0) {
          for (let cIdx = 0; cIdx < convs.length; cIdx++) {
            const conv = convs[cIdx]
            try {
              const mList = $ai.agent('financeiro-whatsapp').listMessages({
                conversation_id: conv.id,
                user_id: uId,
                limit: 200,
              })
              const msgs =
                mList && mList.messages ? mList.messages : Array.isArray(mList) ? mList : []
              for (let mIdx = 0; mIdx < msgs.length; mIdx++) {
                const msg = msgs[mIdx]
                const mDate = (msg.created || '').slice(0, 7)
                if (mDate === targetMonthStr && msg.role === 'assistant') {
                  aiCount++
                }
              }
            } catch (_) {}
          }
        }

        // 2. Fallback por contato WhatsApp se não encontrou mensagens pelo histórico do agente
        if (aiCount === 0 && contactByUser[uId]) {
          const c = contactByUser[uId]
          const cMonth = (c.getString('last_message_at') || c.getString('updated') || '').slice(
            0,
            7,
          )
          if (cMonth === targetMonthStr) {
            aiCount = c.getInt('messages_count') || 0
          }
        }

        aiMessagesByUser[uId] = aiCount
      }

      // Monta lista detalhada de custos por cliente
      let totalAudioCount = 0
      let totalTextCount = 0
      let totalManualCount = 0
      let totalAiCount = 0
      let totalUtilityCount = 0
      let totalGlobalCost = 0

      const clientsCosts = []

      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i]
        const uId = u.id
        const userPhone = u.getString('phone') || ''
        const linkedContact = contactByUser[uId]

        const txAudio = audioTxByUser[uId] || 0
        const txText = textTxByUser[uId] || 0
        const txManual = manualTxByUser[uId] || 0
        const txTotal = txAudio + txText + txManual

        const aiMsgs = aiMessagesByUser[uId] || 0
        const utilityMsgs = utilityMessagesByUser[uId] || 0

        const costAudio = txAudio * COST_AUDIO_TX
        const costAi = aiMsgs * COST_AI_MESSAGE
        const costUtility = utilityMsgs * COST_UTILITY_MSG
        const clientCost = Math.round((costAudio + costAi + costUtility) * 10000) / 10000

        totalAudioCount += txAudio
        totalTextCount += txText
        totalManualCount += txManual
        totalAiCount += aiMsgs
        totalUtilityCount += utilityMsgs
        totalGlobalCost += clientCost

        clientsCosts.push({
          client_id: uId,
          client_name: u.getString('name') || 'Sem nome',
          client_email: u.getString('email'),
          client_phone: userPhone || (linkedContact ? linkedContact.getString('phone_number') : ''),
          has_whatsapp_linked: !!(linkedContact || userPhone),
          tx_audio_count: txAudio,
          tx_text_count: txText,
          tx_manual_count: txManual,
          tx_total_count: txTotal,
          ai_messages_count: aiMsgs,
          utility_messages_count: utilityMsgs,
          cost_audio_brl: Math.round(costAudio * 10000) / 10000,
          cost_ai_brl: Math.round(costAi * 10000) / 10000,
          cost_utility_brl: Math.round(costUtility * 10000) / 10000,
          estimated_cost_brl: clientCost,
        })
      }

      // Ordena por custo estimado (maior primeiro)
      clientsCosts.sort((a, b) => {
        if (b.estimated_cost_brl !== a.estimated_cost_brl) {
          return b.estimated_cost_brl - a.estimated_cost_brl
        }
        return b.tx_total_count - a.tx_total_count
      })

      // Meses disponíveis para seleção histórica (mês atual + 5 anteriores)
      const availableMonths = []
      const refDate = new Date()
      for (let m = 0; m < 6; m++) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth() - m, 1)
        const val = d.toISOString().slice(0, 7)
        availableMonths.push(val)
      }

      return e.json(200, {
        month: targetMonthStr,
        available_months: availableMonths,
        rates: {
          audio_tx: COST_AUDIO_TX,
          ai_message: COST_AI_MESSAGE,
          utility_message: COST_UTILITY_MSG,
          service_message: 0,
        },
        totals: {
          total_clients: allUsers.length,
          total_audio_tx: totalAudioCount,
          total_text_tx: totalTextCount,
          total_manual_tx: totalManualCount,
          total_tx: totalAudioCount + totalTextCount + totalManualCount,
          total_ai_messages: totalAiCount,
          total_utility_messages: totalUtilityCount,
          cost_audio_brl: Math.round(totalAudioCount * COST_AUDIO_TX * 10000) / 10000,
          cost_ai_brl: Math.round(totalAiCount * COST_AI_MESSAGE * 10000) / 10000,
          cost_utility_brl: Math.round(totalUtilityCount * COST_UTILITY_MSG * 10000) / 10000,
          total_estimated_cost_brl: Math.round(totalGlobalCost * 10000) / 10000,
        },
        clients: clientsCosts,
      })
    } catch (err) {
      console.log('[admin] Erro em /backend/v1/admin/costs: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
