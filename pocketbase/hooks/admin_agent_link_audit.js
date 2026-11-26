/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// Diagnóstico v0.0.189 — Item 37 / domínio oficial ativo: rota TEMPORÁRIA
// que prova o estado do agente nativo 'financeiro-whatsapp' depois da
// migração 0068. Somente leitura, restrita a admin. A dona (ou um curl com
// token admin) chama /backend/v1/admin/agent-link-audit e recebe:
//   - prompt: se ainda contém domínio antigo, o trecho ao redor da
//     ocorrência; e se contém consciente.net.br.
//   - memories: TOTAL, quantas contêm link antigo, quantas contêm
//     consciente.net.br, e prévia do conteúdo de cada uma.
// Após validação, remover junto com a 0068? NÃO: a 0068 fica (migração
// idempotente); esta rota é removida numa rodada futura quando a dona
// confirmar o comportamento no vivo.
// ----------------------------------------------------

routerAdd(
  'GET',
  '/backend/v1/admin/agent-link-audit',
  (e) => {
    try {
      const authUser = e.auth
      const isAdmin =
        authUser &&
        (authUser.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
          authUser.getString('role') === 'admin')
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const SLUG = 'financeiro-whatsapp'
      const OLD_LINK_1 = 'consciente.goskip.app'
      const OLD_LINK_2 = 'agente-financeiro-whatsapp-37fd3.goskip.app'

      const hasOldLink = (c) => {
        const low = String(c || '').toLowerCase()
        return low.indexOf(OLD_LINK_1) !== -1 || low.indexOf(OLD_LINK_2) !== -1
      }

      // ---------- systemPrompt ----------
      let promptReport = null
      try {
        const agent = $ai.agents.get(app, SLUG)
        const prompt = String((agent && (agent.systemPrompt || agent.get('systemPrompt'))) || '')
        let oldSnippet = ''
        const idx = prompt.toLowerCase().indexOf(OLD_LINK_1)
        const idx2 = prompt.toLowerCase().indexOf(OLD_LINK_2)
        const first = idx >= 0 ? idx : idx2
        if (first >= 0) {
          oldSnippet = prompt.slice(Math.max(0, first - 80), first + 120)
        }
        promptReport = {
          length: prompt.length,
          has_old_domain: first >= 0,
          old_snippet: oldSnippet,
          has_new_domain: prompt.toLowerCase().indexOf('consciente.net.br') !== -1,
          new_snippet:
            prompt.toLowerCase().indexOf('consciente.net.br') >= 0
              ? prompt.slice(
                  Math.max(0, prompt.toLowerCase().indexOf('consciente.net.br') - 80),
                  prompt.toLowerCase().indexOf('consciente.net.br') + 120,
                )
              : '',
        }
      } catch (pErr) {
        promptReport = { error: String(pErr) }
      }

      // ---------- memórias ----------
      let memReport = null
      try {
        let memories = null
        if (typeof $ai.agents.listMemories === 'function') {
          memories = $ai.agents.listMemories(SLUG)
        } else {
          const agentRec = $ai.agents.get(SLUG)
          if (agentRec && typeof agentRec.listMemories === 'function') {
            memories = agentRec.listMemories()
          }
        }
        const items = []
        let staleCount = 0
        let newCount = 0
        if (memories && typeof memories.length === 'number') {
          for (let i = 0; i < memories.length; i++) {
            const m = memories[i]
            let content = ''
            let type = ''
            try {
              if (typeof m === 'string') content = m
              else if (typeof m.getString === 'function') {
                content = m.getString('content') || m.getString('text') || ''
              } else if (typeof m === 'object') {
                content = m.content || m.text || ''
                type = m.type || ''
              }
            } catch (cErr) {
              content = '(erro ao ler conteúdo)'
            }
            const isOld = hasOldLink(content)
            const isNew = String(content).indexOf('consciente.net.br') !== -1
            if (isOld) staleCount++
            if (isNew) newCount++
            items.push({
              type: type,
              is_old: isOld,
              is_new: isNew,
              preview: String(content).slice(0, 200),
            })
          }
        }
        memReport = {
          available: !!(memories && typeof memories.length === 'number'),
          total: memories && typeof memories.length === 'number' ? memories.length : -1,
          with_old_domain: staleCount,
          with_new_domain: newCount,
          items: items,
        }
      } catch (mErr) {
        memReport = { error: String(mErr) }
      }

      // ---------- app_settings (fonte em runtime do bridge) ----------
      let appLink = null
      try {
        const recs = $app.findRecordsByFilter(
          'app_settings',
          "key = 'app_access_link'",
          '-updated',
          1,
          0,
        )
        appLink = recs && recs.length > 0 ? recs[0].getString('value_text') : ''
      } catch (sErr) {
        appLink = '(erro: ' + String(sErr) + ')'
      }

      return e.json(200, {
        agent: SLUG,
        prompt: promptReport,
        memories: memReport,
        app_settings_value: appLink,
      })
    } catch (err) {
      console.log('[agent-link-audit] Erro: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
