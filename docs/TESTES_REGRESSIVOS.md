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

## H) Registro de Gasto por Áudio no WhatsApp (Voice Message — Pipeline Multi-Estratégia e Chave STT)

1. **Configuração Prévia da Chave de Transcrição (Exclusivo Admin)**:
   - Faça login como Administrador (`barbara.ferreira.leal@gmail.com`).
   - Acesse `/settings` (Configurações) na seção "Canal Oficial WhatsApp Business (Meta Cloud API)".
   - Localize o card "Chave de Transcrição de Voz / STT (Groq / OpenAI)".
   - **Cenário Sem Chave**: o badge exibe em amarelo "Não configurada" e o badge do canal exibe "Transcrição de Áudio Pendente".
   - Cole a chave de transcrição (ex: chave da Groq obtida em `console.groq.com/keys` no formato `gsk_...` ou chave OpenAI `sk-...`).
   - Clique em **"Salvar Chave"**.
   - **Comportamento Esperado**: toast de sucesso, o campo é limpo e a tela atualiza exibindo o badge verde com check **"Chave de transcrição configurada ✓"** e no cabeçalho **"Transcrição de Áudio Ativa ✓"**. O valor da chave NUNCA é reexibido na interface.

2. **Cenário 1: Com Chave STT Configurada (Transcreve e Registra Automaticamente)**:
   - Abra o WhatsApp no celular com o número cadastrado no Consciente.
   - Grave e envie uma mensagem de voz/áudio dizendo com clareza um gasto: _"gastei 35 reais no almoço"_ (ou _"cinquenta reais no combustível"_).
   - Envie a mensagem de voz para o WhatsApp oficial `+55 11 94998-9868`.
   - **Comportamento Esperado**:
     - O webhook detecta automaticamente a mensagem do tipo `audio` ou `voice`.
     - Dispara imediatamente confirmação de leitura (checks azuis) e ativa o status "digitando..." (três pontinhos) via Meta Status API com custo zero.
     - Baixa o binário de áudio da Meta via Graph API autenticada com o access_token e obtém a URL da mídia via `res.json` do PocketBase JSVM.
     - O hook lê `stt_api_key` de `whatsapp_status` no banco de dados em tempo real e aciona a API de transcrição da Groq (`https://api.groq.com/openai/v1/audio/transcriptions`) com modelo `whisper-large-v3-turbo` (fallback `whisper-large-v3`), multipart/form-data via `$filesystem.fileFromBytes` e `FormData`, `language=pt`, `response_format=json`.
     - Logs estruturados registram cada etapa: URL da mídia obtida (bool), download (bytes), chave presente (bool), tentativa Groq (endpoint, status HTTP) e resultado (primeiros 60 caracteres).
     - Aciona o agente `$ai.agent('financeiro-whatsapp')` com o texto transcrito (ex.: _"gastei 35 reais no almoço"_).
     - Registra a despesa na caixinha correspondente (ex.: Alimentação) com:
       - `amount` em centavos (ex.: R$ 35,00 = `3500` centavos).
       - `source` = `'whatsapp_audio'` (rastreabilidade precisa de áudio).
       - `message_timestamp` preenchido com a data/hora original da mensagem da Meta (ISO).
     - O agente responde cordialmente em menos de 30 segundos confirmando o lançamento, valor consumido e saldo restante da caixinha.

3. **Cenário 2: Sem Chave Configurada ou Falha Inaudível (Contingência Empática)**:
   - Se nenhuma chave de STT estiver configurada ou se o áudio estiver completamente silencioso/com ruído inaudível:
     - O agente envia resposta amigável, honesta e acolhedora pelo WhatsApp sem fingir que entendeu e sem culpar a fala do usuário:
       _"Recebi seu áudio aqui no Consciente! No momento tivemos uma instabilidade na conversão de voz para texto e não consegui ouvir o que você falou. Você pode digitar rapidinho o gasto aqui para mim (ex: "Almoço 35" ou "Mercado 120")? Já registro direto na sua caixinha!"_

4. **Validação no Painel Web e Banco**:
   - Acesse `/transactions` ou o Dashboard:
     - O lançamento aparece com o valor correto (R$ 35,00) e na caixinha correta (Alimentação).
     - Exibe o badge dedicado lilás/índigo **"Áudio WhatsApp"** com ícone de microfone (diferenciado de "Texto WhatsApp" e "Manual").
     - Exibe a **data e hora original da mensagem** (formatada a partir de `message_timestamp`).
   - No banco de dados (`transactions`):
     - `amount`: `3500` centavos.
     - `source`: `'whatsapp_audio'`.
     - `message_timestamp`: string ISO compatível com o timestamp enviado pela Meta.

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

---

## K) Filtro Padrão = Mês Corrente (Dashboard, Transações, Relatórios)

