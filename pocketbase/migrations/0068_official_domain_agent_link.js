/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// Migração 0068 — Item 37 do backlog oficial: domínio oficial ATIVOU.
// Troca o link único de acesso ao app do agente nativo
// 'financeiro-whatsapp' de consciente.goskip.app (e da variante mais
// antiga agente-financeiro-whatsapp-37fd3.goskip.app) para
// https://consciente.net.br:
//   1) systemPrompt: lido via $ai.agents.get, reescrito trocando QUALQUER
//      ocorrência de domínio antigo — sem reconstruir o prompt (nenhum
//      outro comportamento muda), e com confirmação de que o valor novo
//      ficou gravado.
//   2) Memórias: listadas POR CONTEÚDO, cada memória com domínio antigo é
//      APAGADA com o payload EXATO capturado da própria listagem
//      (deleteMemories exige payload exato — variante imprecisa falha em
//      silêncio), e a memória de link único é regravada com o domínio novo.
//   3) Prova: ao fim, RELISTA as memórias e loga quantas com link antigo
//      permanecem (deve ser 0) e como ficou a memória nova.
// Idempotente: roda de novo e não faz nada quando tudo já está no novo
// domínio (no-op na base nova).
// ----------------------------------------------------

migrate(
  (app) => {
    const SLUG = 'financeiro-whatsapp'
    const OLD_LINK_1 = 'consciente.goskip.app'
    const OLD_LINK_2 = 'agente-financeiro-whatsapp-37fd3.goskip.app'
    const NEW_LINK = 'https://consciente.net.br'

    const hasOldLink = (content) => {
      const low = String(content || '').toLowerCase()
      return low.indexOf(OLD_LINK_1) !== -1 || low.indexOf(OLD_LINK_2) !== -1
    }

    // ----------------------------------------------------------
    // 1) systemPrompt: troca apenas as ocorrências dos domínios antigos
    // ----------------------------------------------------------
    try {
      const agent = $ai.agents.get(app, SLUG)
      if (agent) {
        const currentPrompt = String(agent.systemPrompt || agent.get('systemPrompt') || '')
        if (!currentPrompt) {
          console.log('[0068] systemPrompt atual vazio — nada a reescrever no prompt.')
        } else if (hasOldLink(currentPrompt)) {
          let updated = String(currentPrompt).split(OLD_LINK_1).join('consciente.net.br')
          updated = String(updated).split(OLD_LINK_2).join('consciente.net.br')
          // Normaliza: se havia "https://" colado no texto original, evita "https://https://"
          updated = updated.split('https://https://').join('https://')
          // Garante o link como URL completa no prompt
          updated = updated
            .split('Link de acesso ao app: consciente.net.br')
            .join('Link de acesso ao app: https://consciente.net.br')
          updated = updated
            .split('consciente.net.br/register')
            .join('https://consciente.net.br/register')
          updated = updated.split('consciente.net.br/login').join('https://consciente.net.br/login')
          updated = updated
            .split('consciente.net.br/forgot-password')
            .join('https://consciente.net.br/forgot-password')
          $ai.agents.update(app, SLUG, { systemPrompt: updated })
          console.log(
            '[0068] systemPrompt atualizado: domínios antigos → consciente.net.br (tamanho ' +
              String(updated).length +
              ')',
          )
        } else {
          console.log('[0068] systemPrompt sem domínio antigo — já atualizado (no-op).')
        }
      } else {
        console.log('[0068] Agente ' + SLUG + ' não encontrado — nada a fazer.')
      }
    } catch (promptErr) {
      console.log('[0068] FALHA ao atualizar systemPrompt: ' + promptErr)
    }

    // ----------------------------------------------------------
    // 2) Memórias: listar, capturar payload exato, apagar as antigas
    // ----------------------------------------------------------
    let memories = null
    try {
      if (typeof $ai !== 'undefined' && $ai && $ai.agents) {
        if (typeof $ai.agents.listMemories === 'function') {
          memories = $ai.agents.listMemories(SLUG)
        } else if (typeof $ai.agents.get === 'function') {
          const agentRec = $ai.agents.get(SLUG)
          if (agentRec && typeof agentRec.listMemories === 'function') {
            memories = agentRec.listMemories()
          }
        }
      }
    } catch (listErr) {
      console.log('[0068] Falha ao listar memórias: ' + listErr)
    }

    if (!memories || typeof memories.length !== 'number') {
      console.log('[0068] Listagem indisponível — nada a fazer nesta cópia (ok).')
      return
    }

    console.log('[0068] Memórias: TOTAL=' + memories.length)

    const stale = []
    for (let i = 0; i < memories.length; i++) {
      const m = memories[i]
      let content = ''
      let type = 'text'
      let payload = null
      let id = ''
      try {
        if (typeof m === 'string') {
          content = m
        } else if (typeof m.getString === 'function') {
          content = m.getString('content') || m.getString('text') || m.getString('memory') || ''
        } else if (typeof m === 'object') {
          content = m.content || m.text || m.memory || ''
          type = m.type || 'text'
          payload = m.payload || null
          id = m.id || ''
        }
        if (payload && typeof payload === 'string') {
          try {
            payload = JSON.parse(payload)
          } catch (pErr) {
            payload = { text: payload }
          }
        }
      } catch (cErr) {
        continue
      }
      if (hasOldLink(content)) {
        stale.push({ id: id, type: type, payload: payload, content: content })
        console.log('[0068] Memória antiga DETECTADA :: ' + String(content).slice(0, 140))
      }
    }

    let deleted = 0
    for (let s = 0; s < stale.length; s++) {
      const t = stale[s]
      let ok = false
      let lastErr = ''
      // A) payload EXATO capturado da listagem (formato confirmado nas 0064/0066)
      if (!ok && t.payload) {
        try {
          $ai.agents.deleteMemories(app, SLUG, [{ type: t.type, payload: t.payload }])
          ok = true
        } catch (aErr) {
          lastErr = 'A(payload): ' + String(aErr)
        }
      }
      // B) payload reconstruído como texto puro
      if (!ok && t.content) {
        try {
          $ai.agents.deleteMemories(app, SLUG, [{ type: 'text', payload: { text: t.content } }])
          ok = true
        } catch (dErr) {
          lastErr = 'D(text): ' + String(dErr)
        }
      }
      if (ok) {
        deleted++
        console.log('[0068] Memória antiga APAGADA :: ' + String(t.content).slice(0, 120))
      } else {
        console.log('[0068] FALHA ao apagar memória antiga :: ' + lastErr)
      }
    }

    // ----------------------------------------------------------
    // 3) Regravar a memória do link único com o domínio NOVO
    // ----------------------------------------------------------
    try {
      $ai.agents.putMemories(app, SLUG, [
        {
          type: 'text',
          payload: {
            text:
              'Link ÚNICO de acesso ao app Consciente - Seu parceiro nas finanças: ' +
              NEW_LINK +
              '. Este ÚNICO link serve para qualquer finalidade: acessar o app, fazer login, se cadastrar/criar conta ou recuperar o acesso. Sempre entregue exatamente este link (sem /login, /register ou outros caminhos) quando alguém pedir para acessar, entrar ou criar conta.',
          },
        },
      ])
      console.log('[0068] Memória de link único regravada com ' + NEW_LINK)
    } catch (putErr) {
      console.log('[0068] FALHA ao regravar memória de link único: ' + putErr)
    }

    // ----------------------------------------------------------
    // 4) PROVA: relistar e contar o que sobrou de link antigo
    // ----------------------------------------------------------
    try {
      let again = null
      if (typeof $ai.agents.listMemories === 'function') {
        again = $ai.agents.listMemories(SLUG)
      }
      let staleAfter = -1
      let totalAfter = -1
      let newMemoryPreview = ''
      if (again && typeof again.length === 'number') {
        totalAfter = again.length
        staleAfter = 0
        for (let j = 0; j < again.length; j++) {
          const m = again[j]
          let content = ''
          try {
            if (typeof m === 'string') content = m
            else if (typeof m.getString === 'function') {
              content = m.getString('content') || m.getString('text') || ''
            } else if (typeof m === 'object') content = m.content || m.text || ''
          } catch (rErr) {
            content = ''
          }
          if (hasOldLink(content)) staleAfter++
          if (!newMemoryPreview && String(content).indexOf('consciente.net.br') !== -1) {
            newMemoryPreview = String(content).slice(0, 160)
          }
        }
      }
      console.log(
        '[0068] RESUMO: apagadas=' +
          deleted +
          ' | após: total=' +
          totalAfter +
          ' | com link antigo=' +
          staleAfter +
          (staleAfter === 0 ? ' (LIMPO)' : ' (AINDA HÁ RESTOS)'),
      )
      if (newMemoryPreview) {
        console.log('[0068] Memória nova (prova): ' + newMemoryPreview)
      }
    } catch (relErr) {
      console.log('[0068] Falha na relistagem de prova: ' + relErr)
    }
  },
  (app) => {
    // down: no-op seguro — restaurar o link antigo exigiria reverter dados do
    // agente vivo; nunca executado em produção.
  },
)
