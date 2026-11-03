export const ARQUITETURA_MARKDOWN = `# Arquitetura Técnica — Consciente (Seu parceiro nas finanças)

## 1. Visão Geral da Solução

O **Consciente - Seu parceiro nas finanças** é um agente financeiro autônomo focado na experiência conversacional direta pelo WhatsApp, complementado por um painel web em React + TypeScript.

- **Canal Principal**: O cliente conversa no WhatsApp do número comercial oficial \`+55 11 94998-9868\` (Phone Number ID \`1314873981716321\`, WABA ID \`1888947369148112\`).
- **Ponte de Entrada**: As mensagens enviadas pelos clientes chegam via Webhook da Meta Cloud API no endpoint permanente do backend:
  \`https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev/backend/v1/whatsapp/webhook\`
- **Inteligência Artificial**: O agente nativo \`$ai.agent('financeiro-whatsapp')\` processa o contexto, identifica caixinhas e executa chamadas de ferramentas diretamente no banco.
- **Envio de Resposta**: As respostas são disparadas diretamente pela Meta Graph API (\`https://graph.facebook.com/v21.0/{phone_number_id}/messages\`) utilizando o token de sistema permanente armazenado em \`whatsapp_status.access_token\`.
- **Painel Web**: Permite onboarding guiado das caixinhas, gráficos, extrato, criação de caixinhas personalizadas (com figurinhas de bichinhos) e gestão de perfil.

---

## 2. Fluxo de Mensagens Passo a Passo

1. **Webhook Inbound (POST /backend/v1/whatsapp/webhook)**:
   - Recebe o payload da Meta (\`entry[].changes[].value.messages[]\`).
   - Dispara imediatamente status de lida e typing indicator ("digitando...") via Meta Status API para dar feedback instantâneo ao usuário sem custo de mensagens.
   - Normaliza o número E.164 (dígitos com DDI 55).
   - **Fluxo de Mensagem de Áudio / Voice Message (Pipeline Multi-Estratégia e Chave Dinâmica)**:
     - **Reconhecimento de voice message**: identifica se \`type === 'audio'\` ou \`type === 'voice'\` no payload do WhatsApp.
     - Extrai o \`mediaId\` do objeto (\`msg.audio.id\` ou \`msg.voice.id\`).
     - **Download da mídia pela API da Meta**: consulta a Meta Graph API (\`GET https://graph.facebook.com/v21.0/{mediaId}\`) autenticando com o token permanente salvo em \`whatsapp_status.access_token\` para obter a URL temporária de download (\`url\`). Em seguida, baixa o arquivo de áudio binário utilizando o mesmo header de autorização, preservando os bytes intactos (\`res.body\` / \`res.raw\`).
     - **Conversão Base64 e Logs por Etapa**: converte o slice de bytes para Base64 em blocos eficientes via encoder Base64 puro em JavaScript, registrando logs analíticos detalhados por etapa com prefixo \`[whatsapp_bridge] [AUDIO]\` (tamanho em bytes, conversão base64 e status HTTP de cada tentativa).
     - **Leitura da Chave de STT (\`stt_api_key\`) do Banco**: o hook consulta dinamicamente a coleção \`whatsapp_status\` pelo campo \`stt_api_key\` configurado pela admin em Configurações. Se presente, utiliza a chave primária; se ausente, faz fallback para variáveis de ambiente (\`GROQ_API_KEY\`, \`OPENAI_API_KEY\`, \`OPENROUTER_API_KEY\`).
     - **Tentativa 1 (Groq Whisper Large v3 Turbo / v3)**: utiliza obrigatoriamente a chave configurada em \`whatsapp_status.stt_api_key\` lida em tempo real, submetendo o áudio via multipart FormData com \`$filesystem.fileFromBytes(audioBytes, 'audio.ogg')\` ao endpoint \`https://api.groq.com/openai/v1/audio/transcriptions\` com modelo \`whisper-large-v3-turbo\` (fallback \`whisper-large-v3\`), idioma \`pt\` e \`response_format=json\`.
     - **Tentativa 2 (Fallback OpenAI Whisper Direto)**: caso a chave configurada seja padrão OpenAI (\`sk-...\`) ou ocorra falha, recorre à API OpenAI (\`https://api.openai.com/v1/audio/transcriptions\`) com modelo \`whisper-1\`.
     - **Mensagens Honestas e Claras ao Cliente (Contingência Empática)**: caso nenhuma chave esteja configurada ou ocorra ruído/áudio inaudível, o agente envia uma resposta amigável e honesta pelo WhatsApp orientando a digitar o gasto sem culpar a usuária.
     - **Rastreabilidade de Origem e Data Original**: a transação é gravada com \`source = 'whatsapp_audio'\` (distinto de \`whatsapp_text\` e \`manual\`), preservando em \`message_timestamp\` a data/hora exata do envio na Meta (exibido na interface com badge dedicado "Áudio WhatsApp" e horário original). Uma vez obtido o texto transcrito, o pipeline aciona o agente \`$ai.agent('financeiro-whatsapp')\` e registra a despesa em centavos na caixinha correspondente.
   - Se for Texto ou Interativo: extrai o texto diretamente (\`text.body\`).
2. **Resolução de Identidade (\`resolveUser\`)**:
   - Etapa A: Busca vínculo explícito em \`whatsapp_contacts.phone_number == digits\` e lê o campo \`user\`.
   - Etapa B: Busca na coleção \`users\` comparando o campo \`phone\` (com match exato ou pelos últimos 8 dígitos).
   - Etapa C: Fallback em ambiente de teste/single-user: se existir apenas 1 usuário real no banco e este não possuir telefone preenchido, auto-vincula.
3. **Avaliação de Cadastro Completo (\`isUserAccountReady\`)**:
   - Critério único e centralizado: usuário real existe + (\`onboarding_completed: true\` OU possui categorias/caixinhas salvas).
   - Tolera confirmação de email pendente para não bloquear o lançamento imediato de compras.
4. **Chamada do Agente de IA**:
   - Se cadastrado e ativo: executa \`$ai.agent('financeiro-whatsapp').chat\` com \`user_id = matchedUser.id\`, injetando a data atual e a instrução obrigatória de centavos (\`amount = valor * 100\`).
   - Se visitante/não cadastrado: executa o agente com \`user_id = guestUser.id\` e prompt instruindo apresentação cordial como Consciente e convite com links oficiais de \`/register\` e \`/login\`.
5. **Envio da Resposta (\`sendMetaMessage\`)**:
   - Lê \`whatsapp_status.access_token\` e \`phone_number_id\`.
   - Dispara POST na Meta Graph API com timeout de 30s.
   - Atualiza \`whatsapp_contacts\` com contagem, timestamp e \`conversation_id\`.

---

## 3. Modelo de Dados (Coleções)

### Coleções de Negócio / Aplicação (Aptas a Zeragem Controlada)

- **\`users\`** (auth): Contas de usuários. Campos-chave: \`email\`, \`name\`, \`phone\`, \`onboarding_completed\`, \`verified\`, \`role\` (\`client\` | \`admin\`). A dona do produto (\`barbara.ferreira.leal@gmail.com\`) possui \`role: 'admin'\`. Clientes comuns possuem \`role: 'client'\`.
  _Nota_: O usuário de serviço \`whatsapp-visitante@agente.internal\` é mantido para chats de visitantes.
- **\`categories\`** (base): Caixinhas essenciais e personalizadas. Campos: \`owner\` (relation \`users\`), \`name\`, \`type\` (\`despesa\` | \`receita\` | \`investimento\`), \`icon\` (suporta figurinhas de bichinhos ex. \`pet-cat\`, \`pet-dog\`), \`color\`.
- **\`budgets\`** (base): Tetos mensais das caixinhas. Campos: \`owner\`, \`category\` (relation \`categories\`), \`month\` (\`YYYY-MM\`), \`amount\` (em **CENTAVOS**).
- **\`transactions\`** (base): Lançamentos financeiros. Campos: \`owner\`, \`description\` (em **CENTAVOS**), \`date\`, \`category\`, \`type\`, \`source\` (\`whatsapp_text\` | \`whatsapp_audio\` | \`manual\` | \`import\` | \`agent\` | legado \`whatsapp\`), \`message_timestamp\` (ISO com data/hora original da mensagem na Meta), \`note\`.
- **\`alerts\`** (base): Notificações de estouro de caixinhas (80%/90%). Campos: \`owner\`, \`title\`, \`message\`, \`type\`, \`read\`.
- **\`import_jobs\`** (base): Histórico de importação de arquivos .txt do WhatsApp. Campos: \`owner\`, \`filename\`, \`status\`, \`total_lines\`, \`imported_count\`.

### Coleções Técnicas e de Infraestrutura (**NÃO APAGAR NA ZERAGEM**)

- **\`whatsapp_status\`**: Configuração do canal oficial Meta Cloud API da proprietária e parâmetros de IA/Voz.
  - Campos: \`owner\`, \`connected\`, \`phone_number\` (+55 11 94998-9868), \`phone_number_id\` (1314873981716321), \`waba_id\` (1888947369148112), \`verify_token\` (\`agente-financeiro\`), \`access_token\` (token permanente da Meta), \`stt_api_key\` (chave de transcrição de voz Groq/OpenAI salva com segurança), \`last_send_status\`, \`last_send_error\`, \`last_send_at\`.
- **\`whatsapp_contacts\`**: Agenda de números que interagiram pelo WhatsApp.
  - Campos: \`phone_number\`, \`user\`, \`name\`, \`conversation_id\`, \`messages_count\`, \`last_message_at\`.

---

## 4. Papéis de Usuário (Admin × Cliente) e Backoffice (/admin)

1. **Separação de Papéis e O Que Cada Um Vê**:
   - **Cliente (\`client\` - padrão)**:
     - Foco 100% na experiência pessoal de finanças e caixinhas.
     - Vê: Dashboard, Caixinhas, Extrato de Transações, Categorias, Relatórios e Configurações de Perfil/Senha.
     - **Não vê dados técnicos**: canal WhatsApp, token de acesso, Phone ID, WABA ID ou webhook URL.
     - **Não vê rota de Backoffice**: barrado com mensagem amigável de Acesso Restrito em \`/admin\`.
   - **Administrador (\`admin\`)**:
     - Conta da dona do produto (\`barbara.ferreira.leal@gmail.com\`) promovida automaticamente.
     - Vê dados técnicos em Configurações (\`/settings\`), aviso oficial no Assistente (\`/assistant\`) e acesso ao Backoffice (\`/admin\`) e Documentação Técnica.

2. **Proteção Estrita de Endpoints no Backend**:
   - Endpoints de infraestrutura do WhatsApp recusam usuários comuns com HTTP \`403 Forbidden\`.
   - Endpoints do Backoffice (\`/backend/v1/admin/overview\`, \`/backend/v1/admin/clients/{id}\`, \`/backend/v1/admin/costs\`, etc.) exigem autenticação ativa e validação estrita de \`role === 'admin'\`.

---

## 5. Gestão Operacional de Custos por Cliente (Backoffice Admin)

Implementado no hook \`pocketbase/hooks/admin_backoffice.js\` com endpoints protegidos para controle da dona do produto:
- **Transação via Áudio WhatsApp**: R$ 0,001 (Groq Whisper)
- **Mensagem de IA do Agente**: R$ 0,02 (resposta gerada)
- **Mensagem Ativa / Utility Template**: R$ 0,04
- **Mensagens de Serviço (24h, blue ticks, typing)**: R$ 0,00
- **Rota Dedicada de Custos**: \`GET /backend/v1/admin/costs?month=YYYY-MM\` com totais acumulados, histórico e lista ordenada pelo maior custo.
`

