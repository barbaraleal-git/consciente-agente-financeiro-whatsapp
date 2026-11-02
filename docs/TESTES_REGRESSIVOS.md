# Roteiro de Testes Regressivos Obrigatório — Consciente

Este roteiro é **obrigatório após qualquer ajuste sistêmico** no Consciente. Nenhuma entrega deve ser considerada concluída sem a validação dos itens essenciais deste documento.

---

## Runbook de Zeragem de Dados de Desenvolvimento

Quando for necessário testar o fluxo de ponta a ponta como um novo cliente:

1. Abra o terminal na raiz do projeto.
2. Execute o dry-run para revisar o que será limpo e verificar a integridade pré-reset:
   ```bash
   node scripts/reset-dev.js
   ```
3. Execute a zeragem efetiva:
   ```bash
   node scripts/reset-dev.js --yes
   ```
4. **O que é preservado**: O canal Meta Cloud API (`whatsapp_status`), tokens permanentes, Phone ID e WABA ID são mantidos intactos.
5. **Passo OBRIGATÓRIO pós-reset de verificação do canal WhatsApp**:
   - Conferir a saída do script: a seção `[TRAVA PÓS-RESET]` deve exibir `Canal Meta Cloud API: ATIVO E INTACTO` e `Token Configurado: SIM`.
   - **Como conferir pelo banco de dados**:
     - Coleção: `whatsapp_status`
     - Verificar que existe 1 registro com:
       - `phone_number`: `+55 11 94998-9868`
       - `phone_number_id`: `1314873981716321`
       - `waba_id`: `1888947369148112`
       - `access_token`: não vazio (token permanente iniciado por `EA...`)
       - `last_send_status`: `meta_token_verified_200` ou `success`
   - **Como conferir pelo painel Web**:
     - Acesse `/settings` > Canal Oficial WhatsApp Business.
     - Confirme que o badge verde **"Token Meta Configurado"** / **"Token Ativo"** está visível.
     - Clique em "Testar Disparo Direto" ou "Testar Mensagem" para atestar a comunicação 200 com a Meta Graph API.
   - **Como conferir via API**:
     - Requisição `GET /backend/v1/whatsapp/status` deve retornar `{ token_configurado: true, owner_connected: true, phone_number_id: "1314873981716321", waba_id: "1888947369148112" }`.

---

## Diagnóstico Rápido: Como Ler os Logs do Webhook

Caso envie uma mensagem no WhatsApp e não receba resposta em até 30 segundos:

1. Acesse o painel de logs do backend (ou `list_logs`).
2. Busque no stream `requests` por `POST /backend/v1/whatsapp/webhook`:
   - Código `200`: Mensagem entregue com sucesso pela Meta.
   - Código `403` ou `500`: Falha de webhook ou rota indisponível.
3. Busque no stream `hooks` pelos prefixos `[whatsapp_bridge]`:
   - `Recebido webhook: from=...`: Confirma que a Meta disparou o evento.
   - `Usuário vinculado para ...`: Mostra se identificou como cadastrado ou visitante.
   - `POST https://graph.facebook.com/...`: Registra a tentativa de envio da resposta.
   - `statusCode=200`: Resposta entregue aos servidores da Meta com sucesso.

---

## Matriz de Execução dos Testes

- **(SEMPRE RODA)**: Itens marcados como obrigatórios em qualquer alteração.
- **(QUANDO ALTERAR)**: Itens executados quando a área específica de telas ou modelos sofrer ajustes.

---

## A) Cadastro, Login e Verificação de Email (SEMPRE RODA)

1. **Passo a passo**:
   - Acesse `/register`.
   - Preencha Nome, Email, WhatsApp com DDD (ex: `(11) 97672-9458`), Senha e Confirmação.
   - Clique em "Criar Conta".
   - Verifique se a tela exibe confirmação sem erros.
