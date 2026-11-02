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

1. **Passo a passo**:
   - Acesse `/assistant`.
   - Digite: `Quanto sobrou na minha caixinha de alimentação?`
   - Envie e observe a resposta em tempo real via streaming.
2. **Comportamento Esperado**:
   - Resposta precisa com o valor correto em reais, citando a caixinha correspondente.

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

## H) Registro de Gasto por Áudio no WhatsApp (NOVO)

1. **Passo a passo**:
   - Abra o WhatsApp no celular com o número cadastrado no Consciente.
   - Grave uma mensagem de voz/áudio dizendo: _"gastei trinta reais no almoço"_ ou _"almoço quarenta e cinco reais"_.
   - Envie a nota de voz para o WhatsApp oficial `+55 11 94998-9868`.
2. **Comportamento Esperado**:
   - O webhook detecta `msg.type === 'audio'` ou `'voice'`.
   - Marca imediatamente como lida e ativa "digitando..." (três pontinhos).
   - Baixa a mídia via Meta Cloud API usando o token em `whatsapp_status.access_token`.
   - Transcreve o áudio para texto.
   - Registra o gasto de R$ 30,00 (3000 centavos) na caixinha de Alimentação.
   - Responde cordialmente confirmando o valor registrado e saldo da caixinha.
   - Caso o áudio seja inaudível ou ruído puro: responde mensagem amigável pedindo para repetir mais perto do microfone ou digitar.

---

## I) Restrição de Visão do Cliente Comum vs Admin (NOVO)

1. **Passo a passo com Cliente Comum (`role: 'client'`)**:
   - Faça login com uma conta de cliente comum (ex.: qualquer usuário que não seja Barbara).
   - Acesse `/settings`: a seção "Canal Oficial WhatsApp Business (Meta Cloud API)", campos de Token, IDs da Meta, Webhook e lista de contatos NÃO devem aparecer.
   - No menu lateral (Sidebar): o item "Backoffice" NÃO deve aparecer.
   - Tente acessar diretamente `/admin`: a tela bloqueia exibindo "Acesso Restrito".
   - Tente chamar diretamente `GET /backend/v1/whatsapp/status`: recebe HTTP 403 Forbidden.
2. **Passo a passo com Administradora (`role: 'admin'`)**:
   - Faça login com `barbara.ferreira.leal@gmail.com` (ou usuário com role `admin`).
   - Acesse `/settings`: a seção do Canal Oficial WhatsApp aparece normalmente com todos os controles.
   - No menu lateral (Sidebar): o item "Backoffice" aparece com ícone de escudo.
   - Acesse `/admin`: a página carrega perfeitamente com métricas, lista de clientes e ferramentas de suporte.

---

## J) Backoffice Administrativo e Ações de Suporte (NOVO)

1. **Visão Geral e Métricas**:
   - Em `/admin`, confira os 4 cartões: Total de Clientes, Clientes Ativos (7d/30d), Total de Transações e Conversas WhatsApp.
2. **Busca e Lista de Clientes**:
   - Digite o nome ou email de um cliente no campo de busca: a tabela filtra instantaneamente.
   - Clique nos cabeçalhos de coluna (Caixinhas, Transações, Cadastro) para ordenar.
3. **Detalhes do Cliente e Suporte**:
   - Clique em "Detalhes" em qualquer cliente da lista.
   - Modal abre com 3 abas: Caixinhas (consumido vs teto), Últimas Transações e Histórico da Conversa WhatsApp.
   - Clique em "Zerar Fio da Conversa": reseta o contexto do agente daquele contato (limpa `thread_id`).
   - Clique em "Desvincular WhatsApp" / "Vincular WhatsApp": atualiza o vínculo do telefone do cliente com feedback imediato.
