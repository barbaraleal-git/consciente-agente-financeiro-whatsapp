/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// Migração 0069 (v0.0.190) — limpeza final de memórias do agente
// 'financeiro-whatsapp' que ainda citam o domínio antigo
// (consciente.goskip.app / agente-financeiro-whatsapp-37fd3.goskip.app).
//
// Contexto: a 0068 regravou a memória do link com consciente.net.br e as
// 0066/0067 já limparam por conteúdo — mas a IA ainda respondeu o link
// antigo em 01:22/01:29 UTC (fonte: histórico/memórias residuais). Com a
// injeção runtime do link canônico no whatsapp_bridge (mesma rodada), as
// memórias deixam de ser a fonte da resposta; esta migração elimina o
// resíduo estático que sobrou, com PROVA EMBUTIDA: relista as memórias
// por conteúdo no final e registra o resultado nos logs.
//
// PADRÃO JÁ USADO NAS 0066/0067 (armadilha conhecida): o deleteMemories
// recebe o payload EXATO como está na coleção — comparar por substring
// do conteúdo antigo, não reconstruir o texto "de cabeça".
// Idempotente: em base limpa é no-op.
// ----------------------------------------------------

migrate(
  (app) => {
    const SLUG = 'financeiro-whatsapp'
    const OLD_LINK_1 = 'consciente.goskip.app'
    const OLD_LINK_2 = 'agente-financeiro-whatsapp-37fd3.goskip.app'

    const hasOldLink = (content) => {
      const low = String(content || '').toLowerCase()
      return low.indexOf(OLD_LINK_1) !== -1 || low.indexOf(OLD_LINK_2) !== -1
    }

    // ---------- 1. Memórias do agente ----------
    let removedCount = 0
    try {
      let memories = null
      if (typeof $ai !== 'undefined' && $ai && typeof $ai.agents !== 'undefined' && $ai.agents) {
        if (typeof $ai.agents.listMemories === 'function') {
          memories = $ai.agents.listMemories(SLUG)
        } else {
          const agentRec = $ai.agents.get(app, SLUG)
          if (agentRec && typeof agentRec.listMemories === 'function') {
            memories = agentRec.listMemories()
          }
        }
      }

      if (memories && typeof memories.length === 'number') {
        const stalePayloads = []
        for (let i = 0; i < memories.length; i++) {
          const m = memories[i]
          let content = ''
          try {
            if (typeof m === 'string') content = m
            else if (typeof m.getString === 'function') {
              content = m.getString('content') || m.getString('text') || ''
            } else if (typeof m === 'object') {
              content = m.content || m.text || ''
            }
          } catch (_) {
            content = ''
          }
          if (content && hasOldLink(content)) {
            stalePayloads.push(String(content))
          }
        }

        // deleteMemories com payload EXATO (armadilha conhecida das 0022/0066/0067)
        if (stalePayloads.length > 0 && typeof $ai.agents.deleteMemories === 'function') {
          $ai.agents.deleteMemories(SLUG, stalePayloads)
          removedCount = stalePayloads.length
        } else if (stalePayloads.length > 0) {
          console.log(
            '[0069] deleteMemories indisponível — ' +
              stalePayloads.length +
              ' memória(s) com domínio antigo ficam para limpeza manual.',
          )
        }
      }
    } catch (memErr) {
      console.log('[0069] Aviso ao limpar memórias (não fatal): ' + memErr)
    }

    // ---------- 2. PROVA: relistagem por conteúdo ----------
    let remainingOld = -1
    let total = -1
    let newDomainCount = -1
    try {
      const memoriesAfter = $ai.agents.listMemories(SLUG)
      if (memoriesAfter && typeof memoriesAfter.length === 'number') {
        total = memoriesAfter.length
        remainingOld = 0
        newDomainCount = 0
        for (let i = 0; i < memoriesAfter.length; i++) {
          const m = memoriesAfter[i]
          let content = ''
          try {
            if (typeof m === 'string') content = m
            else if (typeof m.getString === 'function') {
              content = m.getString('content') || m.getString('text') || ''
            } else if (typeof m === 'object') {
              content = m.content || m.text || ''
            }
          } catch (_) {
            content = ''
          }
          if (hasOldLink(content)) {
            remainingOld++
            console.log(
              '[0069] MEMÓRIA COM DOMÍNIO ANTIGO RESTANTE: ' + String(content).slice(0, 200),
            )
          }
          if (String(content).indexOf('consciente.net.br') !== -1) {
            newDomainCount++
          }
        }
      }
    } catch (proofErr) {
      console.log('[0069] Aviso na relistagem de prova (não fatal): ' + proofErr)
    }

    console.log(
      '[0069] Fim: removidas=' +
        removedCount +
        ' | total_memorias=' +
        total +
        ' | com_dominio_antigo_restantes=' +
        remainingOld +
        ' | com_consciente.net.br=' +
        newDomainCount,
    )
  },
  (app) => {
    // Down: no-op (memórias removidas não são restauradas; o link canônico
    // vive em app_settings, editável no backoffice — nunca em memória de IA).
  },
)
