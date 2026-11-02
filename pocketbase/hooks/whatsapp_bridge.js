/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// 1. Webhook do WhatsApp (Meta Cloud API)
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
// 2. Webhook POST - Recebe mensagens reais do WhatsApp da Meta
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

    const getOrCreateGuestUser = function () {
      try {
        const guest = $app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'whatsapp-visitante@agente.internal',
        )
        if (guest && guest.id) return guest
      } catch (_) {}

      try {
        const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
        if (users.length > 0 && users[0].id) return users[0]
      } catch (_) {}

      try {
        const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
        const newGuest = new Record(usersCol)
        newGuest.setEmail('whatsapp-visitante@agente.internal')
        newGuest.setPassword('Skip@Pass123!')
        newGuest.setVerified(true)
        newGuest.set('name', 'Visitante WhatsApp')
        newGuest.set('onboarding_completed', true)
        $app.save(newGuest)
        console.log('[whatsapp_bridge] Usuário visitante criado sob demanda:', newGuest.id)
        return newGuest
      } catch (err) {
        console.log('[whatsapp_bridge] Falha ao criar usuário visitante sob demanda:', err)
      }

      return null
    }

    const isUserAccountReady = function (u) {
      if (!u || !u.id) return false
      // Visitante técnico nunca é considerado usuário cadastrado
      if (u.getString('email') === 'whatsapp-visitante@agente.internal') return false

      // Critério único e centralizado de cadastro completo:
      // Usuário existe no banco de dados. Tolera email pendente de verificação
      // (usuária pode lançar gastos logo após criar conta sem travar no clique do email).
      // Onboarding de caixinhas concluído (onboarding_completed: true) OU possui caixinhas/categorias criadas.
      const onboardingFlag = u.getBool('onboarding_completed')
      if (onboardingFlag) return true

      try {
        const cats = $app.findRecordsByFilter('categories', `owner = '${u.id}'`, '-created', 1, 0)
        if (cats.length > 0) return true
      } catch (_) {}

      return false
    }

    const resolveUser = function (phoneDigits, senderName) {
      if (!phoneDigits) return null

      const suffixMatch = function (p1, p2) {
        if (!p1 || !p2) return false
        if (p1 === p2) return true
        if (p1.endsWith(p2) || p2.endsWith(p1)) return true
        const s1 = p1.slice(-8)
        const s2 = p2.slice(-8)
        return s1.length >= 8 && s1 === s2
      }

      // 1. Verifica se já existe vínculo explícito em whatsapp_contacts
      try {
        const contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', phoneDigits)
        const contactUserId = contact.getString('user')
        if (contactUserId) {
          const u = $app.findRecordById('_pb_users_auth_', contactUserId)
          if (u && u.id && u.getString('email') !== 'whatsapp-visitante@agente.internal') {
            return u
          }
        }
      } catch (_) {}

      // 2. Busca na coleção de usuários pelo campo phone (com match por sufixo)
      try {
        const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 300, 0)
        for (let u = 0; u < users.length; u++) {
          const user = users[u]
          if (user.getString('email') === 'whatsapp-visitante@agente.internal') continue
          const userPhone = normalizeDigits(user.getString('phone'))
          if (userPhone && suffixMatch(userPhone, phoneDigits)) {
            return user
          }
        }
      } catch (_) {}

      // 3. Fallback inteligente: se há exatamente 1 usuário real cadastrado no sistema
      // (caso típico de single-user / ambiente de teste após reset) e o usuário ainda não
      // preencheu o campo phone, faz a auto-associação automática e salva o phone
      try {
        const realUsers = $app.findRecordsByFilter(
          '_pb_users_auth_',
          "email != 'whatsapp-visitante@agente.internal'",
          '-created',
          10,
          0,
        )
        if (realUsers.length === 1) {
          const soleUser = realUsers[0]
          const existingPhone = normalizeDigits(soleUser.getString('phone'))
          if (!existingPhone || suffixMatch(existingPhone, phoneDigits)) {
            if (!existingPhone) {
              try {
                soleUser.set('phone', phoneDigits)
                $app.save(soleUser)
                console.log(
                  `[whatsapp_bridge] Telefone ${phoneDigits} auto-vinculado ao único usuário real cadastrado: ${soleUser.id} (${soleUser.getString('email')})`,
                )
              } catch (_) {}
            }
            return soleUser
          }
        }
      } catch (_) {}

      return null
    }

    const sendMetaStatusAndTyping = function (messageId) {
      if (!messageId) return { success: false, error: 'message_id ausente' }

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          if (recToken) break
        }
      } catch (_) {}

      if (!token) {
        console.log('[whatsapp_bridge] [status+typing] Token ausente, prosseguindo sem indicação')
        return { success: false, error: 'Token ausente' }
      }

      const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: String(messageId),
        typing_indicator: {
          type: 'text',
        },
      }

      try {
        const res = $http.send({
          url: endpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 10,
        })
        const statusCode = res.statusCode
        if (statusCode >= 200 && statusCode < 300) {
          console.log(
            '[whatsapp_bridge] [status+typing] Sucesso status=read + typing_indicator para msg:',
            messageId,
          )
          return { success: true, status: statusCode }
        }
        console.log(
          '[whatsapp_bridge] [status+typing] Meta retornou status HTTP ' +
            statusCode +
            ', seguindo normalmente',
        )
        return { success: false, status: statusCode }
      } catch (err) {
        console.log(
          '[whatsapp_bridge] [status+typing] Exceção na chamada de status (fail-safe):',
          err,
        )
        return { success: false, error: String(err) }
      }
    }

    const sendMetaMessage = function (toNumber, textBody) {
      const cleanTo = normalizeDigits(toNumber)
      if (!cleanTo) return { success: false, error: 'Número inválido' }

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let statusRecord = null

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          if (!statusRecord) statusRecord = rec
          if (recToken) {
            statusRecord = rec
            break
          }
        }
      } catch (_) {}

      if (!token) {
        const errMsg = 'Token da Meta ausente em Configurações'
        console.log('[whatsapp_bridge] Falha no envio: Token de acesso ausente')
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'failed_missing_token')
            statusRecord.set('last_send_error', errMsg)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return { success: false, error: errMsg, missing_token: true }
      }

      const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: false,
          body: String(textBody || '').trim(),
        },
      }

      console.log('[whatsapp_bridge] POST ' + endpoint + ' para to=' + cleanTo)

      let res = null
      try {
        res = $http.send({
          url: endpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 30,
        })
      } catch (httpErr) {
        const netErr =
          'Erro de conexão com Meta Graph API: ' +
          (httpErr ? httpErr.message || String(httpErr) : '')
        console.log('[whatsapp_bridge] Exceção $http.send:', netErr)
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'network_error')
            statusRecord.set('last_send_error', netErr)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return { success: false, error: netErr }
      }

      const statusCode = res.statusCode
      const rawBody = res.rawText || ''
      let responseJson = {}
      try {
        responseJson = JSON.parse(rawBody)
      } catch (_) {
        responseJson = { raw: rawBody }
      }

      console.log(
        '[whatsapp_bridge] Meta Graph API statusCode=' +
          statusCode +
          ' body=' +
          rawBody.slice(0, 300),
      )

      if (statusCode >= 200 && statusCode < 300) {
        const msgId =
          responseJson.messages && responseJson.messages[0] ? responseJson.messages[0].id : null
        console.log('[whatsapp_bridge] Sucesso no envio Meta Cloud API. ID:', msgId)
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'success')
            statusRecord.set('last_send_error', '')
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return { success: true, status: statusCode, message_id: msgId, data: responseJson }
      }

      const metaErr = responseJson.error || {}
      const metaCode = metaErr.code
      const metaSubcode = metaErr.error_subcode
      const metaMsg = metaErr.message || rawBody || 'Erro HTTP ' + statusCode

      let friendly = metaMsg
      if (statusCode === 401 || metaCode === 190) {
        friendly =
          'Token da Meta expirado ou inválido (code ' +
          metaCode +
          '). Atualize o token em Configurações.'
      } else if (
        metaCode === 131047 ||
        metaSubcode === 2494010 ||
        /template/i.test(metaMsg) ||
        /24\s*hour/i.test(metaMsg)
      ) {
        friendly =
          'Janela de 24h fechada. Cliente precisa enviar mensagem primeiro ou usar template aprovado pela Meta.'
        console.log('[whatsapp_bridge] [JANELA 24H FECHADA] Meta requer template de mensagem.')
      } else if (metaCode === 131030 || metaCode === 131026) {
        friendly = 'Número não cadastrado na lista de teste da Meta (code ' + metaCode + ').'
      }

      if (statusRecord) {
        try {
          statusRecord.set('last_send_status', 'failed_' + statusCode)
          statusRecord.set('last_send_error', friendly.slice(0, 500))
          statusRecord.set('last_send_at', new Date().toISOString())
          $app.save(statusRecord)
        } catch (_) {}
      }

      return {
        success: false,
        status: statusCode,
        code: metaCode,
        subcode: metaSubcode,
        error: friendly,
        meta_raw: metaErr,
      }
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
          const incomingMsgId = msg.id

          // Extrai o timestamp original da mensagem enviado pela Meta
          // msg.timestamp é string de Unix seconds (ex: "1711234567")
          let messageTimestampIso = ''
          if (msg.timestamp) {
            try {
              const sec = parseInt(msg.timestamp, 10)
              if (!isNaN(sec) && sec > 0) {
                messageTimestampIso = new Date(sec * 1000).toISOString()
              }
            } catch (_) {}
          }
          if (!messageTimestampIso) {
            messageTimestampIso = new Date().toISOString()
          }

          let textContent = ''
          let isAudioMessage = msgType === 'audio' || msgType === 'voice'

          if (msgType === 'text' && msg.text) {
            textContent = msg.text.body || ''
          } else if (msgType === 'interactive' && msg.interactive) {
            textContent =
              msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || ''
          } else if (isAudioMessage) {
            const audioData = msg.audio || msg.voice || {}
            const mediaId = audioData.id
            console.log(
              `[whatsapp_bridge] [AUDIO] Recebido áudio de ${fromRaw}, mediaId=${mediaId}, mime=${audioData.mime_type || ''}`,
            )

            // Obter token da Meta para baixar a mídia
            let metaToken =
              $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
            try {
              const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
              for (let w = 0; w < wsList.length; w++) {
                const rec = wsList[w]
                const tk = rec.getString('access_token')
                if (tk) {
                  metaToken = tk
                  break
                }
              }
            } catch (_) {}

            if (!mediaId || !metaToken) {
              console.log(
                '[whatsapp_bridge] [AUDIO] Falha: mediaId ou token da Meta ausente. mediaId=' +
                  mediaId +
                  ', temToken=' +
                  !!metaToken,
              )
            } else {
              try {
                // Passo (a): Obter a URL de download da mídia via Meta Cloud API
                console.log(
                  '[whatsapp_bridge] [AUDIO] Consultando URL da mídia na Meta Graph API: ' +
                    mediaId,
                )
                const mediaMetaRes = $http.send({
                  url: 'https://graph.facebook.com/v21.0/' + mediaId,
                  method: 'GET',
                  headers: {
                    Authorization: 'Bearer ' + metaToken,
                  },
                  timeout: 15,
                })

                let mediaUrl = ''
                if (mediaMetaRes.statusCode >= 200 && mediaMetaRes.statusCode < 300) {
                  try {
                    const parsed = JSON.parse(mediaMetaRes.rawText || '{}')
                    mediaUrl = parsed.url || ''
                  } catch (_) {}
                } else {
                  console.log(
                    '[whatsapp_bridge] [AUDIO] Meta retornou status ' +
                      mediaMetaRes.statusCode +
                      ' ao consultar mediaId: ' +
                      mediaMetaRes.rawText,
                  )
                }

                if (mediaUrl) {
                  console.log('[whatsapp_bridge] [AUDIO] URL obtida. Baixando binário do áudio...')
                  const downloadRes = $http.send({
                    url: mediaUrl,
                    method: 'GET',
                    headers: {
                      Authorization: 'Bearer ' + metaToken,
                      'User-Agent': 'Consciente-Agent/1.0',
                    },
                    timeout: 25,
                  })

                  if (downloadRes.statusCode >= 200 && downloadRes.statusCode < 300) {
                    console.log(
                      '[whatsapp_bridge] [AUDIO] Download concluído com sucesso. Transcrevendo áudio via IA...',
                    )

                    // Transcrição do áudio usando os serviços de IA integrados
                    let transcribedText = ''
                    let transcriptionFailureReason = ''

                    // Obtém os bytes do áudio baixado (downloadRes.body é slice de números/bytes ou fallback para raw)
                    const audioBytes = downloadRes.body || downloadRes.raw || []
                    const bytesLength = Array.isArray(audioBytes)
                      ? audioBytes.length
                      : audioBytes.length || 0
                    console.log(
                      `[whatsapp_bridge] [AUDIO] Áudio baixado: ${bytesLength} bytes recebidos. Preparando transcrição via Whisper...`,
                    )

                    // Converte os bytes do áudio para Base64 usando encoder puro compatível com Goja JSVM
                    const bytesToBase64 = function (rawInput) {
                      if (!rawInput) return ''
                      try {
                        const chars =
                          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
                        const isArr = Array.isArray(rawInput)
                        const len = rawInput.length || 0
                        let output = ''

                        for (let i = 0; i < len; i += 3) {
                          const c1 = (isArr ? rawInput[i] : rawInput.charCodeAt(i)) & 0xff
                          const c2 =
                            i + 1 < len
                              ? (isArr ? rawInput[i + 1] : rawInput.charCodeAt(i + 1)) & 0xff
                              : NaN
                          const c3 =
                            i + 2 < len
                              ? (isArr ? rawInput[i + 2] : rawInput.charCodeAt(i + 2)) & 0xff
                              : NaN

                          output += chars.charAt(c1 >> 2)
                          if (isNaN(c2)) {
                            output += chars.charAt((c1 & 3) << 4) + '=='
                          } else if (isNaN(c3)) {
                            output +=
                              chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) +
                              chars.charAt((c2 & 15) << 2) +
                              '='
                          } else {
                            output +=
                              chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) +
                              chars.charAt(((c2 & 15) << 2) | (c3 >> 6)) +
                              chars.charAt(c3 & 63)
                          }
                        }
                        return output
                      } catch (b64Err) {
                        console.log(
                          '[whatsapp_bridge] [AUDIO] Falha ao codificar áudio em base64:',
                          b64Err,
                        )
                        return ''
                      }
                    }

                    // Tenta obter string binária direta de downloadRes.raw ou o array downloadRes.body
                    const rawBinaryData = downloadRes.raw || downloadRes.body || []
                    const audioBase64 = bytesToBase64(rawBinaryData)
                    console.log(
                      `[whatsapp_bridge] [AUDIO] Áudio convertido em base64: length=${audioBase64 ? audioBase64.length : 0}`,
                    )

                    // Obtenção de chaves STT: primeiro tenta na coleção whatsapp_status (salva via painel admin)
                    let dbSttKey = ''
                    try {
                      const wsListForStt = $app.findRecordsByFilter(
                        'whatsapp_status',
                        '',
                        '-created',
                        10,
                        0,
                      )
                      for (let wsIdx = 0; wsIdx < wsListForStt.length; wsIdx++) {
                        const sk = wsListForStt[wsIdx].getString('stt_api_key')
                        if (sk) {
                          dbSttKey = sk.trim()
                          break
                        }
                      }
                    } catch (wsErr) {
                      console.log(
                        '[whatsapp_bridge] [AUDIO] Falha ao consultar stt_api_key em whatsapp_status:',
                        wsErr,
                      )
                    }

                    // Se a chave configurada no banco começar com gsk_ ou não for sk-, assume Groq por padrão (ou OpenAI se sk-)
                    const envGroqKey = $os.getenv('GROQ_API_KEY') || ''
                    const envOpenAiKey = $os.getenv('OPENAI_API_KEY') || ''
                    const envOpenRouterKey =
                      $os.getenv('OPENROUTER_API_KEY') || $os.getenv('OPENROUTER_KEY') || ''

                    // Determina provedor e chave primária
                    let dedicatedSttKey = dbSttKey || envGroqKey || envOpenAiKey || ''
                    let isGroqFormat = true
                    if (dedicatedSttKey.startsWith('sk-') && !dedicatedSttKey.startsWith('gsk_')) {
                      isGroqFormat = false
                    }

                    console.log(
                      `[whatsapp_bridge] [AUDIO] Chaves STT disponíveis: dbSttKey=${dbSttKey ? 'SIM (' + dbSttKey.slice(0, 7) + '...)' : 'NÃO'}, envGroqKey=${envGroqKey ? 'SIM' : 'NÃO'}, envOpenAiKey=${envOpenAiKey ? 'SIM' : 'NÃO'}, isGroqFormat=${isGroqFormat}`,
                    )

                    // Estratégia 1: Groq Whisper API (whisper-large-v3) se tiver chave dedicada Groq (ou configurada no banco)
                    const activeGroqKey = isGroqFormat ? dedicatedSttKey : envGroqKey
                    if (!transcribedText && activeGroqKey) {
                      try {
                        console.log(
                          '[whatsapp_bridge] [AUDIO] [Estratégia 1] Tentando Groq Whisper API (whisper-large-v3)...',
                        )
                        const audioFileObj = $filesystem.fileFromBytes(audioBytes, 'audio.ogg')
                        const form = new FormData()
                        form.append('file', audioFileObj)
                        form.append('model', 'whisper-large-v3')
                        form.append('language', 'pt')

                        const gRes = $http.send({
                          url: 'https://api.groq.com/openai/v1/audio/transcriptions',
                          method: 'POST',
                          headers: {
                            Authorization: 'Bearer ' + activeGroqKey,
                          },
                          body: form,
                          timeout: 25,
                        })

                        const gCode = gRes.statusCode
                        const gRaw = gRes.raw || ''
                        console.log(`[whatsapp_bridge] [AUDIO] [Estratégia 1] Groq status=${gCode}`)
                        if (gCode >= 200 && gCode < 300) {
                          const jsonB = JSON.parse(gRaw || '{}')
                          if (jsonB.text) {
                            transcribedText = jsonB.text.trim()
                            console.log(
                              `[whatsapp_bridge] [AUDIO] [Estratégia 1] Sucesso Groq: "${transcribedText}"`,
                            )
                          }
                        } else {
                          transcriptionFailureReason = `Groq HTTP ${gCode}: ${gRaw.slice(0, 150)}`
                        }
                      } catch (gErr) {
                        console.log('[whatsapp_bridge] [AUDIO] [Estratégia 1] Exceção Groq:', gErr)
                        transcriptionFailureReason = String(gErr)
                      }
                    }

                    // Estratégia 2: OpenRouter STT dedicado (/api/v1/audio/transcriptions) se OPENROUTER_API_KEY estiver configurada
                    if (!transcribedText && envOpenRouterKey && audioBase64) {
                      const orModels = ['openai/whisper-large-v3', 'openai/whisper-1']
                      for (let om = 0; om < orModels.length; om++) {
                        const mSlug = orModels[om]
                        try {
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Estratégia 2] Tentando OpenRouter STT model=${mSlug}...`,
                          )
                          const orRes = $http.send({
                            url: 'https://openrouter.ai/api/v1/audio/transcriptions',
                            method: 'POST',
                            headers: {
                              Authorization: 'Bearer ' + envOpenRouterKey,
                              'Content-Type': 'application/json',
                              'HTTP-Referer': 'https://goskip.app',
                              'X-Title': 'Consciente Financeiro',
                            },
                            body: JSON.stringify({
                              model: mSlug,
                              input_audio: {
                                data: audioBase64,
                                format: 'ogg',
                              },
                              language: 'pt',
                            }),
                            timeout: 30,
                          })

                          const orCode = orRes.statusCode
                          const orRaw = orRes.raw || ''
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Estratégia 2] OpenRouter ${mSlug} status=${orCode}`,
                          )

                          if (orCode >= 200 && orCode < 300) {
                            const orJson = JSON.parse(orRaw || '{}')
                            if (orJson.text) {
                              transcribedText = orJson.text.trim()
                              console.log(
                                `[whatsapp_bridge] [AUDIO] [Estratégia 2] Sucesso OpenRouter: "${transcribedText}"`,
                              )
                              break
                            }
                          } else {
                            transcriptionFailureReason = `OpenRouter ${mSlug} HTTP ${orCode}: ${orRaw.slice(0, 150)}`
                          }
                        } catch (orErr) {
                          console.log(
                            `[whatsapp_bridge] [AUDIO] [Estratégia 2] Exceção em OpenRouter ${mSlug}:`,
                            orErr,
                          )
                          transcriptionFailureReason = String(orErr)
                        }
                      }
                    }

                    // Estratégia 3: OpenAI Audio Transcriptions direta se tiver chave OpenAI (ou configurada no banco com sk-)
                    const activeOpenAiKey = !isGroqFormat ? dedicatedSttKey : envOpenAiKey
                    if (!transcribedText && activeOpenAiKey) {
                      try {
                        console.log(
                          '[whatsapp_bridge] [AUDIO] [Estratégia 3] Tentando OpenAI Whisper direto...',
                        )
                        const audioFileObj = $filesystem.fileFromBytes(audioBytes, 'audio.ogg')
                        const form = new FormData()
                        form.append('file', audioFileObj)
                        form.append('model', 'whisper-1')
                        form.append('language', 'pt')

                        const oRes = $http.send({
                          url: 'https://api.openai.com/v1/audio/transcriptions',
                          method: 'POST',
                          headers: {
                            Authorization: 'Bearer ' + activeOpenAiKey,
                          },
                          body: form,
                          timeout: 25,
                        })

                        const oCode = oRes.statusCode
                        const oRaw = oRes.raw || ''
                        console.log(
                          `[whatsapp_bridge] [AUDIO] [Estratégia 3] OpenAI status=${oCode}`,
                        )

                        if (oCode >= 200 && oCode < 300) {
                          const jsonBody = JSON.parse(oRaw || '{}')
                          if (jsonBody.text) {
                            transcribedText = jsonBody.text.trim()
                            console.log(
                              `[whatsapp_bridge] [AUDIO] [Estratégia 3] Sucesso via OpenAI Whisper: "${transcribedText}"`,
                            )
                          }
                        } else {
                          transcriptionFailureReason = `OpenAI Whisper HTTP ${oCode}: ${oRaw.slice(0, 150)}`
                        }
                      } catch (oErr) {
                        console.log('[whatsapp_bridge] [AUDIO] [Estratégia 3] Exceção:', oErr)
                        transcriptionFailureReason = String(oErr)
                      }
                    }

                    if (transcribedText) {
                      textContent = transcribedText
                      console.log(
                        `[whatsapp_bridge] [AUDIO] Texto extraído com sucesso do áudio: "${textContent}"`,
                      )
                    } else {
                      console.log(
                        `[whatsapp_bridge] [AUDIO] Não foi possível transcrever o áudio. Causa: ${transcriptionFailureReason || 'nenhum provedor respondeu'}`,
                      )
                    }
                  } else {
                    console.log(
                      '[whatsapp_bridge] [AUDIO] Falha ao baixar binário da URL Meta: status ' +
                        downloadRes.statusCode,
                    )
                  }
                }
              } catch (audioErr) {
                console.log(
                  '[whatsapp_bridge] [AUDIO] Exceção durante processamento de áudio:',
                  audioErr,
                )
              }
            }
          }

          console.log(
            `[whatsapp_bridge] Recebido webhook: from=${fromRaw}, type=${msgType}, id=${incomingMsgId || 's/id'}, text="${textContent.slice(0, 100)}"`,
          )

          // Se for mensagem de áudio e não conseguimos transcrever:
          // Resposta acolhedora, honesta e orientativa para o usuário, conforme critério de aceitação #2
          if (fromRaw && isAudioMessage && !textContent) {
            console.log(
              '[whatsapp_bridge] [AUDIO] Transcrição não produziu texto. Enviando resposta orientativa para: ' +
                fromRaw,
            )
            const audioFriendlyMsg =
              'Recebi seu áudio aqui no Consciente! 🎙️\n\nNo momento tivemos uma instabilidade na conversão de voz para texto e não consegui ouvir o que você falou. Você pode digitar rapidinho o gasto aqui para mim (ex: "Almoço 35" ou "Mercado 120")? Já registro direto na sua caixinha!'
            sendMetaMessage(fromRaw, audioFriendlyMsg)
            processedCount++
            continue
          }

          if (fromRaw && textContent) {
            // AJUSTE 2: Indicação imediata de recebimento no WhatsApp
            // Marca imediatamente a mensagem como lida e dispara os três pontinhos (typing indicator)
            // Custo ZERO na Meta e fail-safe (qualquer erro é apenas logado e não afeta o agente)
            if (incomingMsgId) {
              try {
                sendMetaStatusAndTyping(incomingMsgId)
              } catch (typeErr) {
                console.log(
                  '[whatsapp_bridge] Falha ao acionar typing inicial (ignorado):',
                  typeErr,
                )
              }
            }
            const phoneDigits = normalizeDigits(fromRaw)
            let senderName = ''
            if (contactsList && contactsList[k]) {
              senderName = contactsList[k].profile?.name || ''
            }

            // 1. Localiza usuário vinculado
            const matchedUser = resolveUser(phoneDigits, senderName)
            console.log(
              `[whatsapp_bridge] Usuário vinculado para ${phoneDigits}: ${matchedUser ? matchedUser.id + ' (' + matchedUser.getString('email') + ')' : 'NENHUM (não cadastrado)'}`,
            )

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
              try {
                if (!matchedUser.getString('phone')) {
                  matchedUser.set('phone', phoneDigits)
                  $app.save(matchedUser)
                }
              } catch (_) {}
            } else if (!contact.getString('user')) {
              contact.set('user', '')
            }

            if (senderName && contact.getString('name') === 'Contato WhatsApp') {
              contact.set('name', senderName)
            }
            $app.save(contact)

            // 3. Determina usuário ativo para o agente e status de cadastro completo
            let activeUserId = ''
            let isRegistered = false
            let hasCompletedOnboarding = false

            if (matchedUser) {
              activeUserId = matchedUser.id
              isRegistered = true
              hasCompletedOnboarding = isUserAccountReady(matchedUser)
            } else {
              const guest = getOrCreateGuestUser()
              if (guest) {
                activeUserId = guest.id
              }
            }

            console.log(
              `[whatsapp_bridge] activeUserId para agente: "${activeUserId}", isRegistered=${isRegistered}, hasCompletedOnboarding=${hasCompletedOnboarding}`,
            )

            const existingConvId = contact.getString('conversation_id') || null
            const todayStr = messageTimestampIso
              ? messageTimestampIso.slice(0, 10)
              : new Date().toISOString().slice(0, 10)
            const msgSource = isAudioMessage ? 'whatsapp_audio' : 'whatsapp_text'

            let promptForAgent = `[Data para registro: ${todayStr}. Origem da mensagem: ${msgSource}. Data e hora exata da mensagem: ${messageTimestampIso}. Usuário cadastrado e ativo (${matchedUser ? matchedUser.getString('name') || matchedUser.getString('email') : ''}). IMPORTANTE: No banco de dados, o campo amount de transactions deve ser gravado em CENTAVOS (valor em reais * 100, ex: 100 reais = 10000 centavos, 45 reais = 4500). O campo source deve ser '${msgSource}' e o campo message_timestamp deve ser '${messageTimestampIso}'. Para a data da transação, use '${todayStr}'. REGISTRE IMEDIATAMENTE qualquer gasto enviado sem pedir para finalizar cadastro]: ${textContent}`

            if (!isRegistered) {
              promptForAgent = `[ATENÇÃO: Mensagem recebida via WhatsApp de um número AINDA NÃO CADASTRADO ou NÃO VINCULADO no aplicativo (${phoneDigits}, nome: "${senderName || 'Visitante'}").
Apresente-se cordialmente como o Consciente - Seu parceiro nas finanças. Explique brevemente que você ajuda no controle diário de custos e caixinhas.
Se a mensagem for um gasto ou dúvida, convide a pessoa a criar conta ou entrar na conta existente fornecendo OBRIGATORIAMENTE os links oficiais:
- Link de Cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register
- Link de Login: https://agente-financeiro-whatsapp-37fd3.goskip.app/login
Se a pessoa já tem conta criada e não está sendo reconhecida, instrua com carinho: "Se você já tem uma conta no Consciente, acesse https://agente-financeiro-whatsapp-37fd3.goskip.app/login e confirme seu WhatsApp em Configurações > Perfil para sincronizar seus lançamentos na hora!"]: ${textContent}`
            } else if (!hasCompletedOnboarding) {
              // Usuário cadastrado no banco mas que ainda não passou pelo onboarding de caixinhas
              promptForAgent = `[ATENÇÃO: Usuário cadastrado (${matchedUser.getString('name') || matchedUser.getString('email')}), porém ainda sem caixinhas configuradas. Incentive-o amigavelmente a acessar https://agente-financeiro-whatsapp-37fd3.goskip.app/onboarding para definir suas primeiras caixinhas ou registre o gasto em categoria padrão se ele insistir]: ${textContent}`
            }

            let agentReply = ''
            let newConvId = existingConvId

            const isConvNotFoundError = function (err) {
              if (!err) return false
              const errStr = String(err).toLowerCase()
              return (
                errStr.includes('conversation not found') ||
                errStr.includes('conversation_not_found') ||
                (err.message && /conversation not found/i.test(err.message))
              )
            }

            // Executa o agente se tivermos activeUserId válido
            if (activeUserId) {
              // Suporte a reemissão periódica de typing a cada ~12s caso a resposta demore,
              // com limite estrito de no máximo 3 reemissões para não martelar a Meta.
              let typingIntervalId = null
              let typingRetries = 0
              let isReplyFinished = false

              if (incomingMsgId && typeof setInterval === 'function') {
                try {
                  typingIntervalId = setInterval(() => {
                    if (isReplyFinished || typingRetries >= 3) {
                      if (typingIntervalId && typeof clearInterval === 'function') {
                        try {
                          clearInterval(typingIntervalId)
                        } catch (_) {}
                      }
                      return
                    }
                    typingRetries++
                    console.log(
                      `[whatsapp_bridge] Reemitindo typing indicator (${typingRetries}/3) para msg: ${incomingMsgId}`,
                    )
                    try {
                      sendMetaStatusAndTyping(incomingMsgId)
                    } catch (_) {}
                  }, 12000)
                } catch (timerErr) {
                  console.log(
                    '[whatsapp_bridge] Timer de typing indicator não suportado no runtime (ignorado):',
                    timerErr,
                  )
                }
              }

              try {
                console.log(
                  `[whatsapp_bridge] Chamando $ai.agent('financeiro-whatsapp').chat user_id=${activeUserId}, conv_id=${existingConvId}`,
                )
                const agentResult = $ai.agent('financeiro-whatsapp').chat({
                  user_id: activeUserId,
                  conversation_id: existingConvId,
                  message: promptForAgent,
                })
                agentReply = agentResult.content || ''
                newConvId = agentResult.conversation_id || existingConvId
                console.log(
                  `[whatsapp_bridge] Agente respondeu com sucesso! conv_id=${newConvId}, tamanho=${agentReply.length}`,
                )
              } catch (aErr) {
                console.log('[whatsapp_bridge] Falha ao executar agente:', aErr)

                // Se a conversa anterior expirou ou não pertence a este usuário, tenta com nova conversa limpa
                if (existingConvId && isConvNotFoundError(aErr)) {
                  console.log(
                    '[whatsapp_bridge] Conversation_id inválido (' +
                      existingConvId +
                      '). Tentando novamente com nova conversa limpa...',
                  )
                  try {
                    const retryResult = $ai.agent('financeiro-whatsapp').chat({
                      user_id: activeUserId,
                      conversation_id: null,
                      message: promptForAgent,
                    })
                    agentReply = retryResult.content || ''
                    newConvId = retryResult.conversation_id || null
                    console.log(
                      '[whatsapp_bridge] Recuperação bem-sucedida! Nova conversation_id:',
                      newConvId,
                    )
                  } catch (retryErr) {
                    console.log('[whatsapp_bridge] Falha no retry de nova conversa:', retryErr)
                    newConvId = null
                  }
                }
              } finally {
                isReplyFinished = true
                if (typingIntervalId && typeof clearInterval === 'function') {
                  try {
                    clearInterval(typingIntervalId)
                  } catch (_) {}
                }
              }
            } else {
              console.log(
                '[whatsapp_bridge] Nenhum activeUserId encontrado. Usando fallback de boas-vindas diretamente.',
              )
            }

            // Fallback garantido: toda mensagem SEMPRE produz uma resposta amigável
            if (!agentReply) {
              if (!isRegistered) {
                agentReply =
                  'Olá! Eu sou o Consciente - Seu parceiro nas finanças no WhatsApp. 👋\n\nSeu número ainda não está reconhecido no app.\n\n• Se ainda não tem conta, cadastre-se em: https://agente-financeiro-whatsapp-37fd3.goskip.app/register\n• Se já tem conta, faça login em: https://agente-financeiro-whatsapp-37fd3.goskip.app/login e confirme seu WhatsApp em Configurações > Perfil para sincronizar seus lançamentos na hora!'
              } else if (!hasCompletedOnboarding) {
                agentReply =
                  'Olá! Seu cadastro no Consciente foi localizado, mas suas caixinhas ainda precisam ser configuradas. Acesse https://agente-financeiro-whatsapp-37fd3.goskip.app/onboarding para definir suas caixinhas de gastos!'
              } else {
                agentReply =
                  'Olá! Não consegui processar seu gasto agora no Consciente devido a uma oscilação momentânea. Por favor, envie novamente com o valor e a categoria (ex: "Almoço 35 reais") para eu registrar na sua caixinha!'
              }
              console.log(
                `[whatsapp_bridge] Mensagem de fallback gerada: "${agentReply.slice(0, 100)}"`,
              )
            }

            // Atualiza contato: incrementa contagem e salva data e conversa
            try {
              const currentCount = contact.getInt('messages_count') || 0
              contact.set('messages_count', currentCount + 1)
              contact.set('last_message_at', new Date().toISOString())
              if (newConvId) {
                contact.set('conversation_id', newConvId)
              }
              $app.save(contact)
              console.log(
                `[whatsapp_bridge] Contato ${phoneDigits} atualizado: count=${currentCount + 1}, conv=${newConvId || 'vazio'}`,
              )
            } catch (saveErr) {
              console.log('[whatsapp_bridge] Erro ao salvar contato:', saveErr)
            }

            // Envia resposta no WhatsApp pela WhatsApp Cloud API da Meta oficial
            if (agentReply) {
              try {
                const sendResult = sendMetaMessage(phoneDigits, agentReply)
                if (!sendResult.success) {
                  console.log('[whatsapp_bridge] Envio Meta Cloud API falhou:', sendResult.error)
                } else {
                  console.log(
                    '[whatsapp_bridge] Resposta entregue com sucesso via WhatsApp Meta Cloud API para:',
                    phoneDigits,
                  )
                }
              } catch (metaErr) {
                console.log(
                  '[whatsapp_bridge] Exceção inesperada no envio Meta Cloud API:',
                  metaErr,
                )
              }
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
// 3. Rota de Envio de Mensagem de Teste Direto (Meta Cloud API) - RESTRITA A ADMIN
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/send-test',
  (e) => {
    const authUser = e.auth
    const isAdmin =
      authUser &&
      (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
        authUser.getString('role') === 'admin')
    if (!isAdmin) {
      return e.json(403, { error: 'Acesso restrito à administração' })
    }
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
      const targetPhone = normalizeDigits(body.to_number || '5511949989868')
      const text =
        body.text ||
        'Olá! Seu canal oficial do Consciente - Seu parceiro nas finanças está conectado e ativo via Meta Cloud API. Canal configurado com sucesso para suas caixinhas!'

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let statusRecord = null

      try {
        const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
        for (let idx = 0; idx < wsList.length; idx++) {
          const rec = wsList[idx]
          if (rec.getString('phone_number_id')) {
            activePhoneId = rec.getString('phone_number_id')
          }
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          if (!statusRecord) statusRecord = rec
          if (recToken) {
            statusRecord = rec
            break
          }
        }
      } catch (_) {}

      if (!token) {
        const msg =
          'Token de Acesso da Meta não configurado. Por favor, cole seu Token Permanente em Configurações > Canal Oficial WhatsApp Business.'
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'failed_missing_token')
            statusRecord.set('last_send_error', msg)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return e.json(400, {
          success: false,
          missing_token: true,
          error: msg,
        })
      }

      const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: targetPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: String(text).trim(),
        },
      }

      console.log('[whatsapp_bridge] send-test disparado para: ' + targetPhone)

      let res = null
      try {
        res = $http.send({
          url: endpoint,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 30,
        })
      } catch (httpErr) {
        const netErr =
          'Erro de conexão com Meta Graph API: ' +
          (httpErr ? httpErr.message || String(httpErr) : '')
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'network_error')
            statusRecord.set('last_send_error', netErr)
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return e.json(500, { success: false, error: netErr })
      }

      const statusCode = res.statusCode
      const rawBody = res.rawText || ''
      let responseJson = {}
      try {
        responseJson = JSON.parse(rawBody)
      } catch (_) {
        responseJson = { raw: rawBody }
      }

      console.log(
        '[whatsapp_bridge] send-test retorno statusCode=' +
          statusCode +
          ' body=' +
          rawBody.slice(0, 300),
      )

      if (statusCode >= 200 && statusCode < 300) {
        const msgId =
          responseJson.messages && responseJson.messages[0] ? responseJson.messages[0].id : null
        if (statusRecord) {
          try {
            statusRecord.set('last_send_status', 'success')
            statusRecord.set('last_send_error', '')
            statusRecord.set('last_send_at', new Date().toISOString())
            $app.save(statusRecord)
          } catch (_) {}
        }
        return e.json(200, {
          success: true,
          message_id: msgId,
          data: responseJson,
        })
      }

      const metaErr = responseJson.error || {}
      const metaCode = metaErr.code
      const metaSubcode = metaErr.error_subcode
      const metaMsg = metaErr.message || rawBody || 'Erro HTTP ' + statusCode

      let friendly = metaMsg
      if (statusCode === 401 || metaCode === 190) {
        friendly =
          'Token da Meta expirado ou inválido (code ' +
          metaCode +
          '). Atualize o token em Configurações.'
      } else if (
        metaCode === 131047 ||
        metaSubcode === 2494010 ||
        /template/i.test(metaMsg) ||
        /24\s*hour/i.test(metaMsg)
      ) {
        friendly =
          'Janela de 24h fechada. Cliente precisa enviar mensagem primeiro ou usar template aprovado pela Meta.'
      } else if (metaCode === 131030 || metaCode === 131026) {
        friendly = 'Número não cadastrado na lista de teste da Meta (code ' + metaCode + ').'
      }

      if (statusRecord) {
        try {
          statusRecord.set('last_send_status', 'failed_' + statusCode)
          statusRecord.set('last_send_error', friendly.slice(0, 500))
          statusRecord.set('last_send_at', new Date().toISOString())
          $app.save(statusRecord)
        } catch (_) {}
      }

      return e.json(statusCode || 400, {
        success: false,
        error: friendly,
        code: metaCode,
        subcode: metaSubcode,
        meta_raw: metaErr,
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Exceção em send-test:', err)
      return e.json(500, {
        success: false,
        error: String(err),
      })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 4. Rota para Salvar Token de Acesso da Meta com Segurança - RESTRITA A ADMIN
// ----------------------------------------------------

routerAdd(
  'POST',
  '/backend/v1/whatsapp/token',
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

      const body = e.requestInfo().body || {}
      const token = String(body.access_token || '').trim()

      if (!token) {
        return e.json(400, { error: 'O token de acesso não pode ser vazio' })
      }

      const wsCol = $app.findCollectionByNameOrId('whatsapp_status')
      let record = null

      try {
        const records = $app.findRecordsByFilter(
          'whatsapp_status',
          `owner = '${authUser.id}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          record = records[0]
        }
      } catch (_) {}

      if (!record) {
        try {
          const anyRecords = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
          if (anyRecords.length > 0) {
            record = anyRecords[0]
          }
        } catch (_) {}
      }

      if (!record) {
        record = new Record(wsCol)
        record.set('owner', authUser.id)
        record.set('phone_number', '+55 11 94998-9868')
        record.set('phone_number_id', '1314873981716321')
        record.set('waba_id', '1888947369148112')
        record.set('app_name', 'Consciente')
        record.set('verify_token', 'agente-financeiro')
        record.set('connected', true)
      }

      record.set('access_token', token)
      record.set('last_send_error', '')
      $app.save(record)

      console.log(
        '[whatsapp_bridge] Token permanente da Meta atualizado para o usuário:',
        authUser.id,
      )

      return e.json(200, {
        success: true,
        token_configurado: true,
        message: 'Token de Acesso da Meta salvo com sucesso!',
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro ao salvar token da Meta:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 4.1 Rota para Salvar Chave de Transcrição de Voz (STT API Key) - RESTRITA A ADMIN
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/stt-key',
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

      const body = e.requestInfo().body || {}
      const sttKey = String(body.stt_api_key || body.key || '').trim()

      if (!sttKey) {
        return e.json(400, { error: 'A chave de transcrição (STT) não pode ser vazia' })
      }

      const wsCol = $app.findCollectionByNameOrId('whatsapp_status')
      let record = null

      try {
        const records = $app.findRecordsByFilter(
          'whatsapp_status',
          `owner = '${authUser.id}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) {
          record = records[0]
        }
      } catch (_) {}

      // Se o registro não tem owner ou é global, reaproveita o existente
      if (!record) {
        try {
          const anyRecords = $app.findRecordsByFilter('whatsapp_status', '', '-created', 1, 0)
          if (anyRecords.length > 0) {
            record = anyRecords[0]
          }
        } catch (_) {}
      }

      if (!record) {
        record = new Record(wsCol)
        record.set('owner', authUser.id)
        record.set('phone_number', '+55 11 94998-9868')
        record.set('phone_number_id', '1314873981716321')
        record.set('waba_id', '1888947369148112')
        record.set('app_name', 'Consciente')
        record.set('verify_token', 'agente-financeiro')
        record.set('connected', true)
      }

      record.set('stt_api_key', sttKey)
      $app.save(record)

      console.log(
        '[whatsapp_bridge] Chave de transcrição (STT) atualizada com sucesso para admin:',
        authUser.id,
      )

      return e.json(200, {
        success: true,
        stt_configurado: true,
        message: 'Chave de transcrição de voz salva com sucesso!',
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro ao salvar chave STT:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 5. Rota de Simulação com Agente
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

      const getOrCreateGuestUser = function () {
        try {
          const guest = $app.findAuthRecordByEmail(
            '_pb_users_auth_',
            'whatsapp-visitante@agente.internal',
          )
          if (guest && guest.id) return guest
        } catch (_) {}

        try {
          const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
          if (users.length > 0 && users[0].id) return users[0]
        } catch (_) {}

        try {
          const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
          const newGuest = new Record(usersCol)
          newGuest.setEmail('whatsapp-visitante@agente.internal')
          newGuest.setPassword('Skip@Pass123!')
          newGuest.setVerified(true)
          newGuest.set('name', 'Visitante WhatsApp')
          newGuest.set('onboarding_completed', true)
          $app.save(newGuest)
          console.log('[whatsapp_bridge] Usuário visitante criado sob demanda:', newGuest.id)
          return newGuest
        } catch (err) {
          console.log('[whatsapp_bridge] Falha ao criar usuário visitante sob demanda:', err)
        }

        return null
      }

      const resolveUser = function (phoneDigits, senderName) {
        if (!phoneDigits) return null

        const suffixMatch = function (p1, p2) {
          if (!p1 || !p2) return false
          if (p1 === p2) return true
          if (p1.endsWith(p2) || p2.endsWith(p1)) return true
          const s1 = p1.slice(-8)
          const s2 = p2.slice(-8)
          return s1.length >= 8 && s1 === s2
        }

        // 1. Verifica se já existe vínculo explícito em whatsapp_contacts
        try {
          const contact = $app.findFirstRecordByData(
            'whatsapp_contacts',
            'phone_number',
            phoneDigits,
          )
          const contactUserId = contact.getString('user')
          if (contactUserId) {
            const u = $app.findRecordById('_pb_users_auth_', contactUserId)
            if (u && u.id && u.getString('email') !== 'whatsapp-visitante@agente.internal') return u
          }
        } catch (_) {}

        // 2. Busca na coleção de usuários pelo campo phone (com match por sufixo)
        try {
          const users = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 300, 0)
          for (let u = 0; u < users.length; u++) {
            const user = users[u]
            if (user.getString('email') === 'whatsapp-visitante@agente.internal') continue
            const userPhone = normalizeDigits(user.getString('phone'))
            if (userPhone && suffixMatch(userPhone, phoneDigits)) {
              return user
            }
          }
        } catch (_) {}

        // 3. Fallback: single real user
        try {
          const realUsers = $app.findRecordsByFilter(
            '_pb_users_auth_',
            "email != 'whatsapp-visitante@agente.internal'",
            '-created',
            10,
            0,
          )
          if (realUsers.length === 1) {
            const soleUser = realUsers[0]
            const existingPhone = normalizeDigits(soleUser.getString('phone'))
            if (!existingPhone || suffixMatch(existingPhone, phoneDigits)) {
              if (!existingPhone) {
                try {
                  soleUser.set('phone', phoneDigits)
                  $app.save(soleUser)
                } catch (_) {}
              }
              return soleUser
            }
          }
        } catch (_) {}

        return null
      }

      const sendMetaMessage = function (toNumber, textBody) {
        const cleanTo = normalizeDigits(toNumber)
        if (!cleanTo) return { success: false, error: 'Número inválido' }

        let activePhoneId = '1314873981716321'
        let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
        let statusRecord = null

        try {
          const wsList = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
          for (let idx = 0; idx < wsList.length; idx++) {
            const rec = wsList[idx]
            if (rec.getString('phone_number_id')) {
              activePhoneId = rec.getString('phone_number_id')
            }
            const recToken = rec.getString('access_token')
            if (recToken && !token) {
              token = recToken
            }
            if (!statusRecord) statusRecord = rec
            if (recToken) {
              statusRecord = rec
              break
            }
          }
        } catch (_) {}

        if (!token) {
          return { success: false, error: 'Token de acesso da Meta não configurado' }
        }

        const endpoint = 'https://graph.facebook.com/v21.0/' + activePhoneId + '/messages'
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: false,
            body: String(textBody || '').trim(),
          },
        }

        let res = null
        try {
          res = $http.send({
            url: endpoint,
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeout: 30,
          })
        } catch (httpErr) {
          return { success: false, error: httpErr ? httpErr.message || String(httpErr) : '' }
        }

        const statusCode = res.statusCode
        if (statusCode >= 200 && statusCode < 300) {
          return { success: true, status: statusCode }
        }

        return { success: false, status: statusCode, error: 'Erro HTTP ' + statusCode }
      }

      const body = e.requestInfo().body || {}
      const rawPhone = body.phone_number
      const message = body.message
      const senderName = body.sender_name || 'Usuário Teste'
      const sendRemote = body.send_remote !== false

      if (!rawPhone || !message) {
        return e.json(400, { error: 'phone_number e message são obrigatórios' })
      }

      const phoneDigits = normalizeDigits(rawPhone)

      // 1. Localiza usuário vinculado
      const matchedUser = resolveUser(phoneDigits, senderName)

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
        try {
          if (!matchedUser.getString('phone')) {
            matchedUser.set('phone', phoneDigits)
            $app.save(matchedUser)
          }
        } catch (_) {}
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
        const guest = getOrCreateGuestUser()
        if (guest) {
          activeUserId = guest.id
        }
      }

      const existingConvId = contact.getString('conversation_id') || null
      const messageTimestampIso = new Date().toISOString()
      const todayStr = messageTimestampIso.slice(0, 10)

      let promptForAgent = `[Data para registro: ${todayStr}. Origem da mensagem: whatsapp_text. Data e hora exata da mensagem: ${messageTimestampIso}. Usuário cadastrado e ativo (${matchedUser ? matchedUser.getString('name') || matchedUser.getString('email') : ''}). IMPORTANTE: No banco de dados, o campo amount de transactions deve ser gravado em CENTAVOS (valor em reais * 100, ex: 100 reais = 10000 centavos, 45 reais = 4500). O campo source deve ser 'whatsapp_text' e o campo message_timestamp deve ser '${messageTimestampIso}'. Para a data da transação, use '${todayStr}'. REGISTRE IMEDIATAMENTE qualquer gasto enviado sem pedir para finalizar cadastro]: ${message}`
      if (!isRegistered) {
        promptForAgent = `[ATENÇÃO: Mensagem recebida via WhatsApp de um número AINDA NÃO CADASTRADO ou NÃO VINCULADO no aplicativo (${phoneDigits}, nome: "${senderName || 'Visitante'}").
Apresente-se cordialmente como o Consciente - Seu parceiro nas finanças. Explique brevemente que você ajuda no controle diário de custos e caixinhas.
Se a mensagem for um gasto ou dúvida, convide a pessoa a criar conta ou entrar na conta existente fornecendo OBRIGATORIAMENTE os links oficiais:
- Link de Cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register
- Link de Login: https://agente-financeiro-whatsapp-37fd3.goskip.app/login
Se a pessoa já tem conta criada e não está sendo reconhecida, instrua com carinho: "Se você já tem uma conta no Consciente, acesse https://agente-financeiro-whatsapp-37fd3.goskip.app/login e confirme seu WhatsApp em Configurações > Perfil para sincronizar seus lançamentos na hora!"]: ${message}`
      }

      let agentReply = ''
      let newConvId = existingConvId

      const isConvNotFoundError = function (err) {
        if (!err) return false
        const errStr = String(err).toLowerCase()
        return (
          errStr.includes('conversation not found') ||
          errStr.includes('conversation_not_found') ||
          (err.message && /conversation not found/i.test(err.message))
        )
      }

      if (activeUserId) {
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

          if (existingConvId && isConvNotFoundError(aErr)) {
            console.log(
              '[whatsapp_bridge] Conversation_id inválido no simulate (' +
                existingConvId +
                '). Tentando novamente com nova conversa limpa...',
            )
            try {
              const retryResult = $ai.agent('financeiro-whatsapp').chat({
                user_id: activeUserId,
                conversation_id: null,
                message: promptForAgent,
              })
              agentReply = retryResult.content || ''
              newConvId = retryResult.conversation_id || null
              console.log(
                '[whatsapp_bridge] Recuperação no simulate bem-sucedida! Nova conversation_id:',
                newConvId,
              )
            } catch (retryErr) {
              console.log(
                '[whatsapp_bridge] Falha no retry de nova conversa no simulate:',
                retryErr,
              )
              newConvId = null
            }
          }
        }
      }

      if (!agentReply) {
        if (!isRegistered) {
          agentReply =
            'Olá! Eu sou o Consciente - Seu parceiro nas finanças no WhatsApp. 👋\n\nSeu número ainda não está vinculado a uma conta no app. Crie sua conta diretamente pelo link oficial https://agente-financeiro-whatsapp-37fd3.goskip.app/register para definir suas caixinhas e controlar seus custos diários em tempo real!'
        } else {
          agentReply =
            'Olá! Não consegui processar seu gasto agora no Consciente devido a uma oscilação momentânea. Por favor, envie novamente com o valor e a categoria (ex: "Almoço 35 reais") para eu registrar na sua caixinha!'
        }
      }

      // Atualiza contato
      try {
        const currentCount = contact.getInt('messages_count') || 0
        contact.set('messages_count', currentCount + 1)
        contact.set('last_message_at', new Date().toISOString())
        if (newConvId) {
          contact.set('conversation_id', newConvId)
        }
        $app.save(contact)
      } catch (_) {}

      // Envia via Meta Cloud API se solicitado
      let remoteSent = false
      let remoteError = null

      if (sendRemote && agentReply) {
        const metaRes = sendMetaMessage(phoneDigits, agentReply)
        remoteSent = metaRes.success
        remoteError = metaRes.error || null
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
        remote_sent: remoteSent,
        remote_error: remoteError,
      })
    } catch (err) {
      console.log('[whatsapp_bridge] Erro na rota de simulação:', err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 6. Rota para consultar status do canal WhatsApp oficial
// O token NUNCA é retornado no JSON — apenas token_configurado: boolean
// RESTRITA A ADMIN: Cliente comum recebe 403 para não vazar IDs/webhooks da Meta
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/whatsapp/status',
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

      let activePhoneId = '1314873981716321'
      let token = $os.getenv('META_WHATSAPP_TOKEN') || $os.getenv('WHATSAPP_ACCESS_TOKEN') || ''
      let sttKey = $os.getenv('GROQ_API_KEY') || $os.getenv('OPENAI_API_KEY') || ''
      let userConfiguredPhone = '+55 11 94998-9868'
      let userWaActive = true
      let wabaId = '1888947369148112'
      let appName = 'Consciente'
      let verifyToken = 'agente-financeiro'
      let lastSendStatus = ''
      let lastSendError = ''
      let lastSendAt = ''

      try {
        const filterStr = authUser ? `owner = '${authUser.id}'` : ''
        const wsList = $app.findRecordsByFilter('whatsapp_status', filterStr, '-created', 1, 0)
        if (wsList.length > 0) {
          const rec = wsList[0]
          userConfiguredPhone = rec.getString('phone_number') || userConfiguredPhone
          userWaActive = rec.getBool('connected')
          activePhoneId = rec.getString('phone_number_id') || activePhoneId
          wabaId = rec.getString('waba_id') || wabaId
          appName = rec.getString('app_name') || appName
          verifyToken = rec.getString('verify_token') || verifyToken
          lastSendStatus = rec.getString('last_send_status')
          lastSendError = rec.getString('last_send_error')
          lastSendAt = rec.getString('last_send_at')
          const recToken = rec.getString('access_token')
          if (recToken && !token) {
            token = recToken
          }
          const recSttKey = rec.getString('stt_api_key')
          if (recSttKey && !sttKey) {
            sttKey = recSttKey
          }
        }
      } catch (_) {}

      // Fallback para encontrar se há qualquer token ou chave stt configurados na coleção
      if (!token || !sttKey) {
        try {
          const anyWs = $app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
          for (let i = 0; i < anyWs.length; i++) {
            if (!token) {
              const tk = anyWs[i].getString('access_token')
              if (tk) token = tk
            }
            if (!sttKey) {
              const sk = anyWs[i].getString('stt_api_key')
              if (sk) sttKey = sk
            }
            if (token && sttKey) break
          }
        } catch (_) {}
      }

      const hasToken = !!token
      const hasSttKey = !!sttKey

      const instanceUrl =
        $os.getenv('PB_INSTANCE_URL') ||
        'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'

      const webhookUrl = `${instanceUrl}/backend/v1/whatsapp/webhook`

      return e.json(200, {
        owner_connected: hasToken,
        token_configurado: hasToken,
        stt_configurado: hasSttKey,
        owner_phone: userConfiguredPhone,
        phone_number_id: activePhoneId,
        waba_id: wabaId,
        app_name: appName,
        verify_token: verifyToken,
        user_phone: userConfiguredPhone,
        user_connected: userWaActive,
        last_send_status: lastSendStatus,
        last_send_error: lastSendError,
        last_send_at: lastSendAt,
        webhook_url: webhookUrl,
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 7. Rota para listar contatos que interagiram pelo WhatsApp - RESTRITA A ADMIN
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/whatsapp/contacts',
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

// ----------------------------------------------------
// 8. Rota para vincular contato a um usuário
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/whatsapp/link-contact',
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

      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      const body = e.requestInfo().body || {}
      const contactId = body.contact_id
      const phone = body.phone_number

      let contact = null
      if (contactId) {
        try {
          contact = $app.findRecordById('whatsapp_contacts', contactId)
        } catch (_) {}
      } else if (phone) {
        const cleanPhone = normalizeDigits(phone)
        try {
          contact = $app.findFirstRecordByData('whatsapp_contacts', 'phone_number', cleanPhone)
        } catch (_) {}
      }

      if (!contact) {
        return e.json(404, { error: 'Contato não encontrado' })
      }

      contact.set('user', authUser.id)
      if (authUser.getString('name') && !contact.getString('name')) {
        contact.set('name', authUser.getString('name'))
      }
      $app.save(contact)

      // Atualiza também o telefone do usuário se não tiver
      try {
        if (!authUser.getString('phone')) {
          authUser.set('phone', contact.getString('phone_number'))
          $app.save(authUser)
        }
      } catch (_) {}

      return e.json(200, { success: true, contact_id: contact.id, user_id: authUser.id })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
