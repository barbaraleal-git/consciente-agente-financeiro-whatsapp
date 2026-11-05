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

---

## Q) Detalhes por Cliente no Backoffice com Dados Reais (Correção do Item 31)

1. **Acesso ao Detalhe do Cliente no /admin**:
   - Faça login como Administradora (`barbara.ferreira.leal@gmail.com`).
   - Acesse o Backoffice (`/admin`).
   - Localize um cliente com caixinhas configuradas e movimentações (ex.: Barbara Leal ou outro cliente com transações reais).
   - Clique no botão **"Detalhes"**.

2. **Verificação da Aba Caixinhas (Gasto Real vs Teto)**:
   - Abra a aba **"Caixinhas"**:
     - **Verificação**: Os valores de **Teto** e **Gasto no Mês** NÃO estão zerados nem em branco.
     - As caixinhas configuradas do cliente (ex.: Alimentação, Transporte, Moradia, etc.) são listadas com seus nomes, ícones e cores oficiais.
     - O valor do Teto corresponde ao campo `amount` cadastrado para a caixinha.
     - O valor do Gasto reflete a soma real das despesas (`type = 'despesa'`) daquela categoria no mês de referência.
     - A barra de progresso reflete visualmente a proporção gasta em relação ao teto.

3. **Verificação da Aba Transações (Últimas Transações com Valores Reais)**:
   - Abra a aba **"Transações"**:
     - **Verificação**: As últimas transações do cliente são exibidas com valores preenchidos em Real (ex.: `R$ 35,00`, `R$ 120,00`), tipo (despesa/receita), caixinha correspondente, origem (`whatsapp_text`, `whatsapp_audio`, `manual`) e data/hora.
     - Nada aparece zerado ou como `R$ 0,00` indevido quando há transações com valor real.

4. **Verificação da Aba Histórico WhatsApp (Conversas do Agente)**:
   - Abra a aba **"Histórico WhatsApp"**:
     - **Verificação**: O painel exibe as mensagens trocadas entre o cliente e o agente financeiro no WhatsApp (mensagens recebidas `incoming` e enviadas `outgoing` pelo agente), com texto completo e carimbo de data/hora.
     - Em caso de cliente que acabou de interagir ou tem histórico de conversas no agente nativo (`financeiro-whatsapp`), as mensagens são carregadas e renderizadas no diálogo.

---

## R) Upload de Foto de Perfil JPEG Pequeno e Tratamento de Erros da Meta (Correção do Item 36)

1. **Aceitação de Arquivo JPEG Válido Pequeno (ex.: 37.1 KB)**:
   - Acesse `/settings` como Administradora.
   - No card "Foto de Perfil do WhatsApp via API", clique em "Escolher Imagem...".
   - Selecione um arquivo JPEG válido de tamanho reduzido (ex.: 37 KB ou arquivo .jpg/.jpeg padrão).
   - **Verificação**:
     - O arquivo NÃO é rejeitado com a mensagem genérica enganosa de formato ou tamanho.
     - A pré-visualização carrega normalmente e exibe o tamanho real em KB.
     - Ao clicar em "Atualizar Foto via API", o upload é submetido à Meta Graph API.
     - Em caso de sucesso, toast verde confirma a atualização do perfil.

2. **Exibição do Erro Real da Meta Sem Mensagem Enganosa**:
   - Se o token da Meta estiver inválido, expirado ou a Meta recusar por qualquer motivo (ex.: política de imagem ou permissão de WABA):
     - **Verificação**: O alerta vermelho exibe o erro REAL retornado pela Meta (ex.: "Meta recusou a criação da sessão de upload: (...)", "Token inválido ou expirado" ou mensagem específica da Graph API).
     - **NUNCA** é exibida a mensagem enganosa "preciso utilizar uma imagem jpeg ou png de no máximo 5MB" quando o arquivo já cumpria esses requisitos.
   - O token da Meta permanece protegido e nunca é exposto na mensagem nem no console do cliente.

---

## S) Guardrail de Temas do Agente (Item 22)

1. **Tentativa de Conversa Fora do Escopo Financeiro**:
   - Abra o WhatsApp com o agente Consciente ou envie mensagem pelo simulador admin.
   - Envie uma pergunta completamente fora do escopo (ex: _"Quem descobriu o Brasil?"_ ou _"Qual a previsão do tempo para amanhã?"_).
   - **Comportamento Esperado**: O agente responde com gentileza e brevidade explicando que seu foco exclusivo é cuidar das finanças pessoais e das caixinhas, convidando o cliente a registrar um gasto ou consultar o saldo.

---

## T) Gasto Retroativo via WhatsApp e Interface (Item 28)

