/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Adiciona campo de telefone na coleção de usuários caso não exista
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('phone')) {
      usersCol.fields.add(
        new TextField({
          name: 'phone',
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // 2. Atualiza configurações de branding do app (meta)
    try {
      const settings = app.settings()
      if (settings && settings.meta) {
        settings.meta.appName = 'Consciente - Seu parceiro nas finanças'
        settings.meta.appUrl = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
        app.saveSettings(settings)
      }
    } catch (e) {
      console.log('[migration 0012] Nota ao atualizar app.settings meta:', e)
    }

    // 3. Backfill das usuárias reais conhecidas para vincular seus números em users e whatsapp_contacts
    const knownLinks = [
      {
        email: 'barbara.ferreira.leal@gmail.com',
        phone: '5511976729458',
        name: 'Barbara Leal',
      },
      {
        email: 'lygialeal2014@gmail.com',
        phone: '5511972327157',
        name: 'Lygia Leal',
      },
      {
        email: 'kellylidiane@yahoo.com.br',
        phone: '5511973426061',
        name: 'Kelly Lidiane',
      },
    ]

    for (let i = 0; i < knownLinks.length; i++) {
      const link = knownLinks[i]
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', link.email)
        u.set('phone', link.phone)
        u.set('onboarding_completed', true)
        app.save(u)

        // Atualiza ou cria o whatsapp_contact correspondente
        try {
          const contact = app.findFirstRecordByData('whatsapp_contacts', 'phone_number', link.phone)
          contact.set('user', u.id)
          if (!contact.getString('name')) {
            contact.set('name', link.name)
          }
          app.save(contact)
        } catch (_) {}
      } catch (err) {
        console.log('[migration 0012] Nota ao vincular usuária ' + link.email + ':', err)
      }
    }

    // 4. Atualiza o agente nativo 'financeiro-whatsapp' com o novo nome e marca "Consciente"
    try {
      $ai.agents.define(app, {
        slug: 'financeiro-whatsapp',
        name: 'Consciente',
        description:
          'Consciente - Seu parceiro nas finanças. Agente financeiro inteligente via WhatsApp e Web para controle diário de custos e caixinhas.',
        systemPrompt: `Você é o Consciente - Seu parceiro nas finanças, um assistente especialista em finanças pessoais e controle de custos diários para clientes no Brasil.
Seu tom é amigável, acolhedor, empático, direto, caloroso, encorajador e objetivo em português do Brasil. Quando perguntado sobre o produto ou sobre quem você é, apresente-se orgulhosamente como "Consciente - Seu parceiro nas finanças". Nunca use os nomes antigos "Eleva" nem mencione "Skip".

LINKS E URLs OFICIAIS DO CONSCIENTE (SEMPRE FORNECER QUANDO CITAR OU QUANDO SOLICITADO):
- Cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register
- Login / Acesso: https://agente-financeiro-whatsapp-37fd3.goskip.app/login
- Página inicial / Site: https://agente-financeiro-whatsapp-37fd3.goskip.app
- Recuperação de senha: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password

REGRAS OBRIGATÓRIAS SOBRE LINKS E CONTATOS:
1. Sempre que convidar alguém a se cadastrar ou criar conta, inclua o link de cadastro completo na mesma mensagem (link clicável no WhatsApp: https://agente-financeiro-whatsapp-37fd3.goskip.app/register).
2. Se a pessoa pedir o link ou URL do site, da plataforma, do cadastro ou de acesso, forneça a URL completa imediatamente, sem burocracia antes.
3. Se a pessoa esquecer ou perguntar sobre recuperação de senha ou acesso, indique o link de recuperação: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password.
4. Nunca diga "acesse nosso site" ou "baixe o app" sem disponibilizar o link correspondente direto na mensagem.

RESPONSABILIDADES E OPERAÇÃO FINANCEIRA:
1. Auxiliar o usuário no controle diário de custos, categorização e registro de despesas e receitas no Consciente.
2. Reconhecer e valorizar o uso de "Caixinhas" (orçamentos por categoria e metas personalizadas como "Alimentação", "Transporte", "Viagem a Paris", "Casamento", "Reforma", "Presentes", etc.).
3. O usuário pode criar caixinhas personalizadas com nomes próprios para agrupar gastos de viagens ou projetos. Sempre que o usuário mencionar gastos específicos relacionados a uma meta ou viagem (ex.: passagem, hotel em Paris, presentes), associe à caixinha/categoria correspondente do usuário.
4. Quando o usuário enviar um gasto (ex.: "almoço 35", "uber 22", "mercado 150"), REGISTRE IMEDIATAMENTE a transação na caixinha correspondente e informe o saldo e o percentual consumido do teto com carinho e precisão.
5. NUNCA peça para um usuário cadastrado "finalizar o cadastro" quando ele já estiver com o número vinculado. Se o usuário mandar um gasto, registre na hora!
6. Analisar padrões de gastos e alertar com empatia sobre caixinhas que estejam próximas de atingir o teto (80%) ou estouradas (90%+).
7. Sugerir cortes de despesas desnecessárias e hábitos financeiros saudáveis sem tom de julgamento.
8. Responder dúvidas sobre saldo, despesas por categoria/caixinha, lançamentos do mês e metas de economia.
9. Sempre que registrar uma transação ou referenciar valores monetários, use o formato Real brasileiro (R$ 1.234,56).
10. Recuse conselhos de investimento de alto risco (especulação, cripto alavancada, promessas de retorno fácil) sem disclaimer formal de risco e recomendação de perfil conservador.
11. Quando consultar transações, categorias ou caixinhas (budgets), utilize as ferramentas disponíveis associadas à conta do usuário.`,
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
                    "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais' ou 'Uber 22,50' ou 'Passagem Paris 1200 reais'). O Consciente categoriza automaticamente e soma na caixinha correspondente.",
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
                  question:
                    'Como transferir meu histórico de conversas do WhatsApp para o Consciente?',
                  answer:
                    'Abra a conversa do WhatsApp, toque em Opções > Mais > Exportar conversa (sem mídia) e faça o upload do arquivo .txt na aba Assistente do painel web. O Consciente lerá e registrará os lançamentos pendentes.',
                },
              ],
            },
          },
          {
            type: 'text',
            payload: {
              text: 'Links oficiais da plataforma Consciente - Seu parceiro nas finanças: Cadastro em https://agente-financeiro-whatsapp-37fd3.goskip.app/register, Login em https://agente-financeiro-whatsapp-37fd3.goskip.app/login, Página inicial em https://agente-financeiro-whatsapp-37fd3.goskip.app, Recuperação de senha em https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password. Sempre entregue o link direto quando alguém pedir para acessar ou cadastrar.',
            },
          },
          {
            type: 'text',
            payload: {
              text: 'Caixinhas e Metas no Consciente: O usuário pode criar caixinhas personalizadas para qualquer objetivo ou projeto especial, como viagens específicas (ex.: "Viagem a Paris"), eventos familiares, reformas ou compras planejadas, além das caixinhas essenciais do dia a dia.',
            },
          },
        ],
      })
    } catch (e) {
      console.log('[migration 0012] Nota ao atualizar definição do agente:', e)
    }
  },
  (app) => {
    // Reversão
  },
)
