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
   - Normaliza o número E.164 (dígitos com DDI 55).
   - Extrai o texto da mensagem (`text.body` ou botões interativos).
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

- **`users`** (auth): Contas de usuários. Campos-chave: `email`, `name`, `phone`, `onboarding_completed`, `verified`.
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

## 6. Procedimento de Zeragem (Runbook de Reset)

Qualquer limpeza de dados para testes do zero deve ser executada exclusivamente pelo script permanente:

```bash
node scripts/reset-dev.js --yes
```

- O script preserva a coleção `whatsapp_status` (token da Meta, IDs do canal e webhook).
- Zera transações, categorias, orçamentos, alertas e import_jobs.
- Zera usuários de teste garantindo que novos registros comecem exatamente como clientes novos.
