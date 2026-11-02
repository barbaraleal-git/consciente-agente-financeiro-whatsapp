#!/usr/bin/env node

/**
 * Script de Zeragem de Dados de Desenvolvimento — Consciente
 * Rotina PERMANENTE de reset (docs/ARQUITETURA.md §6).
 * NUNCA usar migração ad-hoc temporária para limpar dados.
 *
 * USO:
 *   node scripts/reset-dev.js         -> Modo DRY-RUN (apenas lista o que seria apagado)
 *   node scripts/reset-dev.js --yes   -> Executa a limpeza de fato
 *
 * Autenticação (opcional, recomendada): se as regras de acesso das coleções
 * exigirem superusuário, exporte antes:
 *   PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/reset-dev.js --yes
 *
 * PRESERVA OBRIGATORIAMENTE:
 *   - whatsapp_status (Configuração Meta Cloud API, token de acesso, Phone ID, WABA ID)
 *
 * LIMPA (tudo deve ficar em 0 registros):
 *   - transações, categorias, orçamentos (caixinhas), alertas, import_jobs
 *   - whatsapp_contacts (contatos, conversas e vínculos com números)
 *   - TODOS os usuários (o usuário técnico whatsapp-visitante@agente.internal
 *     é recriado automaticamente pelo bridge no primeiro contato de visitante)
 */

import http from 'https'

const POCKETBASE_URL =
  process.env.POCKETBASE_URL ||
  process.env.VITE_POCKETBASE_URL ||
  'https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev'

const isExecute = process.argv.includes('--yes')

let authToken = process.env.PB_ADMIN_TOKEN || ''

async function request(path, options = {}) {
  const url = new URL(path, POCKETBASE_URL)
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (authToken) headers.Authorization = authToken

  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: options.method || 'GET', headers }, (res) => {
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
    })
    req.on('error', reject)
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    req.end()
  })
}

async function authenticate() {
  if (authToken) return
  const email = process.env.PB_ADMIN_EMAIL
  const password = process.env.PB_ADMIN_PASSWORD
  if (!email || !password) return
  try {
    const res = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: { identity: email, password },
    })
    if (res.data?.token) {
      authToken = res.data.token
      console.log('Autenticado como superusuário.\n')
    } else {
      console.log('Aviso: falha ao autenticar superusuário (status ' + res.status + ').\n')
    }
  } catch (err) {
    console.log('Aviso: erro ao autenticar superusuário:', err.message, '\n')
  }
}

async function listAll(col) {
  const items = []
  let page = 1
  for (;;) {
    const res = await request(`/api/collections/${col}/records?perPage=500&page=${page}`)
    const pageItems = res.data?.items || []
    items.push(...pageItems)
    if (pageItems.length < 500 || page >= (res.data?.totalPages || 1)) break
    page++
  }
  return items
}

async function main() {
  console.log('===========================================================')
  console.log('  Consciente - Script de Zeragem de Dados de Desenvolvimento')
  console.log('===========================================================')
  console.log(`Backend alvo: ${POCKETBASE_URL}`)
  console.log(`Modo: ${isExecute ? 'EXECUÇÃO EFETIVA (--yes)' : 'DRY-RUN (Simulação segura)'}\n`)

  await authenticate()

  // 1. Coleções de aplicação a serem esvaziadas (ordem: relations primeiro)
  const collectionsToClear = [
    'alerts',
    'import_jobs',
    'transactions',
    'budgets',
    'categories',
    'whatsapp_contacts',
  ]

  for (const col of collectionsToClear) {
    try {
      const items = await listAll(col)
      console.log(`[${col}] Encontrados ${items.length} registro(s).`)

      if (isExecute && items.length > 0) {
        for (const item of items) {
          const del = await request(`/api/collections/${col}/records/${item.id}`, {
            method: 'DELETE',
          })
          if (del.status >= 400) {
            console.log(`  Aviso: falha ao apagar ${col}/${item.id} (status ${del.status}).`)
          }
        }
        console.log(`  -> ${items.length} registro(s) apagados de ${col}.`)
      }
    } catch (err) {
      console.log(`  Aviso ao consultar ${col}:`, err.message)
    }
  }

  // 2. Usuários: TODOS são removidos (o visitante técnico é recriado sob
  //    demanda pelo bridge no primeiro contato de um visitante).
  try {
    const items = await listAll('users')
    console.log(`[users] Encontrados ${items.length} usuário(s) — todos serão removidos.`)

    if (isExecute && items.length > 0) {
      for (const u of items) {
        const del = await request(`/api/collections/users/records/${u.id}`, { method: 'DELETE' })
        if (del.status >= 400) {
          console.log(`  Aviso: falha ao apagar usuário ${u.email} (status ${del.status}).`)
        }
      }
      console.log(`  -> ${items.length} usuário(s) removido(s).`)
    }
  } catch (err) {
    console.log('  Aviso ao consultar users:', err.message)
  }

  // 3. Verificação final: contagem de TODAS as coleções de aplicação
  const verifyCols = [
    'users',
    'transactions',
    'categories',
    'budgets',
    'alerts',
    'import_jobs',
    'whatsapp_contacts',
  ]
  console.log('\nContagem final por coleção:')
  let allZero = true
  for (const col of verifyCols) {
    try {
      const res = await request(`/api/collections/${col}/records?perPage=1`)
      const total = res.data?.totalItems ?? '?'
      if (total !== 0) allZero = false
      console.log(`  ${col}: ${total} registro(s)`)
    } catch (err) {
      allZero = false
      console.log(`  ${col}: ERRO (${err.message})`)
    }
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
  } else if (allZero) {
    console.log('  Zeragem de dados concluída com sucesso: todas as coleções em 0 registros.')
    console.log('  A infraestrutura do WhatsApp Cloud API está 100% pronta para novos testes.')
  } else {
    console.log('  ATENÇÃO: nem todas as coleções ficaram em 0 registros. Revise acima.')
    process.exitCode = 1
  }
  console.log('===========================================================')
}

main().catch((err) => {
  console.error('Erro durante a execução do reset-dev:', err)
  process.exit(1)
})
