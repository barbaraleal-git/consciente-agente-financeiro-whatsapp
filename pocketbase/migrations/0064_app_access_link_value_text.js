/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// v0.0.178 — CORRETIVA: link de acesso ao app em app_settings.value_text
// A migração 0062 gravou o seed no campo 'value' (inexistente) e o campo real
// é 'value_text'. Estado confirmado no banco vivo: a linha antiga (com o
// value_text vazio) NÃO existe mais — a dona editou o link no backoffice e o
// PUT do admin_app_access_link atualizou o único registro válido, que hoje já
// está com value_text preenchido. Esta migração é a prova idempotente:
// 1) Se NÃO existe registro com key='app_access_link' → cria com value_text
//    correto (caminho que roda em cópias/templates do projeto, onde o banco
//    renasce vazio e a 0062 não consegue garantir o campo).
// 2) Se existe e value_text está VAZIO → preenche com o link padrão
//    (não sobrescreve um valor que a dona já editou).
// 3) Limpeza REAL das memórias antigas do agente 'financeiro-whatsapp'
//    (links antigos: domínio agente-financeiro-whatsapp-37fd3, caminhos
//    /register e /login, "3 links") — deleteMemories com payload EXATO
//    (chave SHA-256 do payload original, conforme API confirmada no skill
//    skip-cloud/ai-agents) — apagar por id NÃO é suportado pela API.
//    Depois garante a memória de FAQ com o link NOVO lido da configuração.
// Logs de contagem em todo passo = prova da execução.
// ----------------------------------------------------

