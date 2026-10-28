/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'financeiro-whatsapp',
      name: 'Agente Financeiro',
      description:
        'Agente inteligente de finanças pessoais via WhatsApp e Web para controle diário de custos.',
      systemPrompt: `Você é o Agente Financeiro, um assistente especialista em finanças pessoais e controle de custos diários para clientes no Brasil.
Seu tom é amigável, direto, encorajador e objetivo.
Suas responsabilidades:
1. Auxiliar o usuário no controle diário de custos, categorização e registro de despesas e receitas.
2. Analisar padrões de gastos e alertar sobre orçamentos estourados ou próximos do limite.
3. Sugerir cortes de despesas desnecessárias e hábitos financeiros saudáveis.
4. Responder dúvidas sobre saldo, despesas por categoria, lançamentos do mês e metas de economia.
5. Sempre que registrar uma transação ou referenciar valores monetários, use o formato Real brasileiro (R$ 1.234,56).
6. Recuse conselhos de investimento de alto risco (especulação, cripto alavancada, promessas de retorno fácil) sem disclaimer formal de risco e recomendação de estudo e perfil conservador.
7. Quando consultar transações, categorias ou orçamentos, utilize as ferramentas disponíveis associadas à conta do usuário.
8. Ao citar lançamentos ou despesas recentes, mencione a descrição e o valor com precisão.`,
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
      ],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como funciona a regra 50-30-20 de finanças pessoais?',
                answer:
                  'A regra 50-30-20 propõe dividir a renda líquida em: 50% para necessidades básicas (moradia, alimentação, contas fixas), 30% para desejos pessoais e estilo de vida (lazer, restaurantes, hobbies) e 20% para reserva de emergência, investimentos e quitação de dívidas.',
              },
              {
                question: 'Como controlar custos no dia a dia pelo WhatsApp?',
                answer:
                  "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais' ou 'Uber 22,50'). O Agente Financeiro categoriza automaticamente e soma ao seu orçamento do mês.",
              },
              {
                question: 'O que fazer quando estouro o orçamento de uma categoria?',
                answer:
                  'Identifique se o excesso foi pontual ou recorrente. Se pontual, compense reduzindo gastos discricionários (lazer, compras supérfluas) em outras categorias no mesmo mês. Se recorrente, revise o limite do orçamento para ser mais realista.',
              },
              {
                question: 'Como transferir meu histórico de conversas do WhatsApp?',
                answer:
                  'Abra a conversa do WhatsApp, toque em Opções > Mais > Exportar conversa (sem mídia) e faça o upload do arquivo .txt na aba Assistente do painel web. O agente lerá e registrará os lançamentos pendentes.',
              },
            ],
          },
        },
        {
          type: 'text',
          payload: {
            text: 'Controle diário de custos: O registro em tempo real é a forma mais eficaz de evitar faturas surpresa no cartão de crédito. Categorias principais recomendadas: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Salário, Investimentos e Outros.',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'financeiro-whatsapp')
    } catch (_) {}
  },
)
