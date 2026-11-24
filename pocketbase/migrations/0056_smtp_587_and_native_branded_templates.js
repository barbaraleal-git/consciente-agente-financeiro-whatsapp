// v0.0.157 — Duas correções em uma migração idempotente:
//
// 1. REAPLICA o SMTP do PocketBase a partir dos segredos SKIP_SMTP_* do painel.
//    A migração 0055 (v0.0.155) rodou UMA ÚNICA VEZ e fixou a porta 465 que
//    estava nos segredos naquela data. A dona trocou SKIP_SMTP_PORT para 587
//    (STARTTLS) no painel, mas migrações já aplicadas NÃO re-executam — o
//    settings de SMTP continuava em 465, cuja saída (egress) está bloqueada
//    (e-mails branded travavam >30s sem erro). Esta migração repete a lógica da
//    0055: lê os segredos do ambiente ($os.getenv — NUNCA hardcoded) e reaplica
//    se divergirem; 587 => tls:false (STARTTLS), 465 => tls:true (SMTPS).
//
// 2. REBRANDING dos templates NATIVOS de e-mail da coleção users (o print da
//    dona mostrou o e-mail de reset com remetente "Eleva App - Seu Agente
//    Financeiro <noreply@mail.goskip.dev>", assunto "Redefina sua senha do
//    Eleva App" e botão preto). Aqui os 3 templates (resetPasswordTemplate,
//    verificationTemplate, confirmEmailChangeTemplate) passam para a identidade
//    visual aprovada (v0.0.150, pocketbase/hooks/mail_branding.js): fundo creme
//    #F8F3E3, card branco, logo real por URL absoluta, botão petróleo #2A5F6E,
//    títulos #1E4A5A e tagline "Seu parceiro nas finanças". Remetente exibido:
//    settings.meta.senderName/address (Consciente <contato@consciente.net.br>).
//    Os hooks onMailerRecord*Send do mail_branding.js continuam por cima como
//    camada viva (reaplicam o HTML branded com o nome da usuária no envio real).
//
// NENHUMA referência a "Eleva App" sobrevive nos templates de e-mail.

