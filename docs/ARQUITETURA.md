# Arquitetura Técnica — Consciente (Seu parceiro nas finanças)

## 1. Visão Geral da Solução

O **Consciente - Seu parceiro nas finanças** é um agente financeiro autônomo focado na experiência conversacional direta pelo WhatsApp, complementado por um painel web em React + TypeScript.

- **Canal Principal**: O cliente conversa no WhatsApp do número comercial oficial `+55 11 94998-9868` (Phone Number ID `1314873981716321`, WABA ID `1888947369148112`).
- **Ponte de Entrada**: As mensagens enviadas pelos clientes chegam via Webhook da Meta Cloud API no endpoint permanente do backend:
  `https://agente-financeiro-whatsapp-37fd3.shrd01.internal.goskip.dev/backend/v1/whatsapp/webhook`
- **Inteligência Artificial**: O agente nativo `$ai.agent('financeiro-whatsapp')` processa o contexto, identifica caixinhas e executa chamadas de ferramentas diretamente no banco.
- **Envio de Resposta**: As respostas são disparadas diretamente pela Meta Graph API (`https://graph.facebook.com/v21.0/{phone_number_id}/messages`) utilizando o token de sistema permanente armazenado em `whatsapp_status.access_token`.
- **Painel Web**: Permite onboarding guiado das caixinhas, gráficos, extrato, criação de caixinhas personalizadas e gestão de perfil.

---

## 2. Fluxo de Mensagens Passo a Passo

1. **Webhook Inbound (POST /backend/v1/whatsapp/webhook)**:
   - Recebe o payload da Meta (`entry[].changes[].value.messages[]`).
   - Dispara imediatamente status de lida e typing indicator ("digitando...") via Meta Status API para dar feedback instantâneo ao usuário sem custo de mensagens.
   - Normaliza o número E.164 (dígitos com DDI 55).
   - **Fluxo de Mensagem de Áudio / Voice Message (Pipeline Multi-Estratégia e Chave Dinâmica)**:
     - **Reconhecimento de voice message**: identifica se `type === 'audio'` ou `type === 'voice'` no payload do WhatsApp.
     - Extrai o `mediaId` do objeto (`msg.audio.id` ou `msg.voice.id`).
     - **Download da mídia pela API da Meta**: consulta a Meta Graph API (`GET https://graph.facebook.com/v21.0/{mediaId}`) autenticando com o token permanente salvo em `whatsapp_status.access_token` para obter a URL temporária de download (`url`). Em seguida, baixa o arquivo de áudio binário utilizando o mesmo header de autorização, preservando os bytes intactos (`res.body` / `res.raw`).
     - **Conversão Base64 e Logs por Etapa**: converte o slice de bytes para Base64 em blocos eficientes via encoder Base64 puro em JavaScript, registrando logs analíticos detalhados por etapa com prefixo `[whatsapp_bridge] [AUDIO]` (tamanho em bytes, conversão base64 e status HTTP de cada tentativa).
     - **Leitura da Chave de STT (`stt_api_key`) do Banco**: o hook consulta dinamicamente a coleção `whatsapp_status` pelo campo `stt_api_key` configurado pela admin em Configurações. Se presente, utiliza a chave primária; se ausente, faz fallback para variáveis de ambiente (`GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`).
     - **Tentativa 1 (Groq Whisper Large v3 Turbo / v3)**: utiliza obrigatoriamente a chave configurada em `whatsapp_status.stt_api_key` lida em tempo real, submetendo o áudio via multipart FormData com `$filesystem.fileFromBytes(audioBytes, 'audio.ogg')` ao endpoint `https://api.groq.com/openai/v1/audio/transcriptions` com modelo `whisper-large-v3-turbo` (fallback `whisper-large-v3`), idioma `pt` e `response_format=json`.
     - **Tentativa 2 (Fallback OpenAI Whisper Direto)**: caso a chave configurada seja padrão OpenAI (`sk-...`) ou ocorra falha, recorre à API OpenAI (`https://api.openai.com/v1/audio/transcriptions`) com modelo `whisper-1`.
     - **Mensagens Honestas e Claras ao Cliente (Contingência Empática)**: caso nenhuma chave esteja configurada ou ocorra ruído/áudio inaudível, o agente envia uma resposta amigável e honesta pelo WhatsApp orientando a digitar o gasto (ex.: "Recebi seu áudio aqui no Consciente! No momento tivemos uma instabilidade na conversão de voz para texto... Você pode digitar rapidinho o gasto aqui para mim? Já registro direto na sua caixinha!"), sem fingir que entendeu ou culpar a usuária.
     - **Rastreabilidade de Origem e Data Original**: a transação é gravada com `source = 'whatsapp_audio'` (distinto de `whatsapp_text` e `manual`), preservando em `message_timestamp` a data/hora exata do envio na Meta (exibido na interface com badge dedicado "Áudio WhatsApp" e horário original). Uma vez obtido o texto transcrito, o pipeline aciona o agente `$ai.agent('financeiro-whatsapp')` e registra a despesa em centavos na caixinha correspondente.
   - Se for Texto ou Interativo: extrai o texto diretamente (`text.body`).
