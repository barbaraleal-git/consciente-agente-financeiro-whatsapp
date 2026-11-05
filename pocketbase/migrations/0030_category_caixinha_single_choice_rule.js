/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0030:
 * 1. Adiciona campo 'budget' (relação opcional com budgets) em 'transactions'
 *    para associar explicitamente a caixinha efetiva escolhida no lançamento.
 * 2. Adiciona campo 'pending_caixinha' (json) em 'whatsapp_contacts'
 *    para memorizar o gasto pendente de desambiguação entre mensagens.
 * 3. Atualiza o agente 'financeiro-whatsapp' com a regra oficial:
 *    - Categoria vinculada a 1 caixinha: registra direto e informa.
 *    - Categoria vinculada a >1 caixinhas: pergunta antes de registrar.
 *    - Nunca duplica soma entre caixinhas.
 */
migrate(
  (app) => {
    // 1. Campo 'budget' em 'transactions'
    let txCol
    try {
      txCol = app.findCollectionByNameOrId('transactions')
    } catch (e) {
      console.log('[migration 0030] Coleção transactions não encontrada:', e)
    }

    if (txCol && !txCol.fields.getByName('budget')) {
      let budgetsColId = ''
      try {
        const budgetsCol = app.findCollectionByNameOrId('budgets')
        budgetsColId = budgetsCol.id
      } catch (_) {}

      txCol.fields.add(
        new Field({
          type: 'relation',
          name: 'budget',
          required: false,
          collectionId: budgetsColId,
          maxSelect: 1,
        }),
      )
      app.save(txCol)
      console.log('[migration 0030] Campo transactions.budget adicionado com sucesso')
    }

    // 2. Campo 'pending_caixinha' em 'whatsapp_contacts'
    let wCol
    try {
      wCol = app.findCollectionByNameOrId('whatsapp_contacts')
    } catch (e) {
      console.log('[migration 0030] Coleção whatsapp_contacts não encontrada:', e)
    }

    if (wCol && !wCol.fields.getByName('pending_caixinha')) {
      wCol.fields.add(new Field({ type: 'json', name: 'pending_caixinha', required: false }))
      app.save(wCol)
      console.log(
        '[migration 0030] Campo whatsapp_contacts.pending_caixinha adicionado com sucesso',
      )
    }

    // 3. Atualização do Agente 'financeiro-whatsapp'
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
Cada lançamento de gasto pertence a UMA ÚNICA caixinha, NUNCA duplica em múltiplas caixinhas:
1. Categoria vinculada a UMA única caixinha: Registre IMEDIATAMENTE e informe o cliente com clareza ("Registrei R$ X na caixinha Y ✅"). Sem atrito, sem pergunta.
2. Categoria vinculada a MAIS de uma caixinha candidata: OBRIGATORIAMENTE PERGUNTE ao cliente em qual caixinha ele deseja lançar (ex.: "Esse gasto de R$ 190 entra em qual caixinha? 1️⃣ Alimentação - VA ou 2️⃣ Alimentação - VR?"). SÓ grave depois da escolha da pessoa. NUNCA assuma nem registre em ambas ao mesmo tempo.
3. Categoria sem vínculo parametrizado: registre na categoria correspondente, usando a caixinha única de fallback por nome/sufixo se aplicável.

=== GUARDRAIL DE TEMAS (REGRA MAIS IMPORTANTE — VALE PARA TODA MENSAGEM) ===
Você SÓ conversa sobre estes temas, sempre amarrados ao app ou às finanças da própria pessoa:
1. Controle de gastos, receitas e lançamentos registrados pela própria pessoa (registro, consulta, correção, cancelamento e substituição de lançamentos).
2. Caixinhas da própria pessoa (teto, consumo, saldo, criação e organização de caixinhas).
3. Investimentos, APENAS dentro do escopo do app (caixinhas de reserva, metas de economia e organização — sem recomendação de ativo).
4. Como usar o produto Consciente (funcionalidades, caixinhas, extrato, relatórios, links oficiais, conta, senha e WhatsApp).
5. Educação financeira básica e curta (dicas de orçamento, 50-30-20, reserva de emergência), desde que ajude no uso do app.
QUALQUER outro assunto é FORA DE ESCOPO e deve ser recusado de forma GENTIL, BREVE e VARIADA.

=== VALORES MONETÁRIOS (REGRA CRÍTICA) ===
No banco, o campo 'amount' de 'transactions' e 'budgets' é INTEIRO EM CENTAVOS (1 real = 100 centavos):
R$ 100,00 = 10000; R$ 45,00 = 4500; R$ 35,50 = 3550; R$ 1.200,00 = 120000.
Sempre multiplique reais por 100 antes de create/update em 'transactions' ou 'budgets'. Nas respostas, formule valores em R$ brasileiro (R$ 1.234,56).

=== LINKS E CONTATOS OFICIAIS ===
- Cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register
- Login: https://agente-financeiro-whatsapp-37fd3.goskip.app/login
- Página inicial: https://agente-financeiro-whatsapp-37fd3.goskip.app
- Recuperação de senha: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password

=== GASTO RETROATIVO ===
Quando a mensagem traz uma data na fala ("ontem gastei 35", "na sexta 40", "dia 10 paguei 200"), registre com 'date' na data informada, 'is_retroactive' = true, e confirme na resposta: "contabilizado em [referência] (dd/mm)".

=== CANCELAR / SUBSTITUIR LANÇAMENTO ===
Deleção SEMPRE lógica: status = 'cancelled'. Nunca delete fisicamente. Um gasto cancelado é imediatamente removido das somas das caixinhas.`,
          tier: 'reasoning',
          tools: [
            {
              collection: 'transactions',
              perms: { list: true, read: true, create: true, update: true, delete: true },
              actAs: 'user',
            },
            {
              collection: 'categories',
              perms: { list: true, read: true, create: true, update: true },
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
          '[migration 0030] Agente financeiro-whatsapp atualizado com regra de caixinhas candidatas',
        )
      }
    } catch (agErr) {
      console.log('[migration 0030] Aviso ao atualizar agente:', agErr)
    }
  },
  (app) => {
    // Revert: idempotente, campos permanecem
  },
)
