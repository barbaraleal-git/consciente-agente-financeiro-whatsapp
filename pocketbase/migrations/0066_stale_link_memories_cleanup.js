/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// Migração 0066 — v0.0.179: limpeza final das memórias antigas de links
// do agente 'financeiro-whatsapp'.
//
// Prova da rodada v0.0.179 (hook de diagnóstico deployado): TOTAL=4 chunks,
// ANTIGOS=1 (contém domínio antigo sem o novo), NOVOS=3. As migrações 0060,
// 0062 e 0064 já apagaram 3 variantes conhecidas por payload EXATO — esta
// fecha a lacuna: lista as memórias POR CONTEÚDO, apaga cada antiga com o
// payload EXATO capturado da própria listagem (API confirmada no skill
// skip-cloud/ai-agents: deleteMemories(app, slug, [{ type, payload }])),
// com fallbacks por id, e RELISTA para provar antigas=0.
// Idempotente: no-op quando não há memória antiga (base nova).
// ----------------------------------------------------

migrate(
  (app) => {
    const SLUG = 'financeiro-whatsapp'
    const OLD_DOMAIN = 'agente-financeiro-whatsapp-37fd3'
    const NEW_LINK = 'consciente.goskip.app'

    const isStale = (content) => {
      const low = String(content).toLowerCase()
      if (low.indexOf(NEW_LINK) !== -1) return false
      return (
        low.indexOf(OLD_DOMAIN) !== -1 ||
        low.indexOf('/register') !== -1 ||
        low.indexOf('/login') !== -1 ||
        low.indexOf('/forgot-password') !== -1 ||
        low.indexOf('3 links') !== -1 ||
        low.indexOf('três links') !== -1
      )
    }

    // ---------- 1) Listar memórias (formatos conhecidos) ----------
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
      console.log('[0066] Falha ao listar memórias: ' + listErr)
    }

    if (!memories || typeof memories.length !== 'number') {
      console.log('[0066] Listagem indisponível — nada a fazer nesta cópia (ok).')
      return
    }

    // ---------- 2) Detectar antigas por conteúdo ----------
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
        if (!payload && id) {
          // Nem toda listagem traz o payload — sem ele não dá para apagar por
          // payload exato; fica registrado para inspeção manual.
          console.log('[0066] Memória antiga SEM payload capturável id=' + id)
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
      if (isStale(content)) {
        stale.push({ id: id, type: type, payload: payload, content: content })
      }
    }

    console.log(
      '[0066] Memórias: TOTAL=' + memories.length + ' | antigas detectadas=' + stale.length,
    )

    // ---------- 3) Apagar cada antiga (payload exato capturado; fallbacks) ----------
    let deleted = 0
    for (let s = 0; s < stale.length; s++) {
      const t = stale[s]
      let ok = false
      let lastErr = ''
      // A) payload EXATO capturado da listagem (formato confirmado pela 0064)
      if (!ok && t.payload) {
        try {
          $ai.agents.deleteMemories(app, SLUG, [{ type: t.type, payload: t.payload }])
          ok = true
        } catch (aErr) {
          lastErr = 'A(payload): ' + String(aErr)
        }
      }
      // B) por id (formatos alternativos, caso a cópia os exponha)
      if (!ok && t.id) {
        try {
          $ai.agents.deleteMemories(SLUG, [t.id])
          ok = true
        } catch (bErr) {
          lastErr = 'B(id): ' + String(bErr)
        }
      }
      if (!ok && t.id) {
        try {
          $ai.agents.deleteMemory(SLUG, t.id)
          ok = true
        } catch (cErr) {
          lastErr = 'C(id): ' + String(cErr)
        }
      }
      // D) payload reconstruído como texto puro
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
        console.log('[0066] Memória antiga APAGADA :: ' + String(t.content).slice(0, 120))
      } else {
        console.log('[0066] FALHA ao apagar memória antiga :: ' + lastErr)
      }
    }

    // ---------- 4) Relistar para PROVAR o resultado ----------
    try {
      let again = null
      if (typeof $ai.agents.listMemories === 'function') {
        again = $ai.agents.listMemories(SLUG)
      }
      let staleAfter = -1
      let totalAfter = -1
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
          if (isStale(content)) staleAfter++
        }
      }
      console.log(
        '[0066] RESUMO: apagadas=' +
          deleted +
          ' | após: total=' +
          totalAfter +
          ' antigas=' +
          staleAfter +
          (staleAfter === 0 ? ' (LIMPO)' : ' (AINDA HÁ RESTOS)'),
      )
    } catch (relErr) {
      console.log('[0066] Falha na relistagem de prova: ' + relErr)
    }

    // ---------- 5) Garante a memória de FAQ com o link NOVO ----------
    try {
      $ai.agents.putMemories(app, SLUG, [
        {
          type: 'text',
          payload: {
            text:
              'Link ÚNICO de acesso ao app Consciente - Seu parceiro nas finanças: https://' +
              NEW_LINK +
              '. Este ÚNICO link serve para qualquer finalidade: acessar o app, fazer login, se cadastrar/criar conta ou recuperar o acesso. Sempre entregue exatamente este link (sem /login, /register ou outros caminhos) quando alguém pedir para acessar, entrar ou criar conta.',
          },
        },
      ])
      console.log('[0066] Memória de link único garantida com https://' + NEW_LINK)
    } catch (putErr) {
      console.log('[0066] FALHA ao regravar memória de link único: ' + putErr)
    }
  },
  (app) => {
    // down: no-op seguro
  },
)
