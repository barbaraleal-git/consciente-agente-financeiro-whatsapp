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
   - **Fluxo de Mensagem de Áudio / Voice Message (Pipeline Multi-Estratégia)**:
     - **Reconhecimento de voice message**: identifica se `type === 'audio'` ou `type === 'voice'` no payload do WhatsApp.
     - Extrai o `mediaId` do objeto (`msg.audio.id` ou `msg.voice.id`).
     - **Download da mídia pela API da Meta**: consulta a Meta Graph API (`GET https://graph.facebook.com/v21.0/{mediaId}`) autenticando com o token permanente salvo em `whatsapp_status.access_token` para obter a URL temporária de download (`url`). Em seguida, baixa o arquivo de áudio binário utilizando o mesmo header de autorização, preservando os bytes intactos (`res.body` / `res.raw`).
     - **Conversão Base64 e Logs por Etapa**: converte o slice de bytes para Base64 em blocos eficientes via `$security.base64Encode`, registrando logs analíticos detalhados por etapa com prefixo `[whatsapp_bridge] [AUDIO]` (tamanho em bytes, conversão base64 e status HTTP de cada tentativa).
     - **Tentativa 1 (OpenRouter Multimodal com Áudio Base64)**: submete o áudio codificado em base64 com detecção do formato (`ogg`, `mp3`, `wav`, `m4a`) e `input_audio` aos modelos multimodais (`google/gemini-2.0-flash-001`, `google/gemini-flash-1.5`, `openai/gpt-4o-audio-preview`), instruindo retorno estrito do texto falado em pt-BR.
     - **Tentativa 2 (Whisper Multipart FormData via OpenRouter / OpenAI)**: se a tentativa 1 não produzir texto, encapsula os bytes através de `$filesystem.fileFromBytes(audioBytes, 'audio.ogg')` e submete via `multipart/form-data` (`FormData` nativo) aos endpoints `/v1/audio/transcriptions` (`openai/whisper-large-v3`, `whisper-1`) com idioma `pt`.
     - **Tentativa 3 (Fallback OpenAI Whisper Direto)**: caso ainda não transcreva e exista `OPENAI_API_KEY` configurada no ambiente, envia requisição direta ao endpoint da OpenAI (`https://api.openai.com/v1/audio/transcriptions`) com modelo `whisper-1`.
     - **Mensagens Honestas e Claras ao Cliente**: caso a transcrição não produza texto (falha momentânea de rede ou áudio inaudível), o agente envia uma resposta amigável e honesta pelo WhatsApp orientando a digitar o gasto (ex.: "Almoço 35 reais") ou reenviar o áudio, sem fingir que entendeu ou culpar o usuário.
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

- **`whatsapp_status`**: Configuração do canal oficial Meta Cloud API da proprietária.
  - Campos: `owner`, `connected`, `phone_number` (+55 11 94998-9868), `phone_number_id` (1314873981716321), `waba_id` (1888947369148112), `verify_token` (`agente-financeiro`), `access_token` (token permanente da Meta), `last_send_status`, `last_send_error`, `last_send_at`.
  - **ATENÇÃO**: Esta coleção guarda a conectividade da Meta. Nunca deve ter seus registros excluídos.
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
