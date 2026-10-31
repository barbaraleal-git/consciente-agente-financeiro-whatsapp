/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/backend/v1/agent/chat',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord ? authRecord.id : null
      if (!userId) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const body = e.requestInfo().body || {}
      const message = body.message
      if (!message || typeof message !== 'string' || !message.trim()) {
        return e.json(400, { error: 'A mensagem é obrigatória' })
      }

      const stream = body.stream === true
      const conversationId = body.conversation_id || null

      if (stream) {
        const conv = $ai.agent('financeiro-whatsapp').getOrCreateConversation({
          user_id: userId,
          id: conversationId,
          title: message.slice(0, 30),
        })

        const iter = $ai.agent('financeiro-whatsapp').chat({
          user_id: userId,
          conversation_id: conv.id,
          message: message,
          stream: true,
        })

        e.response.header().set('Content-Type', 'text/event-stream')
        e.response.header().set('Cache-Control', 'no-cache')
        e.response.header().set('X-Conversation-Id', conv.id)
        $response.stream(e, iter)
        return
      }

      let result
      try {
        result = $ai.agent('financeiro-whatsapp').chat({
          user_id: userId,
          conversation_id: conversationId,
          message: message,
        })
      } catch (chatErr) {
        if (
          conversationId &&
          (chatErr instanceof SkipAiAgentsError || /conversation not found/i.test(String(chatErr)))
        ) {
          result = $ai.agent('financeiro-whatsapp').chat({
            user_id: userId,
            conversation_id: null,
            message: message,
          })
        } else {
          throw chatErr
        }
      }

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na requisição ao agente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'IA temporariamente indisponível' : err.message,
        })
      }
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/agent/conversations',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.json(401, { error: 'Autenticação necessária' })
    const limit = parseInt(e.requestInfo().query?.limit || '20', 10) || 20
    return e.json(
      200,
      $ai.agent('financeiro-whatsapp').listConversations({ user_id: userId, limit }),
    )
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/agent/conversations/{convId}/messages',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.json(401, { error: 'Autenticação necessária' })
    const convId = e.request.pathValue('convId')
    try {
      return e.json(
        200,
        $ai.agent('financeiro-whatsapp').listMessages({
          conversation_id: convId,
          user_id: userId,
        }),
      )
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'Falha ao buscar histórico' : err.message })
      }
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
