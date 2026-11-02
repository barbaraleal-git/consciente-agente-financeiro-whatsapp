// Hook para garantir que todos os emails enviados pelo PocketBase
// usem a marca "Consciente" e a tagline oficial "Consciente - Seu parceiro nas finanças", sem menção a "Eleva" ou "Skip".

// 0. Auto-promoção da dona do produto (Barbara) para admin no login ou criação
onRecordAfterAuthWithPasswordSuccess((e) => {
  try {
    const record = e.record
    if (record && record.getString('email') === 'barbara.ferreira.leal@gmail.com') {
      if (record.getString('role') !== 'admin') {
        record.set('role', 'admin')
        $app.save(record)
        console.log('[auth] barbara.ferreira.leal@gmail.com auto-promovida para admin no login')
      }
    }
  } catch (err) {
    console.log('[auth] Erro ao checar role de admin no login:', err)
  }
  return e.next()
}, 'users')

onRecordCreateRequest((e) => {
  try {
    const record = e.record
    if (record) {
      if (record.getString('email') === 'barbara.ferreira.leal@gmail.com') {
        record.set('role', 'admin')
      } else if (!record.getString('role')) {
        record.set('role', 'client')
      }
    }
  } catch (err) {
    console.log('[auth] Erro ao definir role padrão:', err)
  }
  return e.next()
}, 'users')

// 1. Hook para email de Verificação de Conta
onMailerRecordVerificationSend((e) => {
  try {
    const record = e.record
    const token = (e.meta && e.meta.token) || ''
    const userName = (record && record.getString('name')) || 'Usuário'
    const appUrl = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
    const actionUrl = `${appUrl}/verify-email?token=${token}`

    if (e.message) {
      if (e.message.from) {
        e.message.from.name = 'Consciente - Seu parceiro nas finanças'
      }

      e.message.subject = 'Confirme sua conta no Consciente'

      e.message.html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Confirme sua conta no Consciente</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 20px; letter-spacing: -0.5px;">
                Consciente
              </div>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Consciente - Seu parceiro nas finanças
              </p>
            </td>
          </tr>
          <tr>
            <td style="color: #f1f5f9; font-size: 16px; line-height: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #ffffff; font-weight: 600;">
                Bem-vindo(a) ao Consciente!
              </h2>
              <p style="margin: 0 0 16px 0; color: #cbd5e1;">
                Olá, <strong>${userName}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; color: #cbd5e1;">
                Obrigado por criar sua conta no <strong>Consciente</strong>. Para começar a controlar seus custos e organizar suas caixinhas pelo WhatsApp e Web, confirme seu endereço de email clicando no botão abaixo:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 0 28px 0;">
              <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                Confirmar minha conta
              </a>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; line-height: 18px; color: #94a3b8;">
              <p style="margin: 0 0 8px 0;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 16px 0; word-break: break-all; color: #818cf8;">
                <a href="${actionUrl}" target="_blank" style="color: #818cf8;">${actionUrl}</a>
              </p>
              <p style="margin: 0; color: #64748b;">
                Se você não criou uma conta no Consciente, pode ignorar este email com segurança.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px; font-size: 12px; color: #64748b;">
              © Consciente — Seu parceiro nas finanças. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim()

      e.message.text = `Olá, ${userName}!\n\nBem-vindo(a) ao Consciente - Seu parceiro nas finanças.\n\nPara confirmar sua conta, acesse o link abaixo:\n${actionUrl}\n\nSe você não criou uma conta, ignore este email.\n\nEquipe Consciente`
    }
  } catch (err) {
    console.log('[mail_branding] Erro ao personalizar email de verificação:', err)
  }

  e.next()
})

