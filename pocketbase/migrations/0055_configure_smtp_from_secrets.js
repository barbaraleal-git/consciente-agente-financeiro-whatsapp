// v0.0.155 — Configura o SMTP do PocketBase a partir dos segredos SKIP_SMTP_* do painel.
// A plataforma NÃO aplica esses segredos automaticamente ao settings de SMTP (verificado no
// vivo em 23/11/2026: settings apontavam para o relay interno postfix-relay:25 sem auth,
// sender noreply@mail.goskip.dev, enquanto os segredos SKIP_SMTP_* existiam sem efeito).
// Migração idempotente: lê os 5 segredos do ambiente ($os.getenv — NUNCA hardcoded),
// valida presença e reaplica a configuração se algum item divergir do desejado.
// Reversível: o down restaura o relay padrão da plataforma.

migrate(
  (app) => {
    const host = $os.getenv('SKIP_SMTP_HOST') || ''
    const portStr = $os.getenv('SKIP_SMTP_PORT') || ''
    const username = $os.getenv('SKIP_SMTP_USERNAME') || ''
    const password = $os.getenv('SKIP_SMTP_PASSWORD') || ''
    const sender = $os.getenv('SKIP_SMTP_SENDER') || ''

    const missing = []
    if (!host) missing.push('SKIP_SMTP_HOST')
    if (!portStr) missing.push('SKIP_SMTP_PORT')
    if (!username) missing.push('SKIP_SMTP_USERNAME')
    if (!password) missing.push('SKIP_SMTP_PASSWORD')
    if (!sender) missing.push('SKIP_SMTP_SENDER')
    if (missing.length > 0) {
      console.log(
        '[0055] SKIP_SMTP_* ausentes no ambiente: ' + missing.join(', ') + ' — nada a fazer',
      )
      return
    }

    const port = parseInt(portStr, 10)
    if (isNaN(port) || port <= 0) {
      throw new Error('SKIP_SMTP_PORT inválido: ' + portStr)
    }

    // SKIP_SMTP_SENDER chega como "Nome <endereco@dominio>" ou só o endereço.
    let senderName = 'Consciente'
    let senderAddress = sender
    const m = sender.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
    if (m) {
      senderName = m[1] || senderName
      senderAddress = m[2]
    }

    const want = {
      enabled: true,
      host: host,
      port: port,
      username: username,
      password: password,
      authMethod: 'PLAIN',
      tls: port === 465, // 465 = TLS implícito (SMTPS)
      senderAddress: senderAddress,
      senderName: senderName,
    }

    const s = app.settings()
    const smtp = s.smtp || {}
    const meta = s.meta || {}

    const alreadyOk =
      smtp.enabled === want.enabled &&
      smtp.host === want.host &&
      smtp.port === want.port &&
      smtp.username === want.username &&
      smtp.password === want.password &&
      smtp.authMethod === want.authMethod &&
      smtp.tls === want.tls &&
      meta.senderAddress === want.senderAddress &&
      meta.senderName === want.senderName

    if (alreadyOk) {
      console.log('[0055] SMTP já configurado conforme segredos SKIP_SMTP_* — nada a fazer')
      return
    }

    s.smtp.enabled = want.enabled
    s.smtp.host = want.host
    s.smtp.port = want.port
    s.smtp.username = want.username
    s.smtp.password = want.password
    s.smtp.authMethod = want.authMethod
    s.smtp.tls = want.tls
    s.meta.senderAddress = want.senderAddress
    s.meta.senderName = want.senderName
    app.save(s)

    console.log(
      '[0055] SMTP configurado a partir de SKIP_SMTP_*: host=' +
        want.host +
        ' port=' +
        want.port +
        ' tls=' +
        want.tls +
        ' sender=' +
        want.senderAddress +
        ' senderName=' +
        want.senderName,
    )
  },
  (app) => {
    // down: restaura o relay interno padrão da plataforma
    const s = $app.settings()
    s.smtp.enabled = true
    s.smtp.host = 'postfix-relay.postfix-relay.svc.cluster.local'
    s.smtp.port = 25
    s.smtp.username = ''
    s.smtp.password = ''
    s.smtp.authMethod = ''
    s.smtp.tls = false
    s.meta.senderAddress = 'noreply@mail.goskip.dev'
    s.meta.senderName = 'Eleva App - Seu Agente Financeiro'
    app.save(s)
  },
)
