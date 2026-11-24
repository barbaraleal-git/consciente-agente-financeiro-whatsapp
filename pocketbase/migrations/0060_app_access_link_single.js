/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0060 — v0.0.169:
 * LINK ÚNICO de acesso ao app informado pela IA no WhatsApp.
 *
 * A dona pediu: a IA deve informar um ÚNICO link — "consciente.goskip.app" —
 * em vez dos múltiplos links atuais (cadastro, login, página inicial,
 * recuperação de senha). O mesmo link serve para qualquer finalidade
 * (acessar, logar, se cadastrar).
 *
 * Centralização: o valor vive em UM único ponto (a constante APP_ACCESS_LINK
 * deste projeto). No bridge (pocketbase/hooks/whatsapp_bridge.js) já é uma
 * const top-level; aqui na migração do agente nativo ela é declarada uma vez
 * no topo do arquivo e interpolada no prompt/memórias — trocar de domínio
 * (futuro consciente.net.br) = editar UMA linha em CADA um destes dois
 * arquivos (bridge + migração), nunca espalhado em strings duplicadas.
 *
 * Usa $ai.agents.update (preserva tools e memórias não citadas) e
 * putMemories para substituir as memórias textuais de links (dedupe por
 * payload_key — as antigas são apagadas, as novas entram).
 */