2. **Login com Olhinho**:
   - Acesse `/login`.
   - Digite a senha e teste o ícone de olho para exibir/ocultar caracteres.
   - Entre na conta e confirme que redireciona para `/onboarding` (se novo) ou `/` (se concluído).
3. **Verificação no Banco**:
   - `collection: users, filter: email = 'seu_email@dominio.com'`
   - Conferir se `phone` foi gravado com os dígitos limpos.

---

## B) Onboarding das Caixinhas (SEMPRE RODA)

1. **Passo a passo**:
   - Em `/onboarding`, marque categorias sugeridas (ex: Alimentação, Transporte, Moradia).
   - Defina os tetos mensais em reais (ex: Alimentação R$ 1.200,00).
   - Clique em "+ Criar caixinha personalizada":
     - Nome: `Viagem a Paris`
     - Ícone: avião / mala
     - Cor: azul / violeta
     - Teto: R$ 3.000,00
   - Clique em "Concluir e Começar".
2. **Comportamento Esperado**:
   - Redireciona para o Dashboard (`/`).
   - Caixinhas aparecem na tela de Orçamentos (`/budgets`) com os valores configurados.
3. **Verificação no Banco**:
   - `collection: users` → `onboarding_completed: true`
   - `collection: categories` → Registros com `owner = user.id`
   - `collection: budgets` → Registros com `amount` em centavos (ex: 120000 para R$ 1.200,00).

---

## C) Lançamento de Gasto via WhatsApp Real (SEMPRE RODA)

1. **Passo a passo**:
   - Abra o WhatsApp no seu celular e inicie conversa com `+55 11 94998-9868`.
   - Envie: `100 no Cabana Burger` ou `gastei 122 reais no restaurante Jojo`.
2. **Comportamento Esperado**:
   - Em menos de 30 segundos, o agente responde cordialmente como Consciente confirmando o registro da despesa de R$ 100,00 (ou R$ 122,00) na caixinha de Alimentação.
   - A resposta informa o quanto já foi consumido da caixinha no mês e o saldo restante.
   - **NÃO** deve pedir para "finalizar cadastro".
3. **Verificação no Painel e Banco**:
   - Atualize `/transactions`: o lançamento aparece com fonte `WhatsApp`, valor R$ 100,00 e categoria Alimentação.
   - `collection: transactions`: `amount` deve ser `10000` (centavos), nunca `100`.

---

## D) Caixinhas e Alertas (80% / 90%) (QUANDO ALTERAR CAIXINHAS)

1. **Passo a passo**:
   - Lance gastos sucessivos até ultrapassar 80% do teto da caixinha (ex: gastar R$ 1.000 em uma caixinha de R$ 1.200).
2. **Comportamento Esperado**:
   - O agente responde com aviso empático de que a caixinha está próxima do limite.
   - Um alerta é registrado no sino de notificações do painel web (`/alerts`).
3. **Verificação no Banco**:
   - `collection: alerts, filter: owner = 'user_id' && type = 'budget'`

---

## E) Assistente e Chat no Painel Web (QUANDO ALTERAR IA/ASSISTENTE)

1. **Visão do Cliente Comum (`role: 'client'`)**:
   - Acesse `/assistant` logado como cliente comum.
   - **Verificação**: O card "Canal WhatsApp Real" ou qualquer aviso técnico de conector/canal **NÃO APARECE**.
   - O cliente vê exclusivamente o chat do assistente e, na coluna lateral, o card funcional de transferência de histórico (`.txt`) e status de importações.
   - Digite: `Quanto sobrou na minha caixinha de alimentação?`
   - Envie e observe a resposta em tempo real via streaming.

2. **Visão do Administrador (`role: 'admin'`)**:
   - Acesse `/assistant` logado como administrador.
   - **Verificação**: Na coluna lateral, o card "Canal WhatsApp Oficial" é exibido com o badge "Apenas Admin".
   - O número exibido é o real **+55 11 94998-9868** (vindo dinamicamente de `whatsapp_status`).
   - O status indica "Conectado via Meta Cloud API" (quando `token_configurado` ou `owner_connected` for true), com badge "Ativo" e link direto para Configurações.
   - Nenhuma referência ao número fictício `98765-4321` ou à palavra "conector" aparece.

