/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// 1. Webhook do WhatsApp (Meta Cloud API / Composio)
// GET para verificação de webhook (Meta hub challenge)
// ----------------------------------------------------
routerAdd('GET', '/backend/v1/whatsapp/webhook', (e) => {
  const query = e.requestInfo().query || {}
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  const verifySecret = $os.getenv('WHATSAPP_VERIFY_TOKEN') || 'agente-financeiro-token'

  if (mode === 'subscribe' && (token === verifySecret || token === 'agente-financeiro')) {
    e.response.header().set('Content-Type', 'text/plain')
    return e.string(200, challenge || 'ok')
  }

  return e.json(403, { error: 'Verification failed' })
})

// ----------------------------------------------------
// 2. Webhook POST - Recebe mensagens reais do WhatsApp
// ----------------------------------------------------
routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  try {
    const normalizeDigits = function (raw) {
      if (!raw) return ''
      let digits = String(raw).replace(/\D/g, '')
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits
      }
      return digits
    }

    const body = e.requestInfo().body || {}
    const entries = body.entry || []

    let processedCount = 0

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const changes = entry.changes || []

      for (let j = 0; j < changes.length; j++) {
        const change = changes[j]
        const value = change.value || {}
        const messages = value.messages || []
        const contactsList = value.contacts || []

        for (let k = 0; k < messages.length; k++) {
          const msg = messages[k]
          const fromRaw = msg.from
          const msgType = msg.type

          let textContent = ''
          if (msgType === 'text' && msg.text) {
            textContent = msg.text.body || ''
          } else if (msgType === 'interactive' && msg.interactive) {
            textContent =
              msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || ''
          }

          if (fromRaw && textContent) {
            const phoneDigits = normalizeDigits(fromRaw)
            let senderName = ''
            if (contactsList && contactsList[k]) {
              senderName = contactsList[k].profile?.name || ''
            }

            // 1. Localiza usuário vinculado
            let matchedUser = null
            try {
              const statusRecords = $app.findRecordsByFilter(
                'whatsapp_status',
                '',
                '-created',
                200,
                0,
              )
              for (let s = 0; s < statusRecords.length; s++) {
                const rec = statusRecords[s]
                const recPhone = normalizeDigits(rec.getString('phone_number'))
                if (
                  recPhone &&
                  (recPhone === phoneDigits ||
                    recPhone.endsWith(phoneDigits) ||
                    phoneDigits.endsWith(recPhone))
                ) {
                  const ownerId = rec.getString('owner')
                  if (ownerId) {
                    matchedUser = $app.findRecordById('_pb_users_auth_', ownerId)
                    break
                  }
                }
              }
            } catch (_) {}

            // 2. Busca ou cria whatsapp_contact
            const contactsCol = $app.findCollectionByNameOrId('whatsapp_contacts')
            let contact = null
            try {
              contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', phoneDigits)
            } catch (_) {
              contact = new Record(contactsCol)
              contact.set('phone_number', phoneDigits)
              contact.set('name', senderName || 'Contato WhatsApp')
              contact.set('messages_count', 0)
            }

            if (matchedUser) {
              contact.set('user', matchedUser.id)
              if (matchedUser.getString('name') && !contact.getString('name')) {
                contact.set('name', matchedUser.getString('name'))
              }
            } else if (!contact.getString('user')) {
              contact.set('user', '')
            }

            if (senderName && contact.getString('name') === 'Contato WhatsApp') {
              contact.set('name', senderName)
            }
            $app.save(contact)

            // 3. Determina usuário ativo para o agente
            let activeUserId = ''
            let isRegistered = false

            if (matchedUser) {
              activeUserId = matchedUser.id
              isRegistered = true
            } else {
              try {
                const guest = $app.findAuthRecordByEmail(
                  '_pb_users_auth_',
                  'whatsapp-visitante@agente.internal',
                )
                activeUserId = guest.id
              } catch (_) {
                const anyUsers = $app.findRecordsByFilter('_pb_users_auth_', '', 'created', 1, 0)
                if (anyUsers.length > 0) activeUserId = anyUsers[0].id
              }
            }

            if (!activeUserId) {
              continue
            }

            const existingConvId = contact.getString('conversation_id') || null
            let promptForAgent = textContent
            if (!isRegistered) {
              promptForAgent = `[ATENÇÃO: Mensagem recebida via WhatsApp de um número AINDA NÃO CADASTRADO no aplicativo (${phoneDigits}, nome: "${senderName || 'Visitante'}"). Apresente-se cordialmente como o Agente Financeiro do WhatsApp, explique brevemente que você ajuda no controle diário de custos e caixinhas, responda à dúvida dele e convide-o a se cadastrar na plataforma para conectar as caixinhas e transações à conta dele]: ${textContent}`
            }

            let agentReply = ''
            let newConvId = existingConvId

            try {
              const agentResult = $ai.agent('financeiro-whatsapp').chat({
                user_id: activeUserId,
                conversation_id: existingConvId,
                message: promptForAgent,
              })
              agentReply = agentResult.content || ''
              newConvId = agentResult.conversation_id || existingConvId
            } catch (aErr) {
              console.log('[whatsapp_bridge] Falha ao executar agente:', aErr)
              if (!isRegistered) {
                agentReply =
                  'Olá! Eu sou seu Agente Financeiro no WhatsApp. Seu número ainda não está vinculado a uma conta no app. Acesse nosso portal para criar sua conta, definir suas caixinhas e controlar seus custos diários em tempo real!'
              } else {
                agentReply =
                  'Desculpe, tive uma instabilidade momentânea ao processar sua solicitação financeira. Por favor, tente novamente em alguns instantes!'
              }
            }

            // Atualiza contato
            try {
              const currentCount = contact.getInt('messages_count') || 0
              contact.set('messages_count', currentCount + 1)
              contact.set('last_message_at', new Date().toISOString())
              if (newConvId) contact.set('conversation_id', newConvId)
              $app.save(contact)
            } catch (_) {}

            // Envia resposta no WhatsApp se connector owner estiver ativo
            try {
              if (
                typeof $connectors !== 'undefined' &&
                typeof $connectors.executeAsOwner === 'function'
              ) {
                // Recupera phone_number_id persistido ou fallback padrão
                let activePhoneId = '1314873981716321'
                try {
                  const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
                  if (wsList.length > 0 && wsList[0].getString('phone_number_id')) {
                    activePhoneId = wsList[0].getString('phone_number_id')
                  }
                } catch (_) {}

                const sendResult = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
                  to_number: phoneDigits,
                  phone_number_id: activePhoneId,
                  text: agentReply,
                })
                if (!sendResult.successful) {
                  console.log('[whatsapp_bridge] Connector envio retornou falso:', sendResult.error)
                }
              }
            } catch (cErr) {
              console.log('[whatsapp_bridge] Connector executeAsOwner falhou ou não ativo:', cErr)
            }

            processedCount++
          }
        }
      }
    }

    return e.json(200, { success: true, processed: processedCount })
  } catch (err) {
    console.log('[whatsapp_bridge] Erro no webhook POST:', err)
    return e.json(200, { success: false, error: String(err) })
  }
})

