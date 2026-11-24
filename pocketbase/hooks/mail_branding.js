// Hook para garantir que todos os emails enviados pelo PocketBase
// usem a marca "Consciente" e a tagline oficial "Seu parceiro nas finanças", sem menção a "Eleva" ou "Skip".
// Identidade visual (v0.0.147): tema claro creme/branco, títulos azul-escuro #1E4A5A, botões petróleo #2A5F6E, logo oficial real via URL absoluta.

// v0.0.157: shell de e-mail branded compartilhado (mesma identidade aprovada na
// v0.0.150) — creme #F8F3E3, card branco, logo real por URL absoluta, botão
// petróleo #2A5F6E, títulos #1E4A5A e tagline "Seu parceiro nas finanças".
// Usado pelos 3 hooks onMailer*Send deste arquivo (evita 3 cópias do HTML).
// v0.0.161 — Os 3 e-mails de SISTEMA (verificação, reset de senha, troca de
// e-mail) também respeitam o toggle: modo 'platform' segue o fluxo nativo
// (e.next() — retransmissor Skip, comprovado); modo 'resend' envia via API
// HTTPS do Resend e chama e.next() APENAS se falhar (fallback platform), para
// não duplicar. Reutiliza o ponto único __mailDelivery (mail_delivery.js).
function sendSystemEmailDualPath(e, subject, html, text, kind) {
  try {
    const md = typeof globalThis !== 'undefined' ? globalThis.__mailDelivery : null
    if (
      md &&
      typeof md.getDeliveryMode === 'function' &&
      md.getDeliveryMode() === 'resend' &&
      typeof md.sendViaResend === 'function'
    ) {
      const to = (e.record && e.record.getString('email')) || ''
      const from = typeof md.senderInfo === 'function' ? md.senderInfo() : null
      if (to && from) {
        const res = md.sendViaResend(to, subject, html, from)
        if (res && res.ok) {
          console.log('[mail_branding] ENVIADO via resend | kind=' + kind + ' to=' + to)
          return // enviado — NÃO chamar e.next() (evita envio duplicado)
        }
        console.log(
          '[mail_branding] resend falhou (' +
            ((res && res.reason) || '?') +
            ') — FALLBACK platform | kind=' +
            kind,
        )
      }
    }
  } catch (err) {
    console.log('[mail_branding] nota no caminho duplo de sistema (' + kind + '): ' + err)
  }
  e.next() // modo platform (ou falha do resend): caminho nativo comprovado
}

function brandedEmailShell(
  docTitle,
  heading,
  greetingHtml,
  bodyHtml,
  buttonLabel,
  actionUrl,
  footNote,
) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F3E3; color: #1E4A5A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F3E3; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #E7DFC9; padding: 32px; box-shadow: 0 6px 18px rgba(30,74,90,0.10);">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <img src="https://agente-financeiro-whatsapp-37fd3.goskip.app/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg" alt="Consciente" width="180" style="display: block; width: 180px; max-width: 100%; height: auto; border: 0; margin: 0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="color: #33475A; font-size: 16px; line-height: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1E4A5A; font-weight: 600;">
                ${heading}
              </h2>
              <p style="margin: 0 0 16px 0; color: #33475A;">
                ${greetingHtml}
              </p>
              <p style="margin: 0 0 24px 0; color: #33475A;">
                ${bodyHtml}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 0 28px 0;">
              <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #2A5F6E; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(42, 95, 110, 0.35);">
                ${buttonLabel}
              </a>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #E7DFC9; padding-top: 20px; font-size: 12px; line-height: 18px; color: #6B7A88;">
              <p style="margin: 0 0 8px 0;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin: 0 0 16px 0; word-break: break-all; color: #2A5F6E;">
                <a href="${actionUrl}" target="_blank" style="color: #2A5F6E;">${actionUrl}</a>
              </p>
              <p style="margin: 0; color: #8A94A0;">
                ${footNote}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px; font-size: 12px; color: #8A94A0;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #1E4A5A;">Seu parceiro nas finanças</p>
              <p style="margin: 0;">© Consciente. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

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

      e.message.html = brandedEmailShell(
        'Confirme sua conta no Consciente',
        'Bem-vindo(a) ao Consciente!',
        'Olá, <strong>' + userName + '</strong>!',
        'Obrigado por criar sua conta no <strong>Consciente</strong>. Para começar a controlar seus custos e organizar suas caixinhas pelo WhatsApp e Web, confirme seu endereço de email clicando no botão abaixo:',
        'Confirmar minha conta',
        actionUrl,
        'Se você não criou uma conta no Consciente, pode ignorar este email com segurança.',
      )

      e.message.text = `Olá, ${userName}!\n\nBem-vindo(a) ao Consciente - Seu parceiro nas finanças.\n\nPara confirmar sua conta, acesse o link abaixo:\n${actionUrl}\n\nSe você não criou uma conta, ignore este email.\n\nEquipe Consciente`
    }
  } catch (err) {
    console.log('[mail_branding] Erro ao personalizar email de verificação:', err)
  }

  sendSystemEmailDualPath(
    e,
    'Confirme sua conta no Consciente',
    e.message.html,
    e.message.text,
    'verification',
  )
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

      e.message.html = brandedEmailShell(
        'Redefina sua senha do Consciente',
        'Recuperação de Senha',
        'Olá, <strong>' + userName + '</strong>!',
        'Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para cadastrar uma nova senha:',
        'Redefinir minha senha',
        actionUrl,
        'Se você não solicitou a redefinição de senha, nenhuma alteração foi feita e você pode ignorar este email com segurança.',
      )

      e.message.text = `Olá, ${userName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta no Consciente - Seu parceiro nas finanças.\n\nPara cadastrar uma nova senha, acesse:\n${actionUrl}\n\nSe você não solicitou, ignore este email.\n\nEquipe Consciente`
    }
  } catch (err) {
    console.log('[mail_branding] Erro ao personalizar email de redefinição de senha:', err)
  }

  sendSystemEmailDualPath(
    e,
    'Redefina sua senha do Consciente',
    e.message.html,
    e.message.text,
    'password_reset',
  )
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

      e.message.html = brandedEmailShell(
        'Confirme seu novo email no Consciente',
        'Confirmação de Novo Email',
        'Olá, <strong>' + userName + '</strong>!',
        'Você solicitou a alteração do endereço de email da sua conta no <strong>Consciente</strong>. Clique no botão abaixo para confirmar este novo endereço:',
        'Confirmar novo email',
        actionUrl,
        'Se você não solicitou esta alteração, entre em contato imediatamente com o suporte ou altere sua senha.',
      )

      e.message.text = `Olá, ${userName}!\n\nVocê solicitou a alteração do email da sua conta no Consciente - Seu parceiro nas finanças.\n\nPara confirmar seu novo email, acesse:\n${actionUrl}\n\nSe você não solicitou, ignore este email.\n\nEquipe Consciente`
    }
  } catch (err) {
    console.log('[mail_branding] Erro ao personalizar email de alteração:', err)
  }

  sendSystemEmailDualPath(
    e,
    'Confirme seu novo email no Consciente',
    e.message.html,
    e.message.text,
    'email_change',
  )
})