3. **Transferência de Histórico do WhatsApp**:
   - Envie um arquivo `.txt` exportado do WhatsApp.
   - O upload cria um job em `import_jobs`, que é processado em segundo plano categorizando as despesas e criando os registros em `transactions` via hook backend.

---

## F) Emails Transacionais com Marca Consciente (QUANDO ALTERAR AUTH/EMAILS)

1. **Passo a passo**:
   - Em `/forgot-password`, solicite recuperação de senha para seu email.
2. **Comportamento Esperado**:
   - O email recebido traz o remetente e título "Consciente - Seu parceiro nas finanças".
   - Não contém menções à marca legada "Eleva" nem à palavra "Skip".

---

## G) Infraestrutura e Webhook da Meta (SEMPRE RODA)

1. **Verificação de Webhook Challenge**:
   - Dispare GET em `/backend/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=agente-financeiro&hub.challenge=teste123`.
   - Resposta esperada: `200` com corpo `teste123`.
2. **Disparo de Teste no Painel (Admin)**:
   - Acesse `/settings` como admin > Canal Oficial WhatsApp Business.
   - Clique em "Testar Mensagem" e envie para o número do celular de teste.
   - Confirme recebimento no celular e status `success` no painel.

---

## H) Registro de Gasto por Áudio no WhatsApp (Voice Message)

1. **Passo a passo**:
   - Abra o WhatsApp no celular com o número cadastrado no Consciente.
   - Grave uma mensagem de voz/áudio dizendo com clareza um gasto: _"gastei trinta reais no almoço"_ ou _"cinquenta reais no combustível"_.
   - Envie a mensagem de voz para o WhatsApp oficial `+55 11 94998-9868`.
2. **Comportamento Esperado**:
   - O webhook detecta automaticamente a mensagem do tipo `audio` ou `voice`.
   - Dispara imediatamente confirmação de leitura (checks azuis) e ativa o status "digitando..." (três pontinhos).
   - Baixa o arquivo de áudio pela Meta Cloud API autenticando com o token em `whatsapp_status.access_token`.
   - Transcreve o áudio para texto via inteligência artificial.
   - Aciona o agente `$ai.agent('financeiro-whatsapp')` com o texto transcrito.
   - Registra o gasto com o **valor correto em centavos** (ex.: R$ 30,00 = `3000` centavos) e vinculado à **caixinha correta** (ex.: Alimentação ou Transporte).
   - O agente responde em menos de 30 segundos confirmando o lançamento, o valor consumido no mês e o teto restante da caixinha.
   - **Caso de Exceção (Áudio inaudível / Ruído)**:
     - Envie um áudio em silêncio ou com sopro inaudível.
     - O agente responde de forma empática e amigável pedindo para repetir gravando mais próximo ao microfone ou para digitar a mensagem.
3. **Validação no Painel e Banco**:
   - Acesse `/transactions`: o lançamento consta com o valor exato, categoria correta e fonte `WhatsApp`.
   - No banco (`transactions`): conferir que `amount` está em centavos.

---

## I) Restrição de Visão: Conta Cliente vs Conta Admin