2. **Resolução de Identidade (`resolveUser`)**:
   - Etapa A: Busca vínculo explícito em `whatsapp_contacts.phone_number == digits` e lê o campo `user`.
   - Etapa B: Busca na coleção `users` comparando o campo `phone` (com match exato ou pelos últimos 8 dígitos).
   - Etapa C: Fallback em ambiente de teste/single-user: se existir apenas 1 usuário real no banco e este não possuir telefone preenchido, auto-vincula.
3. **Avaliação de Cadastro Completo (`isUserAccountReady`)**:
   - Critério único e centralizado: usuário real existe + (`onboarding_completed: true` OU possui categorias/caixinhas salvas).
   - Tolera confirmação de email pendente para não bloquear o lançamento imediato de compras.
4. **Chamada do Agente de IA**:
   - Se cadastrado e ativo: executa `$ai.agent('financeiro-whatsapp').chat` com `user_id = matchedUser.id`, injetando a data atual e a instrução obrigatória de centavos (`amount = valor * 100`).
   - Se visitante/não cadastrado: executa o agente com `user_id = guestUser.id` e prompt instruindo apresentação cordial como Consciente e convite com links oficiais de `/register` e `/login`.
5. **Envio da Resposta (`sendMetaMessage`)**:
   - Lê `whatsapp_status.access_token` e `phone_number_id`.
   - Dispara POST na Meta Graph API com timeout de 30s.
   - Atualiza `whatsapp_contacts` com contagem, timestamp e `conversation_id`.

---

## 3. Modelo de Dados (Coleções)

### Coleções de Negócio / Aplicação (Aptas a Zeragem Controlada)

- **`users`** (auth): Contas de usuários. Campos-chave: `email`, `name`, `phone`, `onboarding_completed`, `verified`, `role` (`client` | `admin`). A dona do produto (`barbara.ferreira.leal@gmail.com`) possui `role: 'admin'`. Clientes comuns possuem `role: 'client'`.
  _Nota_: O usuário de serviço `whatsapp-visitante@agente.internal` é mantido para chats de visitantes.
