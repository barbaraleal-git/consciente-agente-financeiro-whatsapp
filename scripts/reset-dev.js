#!/usr/bin/env node

/**
 * Script de Zeragem de Dados de Desenvolvimento — Consciente
 *
 * USO:
 *   node scripts/reset-dev.js         -> Modo DRY-RUN (apenas lista o que seria apagado)
 *   node scripts/reset-dev.js --yes   -> Executa a limpeza de fato
 *
 * PRESERVA OBRIGATORIAMENTE:
 *   - whatsapp_status (Configuração Meta Cloud API, token de acesso, Phone ID, WABA ID)
 *   - Usuário técnico de serviço (whatsapp-visitante@agente.internal)
 *
 * LIMPA:
 *   - transações, categorias, orçamentos (caixinhas), alertas, import_jobs
 *   - usuários reais de teste
 *   - desvincula contatos de whatsapp_contacts (limpando user e conversation_id)
 */

import http from 'http'
import https from 'https'

const POCKETBASE_URL =
  process.env.POCKETBASE_URL ||
  process.env.VITE_POCKETBASE_URL ||
  'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'

const isExecute = process.argv.includes('--yes')

async function request(path, options = {}) {
  const url = new URL(path, POCKETBASE_URL)
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : {}
            resolve({ status: res.statusCode, data })
          } catch (_) {
            resolve({ status: res.statusCode, raw: body })
          }
        })
      },
    )

    req.on('error', reject)
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    req.end()
  })
}

async function main() {
  console.log('===========================================================')
  console.log('  Consciente - Script de Zeragem de Dados de Desenvolvimento')
  console.log('===========================================================')
  console.log(`Backend alvo: ${POCKETBASE_URL}`)
  console.log(`Modo: ${isExecute ? 'EXECUÇÃO EFETIVA (--yes)' : 'DRY-RUN (Simulação segura)'}\n`)

  // 1. Coleções de aplicação a serem esvaziadas
  const collectionsToClear = ['alerts', 'import_jobs', 'transactions', 'budgets', 'categories']

  for (const col of collectionsToClear) {
    try {
      const res = await request(`/api/collections/${col}/records?perPage=500`)
      const items = res.data?.items || []
      console.log(`[${col}] Encontrados ${items.length} registro(s).`)

      if (isExecute && items.length > 0) {
        for (const item of items) {
          await request(`/api/collections/${col}/records/${item.id}`, { method: 'DELETE' })
        }
        console.log(`  -> ${items.length} registro(s) apagados de ${col}.`)
      }
    } catch (err) {
      console.log(`  Aviso ao consultar ${col}:`, err.message)
    }
  }

  // 2. Limpeza de whatsapp_contacts (preserva o número e zera vínculo com usuário e conversa)
  try {
    const res = await request('/api/collections/whatsapp_contacts/records?perPage=500')
    const items = res.data?.items || []
    console.log(`[whatsapp_contacts] Encontrados ${items.length} contato(s).`)

    if (isExecute && items.length > 0) {
      for (const item of items) {
        await request(`/api/collections/whatsapp_contacts/records/${item.id}`, {
          method: 'PATCH',
          body: {
            user: '',
            conversation_id: '',
            messages_count: 0,
          },
        })
      }
      console.log(`  -> ${items.length} contato(s) desvinculados para permitir novo teste do zero.`)
    }
  } catch (err) {
    console.log('  Aviso ao consultar whatsapp_contacts:', err.message)
  }

  // 3. Usuários reais de teste (preserva apenas whatsapp-visitante@agente.internal)
  try {
    const res = await request('/api/collections/users/records?perPage=500')
    const items = res.data?.items || []
    const usersToDelete = items.filter((u) => u.email !== 'whatsapp-visitante@agente.internal')
    console.log(
      `[users] Encontrados ${items.length} usuário(s), dos quais ${usersToDelete.length} são de teste e serão removidos.`,
    )

    if (isExecute && usersToDelete.length > 0) {
      for (const u of usersToDelete) {
        await request(`/api/collections/users/records/${u.id}`, { method: 'DELETE' })
      }
      console.log(`  -> ${usersToDelete.length} usuário(s) de teste removido(s).`)
    }
  } catch (err) {
    console.log('  Aviso ao consultar users:', err.message)
  }

  // 4. Verificação de integridade da infraestrutura preservada
  try {
    const res = await request('/api/collections/whatsapp_status/records?perPage=10')
    const items = res.data?.items || []
    console.log(
      `\n[whatsapp_status] PRESERVADA INTACTA (${items.length} registro de canal oficial mantido).`,
    )
    if (items[0]) {
      console.log(`  Número Comercial: ${items[0].phone_number}`)
      console.log(`  Phone Number ID:  ${items[0].phone_number_id}`)
      console.log(`  WABA ID:          ${items[0].waba_id}`)
      console.log(
        `  Token Meta:       ${items[0].access_token ? 'Configurado e Ativo' : 'Pendente'}`,
      )
    }
  } catch (err) {
    console.log('  Aviso ao verificar whatsapp_status:', err.message)
  }

  console.log('\n===========================================================')
  if (!isExecute) {
    console.log('  Simulação concluída com sucesso! Nenhum dado foi alterado.')
    console.log('  Para executar a limpeza de fato, rode:')
    console.log('    node scripts/reset-dev.js --yes')
  } else {
    console.log('  Zeragem de dados concluída com sucesso!')
    console.log('  A infraestrutura do WhatsApp Cloud API está 100% pronta para novos testes.')
  }
  console.log('===========================================================')
}

main().catch((err) => {
  console.error('Erro durante a execução do reset-dev:', err)
  process.exit(1)
})