1. **Teste com Conta Cliente Comum (`role: 'client'`)**:
   - Faça login com qualquer usuário de teste com papel de cliente comum (ex.: usuário criado em `/register`).
   - Acesse `/settings` (Configurações):
     - **Verificação**: A seção "Canal Oficial WhatsApp Business (Meta Cloud API)", campos de Token, IDs da Meta (Phone ID, WABA ID), Webhook URL e contatos técnicos **NÃO APARECEM**.
     - O cliente só enxerga seus dados pessoais (Nome, Email, Telefone, Senha).
   - Acesse `/assistant` (Assistente):
     - **Verificação**: Nenhum card de canal WhatsApp ou status de conector é exibido para o cliente comum. Apenas o chat e a ferramenta de histórico.
   - Observe o Menu Lateral (Sidebar):
     - **Verificação**: O item "Backoffice" **NÃO APARECE**.
   - Tente navegar manualmente digitando `/admin` na URL do navegador:
     - **Verificação**: Acesso é imediatamente bloqueado, exibindo a tela de alerta "Acesso Restrito: Esta área é restrita a administradores do Consciente." com botão para voltar ao início.
   - Tente realizar requisição direta à API: `GET /backend/v1/whatsapp/status`:
     - **Verificação**: Responde com código HTTP `403 Forbidden`.

2. **Teste com Conta Administradora (`role: 'admin'`)**:
   - Faça login com a conta da dona do produto (`barbara.ferreira.leal@gmail.com`) ou conta com `role: 'admin'`.
   - Acesse `/settings`:
     - **Verificação**: A seção técnica "Canal Oficial WhatsApp Business (Meta Cloud API)" aparece com todos os dados: status de conexão, badge "Token Meta Configurado", Phone Number ID, WABA ID, Webhook URL e ferramenta de disparo de teste.
   - Observe o Menu Lateral (Sidebar):
     - **Verificação**: O item "Backoffice" com ícone de escudo é exibido com destaque.
   - Acesse `/admin`:
     - **Verificação**: A página carrega perfeitamente com todas as métricas, lista de clientes e ferramentas de suporte.

---

## J) Backoffice Administrativo (/admin) e Ações de Suporte

1. **Métricas e Contagens Globais**:
   - Acesse `/admin` logado como admin.
   - Verifique se os 4 cartões de indicadores carregam números reais do banco:
     - Total de Clientes cadastrados.
     - Clientes Ativos (últimos 7 dias e últimos 30 dias).
     - Total de Transações registradas.
     - Conversas / Contatos ativos no WhatsApp.

2. **Listagem e Busca de Clientes**:
   - Na tabela de clientes, teste o campo de busca:
     - Digite parte do nome, email ou telefone de um cliente existente: a tabela filtra em tempo real.
     - Limpe a busca: a lista completa retorna.
   - Teste a ordenação clicando nas colunas (Nome, Cadastro, Caixinhas, Transações): a lista reordena crescentemente/decrescentemente.
   - Observe os badges de status de cada cliente: Onboarding (Concluído/Pendente), WhatsApp (Vinculado/Pendente) e Papel (Admin/Cliente).

3. **Detalhe do Cliente**:
   - Clique no botão "Detalhes" de um cliente na lista.
   - O modal de detalhes abre carregando os dados do cliente em 3 abas:
     - **Aba Caixinhas**: lista as caixinhas do cliente com valores consumidos no mês vs teto estipulado e barra visual de progresso.
     - **Aba Transações**: lista as últimas transações com valor formatado em R$, data, caixinha e origem.
     - **Aba Histórico WhatsApp**: exibe o número de telefone vinculado, data do último contato, total de mensagens e histórico de mensagens trocadas.

4. **Ação de Suporte: Zerar Fio de Conversa**:
   - No modal de detalhes do cliente (ou no menu de ações), clique em **"Zerar Fio da Conversa"**.
   - Confirme a ação no diálogo de segurança.
   - **Comportamento Esperado**: Notificação toast verde de sucesso confirmando que o fio da conversa foi resetado. No banco, o campo `conversation_id` do contato é limpo para destravar o agente.

5. **Ação de Suporte: Desvincular / Vincular WhatsApp**:
   - No modal de detalhes do cliente com WhatsApp vinculado, clique em **"Desvincular WhatsApp"**.
   - Confirme: o telefone é desvinculado e o badge muda para "Não vinculado".
   - Clique em **"Vincular WhatsApp"** e informe/confirme o número com DDD: o telefone é vinculado com sucesso.