1. **Passo a passo**:
   - Acesse `/transactions`: o filtro de período deve vir por padrão selecionado como "Mês corrente" (do dia 1º até hoje).
   - Acesse `/reports`: o período deve vir selecionado como "Mês corrente".
   - No Dashboard (`/`), os cartões de resumo e progresso de caixinhas agregam os lançamentos do mês corrente.
   - Teste alternar os filtros manualmente para "Últimos 7 dias", "Últimos 30 dias" ou "Todo o histórico": os dados são recalculados conforme a escolha.

---

## L) Figurinhas de Bichinhos nas Caixinhas

1. **Passo a passo**:
   - Acesse `/budgets` ou `/categories`.
   - Abra o formulário de criar ou editar caixinha.
   - Na seleção de ícones, alterne para a aba "🐱 Bichinhos".
   - Escolha uma figurinha (ex.: Gatinho 🐱 ou Cachorrinho 🐶), defina um nome e salve.
   - **Comportamento Esperado**: A figurinha aparece no card de Caixinhas, no Dashboard (progresso e lançamentos recentes), no Extrato de Transações e no modal de Novo Lançamento.

---

## M) Documentação Técnica Visível no Backoffice (/admin/docs)

1. **Passo a passo**:
   - Faça login como Admin (`barbara.ferreira.leal@gmail.com`).
   - No menu lateral ou no botão de Backoffice, clique em "Documentação" (`/admin/docs`).
   - Alterne entre as abas "Arquitetura Técnica" e "Testes Regressivos".
   - Confirme a renderização de títulos, listas, tabelas e blocos de código formatados.
   - Faça logout e tente acessar `/admin/docs` como cliente comum: a tela de Acesso Restrito bloqueia a visualização.

---

## N) Custo Mensal Acumulado por Cliente no Backoffice Admin (/admin) (Item 9 das Prioridades)

1. **Visão Geral e Modelagem de Custos em R$**:
   - Faça login como Admin (`barbara.ferreira.leal@gmail.com`).
   - Acesse `/admin`.
   - **Verificação**: No topo do Backoffice, o card de destaque **"Custo Mensal Acumulado por Cliente"** é exibido com:
     - Badge "Operacional" e texto explicativo com os valores unitários:
       - Áudio WhatsApp: R$ 0,001 (Groq Whisper)
       - Mensagem de IA do agente: R$ 0,02 (resposta gerada)
       - Mensagem ativa/utility: R$ 0,04
       - Mensagens de serviço (leitura/typing): R$ 0
     - 4 cartões de resumo do mês selecionado:
       - **Custo Total Estimado** em R$ (formato R$ 0,0000)
       - **Respostas de IA** (quantidade e subtotal em R$)
       - **Áudios Transcritos** (quantidade e subtotal em R$)
       - **Lançamentos no Mês** (total e divisão texto/áudio)

2. **Ordenação e Tabela de Clientes**:
   - Verifique a tabela de custos:
     - Por padrão, a lista vem **ordenada pelo maior custo estimado primeiro** (decrescente).
     - As colunas exibem: Cliente (nome e email), WhatsApp, Lançamentos (Texto/Áudio com custo individual), Mensagens de IA (quantidade e custo) e Custo Estimado Mês (R$).
     - O clique nas colunas permite inverter a ordenação (ex.: por lançamentos, mensagens de IA ou valor em R$).

3. **Seletor Histórico de Mês de Referência**:
   - No cabeçalho do card de custos, utilize o dropdown "Mês:".
   - Selecione um mês anterior (ex.: mês anterior ao atual).
   - **Verificação**: A tabela e os cartões de resumo recalculam imediatamente os custos para o mês selecionado, sem erros e sem recarregar a página.
   - Alterne de volta para o mês corrente.

4. **Custo Estimado no Detalhe Individual do Cliente**:
   - Na tabela de custos ou na tabela geral de clientes, clique no botão **"Detalhes"** de qualquer cliente.
   - **Verificação**: No topo do modal, antes das abas, é exibido o card destacado **"Custo Estimado no Mês"** com:
     - Valor acumulado em R$ no mês selecionado.
     - Detalhamento de mensagens de IA e lançamentos de áudio/texto.
     - Seletor próprio de mês para auditar meses anteriores do cliente individualmente.

5. **Restrição Estrita de Papel e Segurança**:
   - Faça logout da conta admin e acesse com um usuário comum (ou em aba anônima sem autenticação).
   - Tente requisitar a rota `GET /backend/v1/admin/costs`:
     - **Verificação**: Resposta HTTP `403 Forbidden` com mensagem de acesso restrito.
   - Nenhuma informação de custo ou consumo de clientes é visível para clientes comuns na aplicação.

---

## O) Resumo Visual Padronizado das Caixinhas no WhatsApp (Item 19)