// ----------------------------------------------------
// 3. Rota de Simulação / Teste do WhatsApp
// Permite testar o fluxo completo ponta a ponta
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/simulate',
  (e) => {
    try {
      const normalizeDigits = function (raw) {
        if (!raw) return ''
        let digits = String(raw).replace(/\D/g, '')
        if (digits.length === 10 || digits.length === 11) {
          digits = '55' + digits
        }
        return digits
      }

      const body = e.requestInfo().body || {}
      const rawPhone = body.phone_number
      const message = body.message
      const senderName = body.sender_name || 'Usuário Teste'

      if (!rawPhone || !message) {
        return e.json(400, { error: 'phone_number e message são obrigatórios' })
      }

      const phoneDigits = normalizeDigits(rawPhone)

      // 1. Localiza usuário vinculado
      let matchedUser = null
      try {
        const statusRecords = $app.findRecordsByFilter('whatsapp_status', '', '-created', 200, 0)
        for (let s = 0; s < statusRecords.length; s++) {
          const rec = statusRecords[s]
          const recPhone = normalizeDigits(rec.getString('phone_number'))
          if (
            recPhone &&
            (recPhone === phoneDigits ||
              recPhone.endsWith(phoneDigits) ||
              phoneDigits.endsWith(recPhone))
          ) {
            const ownerId = rec.getString('owner')
            if (ownerId) {
              matchedUser = $app.findRecordById('_pb_users_auth_', ownerId)
              break
            }
          }
        }
      } catch (_) {}

      // 2. Localiza ou cria registro de contato
      const contactsCol = $app.findCollectionByNameOrId('whatsapp_contacts')
      let contact = null
      try {
        contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', phoneDigits)
      } catch (_) {
        contact = new Record(contactsCol)
        contact.set('phone_number', phoneDigits)
        contact.set('name', senderName || 'Contato WhatsApp')
        contact.set('messages_count', 0)
      }

      if (matchedUser) {
        contact.set('user', matchedUser.id)
        if (matchedUser.getString('name') && !contact.getString('name')) {
          contact.set('name', matchedUser.getString('name'))
        }
      } else if (!contact.getString('user')) {
        contact.set('user', '')
      }

      if (senderName && contact.getString('name') === 'Contato WhatsApp') {
        contact.set('name', senderName)
      }
      $app.save(contact)

      // 3. Determina usuário ativo para o agente
      let activeUserId = ''
      let isRegistered = false

      if (matchedUser) {
        activeUserId = matchedUser.id
        isRegistered = true
      } else {
        try {
          const guest = $app.findAuthRecordByEmail(
            '_pb_users_auth_',
            'whatsapp-visitante@agente.internal',
          )
          activeUserId = guest.id
        } catch (_) {
          const anyUsers = $app.findRecordsByFilter('_pb_users_auth_', '', 'created', 1, 0)
          if (anyUsers.length > 0) activeUserId = anyUsers[0].id
        }
      }

      if (!activeUserId) {
        return e.json(500, { error: 'Nenhum usuário disponível para executar o agente.' })
      }

      const existingConvId = contact.getString('conversation_id') || null

      let promptForAgent = message
      if (!isRegistered) {
        promptForAgent = `[ATENÇÃO: Mensagem recebida via WhatsApp de um número AINDA NÃO CADASTRADO no aplicativo (${phoneDigits}, nome: "${senderName || 'Visitante'}"). Apresente-se cordialmente como o Agente Financeiro do WhatsApp, explique brevemente que você ajuda no controle diário de custos e caixinhas, responda à dúvida dele e convide-o a se cadastrar na plataforma para conectar as caixinhas e transações à conta dele]: ${message}`
      }

      let agentReply = ''
      let newConvId = existingConvId

      try {
        const agentResult = $ai.agent('financeiro-whatsapp').chat({
          user_id: activeUserId,
          conversation_id: existingConvId,
          message: promptForAgent,
        })
        agentReply = agentResult.content || ''
        newConvId = agentResult.conversation_id || existingConvId
      } catch (aErr) {
        console.log('[whatsapp_bridge] Falha ao executar agente no simulate:', aErr)
        if (!isRegistered) {
          agentReply =
            'Olá! Eu sou seu Agente Financeiro no WhatsApp. Seu número ainda não está vinculado a uma conta no app. Acesse nosso portal para criar sua conta, definir suas caixinhas e controlar seus custos diários em tempo real!'
        } else {
          agentReply =
            'Desculpe, tive uma instabilidade momentânea ao processar sua solicitação financeira. Por favor, tente novamente em alguns instantes!'
        }
      }

      // Atualiza contato
      try {
        const currentCount = contact.getInt('messages_count') || 0
        contact.set('messages_count', currentCount + 1)
        contact.set('last_message_at', new Date().toISOString())
        if (newConvId) contact.set('conversation_id', newConvId)
        $app.save(contact)
      } catch (_) {}

      // Tenta conector se disponível
      let connectorSent = false
      let connectorError = null
      let activePhoneId = '1314873981716321'
      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
        if (wsList.length > 0 && wsList[0].getString('phone_number_id')) {
          activePhoneId = wsList[0].getString('phone_number_id')
        }
      } catch (_) {}

      try {
        if (
          typeof $connectors !== 'undefined' &&
          typeof $connectors.executeAsOwner === 'function'
        ) {
          const sendRes = $connectors.executeAsOwner('WHATSAPP_SEND_MESSAGE', {
            to_number: phoneDigits,
            phone_number_id: activePhoneId,
            text: agentReply,
          })
          connectorSent = !!sendRes.successful
          if (!sendRes.successful) connectorError = sendRes.error
        } else {
          connectorError = 'Conector WhatsApp não habilitado no Skip Cloud'
        }
      } catch (cErr) {
        connectorError = cErr ? cErr.message : 'Conector owner pendente'
      }
      return e.json(200, {
        success: true,
        simulation: true,
        phone: phoneDigits,
        user_id: activeUserId,
        user_name: matchedUser ? matchedUser.getString('name') : 'Visitante',
        is_registered: isRegistered,
        conversation_id: newConvId,
        reply: agentReply,
        connector_sent: connectorSent,
        connector_error: connectorError,
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro na rota de simulação:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 4. Rota para consultar status do conector WhatsApp e número conectado
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/whatsapp/status',
  (e) => {
    try {
      let isOwnerConnected = false
      let registeredPhone = null
      let phoneNumbers = []
      let checkError = null

      try {
        if (
          typeof $connectors !== 'undefined' &&
          typeof $connectors.executeAsOwner === 'function'
        ) {
          const listRes = $connectors.executeAsOwner('WHATSAPP_GET_PHONE_NUMBERS', {})
          if (listRes.successful && listRes.data) {
            isOwnerConnected = true
            const data = listRes.data
            phoneNumbers = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
            if (phoneNumbers.length > 0) {
              registeredPhone =
                phoneNumbers[0].display_phone_number || phoneNumbers[0].phone_number || null
            }
          } else {
            checkError = listRes.error || 'Não conectado no Composio/Meta'
          }
        }
      } catch (cErr) {
        checkError = cErr ? cErr.message : 'Conector owner pendente'
      }

      // Procura número configurado no whatsapp_status do usuário logado
      let userConfiguredPhone = '+55 11 94998-9868'
      let userWaActive = true
      let phoneNumberId = '1314873981716321'
      let wabaId = '1888947369148112'
      let appName = 'Eleva App'
      let verifyToken = 'agente-financeiro'

      const authUser = e.auth
      if (authUser) {
        try {
          const ws = $app.findRecordsByFilter(
            'whatsapp_status',
            `owner = '${authUser.id}'`,
            '',
            1,
            0,
          )
          if (ws.length > 0) {
            userConfiguredPhone = ws[0].getString('phone_number') || userConfiguredPhone
            userWaActive = ws[0].getBool('connected')
            phoneNumberId = ws[0].getString('phone_number_id') || phoneNumberId
            wabaId = ws[0].getString('waba_id') || wabaId
            appName = ws[0].getString('app_name') || appName
            verifyToken = ws[0].getString('verify_token') || verifyToken
          }
        } catch (_) {}
      }

      const instanceUrl =
        $os.getenv('PB_INSTANCE_URL') ||
        'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'

      // Backend URL público oficial para webhooks (VITE_POCKETBASE_URL / PB_INSTANCE_URL)
      const webhookUrl = `${instanceUrl}/backend/v1/whatsapp/webhook`

      return e.json(200, {
        owner_connected: isOwnerConnected,
        owner_phone: registeredPhone || userConfiguredPhone,
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        app_name: appName,
        verify_token: verifyToken,
        available_numbers: phoneNumbers,
        user_phone: userConfiguredPhone,
        user_connected: userWaActive,
        error: checkError,
        webhook_url: webhookUrl,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 5. Rota para listar contatos que interagiram pelo WhatsApp
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/whatsapp/contacts',
  (e) => {
    try {
      const contacts = $app.findRecordsByFilter(
        'whatsapp_contacts',
        '',
        '-last_message_at,-created',
        100,
        0,
      )
      const list = []
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i]
        const userId = c.getString('user')
        let userName = ''
        if (userId) {
          try {
            const u = $app.findRecordById('_pb_users_auth_', userId)
            userName = u.getString('name') || u.getString('email')
          } catch (_) {}
        }

        list.push({
          id: c.id,
          phone_number: c.getString('phone_number'),
          name: c.getString('name'),
          user_id: userId,
          user_name: userName,
          is_registered: !!userId,
          conversation_id: c.getString('conversation_id'),
          messages_count: c.getInt('messages_count'),
          last_message_at: c.getString('last_message_at'),
          created: c.getString('created'),
        })
      }
      return e.json(200, { contacts: list })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
