/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0034:
 * 1. Limpeza Segura de Categorias Gêmeas / Auto-criadas:
 *    - Localiza categorias que tenham o mesmo nome de caixinhas (ex.: "Alimentação - Cartão de Crédito")
 *      ou que foram auto-criadas indevidamente.
 *    - Re-aponta transações que usavam essas categorias para a categoria legítima de Alimentação
 *      ou categoria padrão do usuário, preservando o valor, status e campo budget.
 *    - Remove os vínculos em category_caixinha_links que apontavam para essas categorias gêmeas.
 *    - Remove fisicamente as categorias gêmeas da coleção categories (já que nenhuma transação mais as referencia).
 * 2. Atualiza o agente 'financeiro-whatsapp' ($ai.agents.update):
 *    - Remove a permissão de criar categorias (perms: { list: true, read: true }).
 *    - Adiciona instrução inequívoca: NUNCA crie categorias automaticamente.
 *      Categorias são criadas e mantidas manualmente pelo usuário na tela /categories.
 *      Caixinhas são apenas tetos de gastos autônomos e NÃO geram categorias gêmeas.
 *    - Reforça a regra: se um gasto de alimentação tiver mais de uma caixinha candidata
 *      (ex.: Alimentação - VA, Alimentação - Cartão de Crédito, etc.), OBRIGATORIAMENTE
 *      perguntar ao usuário em qual caixinha ele quer guardar.
 */