migrate(
  (app) => {
    // ---------- PARTE 1: SMTP a partir dos segredos ----------
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
      console.log('[0056] Nota ao ler segredos SKIP_SMTP_*: ' + envErr)
    }

    if (host && portStr && username && password && sender) {
      const port = parseInt(portStr, 10)
      if (isNaN(port) || port <= 0) {
        console.log('[0056] SKIP_SMTP_PORT inválido: ' + portStr + ' — SMTP não alterado')
      } else {
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
            '[0056] SMTP reaplicado dos segredos: host=' +
              host +
              ' port=' +
              port +
              ' tls=' +
              s.smtp.tls,
          )
        } else {
          console.log('[0056] SMTP já conforme os segredos — nada a fazer')
        }

        // Remetente exibido (from name/address) = marca Consciente sempre.
        if (meta.senderAddress !== senderAddress || meta.senderName !== senderName) {
          s.meta.senderAddress = senderAddress
          s.meta.senderName = senderName
          console.log('[0056] meta sender atualizado: ' + senderName + ' <' + senderAddress + '>')
        }
        if (s.meta.appName !== 'Consciente') {
          s.meta.appName = 'Consciente'
        }
        app.save(s)
      }
    } else {
      console.log('[0056] SKIP_SMTP_* ausentes no ambiente — SMTP não alterado; remetente mantido')
    }

    // ---------- PARTE 2: templates nativos com a marca Consciente ----------
    const LOGO_URL =
      'https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg'
    const APP_URL = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'

    function brandedShell(title, introHtml, buttonLabel, actionUrl, footNoteHtml) {
      return (
        '<!DOCTYPE html>\n' +
        '<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<title>' +
        title +
        '</title>\n</head>\n' +
        '<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A;">\n' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F3E3; padding: 40px 16px;"><tr><td align="center">\n' +
        '<table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #E7DFC9; padding: 32px; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">\n' +
        '<tr><td align="center" style="padding-bottom: 24px;"><img src="' +
        LOGO_URL +
        '" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" /></td></tr>\n' +
        '<tr><td style="color: #33475A; font-size: 16px; line-height: 24px;">' +
        introHtml +
        '</td></tr>\n' +
        '<tr><td align="center" style="padding: 8px 0 28px 0;"><a href="' +
        actionUrl +
        '" target="_blank" style="display: inline-block; background-color: #2A5F6E; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(42, 95, 110, 0.35);">' +
        buttonLabel +
        '</a></td></tr>\n' +
        '<tr><td style="border-top: 1px solid #E7DFC9; padding-top: 20px; font-size: 12px; line-height: 18px; color: #6B7A88;">' +
        '<p style="margin: 0 0 8px 0;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>\n' +
        '<p style="margin: 0 0 16px 0; word-break: break-all; color: #2A5F6E;"><a href="' +
        actionUrl +
        '" target="_blank" style="color: #2A5F6E;">' +
        actionUrl +
        '</a></p>\n' +
        footNoteHtml +
        '</td></tr>\n' +
        '<tr><td align="center" style="padding-top: 24px; font-size: 12px; color: #8A94A0;">' +
        '<p style="margin: 0 0 4px 0; font-weight: 600; color: #1E4A5A;">Seu parceiro nas finanças</p>\n' +
        '<p style="margin: 0;">© Consciente. Todos os direitos reservados.</p>\n' +
        '</td></tr>\n' +
        '</table>\n</td></tr></table>\n</body>\n</html>'
      )
    }

    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

      usersCol.resetPasswordTemplate = {
        subject: 'Redefina sua senha do Consciente',
        body: brandedShell(
          'Redefina sua senha do Consciente',
          '<h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1E4A5A; font-weight: 600;">Recuperação de Senha</h2>' +
            '<p style="margin: 0 0 16px 0; color: #33475A;">Olá!</p>' +
            '<p style="margin: 0 0 24px 0; color: #33475A;">Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para cadastrar uma nova senha:</p>',
          'Redefinir minha senha',
          APP_URL + '/reset-password?token={TOKEN}',
          '<p style="margin: 0; color: #8A94A0;">Se você não solicitou a redefinição de senha, nenhuma alteração foi feita e você pode ignorar este email com segurança.</p>',
        ),
      }

      usersCol.verificationTemplate = {
        subject: 'Confirme sua conta no Consciente',
        body: brandedShell(
          'Confirme sua conta no Consciente',
          '<h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1E4A5A; font-weight: 600;">Bem-vindo(a) ao Consciente!</h2>' +
            '<p style="margin: 0 0 16px 0; color: #33475A;">Olá!</p>' +
            '<p style="margin: 0 0 24px 0; color: #33475A;">Obrigado por criar sua conta no <strong>Consciente</strong>. Para começar a controlar seus custos e organizar suas caixinhas pelo WhatsApp e Web, confirme seu endereço de email clicando no botão abaixo:</p>',
          'Confirmar minha conta',
          APP_URL + '/verify-email?token={TOKEN}',
          '<p style="margin: 0; color: #8A94A0;">Se você não criou uma conta no Consciente, pode ignorar este email com segurança.</p>',
        ),
      }

      usersCol.confirmEmailChangeTemplate = {
        subject: 'Confirme seu novo email no Consciente',
        body: brandedShell(
          'Confirme seu novo email no Consciente',
          '<h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1E4A5A; font-weight: 600;">Confirmação de Novo Email</h2>' +
            '<p style="margin: 0 0 16px 0; color: #33475A;">Olá!</p>' +
            '<p style="margin: 0 0 24px 0; color: #33475A;">Você solicitou a alteração do endereço de email da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para confirmar este novo endereço:</p>',
          'Confirmar novo email',
          APP_URL + '/confirm-email-change?token={TOKEN}',
          '<p style="margin: 0; color: #8A94A0;">Se você não solicitou esta alteração, entre em contato imediatamente com o suporte ou altere sua senha.</p>',
        ),
      }

      app.save(usersCol)
      console.log('[0056] Templates nativos de e-mail da coleção users rebrandados (Consciente)')
    } catch (e) {
      console.log('[0056] Nota ao rebrandar templates da coleção users: ' + e)
    }
  },
  (app) => {
    // down: restaura os templates antigos (marca "Eleva App", conforme 0011)
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.resetPasswordTemplate = {
        subject: 'Redefina sua senha do Eleva App',
        body: '<p>Olá,</p>\n<p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Eleva App - Seu Agente Financeiro</strong>.</p>\n<p>Clique no botão abaixo para criar uma nova senha:</p>\n<p>\n  <a class="btn" href="https://agente-financeiro-whatsapp-37fd3.goskip.app/reset-password?token={TOKEN}" target="_blank" rel="noopener">Redefinir minha senha</a>\n</p>\n<p><i>Se você não solicitou a redefinição de senha, ignore esta mensagem.</i></p>\n<p>\n  Atenciosamente,<br/>\n  Equipe Eleva App\n</p>',
      }
      usersCol.verificationTemplate = {
        subject: 'Confirme sua conta no Eleva App',
        body: '<p>Olá,</p>\n<p>Obrigado por criar sua conta no <strong>Eleva App - Seu Agente Financeiro</strong>.</p>\n<p>Clique no botão abaixo para confirmar seu email e começar seu controle financeiro:</p>\n<p>\n  <a class="btn" href="https://agente-financeiro-whatsapp-37fd3.goskip.app/verify-email?token={TOKEN}" target="_blank" rel="noopener">Confirmar minha conta</a>\n</p>\n<p><i>Se você não realizou este cadastro, por favor ignore este email.</i></p>\n<p>\n  Atenciosamente,<br/>\n  Equipe Eleva App\n</p>',
      }
      usersCol.confirmEmailChangeTemplate = {
        subject: 'Confirme seu novo email no Eleva App',
        body: '<p>Olá,</p>\n<p>Você solicitou a alteração do email da sua conta no <strong>Eleva App - Seu Agente Financeiro</strong>.</p>\n<p>Clique no botão abaixo para confirmar seu novo endereço:</p>\n<p>\n  <a class="btn" href="https://agente-financeiro-whatsapp-37fd3.goskip.app/confirm-email-change?token={TOKEN}" target="_blank" rel="noopener">Confirmar novo email</a>\n</p>\n<p><i>Se você não solicitou esta alteração, ignore esta mensagem.</i></p>\n<p>\n  Atenciosamente,<br/>\n  Equipe Eleva App\n</p>',
      }
      app.save(usersCol)
    } catch (e) {
      console.log('[0056] Nota no down dos templates: ' + e)
    }
  },
)
