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
   - Dispara imediatamente status de lida e typing indicator ("digitando...").
   - Normaliza o número E.164 (dígitos com DDI 55).
   - Se for Áudio (`type === 'audio'` ou `'voice'`):
     - Baixa a mídia usando o mediaId e o token em `whatsapp_status.access_token`.
     - Transcreve o áudio para texto via API de transcrição integrada.
     - Se o áudio for inaudível ou falhar, envia mensagem amigável solicitando repetição ou digitação.
     - Se transcrito com sucesso, segue o fluxo exatamente igual a uma mensagem de texto.
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
- **`transactions`** (base): Lançamentos financeiros. Campos: `owner`, `description`, `amount` (em **CENTAVOS**), `date`, `category`, `type`, `source` (`whatsapp` | `manual` | `import` | `agent`), `note`.
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

## 4.1. Papéis de Usuário (Cliente vs Administrador) e Backoffice

1. **Separação de Privilégios**:
   - `client` (Padrão): Acesso apenas aos seus próprios dados de caixinhas, transações e perfil. Não tem acesso a telas de infraestrutura nem a endpoints técnicos da Meta.
   - `admin`: Possui visão normal de cliente no app E acesso a:
     - Configurações do canal oficial Meta WhatsApp Business (token, Phone ID, WABA ID, Webhook).
     - Rota `/admin` (Backoffice Operacional) no menu lateral.
2. **Proteção de Endpoints**:
   - Endpoints `/backend/v1/whatsapp/status`, `/token`, `/send-test` e `/contacts` recusam clientes comuns com HTTP 403.
   - Endpoints `/backend/v1/admin/overview`, `/backend/v1/admin/clients/{id}`, `reset-thread` e `toggle-whatsapp` exigem estritamente autenticação de admin.
3. **Backoffice Operacional (/admin)**:
   - Métricas: Total de clientes, ativos (7d/30d), total de transações, conversas no WhatsApp.
   - Tabela de Clientes: Busca por nome/email/telefone, ordenação e status de onboarding/WhatsApp.
   - Detalhe do Cliente: Suas caixinhas (consumido vs teto), últimas 20 transações, situação WhatsApp e histórico recente de conversa.
   - Ações de Suporte: Zerar Fio da Conversa (limpa `thread_id` travado) e Vincular/Desvincular WhatsApp do cliente.

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