migrate(
  (app) => {
    // ------------------------------------------------------------------------
    // 1. LIMPEZA SEGURA DE CATEGORIAS GÊMEAS
    // ------------------------------------------------------------------------
    try {
      const allBudgets = app.findRecordsByFilter('budgets', '', '-created', 500, 0)
      const allCategories = app.findRecordsByFilter('categories', '', '-created', 500, 0)

      function norm(s) {
        return String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
      }

      // Encontra a categoria legítima padrão de Alimentação para cada usuário
      const defaultAlimentacaoByUser = {}
      for (let i = 0; i < allCategories.length; i++) {
        const cat = allCategories[i]
        const cName = norm(cat.getString('name'))
        const owner = cat.getString('owner') || 'global'
        // Categoria legítima de alimentação é "Alimentação", "Alimentação Essencial", etc.
        if (
          (cName === 'alimentacao' || cName === 'alimentacao essencial') &&
          !defaultAlimentacaoByUser[owner]
        ) {
          defaultAlimentacaoByUser[owner] = cat.id
        }
      }

      // Se não encontrou por usuário, busca global
      const globalAlimCat = allCategories.find((c) => norm(c.getString('name')) === 'alimentacao')

      // Mapeia nomes de caixinhas existentes
      const budgetNames = allBudgets.map((b) => norm(b.getString('name'))).filter(Boolean)

      // Identifica categorias gêmeas (ex.: "Alimentação - Cartão de Crédito")
      for (let c = 0; c < allCategories.length; c++) {
        const cat = allCategories[c]
        const catName = norm(cat.getString('name'))
        const catOwner = cat.getString('owner') || 'global'

        // Verifica se é uma categoria gêmea de caixinha composta (ex.: "alimentacao - cartao de credito")
        const isTwin =
          catName.includes(' - ') &&
          budgetNames.some((bName) => bName === catName || bName.includes(catName))

        if (isTwin) {
          console.log(
            `[migration 0034] Categoria gêmea identificada para limpeza: id=${cat.id}, nome="${cat.getString('name')}"`,
          )

          // 1.1 Localiza todas as transações que apontam para esta categoria gêmea
          let relatedTxs = []
          try {
            relatedTxs = app.findRecordsByFilter(
              'transactions',
              `category = '${cat.id}'`,
              '',
              500,
              0,
            )
          } catch (_) {}

          // Categoria substituta legítima
          const targetCatId =
            defaultAlimentacaoByUser[catOwner] ||
            defaultAlimentacaoByUser['global'] ||
            globalAlimCat?.id ||
            ''

          for (let t = 0; t < relatedTxs.length; t++) {
            const tx = relatedTxs[t]
            if (targetCatId) {
              tx.set('category', targetCatId)
              try {
                app.save(tx)
                console.log(
                  `[migration 0034] Transação ${tx.id} (${tx.getString('description')}) re-apontada para categoria legítima ${targetCatId}`,
                )
              } catch (txErr) {
                console.log(`[migration 0034] Erro ao re-apontar transação ${tx.id}:`, txErr)
              }
            }
          }

          // 1.2 Remove vínculos órfãos de category_caixinha_links
          let relatedLinks = []
          try {
            relatedLinks = app.findRecordsByFilter(
              'category_caixinha_links',
              `category_id = '${cat.id}' || category_name = '${cat.getString('name')}'`,
              '',
              200,
              0,
            )
          } catch (_) {}

          for (let l = 0; l < relatedLinks.length; l++) {
            try {
              app.delete(relatedLinks[l])
            } catch (_) {}
          }

          // 1.3 Exclui a categoria gêmea
          try {
            app.delete(cat)
            console.log(
              `[migration 0034] Categoria gêmea ${cat.id} ("${cat.getString('name')}") removida com sucesso.`,
            )
          } catch (delErr) {
            console.log(`[migration 0034] Aviso ao remover categoria gêmea ${cat.id}:`, delErr)
          }
        }
      }
    } catch (cleanErr) {
      console.log('[migration 0034] Erro na limpeza de categorias gêmeas:', cleanErr)
    }

    // ------------------------------------------------------------------------
    // 2. ATUALIZA AGENTE FINANCEIRO-WHATSAPP: SEM PERMISSÃO DE CRIAR CATEGORIAS
    // ------------------------------------------------------------------------
    try {
      const existingAgent = $ai.agents.get(app, 'financeiro-whatsapp')
      if (existingAgent) {
        $ai.agents.update(app, 'financeiro-whatsapp', {
          name: 'Consciente',
          description:
            'Consciente - Seu parceiro nas finanças. Agente financeiro inteligente via WhatsApp e Web para controle diário de custos e caixinhas.',
          systemPrompt: `Você é o Consciente - Seu parceiro nas finanças, assistente financeiro dos clientes do app Consciente.
Seu tom é amigável, acolhedor, empático, direto e objetivo, em português do Brasil informal e leve (pode usar emoji com moderação). Quando perguntado sobre o produto ou sobre quem você é, apresente-se orgulhosamente como "Consciente - Seu parceiro nas finanças". Nunca use os nomes antigos "Eleva" nem mencione "Skip".

=== REGRA OFICIAL DE CAIXINHAS E CATEGORIAS (REGRA VITAL — ZERO DUPLICAÇÃO) ===
1. Caixinhas são tetos de gastos autônomos (alimentação, transporte, lazer, etc.). NUNCA crie categorias automaticamente ao falar ou criar caixinhas. Categorias são gerenciadas exclusivamente pelo usuário no app.
2. Cada lançamento de gasto pertence a UMA ÚNICA caixinha, NUNCA duplica em múltiplas caixinhas:
   a) Categoria vinculada a UMA única caixinha: Registre IMEDIATAMENTE e informe o cliente com clareza ("Registrei R$ X na caixinha Y ✅"). Sem atrito, sem pergunta.
   b) Categoria vinculada a MAIS de uma caixinha candidata (ex.: Alimentação dividida em "Alimentação - VA" e "Alimentação - Cartão de Crédito", ou padaria/mercado/restaurante quando houver múltiplas caixinhas de alimentação): OBRIGATORIAMENTE PERGUNTE ao cliente em qual caixinha ele deseja lançar (ex.: "Esse gasto de R$ 18 (padaria) entra em qual caixinha? 1️⃣ Alimentação - VA ou 2️⃣ Alimentação - Cartão de Crédito?"). SÓ grave depois da escolha da pessoa. NUNCA assuma nem registre em ambas ao mesmo tempo.
   c) Categoria sem vínculo parametrizado: registre na categoria correspondente, usando a caixinha única de fallback por nome/sufixo se aplicável.

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

=== LINKS E CONTATOS OFICIAIS ===
- Cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register
- Login: https://agente-financeiro-whatsapp-37fd3.goskip.app/login
- Página inicial: https://agente-financeiro-whatsapp-37fd3.goskip.app
- Recuperação de senha: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password
Sempre forneça o link completo quando convidar a criar conta, entrar ou recuperar acesso.

=== REGISTRO DE GASTOS E RECEITAS ===
1. Quando a pessoa enviar um gasto (ex.: "almoço 35", "uber 22", "mercado 150"):
   a) Identifique a caixinha/categoria mais adequada (consulte as categorias do usuário se necessário).
   b) Se a categoria estiver vinculada a mais de uma caixinha, PERGUNTE antes de registrar.
   c) Se houver vínculo único ou caixinha clara, REGISTRE IMEDIATAMENTE a transação (amount em CENTAVOS, type 'despesa', source 'whatsapp', status 'active').
   d) Informe o valor registrado e quanto resta do teto com carinho e precisão.
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
          tools: [
            {
              collection: 'transactions',
              perms: { list: true, read: true, create: true, update: true, delete: true },
              actAs: 'user',
            },
            {
              // CATEGORIAS: apenas LIST e READ para o agente! NUNCA criar nem alterar categorias.
              collection: 'categories',
              perms: { list: true, read: true },
              actAs: 'user',
            },
            {
              collection: 'budgets',
              perms: { list: true, read: true, create: true, update: true },
              actAs: 'user',
            },
            {
              collection: 'category_caixinha_links',
              perms: { list: true, read: true },
              actAs: 'user',
            },
          ],
        })
        console.log(
          '[migration 0034] Agente financeiro-whatsapp atualizado com bloqueio de criação de categoria e regra estrita de pergunta multi-caixinha',
        )
      }
    } catch (agErr) {
      console.log('[migration 0034] Erro ao atualizar agente:', agErr)
    }
  },
  (app) => {
    // Reversão idempotente
  },
)
