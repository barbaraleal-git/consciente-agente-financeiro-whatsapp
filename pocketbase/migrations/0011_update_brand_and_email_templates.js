/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualiza os templates padrão da coleção de usuários 'users'
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol) {
        usersCol.verificationTemplate = {
          subject: 'Confirme sua conta no Eleva App',
          body: `<p>Olá,</p>
<p>Obrigado por criar sua conta no <strong>Eleva App - Seu Agente Financeiro</strong>.</p>
<p>Clique no botão abaixo para confirmar seu email e começar seu controle financeiro:</p>
<p>
  <a class="btn" href="https://agente-financeiro-whatsapp-37fd3.goskip.app/verify-email?token={TOKEN}" target="_blank" rel="noopener">Confirmar minha conta</a>
</p>
<p><i>Se você não realizou este cadastro, por favor ignore este email.</i></p>
<p>
  Atenciosamente,<br/>
  Equipe Eleva App
</p>`,
        }

        usersCol.resetPasswordTemplate = {
          subject: 'Redefina sua senha do Eleva App',
          body: `<p>Olá,</p>
<p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Eleva App - Seu Agente Financeiro</strong>.</p>
<p>Clique no botão abaixo para criar uma nova senha:</p>
<p>
  <a class="btn" href="https://agente-financeiro-whatsapp-37fd3.goskip.app/reset-password?token={TOKEN}" target="_blank" rel="noopener">Redefinir minha senha</a>
</p>
<p><i>Se você não solicitou a redefinição de senha, ignore esta mensagem.</i></p>
<p>
  Atenciosamente,<br/>
  Equipe Eleva App
</p>`,
        }

        usersCol.confirmEmailChangeTemplate = {
          subject: 'Confirme seu novo email no Eleva App',
          body: `<p>Olá,</p>
<p>Você solicitou a alteração do email da sua conta no <strong>Eleva App - Seu Agente Financeiro</strong>.</p>
<p>Clique no botão abaixo para confirmar seu novo endereço:</p>
<p>
  <a class="btn" href="https://agente-financeiro-whatsapp-37fd3.goskip.app/confirm-email-change?token={TOKEN}" target="_blank" rel="noopener">Confirmar novo email</a>
</p>
<p><i>Se você não solicitou esta alteração, ignore esta mensagem.</i></p>
<p>
  Atenciosamente,<br/>
  Equipe Eleva App
</p>`,
        }

        app.save(usersCol)
      }
    } catch (e) {
      console.log('[migration 0011] Nota ao atualizar templates da coleção users:', e)
    }

    // 2. Atualiza as configurações globais de sistema (app.settings)
    try {
      const settings = app.settings()
      if (settings && settings.meta) {
        settings.meta.appName = 'Eleva App'
        settings.meta.appUrl = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'
        if (settings.meta.senderName !== undefined) {
          settings.meta.senderName = 'Eleva App - Seu Agente Financeiro'
        }
        app.save(settings)
      }
    } catch (e) {
      console.log('[migration 0011] Nota ao atualizar app.settings meta:', e)
    }

    // 3. Atualiza o agente nativo 'financeiro-whatsapp' com o nome Eleva App
    try {
      $ai.agents.define(app, {
        slug: 'financeiro-whatsapp',
        name: 'Eleva App',
        description:
          'Eleva App - Seu Agente Financeiro inteligente via WhatsApp e Web para controle diário de custos e caixinhas.',
        systemPrompt: `Você é o Eleva App - Seu Agente Financeiro, um assistente especialista em finanças pessoais e controle de custos diários para clientes no Brasil.
Seu tom é amigável, direto, acolhedor, caloroso, encorajador e objetivo em português do Brasil. Quando perguntado sobre o produto ou sobre quem você é, apresente-se orgulhosamente como "Eleva App - Seu Agente Financeiro".

LINKS E URLs OFICIAIS DO ELEVA APP (SEMPRE FORNECER QUANDO CITAR OU QUANDO SOLICITADO):
- Cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register
- Login / Acesso: https://agente-financeiro-whatsapp-37fd3.goskip.app/login
- Página inicial / Site: https://agente-financeiro-whatsapp-37fd3.goskip.app
- Recuperação de senha: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password

REGRAS OBRIGATÓRIAS SOBRE LINKS E CONTATOS:
1. Sempre que convidar alguém a se cadastrar ou criar conta, inclua o link de cadastro completo na mesma mensagem (link clicável no WhatsApp: https://agente-financeiro-whatsapp-37fd3.goskip.app/register).
2. Se a pessoa pedir o link ou URL do site, da plataforma, do cadastro ou de acesso, forneça a URL completa imediatamente, sem pedir dados nem burocracia antes.
3. Se a pessoa esquecer ou perguntar sobre recuperação de senha ou acesso, indique o link de recuperação: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password.
4. Nunca diga "acesse nosso site" ou "baixe o app" sem disponibilizar o link correspondente direto na mensagem.

RESPONSABILIDADES E OPERAÇÃO FINANCEIRA:
1. Auxiliar o usuário no controle diário de custos, categorização e registro de despesas e receitas no Eleva App.
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
                  question: 'Qual é o link para me cadastrar ou criar conta no Eleva App?',
                  answer:
                    'Você pode criar sua conta no Eleva App diretamente pelo link de cadastro: https://agente-financeiro-whatsapp-37fd3.goskip.app/register. Leva menos de um minuto!',
                },
                {
                  question: 'Qual é o site oficial ou link de login do Eleva App?',
                  answer:
                    'O link para entrar na sua conta é https://agente-financeiro-whatsapp-37fd3.goskip.app/login e a página inicial é https://agente-financeiro-whatsapp-37fd3.goskip.app.',
                },
                {
                  question: 'Esqueci minha senha do Eleva App, como faço para recuperar?',
                  answer:
                    'Você pode redefinir sua senha diretamente pelo link: https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password.',
                },
                {
                  question: 'O que é o Eleva App?',
                  answer:
                    'O Eleva App é o seu Agente Financeiro inteligente que te ajuda no controle diário de custos e caixinhas tanto pelo WhatsApp quanto pelo painel Web.',
                },
                {
                  question: 'Como funciona a regra 50-30-20 de finanças pessoais?',
                  answer:
                    'A regra 50-30-20 propõe dividir a renda líquida em: 50% para necessidades básicas (moradia, alimentação, contas fixas), 30% para desejos pessoais e estilo de vida (lazer, restaurantes, hobbies) e 20% para reserva de emergência, investimentos e quitação de dívidas.',
                },
                {
                  question: 'Como controlar custos no dia a dia pelo WhatsApp com o Eleva App?',
                  answer:
                    "Envie uma mensagem assim que fizer uma compra (ex: 'Almoço 35 reais' ou 'Uber 22,50' ou 'Passagem Paris 1200 reais'). O Eleva App categoriza automaticamente e soma na caixinha correspondente.",
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
                    'Como transferir meu histórico de conversas do WhatsApp para o Eleva App?',
                  answer:
                    'Abra a conversa do WhatsApp, toque em Opções > Mais > Exportar conversa (sem mídia) e faça o upload do arquivo .txt na aba Assistente do painel web. O Eleva App lerá e registrará os lançamentos pendentes.',
                },
              ],
            },
          },
          {
            type: 'text',
            payload: {
              text: 'Links oficiais da plataforma Eleva App: Cadastro em https://agente-financeiro-whatsapp-37fd3.goskip.app/register, Login em https://agente-financeiro-whatsapp-37fd3.goskip.app/login, Página inicial em https://agente-financeiro-whatsapp-37fd3.goskip.app, Recuperação de senha em https://agente-financeiro-whatsapp-37fd3.goskip.app/forgot-password. Sempre entregue o link direto quando alguém pedir para acessar ou cadastrar.',
            },
          },
          {
            type: 'text',
            payload: {
              text: 'Caixinhas e Metas no Eleva App: O usuário pode criar caixinhas personalizadas para qualquer objetivo ou projeto especial, como viagens específicas (ex.: "Viagem a Paris"), eventos familiares, reformas ou compras planejadas, além das caixinhas essenciais do dia a dia.',
            },
          },
        ],
      })
    } catch (e) {
      console.log('[migration 0011] Nota ao atualizar definição do agente:', e)
    }
  },
  (app) => {
    // Reversão
  },
)
