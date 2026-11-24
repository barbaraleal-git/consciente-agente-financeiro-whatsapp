// v0.0.157 — Reaplica o SMTP do PocketBase a partir dos segredos SKIP_SMTP_*.
//
// A migração 0056 (mesma rodada, commit 9308311) rodou ANTES de a dona trocar
// SKIP_SMTP_PORT para 587 no painel — mig applied NÃO re-executa, então o
// settings de SMTP podia ter ficado em 465 (porta cuja saída/egress trava os
// e-mails branded >30s, sem erro). Esta migração é IDEMPOTENTE: lê os segredos
// do ambiente ($os.getenv — NUNCA hardcoded) e só grava se divergirem; no-op
// quando o settings já está conforme (portanto inofensiva em qualquer cópia do
// projeto onde os segredos estejam corretos). 587 => tls:false (STARTTLS),
// 465 => tls:true (SMTPS).

migrate(
  (app) => {
    let host = ''
    let portStr = ''
    let username = ''
    let password = ''
    let sender = ''
    try {
      host = $os.getenv('SKIP_SMTP_HOST') || ''
      portStr = $os.getenv('SKIP_SMTP_PORT') || ''
      username = $os.getenv('SKIP_SMTP_USERNAME') || ''
      password = $os.getenv('SKIP_SMTP_PASSWORD') || ''
      sender = $os.getenv('SKIP_SMTP_SENDER') || ''
    } catch (envErr) {
      console.log('[0057] Nota ao ler segredos SKIP_SMTP_*: ' + envErr)
    }

    if (!host || !portStr || !username || !password || !sender) {
      console.log('[0057] SKIP_SMTP_* ausentes no ambiente — SMTP não alterado')
      return
    }

    const port = parseInt(portStr, 10)
    if (isNaN(port) || port <= 0) {
      console.log('[0057] SKIP_SMTP_PORT inválido: ' + portStr + ' — SMTP não alterado')
      return
    }

    // SKIP_SMTP_SENDER chega como "Nome <endereco@dominio>" ou só o endereço.
    let senderName = 'Consciente'
    let senderAddress = sender
    const m = sender.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
    if (m) {
      senderName = m[1] || senderName
      senderAddress = m[2]
    }

    const s = app.settings()
    const smtp = s.smtp || {}
    const meta = s.meta || {}

    const smtpOk =
      smtp.enabled === true &&
      smtp.host === host &&
      smtp.port === port &&
      smtp.username === username &&
      smtp.password === password &&
      smtp.authMethod === 'PLAIN' &&
      smtp.tls === (port === 465)

    if (!smtpOk) {
      s.smtp.enabled = true
      s.smtp.host = host
      s.smtp.port = port
      s.smtp.username = username
      s.smtp.password = password
      s.smtp.authMethod = 'PLAIN'
      s.smtp.tls = port === 465
      console.log(
        '[0057] SMTP reaplicado dos segredos: host=' +
          host +
          ' port=' +
          port +
          ' tls=' +
          s.smtp.tls,
      )
    } else {
      console.log('[0057] SMTP já conforme os segredos (host=' + host + ' port=' + port + ')')
    }

    if (meta.senderAddress !== senderAddress || meta.senderName !== senderName) {
      s.meta.senderAddress = senderAddress
      s.meta.senderName = senderName
      console.log('[0057] meta sender atualizado: ' + senderName + ' <' + senderAddress + '>')
    }
    if (s.meta.appName !== 'Consciente') {
      s.meta.appName = 'Consciente'
    }
    app.save(s)
  },
  (app) => {
    // down: nada a desfazer estruturalmente — o settings de SMTP é configuração
    // de instância, e restaurar 465 reintroduziria o problema da rodada.
    console.log('[0057] down: nada a fazer (settings de SMTP é configuração de instância)')
  },
)