- **`categories`** (base): Caixinhas essenciais e personalizadas. Campos: `owner` (relation `users`), `name`, `type` (`despesa` | `receita` | `investimento`), `icon`, `color`.
- **`budgets`** (base): Tetos mensais das caixinhas. Campos: `owner`, `category` (relation `categories`), `month` (`YYYY-MM`), `amount` (em **CENTAVOS**).
- **`transactions`** (base): Lançamentos financeiros. Campos: `owner`, `description`, `amount` (em **CENTAVOS**), `date`, `category`, `type`, `source` (`whatsapp_text` | `whatsapp_audio` | `manual` | `import` | `agent` | legado `whatsapp`), `message_timestamp` (ISO com data/hora original da mensagem na Meta), `note`.
- **`alerts`** (base): Notificações de estouro de caixinhas (80%/90%). Campos: `owner`, `title`, `message`, `type`, `read`.
- **`import_jobs`** (base): Histórico de importação de arquivos .txt do WhatsApp. Campos: `owner`, `filename`, `status`, `total_lines`, `imported_count`.

### Coleções Técnicas e de Infraestrutura (**NÃO APAGAR NA ZERAGEM**)

- **`whatsapp_status`**: Configuração do canal oficial Meta Cloud API da proprietária e parâmetros de IA/Voz.
  - Campos: `owner`, `connected`, `phone_number` (+55 11 94998-9868), `phone_number_id` (1314873981716321), `waba_id` (1888947369148112), `verify_token` (`agente-financeiro`), `access_token` (token permanente da Meta), `stt_api_key` (chave de transcrição de voz Groq/OpenAI salva com segurança), `last_send_status`, `last_send_error`, `last_send_at`.
  - **Configuração da Chave STT via Painel Admin**: Na tela Configurações (`/settings`), a admin pode colar a chave Groq/OpenAI. O backend grava em `stt_api_key` e NUNCA reexibe o valor para o cliente ou admin, expondo apenas o flag booleano `stt_configurado` na rota `GET /backend/v1/whatsapp/status`.
  - **ATENÇÃO**: Esta coleção guarda a conectividade da Meta e da transcrição de áudios. Nunca deve ter seus registros excluídos.
- **`whatsapp_contacts`**: Agenda de números que interagiram pelo WhatsApp.
  - Campos: `phone_number`, `user`, `name`, `conversation_id`, `messages_count`, `last_message_at`.
  - _Na zeragem de desenvolvimento_: os campos `user` e `conversation_id` podem ser limpos para testes do zero, preservando o histórico se desejado.
- **`_agent_*` / `ai_*`**: Tabelas internas gerenciadas pelo Skip Cloud para o agente `financeiro-whatsapp`.

---

## 4. Integrações Externas

1. **Meta WhatsApp Cloud API**:
   - Endpoint: `https://graph.facebook.com/v21.0/{phone_number_id}/messages`
   - Autenticação: Header `Authorization: Bearer {whatsapp_status.access_token}`
   - Formato: JSON payload `{ messaging_product: "whatsapp", recipient_type: "individual", to: cleanTo, type: "text", text: { body: text } }`
2. **Webhook Verification (GET)**:
   - Endpoint: `/backend/v1/whatsapp/webhook`
   - Parâmetros: `hub.mode=subscribe`, `hub.verify_token=agente-financeiro`, `hub.challenge`
   - Retorno: `200` com o challenge em texto plano.

---

## 4.1. Papéis de Usuário (Admin × Cliente) e Backoffice (/admin)

