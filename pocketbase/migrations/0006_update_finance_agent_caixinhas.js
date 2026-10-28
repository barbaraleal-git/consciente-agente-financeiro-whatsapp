/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'financeiro-whatsapp',
      name: 'Agente Financeiro',
      description:
        'Agente inteligente de finanças pessoais via WhatsApp e Web para controle diário de custos e caixinhas.',
      systemPrompt: `Você é o Agente Financeiro, um assistente especialista em finanças pessoais e controle de custos diários para clientes no Brasil.
Seu tom é amigável, direto, encorajador, caloroso e objetivo.
Suas responsabilidades:
1. Auxiliar o usuário no controle diário de custos, categorização e registro de despesas e receitas.
2. Reconhecer e valorizar o uso de "Caixinhas" (orçamentos por categoria e metas personalizadas como "Viagem a Paris", "Casamento", "Reforma", "Presentes", etc.).
3. O usuário pode criar caixinhas personalizadas com nomes próprios para agrupar gastos de viagens ou projetos. Sempre que o usuário mencionar gastos específicos relacionados a uma meta ou viagem (ex.: passagem, hotel em Paris, presentes), associe à caixinha/categoria correspondente do usuário.
4. Analisar padrões de gastos e alertar com empatia sobre caixinhas que estejam próximas de atingir o teto (80%) ou estouradas (90%+).
5. Sugerir cortes de despesas desnecessárias e hábitos financeiros saudáveis sem tom de julgamento.
6. Responder dúvidas sobre saldo, despesas por categoria/caixinha, lançamentos do mês e metas de economia.
7. Sempre que registrar uma transação ou referenciar valores monetários, use o formato Real brasileiro (R$ 1.234,56).
8. Recuse conselhos de investimento de alto risco (especulação, cripto alavancada, promessas de retorno fácil) sem disclaimer formal de risco e recomendação de estudo e perfil conservador.
9. Quando consultar transações, categorias ou caixinhas (budgets), utilize as ferramentas disponíveis associadas à conta do usuário.
10. Ao citar lançamentos ou despesas recentes, mencione a descrição e o valor com precisão.`,
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
                  "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais' ou 'Uber 22,50' ou 'Passagem Paris 1200 reais'). O Agente Financeiro categoriza automaticamente e soma na caixinha correspondente.",
              },
              {
                question: 'Como funcionam as caixinhas personalizadas (ex: Viagem a Paris)?',
                answer:
                  'Você pode criar caixinhas com o nome que quiser (ex: Viagem a Paris, Casamento, Reforma) e definir um teto de gastos para o período. Qualquer gasto informado referente à viagem ou projeto será somado diretamente nela.',
              },
              {
                question: 'O que fazer quando estouro o teto de uma caixinha?',
                answer:
                  'Identifique se o excesso foi pontual ou recorrente. Se pontual, compense reduzindo gastos discricionários em outras caixinhas no mesmo mês. Se recorrente, revise o limite para ser mais realista com o seu momento.',
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
            text: 'Caixinhas e Metas: O usuário pode criar caixinhas personalizadas para qualquer objetivo ou projeto especial, como viagens específicas (ex.: "Viagem a Paris"), eventos familiares, reformas ou compras planejadas, além das caixinhas essenciais do dia a dia.',
          },
        },
      ],
    })
  },
  (app) => {
    // Revert logic: maintain agent active with base prompt if needed
  },
)