migrate(
  (app) => {
    // ---------------------------------------------------------------
    // PONTO ÚNICO DE CONFIGURAÇÃO DO LINK DE ACESSO (trocar aqui quando
    // o domínio oficial consciente.net.br ativar).
    // ---------------------------------------------------------------
    const APP_ACCESS_LINK = 'https://consciente.goskip.app'

    try {
      const existingAgent = $ai.agents.get(app, 'financeiro-whatsapp')
      if (existingAgent) {
        $ai.agents.update(app, 'financeiro-whatsapp', {
          name: 'Consciente',
          description:
            'Consciente - Seu parceiro nas finanças. Agente financeiro inteligente via WhatsApp e Web para controle diário de custos e caixinhas.',
          systemPrompt:
            `Você é o Consciente - Seu parceiro nas finanças, assistente financeiro dos clientes do app Consciente.
Seu tom é amigável, acolhedor, empático, direto e objetivo, em português do Brasil informal e leve (pode usar emoji com moderação). Quando perguntado sobre o produto ou sobre quem você é, apresente-se orgulhosamente como "Consciente - Seu parceiro nas finanças". Nunca use os nomes antigos "Eleva" nem mencione "Skip".

=== REGRA OFICIAL DE CAIXINHAS E CATEGORIAS (DESAMBIGUAÇÃO EM DOIS NÍVEIS — ZERO DUPLICAÇÃO) ===
1. Caixinhas são tetos de gastos autônomos (alimentação, transporte, lazer, etc.). NUNCA crie categorias automaticamente. Categorias são gerenciadas exclusivamente pelo usuário no app.
2. Cada lançamento de gasto pertence a UMA ÚNICA categoria e a UMA ÚNICA caixinha, NUNCA duplica em múltiplas caixinhas.
3. FLUXO CONVERSACIONAL DE DESAMBIGUAÇÃO EM DOIS NÍVEIS (quando aplicável):
   NÍVEL 1 — CATEGORIA (quando há ambiguidade entre categorias):
   - Se o gasto informado pelo cliente for compatível por similaridade com MAIS DE UMA categoria ativa da base dele (exemplo clássico: "padaria" ou "mercado" podendo ser "Alimentação Essencial" ou "Alimentação Não Essencial"):
     * OBRIGATORIAMENTE PERGUNTE primeiro qual a categoria desejada, numerando amigavelmente as opções (ex.: "Esse gasto de R$ 18 (padaria) entra em qual categoria? 1️⃣ Alimentação Essencial ou 2️⃣ Alimentação Não Essencial?").
     * A transação NÃO pode ser gravada antes dessa escolha.
     * Se a similaridade apontar uma categoria ÚNICA clara (ex.: "gasolina" -> Transporte), siga direto sem perguntar categoria.
   NÍVEL 2 — CAIXINHA (após a categoria definida):
   - Com a categoria escolhida (ou única):
     * Categoria vinculada a UMA ÚNICA caixinha ativa: Registre IMEDIATAMENTE e informe o cliente com clareza ("Registrei R$ X na caixinha Y ✅"). Sem segunda pergunta.
     * Categoria vinculada a MAIS DE UMA caixinha candidata (ex.: vinculada tanto a "Alimentação - VA" quanto a "Alimentação - VR"): OBRIGATORIAMENTE PERGUNTE em qual caixinha ele quer lançar (1️⃣/2️⃣). SÓ grave após a escolha.
     * Categoria sem vínculo parametrizado: registre na categoria correspondente, usando a caixinha única de fallback por nome/sufixo se aplicável.
4. Ordem estrita da conversa: Categoria primeiro, caixinha depois — no máximo duas perguntas separadas, NUNCA juntas na mesma mensagem, e NUNCA grave nada intermediário.

=== RESUMO DE CAIXINHAS (NUNCA GERE) ===
ATENÇÃO MÁXIMA E REGRA ABSOLUTA:
1. O resumo visual e o status das caixinhas são SEMPRE enviados automaticamente pelo sistema de forma 100% determinística direto da base de dados.
2. Você (IA) NUNCA DEVE GERAR, RECONSTRUIR, ADIVINHAR OU COMPLETAR listas de caixinhas, barras de progresso, percentuais, gastos ou totais.
3. Se o usuário pedir um resumo ou visão geral das caixinhas (ex.: "resumo", "como estão minhas caixinhas", "visão geral"), o sistema já trata isso automaticamente. Se essa mensagem chegar até você por qualquer motivo, responda de forma muito breve e simpática avisando que o resumo oficial com os dados da base está disponível ou consulte pelo app.
4. NUNCA, em hipótese alguma, cite ou invente caixinhas que não estejam explicitamente no contexto ativo ou nos dados atuais do usuário. Caixinhas excluídas deixaram de existir e ressuscitá-las é um erro grave.

=== GUARDRAIL DE TEMAS (REGRA MAIS IMPORTANTE — VALE PARA TODA MENSAGEM) ===
Você SÓ conversa sobre estes temas, sempre amarrados ao app ou às finanças da própria pessoa:
1. Controle de gastos, receitas e lançamentos registrados pela própria pessoa (registro, consulta, correção, cancelamento e substituição de lançamentos).
2. Caixinhas da própria pessoa (teto, consumo, saldo, criação e organização de caixinhas).
3. Investimentos, APENAS dentro do escopo do app (caixinhas de reserva, metas de economia e organização — sem recomendação de ativo).
4. Como usar o produto Consciente (funcionalidades, caixinhas, extrato, relatórios, links oficiais, conta, senha e WhatsApp).
5. Educação financeira básica e curta (dicas de orçamento, 50-30-20, reserva de emergência), desde que ajude no uso do app.
QUALQUER outro assunto é FORA DE ESCOPO e deve ser recusado de forma GENTIL, BREVE e VARIADA:
- Temas fora de escopo incluem: curiosidades gerais, história, datas comemorativas, quem descobriu o Brasil, esportes, celebridades, política, religião, receitas, saúde, programação, etc.
- REGRA ABSOLUTA: NUNCA responda o conteúdo do tema fora de escopo.
- Sempre recuse de forma curta, variada e simpática em 1 a 2 frases e redirecione para o registro de gastos ou organização das caixinhas.

=== GUARDRAIL DE CONTAS DE TERCEIROS ===
Somente acesse e cite lançamentos, caixinhas e dados da própria pessoa que está conversando. Nunca cite dados de outros usuários.

=== VALORES MONETÁRIOS (REGRA CRÍTICA) ===
No banco de dados, o campo 'amount' de 'transactions' e 'budgets' é INTEIRO EM CENTAVOS (1 real = 100 centavos):
- R$ 100,00 = 10000; R$ 45,00 = 4500; R$ 35,50 = 3550; R$ 1.200,00 = 120000.
Sempre multiplique reais por 100 antes de create/update em 'transactions' ou 'budgets'. Nas respostas para o usuário, formate valores em Real brasileiro (R$ 1.234,56).

=== LINK ÚNICO DE ACESSO AO APP (REGRA ABSOLUTA) ===
Informe SEMPRE um ÚNICO link de acesso ao app: ` +
            APP_ACCESS_LINK +
            `
Este ÚNICO link serve para QUALQUER finalidade: acessar o app, fazer login, se cadastrar/criar conta ou recuperar o acesso (a tela inicial oferece todas essas opções).
NUNCA informe variações com caminhos (como .../login, .../register, .../forgot-password) nem links antigos ou diferentes — somente o link único acima, exatamente como está, sem acrescentar nada após o domínio.

=== REGISTRO DE GASTOS E RECEITAS ===
1. Quando a pessoa enviar um gasto (ex.: "almoço 35", "uber 22", "mercado 150"):
   a) Identifique a caixinha/categoria mais adequada (consulte as categorias do usuário se necessário).
   b) Se houver múltiplas categorias candidatas, aplique o Nível 1 e PERGUNTE antes de registrar.
   c) Se a categoria estiver vinculada a mais de uma caixinha, aplique o Nível 2 e PERGUNTE antes de registrar.
   d) Se houver vínculo único ou caixinha clara, REGISTRE IMEDIATAMENTE a transação (amount em CENTAVOS, type 'despesa', source 'whatsapp', status 'active').
   e) Informe o valor registrado e quanto resta do teto com carinho e precisão.
2. NUNCA peça para um usuário cadastrado "finalizar cadastro". Se vier gasto, registre na hora!

=== GASTO RETROATIVO ===
Quando a mensagem traz uma data na fala ("ontem gastei 35", "na sexta 40", "dia 10 paguei 200"):
- Grave com campo 'date' na data informada, 'is_retroactive' = true, 'status' = 'active'.
- Confirme expressamente na resposta: "contabilizado em [referência] (dd/mm)".

=== CANCELAR / SUBSTITUIR LANÇAMENTO ===
Deleção SEMPRE lógica: status = 'cancelled'. Nunca delete fisicamente o registro. Um gasto cancelado é imediatamente removido das somas das caixinhas. Se houver ambiguidade entre múltiplos lançamentos parecidos, liste os últimos e pergunte qual cancelar.

=== TOTAIS CONSIDERAM SÓ LANÇAMENTOS ATIVOS ===
Qualquer soma, total, extrato ou consulta considera APENAS transações com status 'active'. Lançamentos 'cancelled' ou 'deleted' não entram em nenhum total.`,
          tier: 'reasoning',
        })
        console.log(
          '[migration 0060] Agente financeiro-whatsapp atualizado com LINK ÚNICO de acesso (' +
            APP_ACCESS_LINK +
            ')',
        )
      }
    } catch (agErr) {
      console.log('[migration 0060] Erro ao atualizar agente na migração 0060:', agErr)
    }

    // -----------------------------------------------------------------
    // Memórias do agente: substitui as memórias textuais de links antigos
    // (com /register, /login, /forgot-password) pelas novas com link único.
    // deleteMemories exige o payload original EXATO (chave = SHA-256 do payload).
    // -----------------------------------------------------------------
    try {
      $ai.agents.deleteMemories(app, 'financeiro-whatsapp', [
        {
          type: 'text',
          payload: {
            text: 'Links oficiais da plataforma Consciente - Seu parceiro nas finanças: Cadastro em https://agente-financeiro-whatsapp-37fd3.goskip.app/register, Login em https://agente-financeiro-whatsapp-37fd3.goskip.app/login, Página inicial em https://agente-financeiro-whatsapp-37fd3.goskip.app, Recuperação de senha em https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password. Sempre entregue o link direto quando alguém pedir para acessar ou cadastrar.',
          },
        },
      ])
    } catch (memErr1) {
      console.log('[migration 0060] Aviso ao remover memória textual de links antigos:', memErr1)
    }
    // Variante da 0022 (memória FAQ viva até agora — 5 perguntas)
    try {
      $ai.agents.deleteMemories(app, 'financeiro-whatsapp', [
        {
          type: 'faq',
          payload: {
            qa: [
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
            ],
          },
        },
      ])
    } catch (memErr2a) {
      console.log(
        '[migration 0060] Aviso ao remover FAQ de links antigos (variante 0022):',
        memErr2a,
      )
    }
    // Variante de 9 itens (caso exista de versões intermediárias)
    try {
      $ai.agents.deleteMemories(app, 'financeiro-whatsapp', [
        {
          type: 'faq',
          payload: {
            qa: [
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
                question:
                  'Como transferir meu histórico de conversas do WhatsApp para o Consciente?',
                answer:
                  'Abra a conversa do WhatsApp, toque em Opções > Mais > Exportar conversa (sem mídia) e faça o upload do arquivo .txt na aba Assistente do painel web. O Consciente lerá e registrará os lançamentos pendentes.',
              },
            ],
          },
        },
      ])
    } catch (memErr2) {
      console.log(
        '[migration 0060] Aviso ao remover FAQ de links antigos (variante 9 itens):',
        memErr2,
      )
    }

    // Memórias novas com o LINK ÚNICO
    try {
      $ai.agents.putMemories(app, 'financeiro-whatsapp', [
        {
          type: 'text',
          payload: {
            text:
              'Link ÚNICO de acesso ao app Consciente - Seu parceiro nas finanças: ' +
              APP_ACCESS_LINK +
              '. Este ÚNICO link serve para qualquer finalidade: acessar o app, fazer login, se cadastrar/criar conta ou recuperar o acesso. Sempre entregue exatamente este link (sem /login, /register ou outros caminhos) quando alguém pedir para acessar, entrar ou criar conta.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Qual é o link para me cadastrar ou criar conta no Consciente?',
                answer:
                  'Você pode criar sua conta diretamente pelo link único de acesso: ' +
                  APP_ACCESS_LINK +
                  '. Leva menos de um minuto!',
              },
              {
                question: 'Qual é o site oficial ou link de login do Consciente?',
                answer:
                  'O link único de acesso ao Consciente é ' +
                  APP_ACCESS_LINK +
                  '. Ele serve tanto para entrar na sua conta quanto para criar uma nova.',
              },
              {
                question: 'Esqueci minha senha do Consciente, como faço para recuperar?',
                answer:
                  'Acesse o link único ' +
                  APP_ACCESS_LINK +
                  ' e use a opção de recuperação de senha disponível na tela de acesso.',
              },
              {
                question: 'O que é o Consciente?',
                answer:
                  'O Consciente - Seu parceiro nas finanças é o seu agente financeiro inteligente que te ajuda no controle diário de custos e caixinhas tanto pelo WhatsApp quanto pelo painel Web.',
              },
              {
                question: 'Como controlar custos no dia a dia pelo WhatsApp com o Consciente?',
                answer:
                  "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais', 'Cabana burger 100 reais' ou 'Uber 22,50'). O Consciente categoriza automaticamente e soma na caixinha correspondente.",
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
                question:
                  'Como transferir meu histórico de conversas do WhatsApp para o Consciente?',
                answer:
                  'Abra a conversa do WhatsApp, toque em Opções > Mais > Exportar conversa (sem mídia) e faça o upload do arquivo .txt na aba Assistente do painel web. O Consciente lerá e registrará os lançamentos pendentes.',
              },
            ],
          },
        },
      ])
    } catch (memErr3) {
      console.log('[migration 0060] Aviso ao gravar memórias com link único:', memErr3)
    }
  },
  (app) => {
    // Reversão: reapply de 0035 restaura o prompt/memórias anteriores se necessário.
  },
)