1. **Separação de Papéis e O Que Cada Um Vê**:
   - **Cliente (`client` - padrão)**:
     - Foco 100% na experiência pessoal de finanças e caixinhas.
     - Vê: Dashboard, Caixinhas/Orçamentos, Extrato de Transações, Categorias, Relatórios e Configurações de Perfil/Senha.
     - **Não vê dados técnicos**: cliente comum **NÃO** tem acesso à seção do canal WhatsApp, token de acesso, Phone Number ID, WABA ID, URL de Webhook ou listas de contatos de infraestrutura. Essa seção é totalmente ocultada da tela de Configurações (`/settings`). Na página do Assistente (`/assistant`), nenhum card de canal WhatsApp ou aviso de conector é exibido: o cliente visualiza apenas a janela de chat e a ferramenta de histórico.
     - **Não vê rota de Backoffice**: o link de Backoffice não é exibido no menu lateral (Sidebar) e a rota `/admin` barra o acesso com mensagem de "Acesso Restrito".
   - **Administrador (`admin`)**:
     - Conta da dona do produto (`barbara.ferreira.leal@gmail.com`) promovida automaticamente de forma idempotente (via migração e no login).
     - Possui a visão completa de cliente para gerenciar suas próprias finanças.
     - **Vê dados técnicos em Configurações (`/settings`)**: seção exclusiva "Canal Oficial WhatsApp Business (Meta Cloud API)", exibindo status da Meta Graph API, token configurado/ativo, Phone Number ID, WABA ID, Webhook URL e ferramenta de disparo de mensagem de teste.
     - **Vê aviso oficial no Assistente (`/assistant`)**: card exclusivo com badge "Apenas Admin" exibindo o número oficial real (+55 11 94998-9868) e status dinâmico da Meta Cloud API.
     - **Vê e acessa o Backoffice (`/admin`)**: atalho com ícone de escudo na Sidebar para suporte operacional e monitoramento da base de clientes.

2. **Proteção Estrita de Endpoints no Backend**:
   - Endpoints de infraestrutura do WhatsApp (`/backend/v1/whatsapp/status`, `/backend/v1/whatsapp/token`, `/backend/v1/whatsapp/send-test`, `/backend/v1/whatsapp/contacts`) recusam usuários comuns com HTTP `403 Forbidden`.
   - Endpoints do Backoffice (`/backend/v1/admin/overview`, `/backend/v1/admin/clients/{id}`, `/backend/v1/admin/clients/{id}/reset-thread`, `/backend/v1/admin/clients/{id}/toggle-whatsapp`) exigem autenticação ativa e validação estrita de `role === 'admin'`.

3. **Arquitetura do Backoffice Operacional (`/admin`)**:
   - **Contagens e Métricas Globais**:
     - Total de Clientes cadastrados.
     - Clientes Ativos em 7 dias e em 30 dias.
     - Volume total de Transações registradas no sistema.
     - Total de Conversas / Contatos ativos no WhatsApp.
   - **Lista de Clientes com Busca e Ordenação**:
     - Listagem paginada/filtrada com busca em tempo real por nome, e-mail ou número de telefone.
     - Indicadores visuais de status: onboarding concluído/pendente, WhatsApp vinculado/desvinculado, papel (admin/cliente).
     - Ordenação dinâmica por colunas (nome, data de cadastro, caixinhas, transações).
   - **Painel de Detalhes do Cliente**:
     - Modal completo ao clicar em "Detalhes" de qualquer cliente da base.
     - **Aba Caixinhas**: lista todas as caixinhas do cliente com valor gasto no mês vs teto estipulado e barra de progresso.
     - **Aba Transações**: exibe as últimas transações do cliente com valor em R$, data, caixinha e fonte (WhatsApp / Manual).
     - **Aba Histórico WhatsApp**: exibe o telefone E.164, data da última mensagem, total de mensagens e histórico de interações registradas no canal.
   - **Ações de Suporte Operacional**:
     - **Zerar Fio da Conversa (`reset-thread`)**: limpa o `thread_id`/`conversation_id` travado na agenda do WhatsApp (`whatsapp_contacts`), permitindo que o cliente recomece uma conversa limpa com o agente do zero caso tenha ficado em um estado confuso.
     - **Des/vincular WhatsApp (`toggle-whatsapp`)**: permite ao suporte vincular manualmente o telefone do cliente ou desvincular o número em caso de troca de aparelho ou conflito cadastral.

---

## 5. Cadeia de Decisão do Agente

- **Caso 1: Visitante (Número Não Reconhecido)**:
  - Resposta: Apresenta-se como "Consciente - Seu parceiro nas finanças", explica o controle de caixinhas e fornece os links diretos:
    - Cadastro: `https://agente-financeiro-whatsapp-37fd3.goskip.app/register`
    - Login: `https://agente-financeiro-whatsapp-37fd3.goskip.app/login`
    - Instrução: "Se você já tem uma conta no Consciente, acesse o login e confirme seu WhatsApp em Configurações > Perfil para sincronizar seus lançamentos na hora!"