export const TESTES_REGRESSIVOS_MARKDOWN = `# Roteiro de Testes Regressivos Obrigatório — Consciente

Este roteiro é **obrigatório após qualquer ajuste sistêmico** no Consciente. Nenhuma entrega deve ser considerada concluída sem a validação dos itens essenciais deste documento.

---

## Runbook de Zeragem de Dados de Desenvolvimento

Quando for necessário testar o fluxo de ponta a ponta como um novo cliente:

1. Abra o terminal na raiz do projeto.
2. Execute o dry-run para revisar o que será limpo e verificar a integridade pré-reset:
   \`\`\`bash
   node scripts/reset-dev.js
   \`\`\`
3. Execute a zeragem efetiva:
   \`\`\`bash
   node scripts/reset-dev.js --yes
   \`\`\`
4. **O que é preservado**: O canal Meta Cloud API (\`whatsapp_status\`), tokens permanentes, Phone ID e WABA ID são mantidos intactos.

---

## Matriz de Execução dos Testes

- **(SEMPRE RODA)**: Itens marcados como obrigatórios em qualquer alteração.
- **(QUANDO ALTERAR)**: Itens executados quando a área específica de telas ou modelos sofrer ajustes.

---

## A) Cadastro, Login e Verificação de Email (SEMPRE RODA)
- Teste de cadastro em \`/register\` com telefone e validações.
- Teste de login em \`/login\` com olhinho para alternar visibilidade de senha.
- Verificação no banco de telefone limpo.

---

## B) Onboarding das Caixinhas (SEMPRE RODA)
- Seleção de caixinhas sugeridas e criação de caixinha personalizada.
- Redirecionamento após conclusão com \`onboarding_completed: true\` e orçamentos em centavos.

---

## C) Lançamento de Gasto via WhatsApp Real (SEMPRE RODA)
- Envio de mensagem de gasto para \`+55 11 94998-9868\`.
- Resposta empática do agente em menos de 30 segundos com teto consumido e saldo.
- Gravação de transação com \`amount\` em centavos e \`source = 'whatsapp_text'\`.

---

## D) Caixinhas e Alertas (80% / 90%) (QUANDO ALTERAR CAIXINHAS)
- Gastos sucessivos até ultrapassar 80% do teto mensal da caixinha.
- Notificação registrada na coleção \`alerts\`.

---

## E) Assistente e Chat no Painel Web (QUANDO ALTERAR IA/ASSISTENTE)
- Visão do cliente comum sem dados técnicos de canal.
- Visão do administrador com badge Apenas Admin e dados reais do canal.
- Importação de histórico via arquivo \`.txt\`.

---

## F) Emails Transacionais com Marca Consciente (QUANDO ALTERAR AUTH/EMAILS)
- Recuperação de senha com remetente e título oficial "Consciente - Seu parceiro nas finanças".

---

## G) Infraestrutura e Webhook da Meta (SEMPRE RODA)
- Verificação do webhook challenge \`GET /backend/v1/whatsapp/webhook\`.
- Disparo de mensagem de teste pelo painel admin.

---

## H) Registro de Gasto por Áudio no WhatsApp (Voice Message)
- Gravação e envio de mensagem de áudio.
- Download via Meta Graph API, transcrição via Groq Whisper e registro em centavos com \`source = 'whatsapp_audio'\`.
- Exibição de badge lilás dedicado e data/hora original da mensagem.

---

## I) Restrição de Visão: Conta Cliente vs Conta Admin
- Cliente comum bloqueado em \`/admin\` com tela de Acesso Restrito.
- Administrador com menu de Backoffice e Documentação visíveis.

---

## J) Backoffice Administrativo (/admin) e Ações de Suporte
- Métricas globais (clientes, ativos 7d/30d, transações, conversas WhatsApp).
- Listagem com busca, ordenação e badges de status.
- Detalhes do cliente com caixinhas, extrato e histórico.
- Ações de suporte: zerar fio de conversa e vincular/desvincular WhatsApp.

---

## K) Filtro Padrão = Mês Corrente (Dashboard, Transações, Relatórios)
1. **Passo a passo**:
   - Abra a tela de Transações (\`/transactions\`).
   - Verifique que o seletor de período vem selecionado por padrão como **"Mês corrente"** (do dia 1º até hoje).
   - Teste alterar o seletor para "Últimos 7 dias", "Últimos 30 dias" ou "Todo o histórico": os lançamentos filtram corretamente.
   - Abra o Dashboard (\`/\`): os totais de receitas, despesas e gastos das caixinhas agregam os lançamentos do mês corrente.
   - Abra Relatórios (\`/reports\`): o período padrão inicia em **"Mês corrente"**, podendo ser alterado pelo usuário.

---

## L) Figurinhas de Bichinhos nas Caixinhas
1. **Passo a passo**:
   - Acesse Caixinhas (\`/budgets\`) ou Categorias (\`/categories\`).
   - Clique em "+ Nova Caixinha" ou "+ Criar Caixinha".
   - Na seleção de ícone, observe a aba **"🐱 Bichinhos"**:
     - Estão disponíveis opções como Gatinho 🐱, Cachorrinho 🐶, Patinhas 🐾, Ursinho 🐻, Panda 🐼, Coala 🐨, Leãozinho 🦁, Coelhinho 🐰, Raposa 🦊, Pinguim 🐧, etc.
   - Selecione a figurinha de Gatinho ou Cachorrinho, defina um nome (ex: "Cuidados do Pet" ou "Mimos do Gato") e salve.
   - **Comportamento Esperado**:
     - A caixinha exibe a figurinha do bichinho no card de caixinhas (\`/budgets\`).
     - No Dashboard (\`/\`), a figurinha aparece no progresso das caixinhas e nos lançamentos recentes.
     - Em Transações (\`/transactions\`), a figurinha é exibida ao lado do nome da caixinha no extrato.
     - No modal de Novo Lançamento, a caixinha aparece com a figurinha selecionada.

---

## M) Documentação Técnica no Backoffice Admin
1. **Passo a passo**:
   - Faça login como Administrador (\`barbara.ferreira.leal@gmail.com\`).
   - Acesse o menu lateral (Sidebar) ou a tela de Backoffice: clique em **"Documentação"** (\`/admin/docs\`).
   - **Comportamento Esperado**:
     - A página carrega com abas para alternar entre **"Arquitetura Técnica"** e **"Testes Regressivos"**.
     - O conteúdo é renderizado de forma legível com títulos, listas, tabelas e blocos de código formatados.
     - Um cliente comum que tentar acessar \`/admin/docs\` é barrado com a tela de Acesso Restrito.

---

## N) Custo Mensal Acumulado por Cliente no Backoffice Admin (/admin) (Item 9 das Prioridades)
1. **Passo a passo**:
   - Faça login como Administrador (\`barbara.ferreira.leal@gmail.com\`).
   - Acesse \`/admin\`.
   - **Comportamento Esperado**:
     - O card **"Custo Mensal Acumulado por Cliente"** é exibido no topo com os valores unitários detalhados.
     - 4 cartões de métricas do mês: Custo Total Estimado em R$ (formato R$ 0,0000), Respostas de IA, Áudios Transcritos e Lançamentos.
     - Tabela ordenada pelo maior custo primeiro, com alternância de colunas e seletor histórico de meses.
     - No detalhe individual de cada cliente (botão "Detalhes"), o custo estimado mensal e decomposição são exibidos junto com o seletor de mês.
     - A rota \`GET /backend/v1/admin/costs\` retorna 403 Forbidden para clientes comuns e visitantes.
`