1. **Solicitação de Visão Geral / Resumo das Caixinhas**:
   - Abra o WhatsApp do cliente cadastrado (ou utilize a modal "Testar Mensagem" em Configurações informando o número cadastrado).
   - Envie uma mensagem solicitando o resumo, por exemplo:
     - _"quais são minhas caixinhas?"_
     - _"resumo das minhas caixinhas"_
     - _"como estão minhas caixinhas?"_
     - _"visão geral das caixinhas"_
   - **Verificação de Cabeçalho**:
     - A resposta inicia com: `📊 *Suas Caixinhas — Mês de [Nome do Mês]*`
   - **Verificação de Itens e Barras Visuais**:
     - Cada caixinha do tipo despesa é listada com seu emoji correspondente (ex: 🍽️, 🚗, 🐱, 🏠).
     - Nome da caixinha formatado em negrito (`*Nome*`).
     - Barra de progresso proporcional com 10 caracteres de bloco (`▓▓▓▓░░░░░░`) e percentual de consumo (`XX%`).
     - Linha de valores monetários em formato Real: `Gasto: R$ XX,XX / Teto: R$ YY,YY`.
     - Status amigável de saldo restante: `(Restam R$ ZZ,ZZ)`.
   - **Verificação de Alertas em Destaque**:
     - Caixinha com consumo `>= 80%` e `< 100%`: exibe marcador de atenção `⚠️` no título e aviso `⚠️ *Atenção:* restam R$ ZZ,ZZ`.
     - Caixinha com consumo `>= 100%` (estourada): exibe marcador crítico `🚨` no título e aviso `🚨 *Estourada por R$ WW,WW*`.
   - **Verificação de Rodapé**:
     - Linha divisória `───────────────────────`.
     - `💰 *Total Gasto no Mês:* R$ XX,XX`.
     - `🎯 *Total dos Tetos:* R$ YY,YY`.
     - `✨ *Saldo Restante no Mês:* R$ ZZ,ZZ` ou `🚨 *Estouro Geral no Mês:* R$ WW,WW`.
   - **Verificação de Não-Regressão**:
     - Mensagens de lançamento normal (ex: "almoço 35", "uber 22") continuam sendo registradas normalmente como transações sem ativar a tela inteira de resumo.

---

## P) Atualização da Foto de Perfil do WhatsApp via API no Painel Admin (Item 20)

1. **Acesso Exclusivo à Administração**:
   - Faça login como Administradora (`barbara.ferreira.leal@gmail.com`).
   - Acesse **Configurações** (`/settings`).
   - Role até a seção **"Canal Oficial WhatsApp Business (Meta Cloud API)"**.
   - **Verificação de Visibilidade**:
     - O card **"Foto de Perfil do WhatsApp via API"** é exibido exclusivamente para o perfil de administrador com badge "Meta Resumable Upload".
     - Um cliente comum não tem acesso a essa seção nem visualiza campos técnicos ou botões de upload da Meta.

2. **Nota Explicativa sobre o Nome de Exibição**:
   - Verifique o alerta em destaque amarelo/âmbar:
     - Explica com clareza: _"O nome de exibição que aparece para os clientes não pode ser alterado via API por restrição oficial da Meta — ele exige análise e aprovação humana no WhatsApp Manager... Já a foto de perfil pode ser trocada e atualizada diretamente aqui pelo botão abaixo!"_.
     - Contém link direto para o WhatsApp Manager (`business.facebook.com`).

3. **Seleção e Validação de Imagem**:
   - Clique em **"Escolher Imagem..."**.
   - Selecione um arquivo JPEG ou PNG (até 5MB).
   - **Verificação**:
     - A foto pré-visualizada é exibida no círculo de avatar.
     - Aparece o nome do arquivo, tamanho em KB e os botões **"Atualizar Foto via API"** e **"Cancelar"**.
   - Tente selecionar um arquivo não suportado (ex: .pdf ou .txt): o sistema avisa com toast vermelho de formato inválido.

4. **Envio via Resumable Upload e Resposta Amigável**:
   - Clique no botão verde **"Atualizar Foto via API"**.
   - O botão entra em estado de carregamento com spinner (_"Enviando para a Meta..."_).
   - O backend realiza a autenticação com o token salvo em `whatsapp_status`, cria a sessão de Resumable Upload na Meta, envia os bytes da imagem e aplica no perfil comercial (`whatsapp_business_profile`).
   - **Resultado Esperado**:
     - Em caso de sucesso: Toast verde com mensagem _"Foto atualizada com sucesso — pode levar alguns minutos para aparecer para os clientes."_.
     - Em caso de token não configurado ou rejeição da Meta: Toast vermelho com a mensagem descritiva do erro retornado pela Graph API.
   - **Segurança de Segredos**:
     - O token permanente da Meta permanece 100% restrito ao backend PocketBase e nunca é retornado nem inspecionável na resposta HTTP do navegador.