- **Caso 2: Usuário Cadastrado com Caixinhas Concluídas**:
  - Resposta: Registra imediatamente o gasto na caixinha correspondente, converte o valor para centavos no banco e responde informando valor em R$, total gasto no mês e saldo restante do teto.
- **Caso 3: Usuário Cadastrado com Onboarding Pendente**:
  - Resposta: Reconhece a conta e convida amigavelmente a finalizar a escolha das caixinhas em `https://agente-financeiro-whatsapp-37fd3.goskip.app/onboarding` para que os tetos fiquem calibrados.

---

## 6. Procedimento de Zeragem (Runbook de Reset e Preservação do Canal)

Qualquer limpeza de dados para testes do zero deve ser executada exclusivamente pela rotina permanente protegida:

```bash
node scripts/reset-dev.js --yes
```

### Regras de Ouro e Proteções Estruturais

1. **JAMAIS usar migrações ad-hoc temporárias**: migrações são imutáveis e rodam em toda réplica do banco. Limpezas anteriores feitas por migrações causaram remoção indevida de dados, recriação automática de usuários e quebras de token.
2. **Preservação Estrutural de `whatsapp_status`**:
   - A coleção `whatsapp_status` armazena a chave de autenticação do canal oficial Meta Cloud API (`access_token`, `phone_number_id`, `waba_id`, `phone_number`, `verify_token`).
   - Esta coleção **nunca** é incluída na lista de coleções esvaziadas pelo script (proteção via trava `FORBIDDEN_COLLECTIONS`).
   - Se houver vínculo de `owner` com algum usuário prestes a ser removido, o script desvincula o `owner = ""` antes da remoção dos usuários para evitar qualquer risco de cascade delete.
3. **Trava Pré-Reset**: O script valida a existência de `whatsapp_status` e se o token Meta está ativo antes de apagar qualquer dado. Se o canal estiver ausente ou sem token, o script aborta a operação.
4. **Trava Pós-Reset Obrigatória**: Imediatamente após a limpeza das coleções de negócio, o script executa uma checagem mandatória de que `whatsapp_status` permanece intacto com `token_configurado: true`, `phone_number_id` e `waba_id` preservados. Caso o canal não passe na validação, o script reporta erro crítico.
5. **O que é zerado**: `alerts`, `import_jobs`, `transactions`, `budgets`, `categories`, `whatsapp_contacts` e `users` (o visitante de serviço `whatsapp-visitante@agente.internal` é recriado sob demanda no primeiro contato).

---

## 10. Gestão Operacional de Custos por Cliente (Backoffice Admin)

Implementado no hook `pocketbase/hooks/admin_backoffice.js` com rotas protegidas para auditoria e controle de margem financeira:

### Modelagem Unitária de Custos Operacionais

- **Transação via Áudio WhatsApp (`source = 'whatsapp_audio'`)**: `R$ 0,001` (transcrição via Groq Whisper large-v3-turbo / large-v3).
- **Mensagem de IA do Agente (respostas geradas pelo assistente)**: `R$ 0,02` (estimativa média de resposta de IA pelo modelo nativo `$ai.agent`).
- **Mensagens Ativas / Utility Templates (fora da janela de 24h)**: `R$ 0,04` (custo por disparo ativo na Meta).
- **Mensagens de Serviço (dentro de 24h, confirmação de leitura blue ticks, typing/digitando)**: `R$ 0,00` (isento de tarifação pela Meta).

### Endpoints Administrativos

