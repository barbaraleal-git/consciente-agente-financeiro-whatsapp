/// <reference path="../pb_data/types.d.ts" />
/**
 * send_test_emails.js — script de validação da rodada de branding (v0.0.150/0.0.151)
 *
 * Dispara os 3 e-mails de teste para barbara.ferreira.leal@gmail.com usando
 * EXCLUSIVAMENTE o que já existe em produção:
 *   - type=precharge:    rota POST /backend/v1/proactive/test-email (default)
 *   - type=pix_renewal:  mesma rota com o novo parâmetro type
 *   - type=system:       API de redefinição de senha do PocketBase
 *                        (POST /api/collections/users/request-password-reset)
 *                        — cai no hook onMailerRecordPasswordResetSend do
 *                        mail_branding.js e sai com o template rebrandado.
 *
 * O token admin é lido de "admin token" (stdin) — NUNCA hardcoded.
 * Rodar: node scripts/send-branding-test-emails.mjs
 */

const BACKEND_URL =
  process.env.BACKEND_URL || 'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'
const OWNER_EMAIL = 'barbara.ferreira.leal@gmail.com'

async function post(url, body, headers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch (_) {
    json = null
  }
  return { status: res.status, body: json }
}

async function main() {
  const adminToken = (
    await new Promise((resolve) => {
      let data = ''
      process.stdin.on('data', (c) => (data += c))
      process.stdin.on('end', () => resolve(data.trim()))
    })
  )
    .replace(/^admin token\s*:?/i, '')
    .trim()

  if (!adminToken) {
    console.error(
      'ERRO: cole o token admin no stdin (echo <token> | node scripts/send-branding-test-emails.mjs)',
    )
    process.exit(1)
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: adminToken,
  }

  // 1. Pré-cobrança (comportamento atual da rota)
  const precharge = await post(
    BACKEND_URL + '/backend/v1/proactive/test-email',
    { type: 'precharge', to: OWNER_EMAIL },
    authHeaders,
  )
  console.log('precharge  ->', precharge.status, JSON.stringify(precharge.body))

  // 2. Renovação Pix anual (engine, envio forçado para a dona)
  const pix = await post(
    BACKEND_URL + '/backend/v1/proactive/test-email',
    { type: 'pix_renewal', to: OWNER_EMAIL },
    authHeaders,
  )
  console.log('pix_renewal ->', pix.status, JSON.stringify(pix.body))

  // 3. Sistema (redefinição de senha — mail_branding)
  const system = await post(
    BACKEND_URL + '/api/collections/users/request-password-reset',
    { email: OWNER_EMAIL },
    { 'Content-Type': 'application/json' },
  )
  console.log('system     ->', system.status, JSON.stringify(system.body))
}

main()