1. **Envio de Lançamento com Data Passada**:
   - Pelo WhatsApp do cliente, envie: _"Ontem gastei 35 no almoço"_.
   - **Comportamento Esperado**: O agente reconhece a data no passado e registra com o campo \`date\` de ontem e \`is_retroactive = true\`. A resposta empática do agente cita expressamente a data original considerada e o extrato exibe o badge "Retroativo".

---

## U) Cancelar Último Lançamento via WhatsApp (Item 23)

1. **Solicitação de Cancelamento Seguro**:
   - No WhatsApp, envie um gasto: _"Gastei 45 no uber"_.
   - Em seguida envie: _"Cancela o último lançamento"_.
   - O agente solicita confirmação simples: _"Tem certeza que deseja cancelar o lançamento de R$ 45,00? Responda SIM para confirmar"_.
   - Ao responder _"SIM"_, o agente confirma o estorno e o campo \`status\` passa para \`'cancelled'\`.

---

## W) Idempotência do Webhook WhatsApp (Prevenção de Duplicidade por Retry da Meta)

1. **Reenvio de Mensagem por Latência**:
   - O webhook detecta \`wamid\` já processado na coleção \`whatsapp_processed_messages\` e no cache de memória, descartando processamento repetido sem gerar mensagens duplicadas.

---

## V) Totais e Caixinhas Apenas com Transações Ativas (Item 27)

1. **Exclusão Lógica e Recálculo Automático**:
   - Lançamentos cancelados ou excluídos são deduzidos dos totais do Dashboard, Caixinhas e Relatórios imediatamente, ficando disponíveis em Transações para conferência visual.

---

## X) Histórico Visível de Transações Canceladas na Visão do Cliente e Isolamento Estrito de Totais

1. **Visibilidade Imediata de Transações Canceladas**:
   - Na rota \`/transactions\`, o filtro padrão exibe todos os lançamentos cronologicamente com cancelados destacados (badge "Cancelado", texto tachado e opacidade reduzida).

---

## Y) Fallback Inteligente e Diferenciação de Mensagens no WhatsApp (Prevenção de Falso Erro de Gasto)

1. **Mensagens Não-Financeiras (Saudação e Status)**:
   - Em caso de oscilação, perguntas como _"Oi, deu certo?"_ ou saudações nunca recebem erro de gasto, mas mensagens acolhedoras e contextuais.

---

## Z) Edição de Caixinha Existente (Ícone com 3 Abas, Nome, Cor e Teto) em /budgets

1. **Abertura do Modal de Edição de Caixinha Existente**:
   - Acesse a tela de **Caixinhas** (\`/budgets\`).
   - Em qualquer caixinha existente (exemplo: _"Alimentação - VA"_ ou _"Pet"_), clique no botão de **Editar** (ícone de lápis).
   - O modal **"Editar Caixinha"** se abre com categoria selecionada, nome editável, seletor de ícones com 3 abas (**Ícones**, **Emojis** e **🐱 Bichinhos**), seletor de cor, teto (R$) e mês de referência.
2. **Alteração de Ícone, Nome e Cor**:
   - Alterne para a aba desejada (ex.: 🐱 Bichinhos), selecione uma figurinha (Panda, Abelhinha, etc.) e salve.
   - O novo ícone, nome e cor refletem no Dashboard, Caixinhas, Extrato, Modal de Lançamentos e no resumo do WhatsApp.
3. **Zero Regressão**:
   - O teto e o mês de referência são mantidos e salvos perfeitamente.

---

## AA) Fallback Embutido e Resiliente do WhatsApp (Zero Erro de Escopo e Resposta Acolhedora)

1. **Deploy dos Hooks sem Hook Scoping Error**:
   - O deploy de backend (`deploy_backend`) e a inicialização dos hooks do PocketBase ocorrem sem nenhuma falha de escopo Goja (ex.: `Hook scoping error: top-level declaration`).
   - Todas as funções auxiliares de fallback inteligente e tentativas de reconexão residem inline dentro do escopo dos próprios handlers e callbacks ou via `globalThis`.

2. **Resposta Acolhedora em Mensagens Não-Financeiras Durante Falha**:
   - Envie uma mensagem não-financeira como _"Oi"_, _"Olá"_, _"Tudo bem?"_ ou _"Oi, deu certo?"_.
   - Em caso de indisponibilidade ou timeout da IA ou de módulos externos:
     - O Consciente responde com mensagem acolhedora e contextual, cumprimentando e oferecendo ajuda.
     - **Critério Obrigatório**: O agente **NUNCA** responde exigindo valor e categoria (ex.: _"envie o valor e a categoria"_) para conversas comuns ou saudações.

3. **Fallback Correto em Lançamentos Financeiros**:
   - Envie um gasto explícito (ex.: _"Almoço 35"_ ou _"Mercado 120"_).
   - Se a IA estiver inoperante ou sofrer timeout:
     - O fallback orienta educadamente a enviar novamente o valor e a caixinha, preservando a coerência do atendimento financeiro.

4. **Zero Regressão dos Cenários A a Z**:
   - Todos os fluxos de áudio, resumos visuais de caixinhas, filtros de transações, edição com 3 abas de ícones/bichinhos e isolamento de permissões continuam 100% íntegros.

---

## AB) Alinhamento e Match Unificado de Caixinhas entre o WhatsApp e o App (Fonte Única de Verdade)

1. **Contexto e Causa Raiz Solucionada**:
   - No WhatsApp, o usuário pode registrar ou reclassificar lançamentos com categorias semânticas (ex.: _"Alimentação Essencial"_ ou _"Alimentação Não Essencial"_) ou notas direcionando para a caixinha (ex.: _"Alimentação - VA"_ ou _"VR"_).
   - Anteriormente, o resumo do WhatsApp calculava os gastos somando transações vinculadas às caixinhas por aproximação ou notas, enquanto o App exigia igualdade estrita do ID de categoria (`t.category === b.category`). Como resultado, as caixinhas de alimentação apareciam com gastos preenchidos no WhatsApp mas totalmente vazias no App.
   - **Comportamento Unificado**:
     - O matcher unificado em `src/lib/caixinhaMatcher.ts` e `caixinhas_summary_helper.js` agora reconhece consistentemente tanto o vínculo direto por ID, quanto associações semânticas por note/observação (ex.: _"Alimentação - VA"_, _"VR"_, _"VA"_), sufixos característicos e subcategorias contidas no nome da caixinha.

2. **Verificação no App - Tela de Caixinhas (`/budgets`)**:
   - Acesse a tela de **Caixinhas** (`/budgets`).
   - As caixinhas de alimentação com teto definido (ex.: _"Alimentação - VA"_ com teto de R$ 1.000,00 e _"Alimentação - VR"_ com teto de R$ 1.200,00):
     - Mostram exatamente os mesmos valores apurados no resumo do WhatsApp (ex.: **R$ 214,56** de R$ 1.000,00 no VA e **R$ 190,00** de R$ 1.200,00 no VR).
     - Cada cartão de caixinha exibe uma seção expansível/visível de **Lançamentos vinculados** detalhando os gastos pertinentes (ex.: _"Mercado Violeta - R$ 214,56"_ sob a caixinha VA, e _"Rascal - R$ 190,00"_ sob a caixinha VR).

3. **Verificação no Dashboard (`/`)**:
   - Na visão geral do Dashboard, o bloco de Caixinhas do Mês exibe os gastos consumidos e as barras de porcentagem correspondentes aos valores do WhatsApp.
   - Na lista de transações recentes, os lançamentos exibem o nome da caixinha efetiva vinculada e, quando aplicável, o badge de sub-classificação (_"Essencial"_ ou _"Não Essencial"_).

4. **Verificação na Lista de Transações (`/transactions`)**:
   - A listagem de lançamentos identifica claramente a qual caixinha cada transação pertence (ex.: _"Alimentação - VA"_ com badge _"Essencial"_ para Mercado Violeta; _"Alimentação - VR"_ com badge _"Não Essencial"_ para Rascal).

5. **Garantia de Isolamento de Transações Canceladas/Excluídas (Zero Regressão)**:
   - Apenas lançamentos com status ativo (`status === 'active'`) são contabilizados nos totais das caixinhas.
   - Lançamentos cancelados ou excluídos permanecem visíveis para auditoria mas jamais somam nem alteram as barras de progresso.

---

## AC) Parametrização Categoria↔Caixinhas por Cliente (Vínculos N:N) e Zero Regressão

1. **Contexto e Regra de Negócio**:
   - Cada cliente possui realidade financeira e arranjos de benefícios próprios (ex.: VR, VA, Alimentação Essencial, Lazer).
   - O cliente pode decidir livremente quais categorias alimentam quais caixinhas:
     - Uma mesma categoria pode alimentar mais de uma caixinha (ex.: _"Alimentação Essencial"_ soma tanto em _"Alimentação VA"_ quanto em _"Alimentação VR"_).
     - Uma caixinha pode receber lançamentos de múltiplas categorias.
   - Quando o cliente parametriza vínculos para uma caixinha, os lançamentos ativos dessas categorias somam nas caixinhas vinculadas.
   - **Zero Regressão**: Clientes que ainda não configuraram vínculos explícitos continuam com o comportamento padrão anterior (matching por ID de categoria, notas semânticas e sufixos VA/VR) 100% preservado.

2. **Passo a Passo de Verificação no App (/budgets)**:
   - Acesse **Caixinhas** (`/budgets`).
   - Clique em **Editar** em uma caixinha (ex.: _"Alimentação - VA"_).
   - No modal, alterne para a aba **"Categorias Vinculadas"**:
     - O sistema lista todas as categorias disponíveis do cliente (cadastradas + observadas em lançamentos).
     - Marque a categoria _"Alimentação Essencial"_.
     - O aviso explicativo destaca que os lançamentos desta categoria somarão nesta caixinha e que categorias podem alimentar mais de uma caixinha.
     - Clique em **Salvar Caixinha**.
   - Em seguida, edite a caixinha _"Alimentação - VR"_, vá na aba **"Categorias Vinculadas"** e marque também _"Alimentação Essencial"_. Salve.

3. **Verificação de Vínculos e Isolamento de Cancelados**:
   - Desmarque a categoria no modal de edição da caixinha: o vínculo deixa de existir imediatamente.
   - Lançamentos com `status === 'cancelled'` ou `status === 'deleted'` continuam visíveis no extrato mas **NUNCA** entram em nenhuma soma de caixinha.

---

## AD) Escolha Obrigatória de Caixinha e Não Duplicação de Gastos (Item 29 / v0.0.56)

1. **Objetivo do Teste**:
   - Garantir que cada transação conte em no máximo UMA única caixinha, eliminando qualquer duplicação de saldo e respeitando a escolha do cliente.

2. **Cenário 1 — WhatsApp com Categoria Vinculada a Múltiplas Caixinhas**:
   - Certifique-se de que a categoria _"Alimentação Essencial"_ possui vínculos com duas ou mais caixinhas (ex.: _"Alimentação VA"_ e _"Alimentação VR"_).
   - No WhatsApp, envie um gasto: _"Almoço 190 Alimentação Essencial"_.
   - **Comportamento Esperado**:
     - A transação **NÃO** é gravada imediatamente no banco.
     - O contato fica com pendência salva (`pending_caixinha`).
     - A IA responde perguntando em qual caixinha alocar com lista numerada e amigável:
       `Esse gasto de R$ 190,00 entra em qual caixinha?`
       `1️⃣ Alimentação VA`
       `2️⃣ Alimentação VR`
       `Responda com o número ou nome da caixinha.`
   - Responda _"1"_ (ou _"Alimentação VA"_):
     - A IA grava a transação com `budget` apontando para a caixinha escolhida.
     - A IA confirma: `Pronto! Registrei seu gasto de R$ 190,00 na caixinha 🍽️ Alimentação VA!`
     - No resumo visual das caixinhas e no App, o valor de R$ 190,00 aparece **somente** na caixinha _"Alimentação VA"_, sem duplicar na _"Alimentação VR"_.
   - Se o cliente responder algo inválido (ex.: _"batata"_), a IA repete educadamente a pergunta listando as opções disponíveis.

3. **Cenário 2 — WhatsApp com Categoria Vinculada a Uma Única Caixinha**:
   - Configure a categoria _"Transporte"_ com vínculo em apenas uma caixinha: _"Transporte Diário"_.
   - No WhatsApp, envie: _"Uber 25 Transporte"_.
   - **Comportamento Esperado**:
     - A IA grava a transação diretamente com `budget` preenchido para _"Transporte Diário"_.
     - A confirmação informa expressamente a caixinha: `Anotado! Uber de R$ 25,00 na caixinha 🚗 Transporte Diário.`

4. **Cenário 3 — Lançamento Manual no App (TransactionModal)**:
   - Abra o painel web e clique em **"Novo Lançamento"**.
   - Digite valor, descrição e selecione a categoria _"Alimentação Essencial"_ (que possui 2 vínculos).
   - **Comportamento Esperado**:
     - O modal exibe imediatamente um seletor obrigatório: _"Caixinha (obrigatório — categoria vinculada a 2 caixinhas)"_.
     - O botão **"Salvar Lançamento"** fica **desabilitado** até que o usuário clique em uma das caixinhas candidatas.
     - Selecione _"Alimentação VR"_ e clique em Salvar: a transação é criada com o campo `budget` preenchido.
     - A despesa soma exclusivamente na caixinha _"Alimentação VR"_.
   - Ao selecionar uma categoria com vínculo único, a caixinha correspondente é pré-selecionada e um aviso visual indica o direcionamento automático.

5. **Cenário 4 — Cliente Sem Vínculos Parametrizados (Fallback Retrocompatível)**:
   - Para um cliente que não configurou nenhum vínculo na coleção `category_caixinha_links`, envie ou lance um gasto normalmente.
   - O matcher continua aplicando o fallback histórico (matching semântico por categoria / anotação / sufixos) resolvendo para uma única caixinha estável sem quebrar nem exigir fluxo adicional.

6. **Cenário 5 — Isolamento Estrito de Transações Canceladas**:
   - Transações com status `cancelled` ou `deleted` continuam excluídas de qualquer soma de caixinha, dashboard ou resumo de WhatsApp.