migrate(
  (app) => {
    const DEFAULT_LINK = 'consciente.goskip.app'

    // ---------- 1) e 2) Seed/correção idempotente em app_settings ----------
    let appAccessLink = DEFAULT_LINK
    try {
      let existing = []
      try {
        existing = app.findRecordsByFilter(
          'app_settings',
          "key = 'app_access_link'",
          '-updated',
          50,
          0,
        )
      } catch (findErr) {
        console.log('[0064] app_settings não pesquisável ainda: ' + findErr)
      }
      if (!existing || existing.length === 0) {
        const settingsCol = app.findCollectionByNameOrId('app_settings')
        const rec = new Record(settingsCol)
        rec.set('key', 'app_access_link')
        rec.set('value_text', DEFAULT_LINK)
        app.save(rec)
        console.log('[0064] app_access_link CRIADO em app_settings.value_text = ' + DEFAULT_LINK)
      } else {
        // Preenche value_text VAZIO em TODOS os registros com a key (corrige o
        // legado da 0062 em qualquer cópia; na viva há 3 registros — 1 vazio).
        let filled = 0
        let alreadyOk = 0
        for (let i = 0; i < existing.length; i++) {
          const rec = existing[i]
          const current = String(rec.getString('value_text') || '').trim()
          if (current) {
            alreadyOk++
            if (i === 0) {
              appAccessLink = current
            }
          } else {
            rec.set('value_text', DEFAULT_LINK)
            app.save(rec)
            filled++
          }
        }
        appAccessLink = String(existing[0].getString('value_text') || '').trim() || appAccessLink
        console.log(
          '[0064] app_access_link: total=' +
            existing.length +
            ' já preenchidos=' +
            alreadyOk +
            ' corrigidos agora=' +
            filled +
            ' | ativo (mais recente): ' +
            appAccessLink,
        )
        if (existing.length > 1) {
          console.log(
            '[0064] AVISO: existem ' +
              existing.length +
              " registros com key='app_access_link' — leitura e escrita usam SEMPRE o updated mais recente (critério único em hook, bridge e migração). A dona pode revisar no painel Collections se quiser remover os antigos.",
          )
        }
      }
    } catch (seedOuter) {
      console.log('[0064] Falha no seed app_access_link: ' + seedOuter)
    }

    // ---------- 3) Limpeza REAL das memórias antigas (payload EXATO) ----------
    // API confirmada (skill skip-cloud/ai-agents):
    //   $ai.agents.deleteMemories(app, slug, [{ type, payload }]) — payload
    //   EXATO original (chave SHA-256). Apagar por id NÃO é suportado.
    //   $ai.agents.putMemories(app, slug, [{ type, payload }]) — adiciona com
    //   dedupe por (type, payload_key).
    // Memórias conhecidas com links antigos (conferidas nos arquivos das
    // migrações 0010/0011/0012/0014/0019/0022): 1 text de links oficiais +
    // 2 variantes de FAQ de links (5 e 9 perguntas).

    const OLD_FAQ_5 = [
      {
        question: 'Qual é o link para me cadastrar ou criar conta no Consciente?',
        answer:
          'Você pode criar sua conta no Consciente diretamente pelo link de cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register. Se já tem conta, acesse https://agente-financeiro-whatsapp-37fd3.goskip.app/login.',
      },
      {
        question: 'Qual é o site oficial ou link de login do Consciente?',
        answer:
          'O link para entrar na sua conta é https://agente-financeiro-whatsapp-37fd3.goskip.app/login e a página inicial é https://agente-financeiro-whatsapp-37fd3.goskip.app.',
      },
      {
        question: 'Esqueci minha senha do Consciente, como faço para recuperar?',
        answer:
          'Você pode redefinir sua senha diretamente pelo link: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password.',
      },
      {
        question: 'O que é o Consciente?',
        answer:
          'O Consciente - Seu parceiro nas finanças é o seu agente financeiro inteligente que te ajuda no controle diário de custos e caixinhas tanto pelo WhatsApp quanto pelo painel Web.',
      },
      {
        question: 'Como controlar custos no dia a dia pelo WhatsApp com o Consciente?',
        answer:
          "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais' ou 'Cabana burger 100 reais' ou '122 no Jojo'). O Consciente categoriza automaticamente e soma na caixinha correspondente.",
      },
    ]

    const OLD_FAQ_9 = [
      {
        question: 'Qual é o link para me cadastrar ou criar conta no Consciente?',
        answer:
          'Você pode criar sua conta no Consciente diretamente pelo link de cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register. Leva menos de um minuto!',
      },
      {
        question: 'Qual é o site oficial ou link de login do Consciente?',
        answer:
          'O link para entrar na sua conta é https://agente-financeiro-whatsapp-37fd3.goskip.app/login e a página inicial é https://agente-financeiro-whatsapp-37fd3.goskip.app.',
      },
      {
        question: 'Esqueci minha senha do Consciente, como faço para recuperar?',
        answer:
          'Você pode redefinir sua senha diretamente pelo link: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password.',
      },
      {
        question: 'O que é o Consciente?',
        answer:
          'O Consciente - Seu parceiro nas finanças é o seu agente financeiro inteligente que te ajuda no controle diário de custos e caixinhas tanto pelo WhatsApp quanto pelo painel Web.',
      },
      {
        question: 'Como funciona a regra 50-30-20 de finanças pessoais?',
        answer:
          'A regra 50-30-20 propõe dividir a renda líquida em: 50% para necessidades básicas (moradia, alimentação, contas fixas), 30% para desejos pessoais e estilo de vida (lazer, restaurantes, hobbies) e 20% para reserva de emergência, investimentos e quitação de dívidas.',
      },
      {
        question: 'Como controlar custos no dia a dia pelo WhatsApp com o Consciente?',
        answer:
          "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais' ou 'Cabana burger 100 reais' ou 'Uber 22,50'). O Consciente categoriza automaticamente e soma na caixinha correspondente.",
      },
      {
        question: 'Como funcionam as caixinhas personalizadas (ex: Viagem a Paris)?',
        answer:
          'Você pode criar caixinhas com o nome que quiser (ex: Viagem a Paris, Casamento, Reforma) e definir um teto de gastos para o período. Qualquer gasto informado referente à viagem ou projeto será somado diretamente nela.',
      },
      {
        question: 'O que fazer quando estourar o teto de uma caixinha?',
        answer:
          'Identifique se o excesso foi pontual ou recorrente. Se pontual, compense reduzindo gastos discricionários em outras caixinhas no mesmo mês. Se recorrente, revise o limite para ser mais realista com o seu momento.',
      },
      {
        question: 'Como transferir meu histórico de conversas do WhatsApp para o Consciente?',
        answer:
          'Abra a conversa do WhatsApp, toque em Opções > Mais > Exportar conversa (sem mídia) e faça o upload do arquivo .txt na aba Assistente do painel web. O Consciente lerá e registrará os lançamentos pendentes.',
      },
    ]

    const STALE_MEMORIES = [
      {
        label: 'text-oficial-links (0010/0011/0012/0014)',
        type: 'text',
        payload: {
          text: 'Links oficiais da plataforma Consciente - Seu parceiro nas finanças: Cadastro em https://agente-financeiro-whatsapp-37fd3.goskip.app/register, Login em https://agente-financeiro-whatsapp-37fd3.goskip.app/login, Página inicial em https://agente-financeiro-whatsapp-37fd3.goskip.app, Recuperação de senha em https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password. Sempre entregue o link direto quando alguém pedir para acessar ou cadastrar.',
        },
      },
      { label: 'faq-links-variante-5 (0022)', type: 'faq', payload: { qa: OLD_FAQ_5 } },
      { label: 'faq-links-variante-9 (0012/0014/0019)', type: 'faq', payload: { qa: OLD_FAQ_9 } },
    ]

    let deletedCount = 0
    let deleteErrors = 0
    for (let i = 0; i < STALE_MEMORIES.length; i++) {
      const target = STALE_MEMORIES[i]
      try {
        $ai.agents.deleteMemories(app, 'financeiro-whatsapp', [target.payload])
        deletedCount++
        console.log('[0064] Memória antiga APAGADA (' + target.label + ')')
      } catch (delErr) {
        deleteErrors++
        // "not found" = memória já não existe (idempotência) — não é falha real.
        console.log(
          '[0064] deleteMemories (' +
            target.label +
            '): ' +
            (String(delErr).indexOf('not found') !== -1 || String(delErr).indexOf('no rows') !== -1
              ? 'já inexistente (ok, idempotente)'
              : 'FALHA real: ' + delErr),
        )
      }
    }
    console.log(
      '[0064] RESUMO LIMPEZA MEMÓRIAS: candidatos=' +
        STALE_MEMORIES.length +
        ' | comando ok=' +
        deletedCount +
        ' | já inexistentes/erros=' +
        deleteErrors,
    )

    // ---------- Garante a memória de FAQ com o link NOVO ----------
    // putMemories é idempotente por (type, payload_key): regravar o MESMO
    // conteúdo não duplica; só ingere quando o texto muda.
    try {
      $ai.agents.putMemories(app, 'financeiro-whatsapp', [
        {
          type: 'text',
          payload: {
            text:
              'Link ÚNICO de acesso ao app Consciente - Seu parceiro nas finanças: https://' +
              appAccessLink +
              '. Este ÚNICO link serve para qualquer finalidade: acessar o app, fazer login, se cadastrar/criar conta ou recuperar o acesso. Sempre entregue exatamente este link (sem /login, /register ou outros caminhos) quando alguém pedir para acessar, entrar ou criar conta.',
          },
        },
      ])
      console.log('[0064] Memória de link único garantida com https://' + appAccessLink)
    } catch (putErr) {
      console.log('[0064] FALHA ao regravar memória de link único: ' + putErr)
    }
  },
  (app) => {
    // down: no-op seguro (o seed é a configuração vigente do link)
  },
)
