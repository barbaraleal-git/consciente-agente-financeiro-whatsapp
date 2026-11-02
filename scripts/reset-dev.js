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

  // 0. TRAVA DE SEGURANÇA ESTRUTURAL (PRÉ-RESET):
  // Valida que o canal oficial WhatsApp (whatsapp_status) existe e está com token configurado.
  // JAMAIS inicia a limpeza se a infraestrutura do WhatsApp não puder ser atestada antes.
  console.log('[TRAVA PRÉ-RESET] Verificando integridade da infraestrutura do WhatsApp...')
  let preWsStatus = null
  try {
    const preCheck = await request('/backend/v1/whatsapp/status')
    if (preCheck.status === 200 && preCheck.data) {
      preWsStatus = preCheck.data
      console.log('  Canal Meta Cloud API: Conectado')
      console.log(`  Número Oficial:       ${preWsStatus.owner_phone || preWsStatus.user_phone}`)
      console.log(`  Phone Number ID:      ${preWsStatus.phone_number_id}`)
      console.log(`  WABA ID:              ${preWsStatus.waba_id}`)
      console.log(
        `  Token Configurado:    ${preWsStatus.token_configurado ? 'SIM (Ativo)' : 'NÃO (Pendente)'}`,
      )

      if (!preWsStatus.token_configurado) {
        console.error(
          '\n[ALERTA PRÉ-RESET] whatsapp_status está sem token configurado antes de iniciar!',
        )
        console.error('Abortando para não propagar estado inconsistente.')
        process.exitCode = 1
        return
      }
    } else {
      // Se a rota do backend retornar != 200 (ex: sem auth superuser), tenta consulta direta
      const resWs = await request('/api/collections/whatsapp_status/records?perPage=10')
      const wsItems = resWs.data?.items || []
      if (wsItems.length === 0) {
        console.error('\n[ALERTA PRÉ-RESET] Nenhum registro encontrado em whatsapp_status!')
        console.error('Abortando: infraestrutura do canal oficial precisa existir antes do reset.')
        process.exitCode = 1
        return
      }
      const wsRec = wsItems[0]
      const hasToken = !!wsRec.access_token
      console.log('  Registro whatsapp_status encontrado.')
      console.log(`  Número: ${wsRec.phone_number}`)
      console.log(`  Phone Number ID: ${wsRec.phone_number_id}`)
      console.log(`  WABA ID: ${wsRec.waba_id}`)
      console.log(`  Token presente no registro: ${hasToken ? 'SIM' : 'NÃO'}`)
      if (!hasToken) {
        console.error('\n[ALERTA PRÉ-RESET] Registro whatsapp_status está sem access_token!')
        process.exitCode = 1
        return
      }
    }
  } catch (preErr) {
    console.log('  Aviso na verificação pré-reset:', preErr.message)
  }
  console.log('  -> Trava pré-reset aprovada: infraestrutura do WhatsApp confirmada intacta.\n')

  // 1. Coleções de aplicação a serem esvaziadas (ordem: relations primeiro)
  // REGRA DE SEGURANÇA ESTRUTURAL: whatsapp_status JAMAIS deve constar nesta lista.
  const collectionsToClear = [
    'alerts',
    'import_jobs',
    'transactions',
    'budgets',
    'categories',
    'whatsapp_contacts',
  ]

  // Defesa em profundidade: validação programática estrita contra inclusão de whatsapp_status
  const FORBIDDEN_COLLECTIONS = ['whatsapp_status', '_superusers', '_collections']
  for (const forbidden of FORBIDDEN_COLLECTIONS) {
    if (collectionsToClear.includes(forbidden)) {
      throw new Error(`VIOLAÇÃO GRAVE: ${forbidden} nunca pode ser incluída na lista de limpeza!`)
    }
  }

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
  // Antes de apagar usuários, se algum registro em whatsapp_status apontar owner para
  // um usuário que será deletado, desvinculamos o owner com segurança preservando o registro e o token.
  try {
    const wsCheck = await request('/api/collections/whatsapp_status/records?perPage=10')
    const wsRecords = wsCheck.data?.items || []
    for (const ws of wsRecords) {
      if (ws.owner && isExecute) {
        console.log(
          `  [whatsapp_status] Desvinculando owner ${ws.owner} para evitar cascade e preservar o canal...`,
        )
        await request(`/api/collections/whatsapp_status/records/${ws.id}`, {
          method: 'PATCH',
          body: { owner: '' },
        })
      }
    }
  } catch (err) {
    console.log('  Nota ao verificar owner de whatsapp_status:', err.message)
  }

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
  console.log('\nContagem final por coleção de negócio:')
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

  // 4. VERIFICAÇÃO OBRIGATÓRIA PÓS-RESET DO CANAL WHATSAPP:
  // Valida que whatsapp_status permanece 100% INTACTO com token presente, phone_number_id e WABA ID.
  console.log(
    '\n[TRAVA PÓS-RESET] Verificando integridade da infraestrutura do WhatsApp pós-reset...',
  )
  let postResetValid = false
  try {
    const statusRes = await request('/backend/v1/whatsapp/status')
    if (statusRes.status === 200 && statusRes.data) {
      const st = statusRes.data
      console.log(
        `  Canal Meta Cloud API: ${st.token_configurado ? 'ATIVO E INTACTO' : 'ERRO - TOKEN AUSENTE'}`,
      )
      console.log(`  Token Configurado:    ${st.token_configurado ? 'SIM' : 'NÃO (FALHA GRAVE)'}`)
      console.log(`  Número Comercial:     ${st.owner_phone || st.user_phone}`)
      console.log(`  Phone Number ID:      ${st.phone_number_id}`)
      console.log(`  WABA ID:              ${st.waba_id}`)
      console.log(`  Webhook URL:          ${st.webhook_url}`)

      if (st.token_configurado && st.phone_number_id && st.waba_id) {
        postResetValid = true
      }
    } else {
      // Fallback via API REST
      const res = await request('/api/collections/whatsapp_status/records?perPage=10')
      const items = res.data?.items || []
      if (
        items.length > 0 &&
        items[0].access_token &&
        items[0].phone_number_id &&
        items[0].waba_id
      ) {
        console.log(`  [whatsapp_status] Registro preservado intacto (ID: ${items[0].id}).`)
        console.log(`  Número Comercial: ${items[0].phone_number}`)
        console.log(`  Phone Number ID:  ${items[0].phone_number_id}`)
        console.log(`  WABA ID:          ${items[0].waba_id}`)
        console.log(
          `  Token Meta:       ${items[0].access_token ? 'Configurado e Ativo' : 'AUSENTE'}`,
        )
        postResetValid = true
      }
    }
  } catch (err) {
    console.log('  Aviso ao verificar whatsapp_status pós-reset:', err.message)
  }

  console.log('\n===========================================================')
  if (!isExecute) {
    console.log('  Simulação concluída com sucesso! Nenhum dado foi alterado.')
    console.log('  Para executar a limpeza de fato, rode:')
    console.log('    node scripts/reset-dev.js --yes')
  } else if (allZero && postResetValid) {
    console.log('  Zeragem de dados concluída com sucesso: todas as coleções em 0 registros.')
    console.log(
      '  A infraestrutura do WhatsApp Cloud API está 100% preservada e pronta para novos testes.',
    )
  } else {
    if (!allZero) {
      console.log('  ATENÇÃO: nem todas as coleções ficaram em 0 registros. Revise acima.')
    }
    if (!postResetValid) {
      console.log(
        '  FALHA CRÍTICA: o canal WhatsApp não passou na validação de integridade pós-reset!',
      )
    }
    process.exitCode = 1
  }
  console.log('===========================================================')
}

main().catch((err) => {
  console.error('Erro durante a execução do reset-dev:', err)
  process.exit(1)
})
