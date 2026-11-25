/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// v0.0.177 — LINK DE ACESSO AO APP COMO CONFIGURAÇÃO + LIMPEZA REAL DE MEMÓRIAS
// 1) Seed idempotente: app_settings (key='app_access_link', value='consciente.goskip.app')
// 2) Limpeza REAL das memórias antigas do agente financeiro-whatsapp que ainda
//    citam o domínio antigo (agente-financeiro-whatsapp-37fd3) ou paths antigos
//    (/register, /login) — lista as memórias, identifica por CONTEÚDO e apaga
//    por id (não por payload exato, como a tentativa anterior que falhou
//    silenciosamente). Depois regrava a memória de FAQ com o link novo, lido
//    da configuração. Logs de contagem = prova da limpeza.
// ----------------------------------------------------

migrate(
  (app) => {
    // ---------- 1) Seed idempotente do link em app_settings ----------
    try {
      let seedExisting = []
      try {
        seedExisting = app.findRecordsByFilter(
          'app_settings',
          "key = 'app_access_link'",
          '-created',
          1,
          0,
        )
      } catch (seedErr) {
        console.log('[0062] app_settings indisponível para busca: ' + seedErr)
      }
      if (!seedExisting || seedExisting.length === 0) {
        const settingsCol = app.findCollectionByNameOrId('app_settings')
        const rec = new Record(settingsCol)
        rec.set('key', 'app_access_link')
        rec.set('value_text', 'consciente.goskip.app')
        app.save(rec)
        console.log('[0062] app_access_link CRIADO em app_settings = consciente.goskip.app')
      } else {
        console.log('[0062] app_access_link já existe: ' + seedExisting[0].getString('value_text'))
      }
    } catch (seedOuter) {
      console.log('[0062] Falha no seed app_access_link: ' + seedOuter)
    }

    // ---------- 2) Limpeza REAL das memórias antigas ----------
    let appAccessLink = 'consciente.goskip.app'
    try {
      const seed = app.findFirstRecordByFilter('app_settings', "key = 'app_access_link'", '')
      if (seed && seed.getString('value_text')) appAccessLink = seed.getString('value_text')
    } catch (_) {}

    const OLD_DOMAIN = 'agente-financeiro-whatsapp-37fd3'
    const isStaleMemory = function (text) {
      const t = String(text || '')
      if (!t) return false
      if (t.indexOf(OLD_DOMAIN) !== -1) return true
      if (t.indexOf('goskip.app') !== -1) {
        if (t.indexOf('/register') !== -1 || t.indexOf('/login') !== -1) return true
      }
      const low = t.toLowerCase()
      // Instruções antigas: "3 links de acesso", link de cadastro/login separado
      if (low.indexOf('3 links') !== -1 || low.indexOf('tres links') !== -1) return true
      if (low.indexOf('três links') !== -1) return true
      if (low.indexOf('link de cadastro') !== -1) return true
      if (low.indexOf('link de registro') !== -1) return true
      if (low.indexOf('link de login') !== -1) return true
      if (low.indexOf('link de acesso ao app') !== -1 && low.indexOf('consciente') === -1) {
        return true
      }
      return false
    }

    let foundCount = 0
    let deletedCount = 0
    const deletedIds = []

    let memories = null
    let listError = ''
    try {
      if (typeof $ai !== 'undefined' && $ai && $ai.agents) {
        if (typeof $ai.agents.listMemories === 'function') {
          memories = $ai.agents.listMemories('financeiro-whatsapp')
        } else if (typeof $ai.agents.memories === 'function') {
          memories = $ai.agents.memories('financeiro-whatsapp')
        } else if (typeof $ai.agents.get === 'function') {
          const agentRec = $ai.agents.get('financeiro-whatsapp')
          if (agentRec && typeof agentRec.listMemories === 'function') {
            memories = agentRec.listMemories()
          }
        }
      }
    } catch (listErr) {
      listError = String(listErr)
    }

    if (memories && typeof memories.length === 'number') {
      foundCount = memories.length
      const staleIds = []
      for (let i = 0; i < memories.length; i++) {
        const m = memories[i]
        let content = ''
        try {
          if (typeof m === 'string') content = m
          else if (typeof m.getString === 'function') {
            content = m.getString('content') || m.getString('text') || m.getString('memory') || ''
          } else if (typeof m === 'object') {
            content = m.content || m.text || m.memory || ''
          }
        } catch (cErr) {
          content = ''
        }
        if (isStaleMemory(content)) {
          const mid = (m && m.id) || (m && typeof m.id === 'string' ? m.id : '') || ''
          if (mid) staleIds.push({ id: mid, content: content })
        }
      }

      console.log(
        '[0062] Memórias do agente financeiro-whatsapp: TOTAL=' +
          foundCount +
          ' | ANTIGAS (a apagar)=' +
          staleIds.length,
      )

      for (let s = 0; s < staleIds.length; s++) {
        const target = staleIds[s]
        let deleted = false
        let delError = ''
        // Tenta os formatos possíveis da API de memórias (delete por id)
        try {
          if (typeof $ai.agents.deleteMemories === 'function') {
            $ai.agents.deleteMemories('financeiro-whatsapp', [target.id])
            deleted = true
          }
        } catch (e1) {
          delError = String(e1)
        }
        if (!deleted) {
          try {
            if (typeof $ai.agents.deleteMemory === 'function') {
              $ai.agents.deleteMemory('financeiro-whatsapp', target.id)
              deleted = true
            }
          } catch (e2) {
            delError = String(e2)
          }
        }
        if (!deleted) {
          try {
            if (typeof $ai.agents.removeMemory === 'function') {
              $ai.agents.removeMemory('financeiro-whatsapp', target.id)
              deleted = true
            }
          } catch (e3) {
            delError = String(e3)
          }
        }
        if (deleted) {
          deletedCount++
          deletedIds.push(target.id)
          console.log(
            '[0062] Memória antiga APAGADA id=' +
              target.id +
              ' :: ' +
              String(target.content).slice(0, 120),
          )
        } else {
          console.log('[0062] FALHA ao apagar memória id=' + target.id + ' :: ' + delError)
        }
      }

      console.log(
        '[0062] RESUMO DA LIMPEZA: encontradas=' +
          foundCount +
          ' | antigas=' +
          staleIds.length +
          ' | apagadas=' +
          deletedCount,
      )
    } else {
      console.log(
        '[0062] AVISO: não foi possível LISTAR memórias via $ai.agents (listError=' +
          (listError || 'API não disponível neste runtime') +
          '). Limpeza NÃO executada — corrigir a API em nova rodada.',
      )
    }

    // ---------- 3) Regrava a memória de FAQ com o link NOVO ----------
    try {
      const faqText =
        'LINK DE ACESSO AO APP Consciente (único e oficial, para acessar, logar ou se cadastrar): https://' +
        appAccessLink +
        ' — NUNCA cite outros domínios ou caminhos de registro/login separados.'
      let regravou = false
      let reErr = ''
      try {
        if (typeof $ai !== 'undefined' && $ai && $ai.agents) {
          if (typeof $ai.agents.putMemories === 'function') {
            $ai.agents.putMemories('financeiro-whatsapp', [faqText])
            regravou = true
          } else if (typeof $ai.agents.addMemory === 'function') {
            $ai.agents.addMemory('financeiro-whatsapp', faqText)
            regravou = true
          } else if (typeof $ai.agents.addMemories === 'function') {
            $ai.agents.addMemories('financeiro-whatsapp', [faqText])
            regravou = true
          }
        }
      } catch (reEx) {
        reErr = String(reEx)
      }
      console.log(
        '[0062] Memória de FAQ regravada com link novo (' +
          appAccessLink +
          '): ' +
          (regravou ? 'OK' : 'FALHOU (' + (reErr || 'API indisponível') + ')'),
      )
    } catch (faqOuter) {
      console.log('[0062] Falha ao regravar memória de FAQ: ' + faqOuter)
    }
  },
  (app) => {
    // down: no-op seguro (não apagamos o seed — ele é a configuração vigente)
  },
)