// 2. Hook para email de Redefinição de Senha
onMailerRecordPasswordResetSend((e) => {
  try {
    const record = e.record
    const token = (e.meta && e.meta.token) || ''
    const userName = (record && record.getString('name')) || 'Usuário'
    const appUrl = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
    const actionUrl = `${appUrl}/reset-password?token=${token}`

    if (e.message) {
      if (e.message.from) {
        e.message.from.name = 'Consciente - Seu parceiro nas finanças'
      }

      e.message.subject = 'Redefina sua senha do Consciente'

      e.message.html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Redefina sua senha do Consciente</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 20px; letter-spacing: -0.5px;">
                Consciente
              </div>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Consciente - Seu parceiro nas finanças
              </p>
            </td>
          </tr>
          <tr>
            <td style="color: #f1f5f9; font-size: 16px; line-height: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #ffffff; font-weight: 600;">
                Recuperação de Senha
              </h2>
              <p style="margin: 0 0 16px 0; color: #cbd5e1;">
                Olá, <strong>${userName}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; color: #cbd5e1;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para cadastrar uma nova senha:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 0 28px 0;">
              <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                Redefinir minha senha
              </a>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; line-height: 18px; color: #94a3b8;">
              <p style="margin: 0 0 8px 0;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 16px 0; word-break: break-all; color: #818cf8;">
                <a href="${actionUrl}" target="_blank" style="color: #818cf8;">${actionUrl}</a>
              </p>
              <p style="margin: 0; color: #64748b;">
                Se você não solicitou a redefinição de senha, nenhuma alteração foi feita e você pode ignorar este email com segurança.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px; font-size: 12px; color: #64748b;">
              © Consciente — Seu parceiro nas finanças. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim()

      e.message.text = `Olá, ${userName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta no Consciente - Seu parceiro nas finanças.\n\nPara cadastrar uma nova senha, acesse:\n${actionUrl}\n\nSe você não solicitou, ignore este email.\n\nEquipe Consciente`
    }
  } catch (err) {
    console.log('[mail_branding] Erro ao personalizar email de redefinição de senha:', err)
  }

  e.next()
})

// 3. Hook para email de Troca de Email
onMailerRecordEmailChangeSend((e) => {
  try {
    const record = e.record
    const token = (e.meta && e.meta.token) || ''
    const userName = (record && record.getString('name')) || 'Usuário'
    const appUrl = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
    const actionUrl = `${appUrl}/confirm-email-change?token=${token}`

    if (e.message) {
      if (e.message.from) {
        e.message.from.name = 'Consciente - Seu parceiro nas finanças'
      }

      e.message.subject = 'Confirme seu novo email no Consciente'

      e.message.html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Confirme seu novo email no Consciente</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 20px; letter-spacing: -0.5px;">
                Consciente
              </div>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Consciente - Seu parceiro nas finanças
              </p>
            </td>
          </tr>
          <tr>
            <td style="color: #f1f5f9; font-size: 16px; line-height: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #ffffff; font-weight: 600;">
                Confirmação de Novo Email
              </h2>
              <p style="margin: 0 0 16px 0; color: #cbd5e1;">
                Olá, <strong>${userName}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; color: #cbd5e1;">
                Você solicitou a alteração do endereço de email da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para confirmar este novo endereço:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 0 28px 0;">
              <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                Confirmar novo email
              </a>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; line-height: 18px; color: #94a3b8;">
              <p style="margin: 0 0 8px 0;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 16px 0; word-break: break-all; color: #818cf8;">
                <a href="${actionUrl}" target="_blank" style="color: #818cf8;">${actionUrl}</a>
              </p>
              <p style="margin: 0; color: #64748b;">
                Se você não solicitou esta alteração, entre em contato imediatamente com o suporte ou altere sua senha.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px; font-size: 12px; color: #64748b;">
              © Consciente — Seu parceiro nas finanças. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim()

      e.message.text = `Olá, ${userName}!\n\nVocê solicitou a alteração do email da sua conta no Consciente - Seu parceiro nas finanças.\n\nPara confirmar seu novo email, acesse:\n${actionUrl}\n\nSe você não solicitou, ignore este email.\n\nEquipe Consciente`
    }
  } catch (err) {
    console.log('[mail_branding] Erro ao personalizar email de alteração:', err)
  }

  e.next()
})