- `GET /backend/v1/admin/costs?month=YYYY-MM`: Agrega o consumo mensal por cliente, calcula totais gerais do mês e disponibiliza o histórico dos últimos 6 meses.
- `GET /backend/v1/admin/clients/:id?month=YYYY-MM`: Retorna o detalhamento individual do cliente enriquecido com o objeto `estimated_cost` contendo a decomposição de áudio, texto, IA e valor consolidado em R$.

### Proteção de Papel

- Visível **exclusivamente para a conta da dona do produto** (`barbara.ferreira.leal@gmail.com`) ou usuários com `role: 'admin'`. Requisições não autenticadas ou de clientes comuns retornam `403 Forbidden`.

---

## 11. Resumo Visual Padronizado das Caixinhas no WhatsApp (Item 19)

Implementado no helper `pocketbase/hooks/caixinhas_summary_helper.js` e integrado ao `pocketbase/hooks/whatsapp_bridge.js` (webhook de entrada e rota de simulação):

### Padrão de Formatação Visual em Texto

- **Cabeçalho:** `📊 *Suas Caixinhas — Mês de [Mês por extenso]*`
- **Itens:** Para cada caixinha ativa do tipo `despesa`, exibe:
  - Emoji da caixinha (ícone de bichinho ou categoria) + `*[Nome da Caixinha]*` + marcador de alerta
  - Barra de progresso proporcional com 10 caracteres de bloco: `▓▓▓▓░░░░░░ XX%`
  - Valores monetários formatados em Real brasileiro: `Gasto: R$ XX,XX / Teto: R$ YY,YY`
  - Linha de status: `Restam R$ ZZ,ZZ` ou `🚨 *Estourada por R$ WW,WW*`
- **Alertas de Destaque:**
  - Consumo `>= 80%` e `< 100%`: Marcador de alerta `⚠️` e aviso de atenção.
  - Consumo `>= 100%`: Marcador crítico `🚨` com valor do estouro em destaque.
- **Rodapé:** Linha divisória com totais consolidados:
  - `💰 *Total Gasto no Mês:* R$ XX,XX`
  - `🎯 *Total dos Tetos:* R$ YY,YY`
  - `✨ *Saldo Restante no Mês:* R$ ZZ,ZZ` (ou `🚨 *Estouro Geral no Mês:* R$ WW,WW`)

---

## 12. Atualização da Foto de Perfil do WhatsApp via API da Meta (Item 20)

Implementado no endpoint restrito à administração `POST /backend/v1/whatsapp/profile-picture`:

### Fluxo de Comunicação com a Meta Graph API

1. **Autenticação:** Exige papel `admin` ou conta da dona (`barbara.ferreira.leal@gmail.com`). O token permanente é lido de forma segura do banco (`whatsapp_status.access_token`) e **nunca é exposto** ao frontend.
2. **Descoberta do App ID:** Consulta `/app` ou `/debug_token` na Graph API para obter o identificador da aplicação Meta.
3. **Resumable Upload (Passo 1):** Inicia sessão de upload via `POST https://graph.facebook.com/v21.0/{APP_ID}/uploads` informando `file_length`, `file_type` (JPEG/PNG) e `file_name`, retornando o `upload_session_id`.
4. **Envio de Bytes (Passo 2):** Transmite os bytes brutos da imagem via `POST https://graph.facebook.com/v21.0/{upload_session_id}` com header `file_offset: 0`, recebendo o `profile_picture_handle` (`uploadBytesJson.h`).
5. **Atualização do Perfil (Passo 3):** Aplica a imagem no número de atendimento via `POST https://graph.facebook.com/v21.0/{phone_number_id}/whatsapp_business_profile` com payload `{ messaging_product: 'whatsapp', profile_picture_handle }`.
6. **Restrição Oficial sobre Nome de Exibição:** Conforme documentação e política da Meta, o **nome de exibição** não pode ser alterado via API (exige revisão humana e aprovação no WhatsApp Manager). O painel administrativo exibe nota explicativa clara com link para o WhatsApp Manager.
