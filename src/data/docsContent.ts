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
     - **Leitura da Chave de STT (\`stt_api_key\`) do Banco**: o hook consulta dinamicamente a coleção \`whatsapp_status\` pelo campo \`stt_api_key\` configurado pela admin em Minha Conta. Se presente, utiliza a chave primária; se ausente, faz fallback para variáveis de ambiente (\`GROQ_API_KEY\`, \`OPENAI_API_KEY\`, \`OPENROUTER_API_KEY\`).
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
     - Vê: Dashboard, Caixinhas, Extrato de Transações, Categorias, Relatórios e Minha Conta (Perfil/Senha).
     - **Não vê dados técnicos**: canal WhatsApp, token de acesso, Phone ID, WABA ID ou webhook URL.
     - **Não vê rota de Backoffice**: barrado com mensagem amigável de Acesso Restrito em \`/admin\`.
   - **Administrador (\`admin\`)**:
     - Conta da dona do produto (\`barbara.ferreira.leal@gmail.com\`) promovida automaticamente.
     - Vê dados técnicos em Minha Conta (\`/settings\`), aviso oficial no Assistente (\`/assistant\`) e acesso ao Backoffice (\`/admin\`) e Documentação Técnica.

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

---

## 6. Correções e Robustez Sistêmica (v0.0.39)

- **Item 31 (Backoffice - Detalhes do Cliente)**: Mapeamento corrigido para utilizar \`amount\` nos tetos de caixinhas e nas transações, com cálculo real de gastos no mês selecionado e recuperação do histórico da conversa via \`$ai.agent('financeiro-whatsapp')\`.
- **Item 36 (Upload de Imagem de Perfil)**: Validação ampliada e tolerante no frontend/backend para imagens JPEG/PNG (aceitando variações de MIME e extensões) e propagação do erro real da Meta sem mascarar com mensagem genérica de formato ou 5MB.
`

export const BACKLOG_MARKDOWN = `# Backlog / Pendências — Consciente (Seu parceiro nas finanças)

Documento oficial de controle de pendências e prioridades do produto (itens históricos 1 a 37 + novos itens 37 a 44 trazidos pela usuária; lista reorganizada por similaridade temática e renumerada como Itens 1 a 30 nas seções pendentes, com a referência antiga preservada em cada linha — ex-Item N). Este documento serve como guia estratégico para os próximos passos de evolução, mantido e reavaliado a cada ciclo de desenvolvimento.

**Regra Permanente**: Zero regressão. Tudo o que já foi validado e entregue deve obrigatoriamente se manter estável a cada nova iteração.

---

## Legenda de Status

- **Concluído**: Funcionalidade ou correção entregue, testada e validada em produção.
- **Respondido / Aguardando Decisão**: Dúvida ou definição já esclarecida tecnicamente; não há pendência de código imediata ou aguarda direcionamento estratégico de negócio.
- **Backlog**: Item pendente de desenvolvimento, reclassificado por esforço/velocidade de entrega.

---

## 1. Itens Concluídos

> Os itens concluídos mantêm sua numeração histórica original. O pedido de parametrização de categorias por caixinhas trazido pela usuária (ex-Item 40 — novo) já está contemplado na entrada **"Parametrização Categoria↔Caixinhas por Cliente (Vínculos N:N Personalizados)"** abaixo, sem item duplicado.

| Item / Funcionalidade | Descrição / Detalhes | Status |
| :--- | :--- | :--- |
| **Áudio no WhatsApp** | Transcrição de mensagens de voz (STT) com pipeline multi-estratégia (Groq Whisper large-v3-turbo / large-v3 com chave dinâmica lida do banco e fallback OpenAI Whisper), conversor Base64 puro em JS, tratamento empático de inaudível e registro em centavos na caixinha correta. | **Concluído** |
| **Rastreabilidade de origem dos lançamentos** | Identificação precisa da origem da despesa (\`whatsapp_text\`, \`whatsapp_audio\`, \`manual\`, \`import\`) com preservação em \`message_timestamp\` da data/hora exata do envio original na Meta e badges visuais dedicados no extrato e dashboard. | **Concluído** |
| **Separação de visões cliente × admin** | Isolamento estrito de permissões: cliente comum não vê dados técnicos (Meta token, Phone ID, WABA ID, Webhook) e tem acesso barrado no backoffice. Administradora (\`barbara.ferreira.leal@gmail.com\`) com privilégios completos. | **Concluído** |
| **Backoffice /admin** | Painel operacional completo com métricas globais da base, clientes ativos (7d/30d), total de transações, conversas no WhatsApp, lista paginada com busca em tempo real, ordenação dinâmica, modal de detalhe por cliente e ações de suporte. | **Concluído** |
| **Item 5: Documentos visíveis no /admin/docs** | Disponibilização da especificação de Arquitetura Técnica (\`docs/ARQUITETURA.md\`), Roteiro de Testes Regressivos (\`docs/TESTES_REGRESSIVOS.md\`) e Backlog de Pendências diretamente na tela de documentação para administradores. | **Concluído** |
| **Item 9: Custo mensal acumulado por cliente no backoffice** | Painel de custos operacionais detalhado no \`/admin\` com modelagem em R$ (R$ 0,001 áudio Groq, R$ 0,02 IA, R$ 0,04 utility), seletor de histórico de meses, cartões de consolidação mensal e exibição no detalhe individual do cliente. | **Concluído** |
| **Item 12: Figurinhas de bichinhos nas caixinhas** | Aba dedicada com figurinhas de animais (Gatinho 🐱, Cachorrinho 🐶, Patinhas 🐾, Ursinho 🐻, Panda 🐼, Coala 🐨, Leão 🦁, Coelhinho 🐰, Raposa 🦊, Pinguim 🐧, etc.) disponíveis na criação de caixinhas, refletidas em Caixinhas, Dashboard, Extrato e Modais. | **Concluído** |
| **Item 13: Filtro padrão = mês corrente nas telas** | Telas de Transações, Dashboard e Relatórios iniciam automaticamente filtradas pelo mês corrente (1º dia até a data atual), com seletor flexível para outros períodos. | **Concluído** |
| **Item 16: Correção do bug do backoffice (erro 500)** | Resolução definitiva da falha no endpoint \`/backend/v1/admin/overview\` com consultas seguras em \`whatsapp_contacts\` sem dependência de tabelas inexistentes. | **Concluído** |
| **Item 19: Resumo visual das caixinhas no WhatsApp** | Resumo padronizado com barras em caracteres de bloco proporcionais (\`▓▓▓▓░░░░░░\`), percentual de consumo, cabeçalho ("📊 *Suas Caixinhas — Mês de [Mês]*"), rodapé com saldo/estouro consolidado e marcadores automáticos (\`⚠️\` para ≥80% e \`🚨\` para estouro). | **Concluído** |
| **Item 20: Foto de perfil do WhatsApp via API (admin)** | Capacidade de atualizar o avatar oficial do número de atendimento diretamente pela tela Minha Conta (\`/settings\`) via Resumable Upload da Meta API e \`whatsapp_business_profile\`, com nota explicativa sobre o nome de exibição. | **Concluído** |
| **Item 31: Bug do Backoffice — Detalhes por cliente zerados/em branco** | **BUG CORRIGIDO**: O endpoint \`/backend/v1/admin/clients/:id\` calculava caixinhas a partir de campos inexistentes (\`limit_cents\` em vez de \`amount\`) e não calculava o gasto real do mês. Além disso, as transações buscavam \`amount_cents\` e o histórico de mensagens buscava apenas em tabela não utilizada. Corrigido com agregação real de transações do mês vs teto, mapeamento de \`amount\` e leitura do histórico ativo de mensagens do agente via \`$ai.agent('financeiro-whatsapp')\`. | **Concluído** |
| **Item 31 (v0.0.110): Importar preços da Stripe como rascunhos pendentes de vigência** | **FUNCIONALIDADE ENTREGUE**: botão "Importar preços da Stripe" no Backoffice (Billing → Planos e Preços) chama a rota \`POST /backend/v1/admin/billing/stripe/import-prices\` (hook \`billing_stripe.js\`, \`$http.send\` com Bearer da secret key de \`stripe_config\`), que lista os Prices ativos do produto Consciente na API da Stripe e grava cada um como linha RASCUNHO em \`subscription_plans\` (\`active = false\`, sem \`valid_from\`/ \`valid_until\`, \`stripe_price_id\` preenchido, label com valor em R$ e periodicidade). Dedupe por \`stripe_price_id\` em TODAS as linhas (ativas ou não): Price já presente na tabela é contado como "já existente" e nunca duplica — o toast de resumo mostra "X importados, Y já existentes". O rascunho aparece destacado em ÂMBAR com badge "Rascunho — defina a vigência", fica FORA da oferta pública (não entra no checkout) e fora da checagem de vigência (hook ignora linhas inativas) até a dona definir vigência/plan_type e ATIVAR. | **Concluído** |
| **Item 36: Bug do Upload de Foto de Perfil — Rejeição de JPEG pequeno com mensagem enganosa** | **BUG CORRIGIDO**: Causa raiz identificada e resolvida: o runtime JSVM (Goja) do PocketBase não populava \`findUploadedFile\` em chamadas multipart do browser, deixando \`fileBytes\` vazio e disparando a mensagem 400 antes de chegar à Meta. O frontend (\`finance.ts\`) agora converte a imagem para Base64/JSON antes do envio e o backend decodifica de forma segura via \`$security.base64Decode\`, com descoberta dinâmica de App ID e upload direto na Meta Graph API. A mensagem genérica foi removida e qualquer retorno da Meta é exibido com seu motivo real. | **Concluído** |
| **Item 22: Guardrail de temas do agente** | Regras estritas de moderação no system prompt do agente (\`financeiro-whatsapp\`) para declinar educadamente assuntos fora de finanças pessoais (ex.: "Quem descobriu o Brasil?") e conduzir o cliente de volta com foco e empatia. | **Concluído** |
| **Item 23: Cancelar/substituir lançamento** | Fluxo conversacional seguro de cancelamento via WhatsApp: cliente pede para cancelar ("cancela o último", "apaga esse lançamento"), o agente solicita confirmação simples ("Tem certeza que deseja cancelar o lançamento de R$ X? Responda SIM para confirmar"), e após "SIM" atualiza o status para \`cancelled\`. Transação cancelada é excluída dos totais e do saldo. | **Concluído** |
| **Item 27: Deleção lógica com status e histórico visível** | Implementado campo \`status\` (\`active\`, \`cancelled\`, \`deleted\`) na coleção de transações com backfill retrocompatível idempotente. Deleções no painel e cancelamentos no WhatsApp são puramente lógicos para auditoria e histórico de segurança. Na listagem de Transações do cliente (\`/transactions\`), o filtro padrão exibe todos os lançamentos (ativos + cancelados), com canceladas visualmente diferenciadas (badge "Cancelado", texto tachado e opacidade) para dar segurança e transparência imediata ao cliente de que o cancelamento foi atendido. REGRA ABSOLUTA: totais, somatórias, gráficos e métricas de todas as telas (Transações, Dashboard, Caixinhas, Relatórios e Backoffice) consideram estritamente lançamentos \`active\`. | **Concluído** |
| **Item 28: Gasto retroativo (lado do agente)** | Capacidade do agente interpretar datas passadas na fala ou texto ("ontem gastei 35", "terça gastei 50"), registrar com o campo \`date\` correspondente e \`is_retroactive = true\`. A confirmação do agente menciona explicitamente a data original e a interface exibe o badge "Retroativo". | **Concluído** |
| **Idempotência de Webhook WhatsApp (Meta retry)** | Proteção estrita contra retries automáticos da Meta (>5s): deduplicação por \`wamid\` (message_id) em memória rápida com TTL e persistência na coleção \`whatsapp_processed_messages\`. Evita mensagens duplicadas ou falsas rejeições de duplicidade. | **Concluído** |
| **Garantia de Integridade de Status e Retroativo** | Hook \`transactions_integrity.js\` garante que toda transação nasça com \`status='active'\` e tenha \`is_retroactive=true\` sempre que a data informada diferir do dia da mensagem. Proteção de deleção lógica definitiva. | **Concluído** |
| **Tratamento de Fallback Inteligente e Resiliência de IA/Áudio** | Correção do bug de mensagens não-financeiras ("Oi, deu certo?") recebendo erro de gasto. Diferenciação contextual entre mensagens de gasto, conversas/dúvidas e saudações; timeouts ajustados de áudio (12s) para não acumular fila; e carregamento resiliente de módulos auxiliares (\`reliability_helper\` e \`caixinhas_summary_helper\`) em ambientes isolados do Goja JSVM. | **Concluído** |
| **Edição Completa de Caixinha (/budgets e /categories)** | Conclusão do modal "Editar Caixinha" em \`/budgets\` e \`/categories\` permitindo que o cliente altere o ícone/figurinha com 3 abas completas (**Ícones**, **Emojis** e **🐱 Bichinhos** com todos os bichinhos oficiais: Gatinho, Cachorrinho, Patinhas, Ursinho, Panda, Coala, Leãozinho, Coelhinho, Raposa, Tigrinho, Pinguim, Corujinha, Borboleta, Abelhinha etc.), o nome e a cor da caixinha, preservando integralmente o teto e o mês de referência. As alterações refletem em tempo real no Dashboard, Caixinhas, Extrato, Modal de Lançamentos e no resumo visual do WhatsApp. | **Concluído** |
| **Resiliência do Agente WhatsApp e Correção de Mensagens Duplicadas/Oscilação** | Resolução da oscilação momentânea e mensagens repetidas no WhatsApp: fallback inteligente embutido diretamente inline nos callbacks do hook (\`whatsapp_bridge.js\`), eliminando declarações de escopo superior sujeitas a \`Hook scoping error\`. Até 3 tentativas com backoff progressivo na invocação do agente nativo \`$ai.agent\` e resposta acolhedora humanizada para saudações e conversas, sem falsos pedidos de valor e categoria em falhas externas. | **Concluído** |
| **Match e Alinhamento de Caixinhas App × WhatsApp (Fonte Única de Verdade)** | Resolução da inconsistência reportada pela usuária em que caixinhas de alimentação apareciam com os gastos corretos no WhatsApp mas zeradas no App. Implementação de lógica unificada em \`caixinhaMatcher.ts\` e \`caixinhas_summary_helper.js\`: além da igualdade estrita de ID de categoria, o sistema suporta associação semântica via \`note\` (ex.: *"caixinha Alimentação - VA"* ou *"VR"*), sufixos característicos e subcategorias contidas no nome da caixinha. Dashboard, Caixinhas e Extrato refletem com precisão os lançamentos vinculados e badges de sub-classificação (*"Essencial"* / *"Não Essencial"*), mantendo isolamento absoluto de lançamentos cancelados/excluídos. | **Concluído** |
| **Parametrização Categoria↔Caixinhas por Cliente (Vínculos N:N Personalizados)** | Atendimento ao pedido da usuária: o próprio cliente define quais categorias de lançamentos podem ser consideradas em quais caixinhas (ex.: *"Alimentação Essencial"* alimentando tanto a caixinha *Alimentação VR* quanto *Alimentação VA*; *"Alimentação Não Essencial"* em *VR* e em *Lazer*). Modelada nova coleção idempotente \`category_caixinha_links\`, aba *"Categorias Vinculadas"* no modal de edição de caixinhas (\`/budgets\`), matcher unificado (\`caixinhaMatcher.ts\` e \`caixinhas_summary_helper.js\`) com fallback retrocompatível de zero regressão para clientes sem vínculos e isolamento total de cancelados. **Registro**: atendido e reconfirmado como ex-Item 40 (novo) da lista da usuária — sem item duplicado. | **Concluído** |
| **Indicador visual coerente quando a assinatura está Cancelada (ex-Item 43 — novo, v0.0.97)** | O escudo da tela Minha Conta (\`/settings\`) nunca mais fica verde quando a assinatura está cancelada: com status \`cancelado\` e \`access_until\` futuro, o indicador vira **ShieldAlert âmbar** com badge "Cancelada" (amber-100/800) e o bloco âmbar **"Cancelada — acesso garantido até DD/MM/AAAA"**. Assinatura ativa e trial permanecem verdes (zero regressão); cancelada sem acesso (período encerrado) fica cinza-slate neutro. | **Concluído** |
| **Teste de Eco no WhatsApp (ex-Item 39 — novo, v0.0.98)** | **Escopo definido e implementado**: comando de diagnóstico \`#eco\` ou \`/eco\` (ex.: \`#eco olá isso é um teste\`) interceptado no webhook REAL do WhatsApp logo após a resolução de identidade/persistência da mensagem e ANTES da chamada à IA. O agente devolve a MESMA mensagem de volta confirmando o caminho completo (recebimento pela Meta → persistência por wamid → envio pela Meta Graph API), SEM consumir IA, mantendo deduplicação por wamid, rate limit e demais interceptações intactas. Mesma interceptação espelhada no \`/simulate\` do Backoffice (resposta no simulador + envio remoto quando habilitado) e log de diagnóstico \`[ECO]\` nos hooks. | **Concluído** |
| **Lembrete Noturno Amigável via WhatsApp (ex-Item 38 — novo, v0.0.99)** | **Lembrete noturno proativo implementado**: rotina agendada diária às 20h30 BRT (\`cronAdd proactive_nightly_reminder\`) que monitora clientes ativos (assinatura ativa, trial ou cancelada com vigência futura). Se a pessoa não tiver nenhum lançamento de gasto no dia corrente (fuso de Brasília, \`America/Sao_Paulo\`), o sistema envia uma mensagem amigável via WhatsApp perguntando se está tudo bem e se realmente não tem gastos para lançar ou se gostaria de aproveitar e lançar agora. Clientes que já lançaram no dia NÃO recebem. Mensagens iniciadas fora da janela de 24h usam o template Meta utility \`lembrete_noturno_lancamento\`; dentro da janela de 24h usa texto amigável ou template com fallback inteligente. Deduplicação estrita na coleção \`proactive_logs\` (chave \`user:nightly_reminder:YYYY-MM-DD\`) garante zero duplicatas no mesmo dia. Canceladas sem vigência, expiradas e inadimplentes são barradas. Rotas admin \`/backend/v1/proactive/status\` e \`/trigger-nightly\` com dry-run para auditoria e teste operacional. | **Concluído** |
| **E-mail de Aviso Pré-Cobrança (ex-Item 42 — novo, v0.0.99)** | **Aviso pré-cobrança recorrente implementado**: rotina agendada diária às 09h00 BRT (\`cronAdd proactive_precharge_email\`) que monitora assinaturas mensais recorrentes ativas com cartão (\`stripe_subscription_id\` ativo). Calcula janelas exatas de 3 dias e 1 dia antes da próxima data de cobrança (\`current_period_end\` sincronizado da Stripe ou \`subscription_expires_at\` do cadastro). Envia e-mail em HTML responsivo com tom empático Consciente informando plano ("Plano Mensal Consciente"), valor (R$ 19,90), data exata da cobrança e link direto para a tela Minha Conta para gestão de faturas ou cancelamento sem atrito. Deduplicação atômica em \`proactive_logs\` (\`user:precharge_3d:YYYY-MM-DD\` / \`user:precharge_1d:YYYY-MM-DD\`). Blindagem estrita: clientes no Plano Anual à vista (pagamento único via Pix/cartão, v0.0.95), contas canceladas, expiradas, em trial ou sem cobrança futura NUNCA recebem e-mail. Rotas admin \`/trigger-precharge\` e \`/test-email\` disponíveis para validação operacional. | **Concluído** |
| **Comunicação proativa de Renovação Pix 30d/7d (ex-Item 15b — novo, v0.0.101)** | **Aviso de renovação do plano anual à vista implementado**: rotina agendada diária às 10h30 BRT (\`cronAdd proactive_pix_renewal\`) que monitora clientes com plano anual PAGO À VISTA (\`billing_mode = one_time\`, Pix ou cartão, validade de 12 meses) cuja data de validade (\`payment_paid_at\` + 12 meses / \`access_until\`) está a exatamente 30 dias e a 7 dias de expirar. Envia AVISO DUPLO por e-mail (HTML responsivo com branding Consciente, valor do plano, data da validade e botão/link direto para \`/settings?section=assinatura\`) e mensagem amigável no WhatsApp convidando à renovação. Deduplicação RÍGIDA em \`proactive_logs\` (\`renewal_30d:<user_id>:<data>\` / \`renewal_7d:<user_id>:<data>\`) — nunca duplica no mesmo dia. Blindagem ABSOLUTA: clientes com assinatura recorrente ativa (\`stripe_subscription_id\` presente) NUNCA recebem — a renovação deles é automática. Falha de SMTP/envio de e-mail é registrada sem travar o job. Rotas admin de trigger manual com \`dry_run: true\` (lista quem receberia sem enviar) e \`/status\` para auditoria. Também corrige o carregamento do engine proativo nos crons (require → fallback globalThis) e o bug \`res.rawText\` no envio WhatsApp. | **Concluído** |
| **Escolha Obrigatória de Caixinha / Regra de Não Duplicação (v0.0.56)** | **REGRA DE OURO ATENDIDA**: Cada transação ativa soma em exatamente UMA única caixinha, nunca duplicando valores no histórico nem em novos gastos. Se a categoria tem múltiplas caixinhas vinculadas: no WhatsApp, a IA suspende a gravação, pergunta em qual caixinha deseja registrar numerando as opções amigavelmente e grava na caixinha escolhida após a resposta do cliente; no App (\`TransactionModal.tsx\`), o sistema exige a seleção obrigatória da caixinha antes de salvar. Se houver vínculo único, grava direto e informa. Se não houver vínculos, mantém fallback retrocompatível estável. Campo \`budget\` em \`transactions\` e \`pending_caixinha\` em \`whatsapp_contacts\`. | **Concluído** |
| **Remanejamento de Caixinha no App e Paridade WhatsApp vs. App (v0.0.57)** | **NOVO RECURSO + BUGFIX**: O cliente pode editar qualquer transação existente de despesa em \`/transactions\` e remanejar para qualquer caixinha do mês (ou desvincular para "Automático / Sem caixinha fixa"). Ao salvar, o valor sai imediatamente da caixinha anterior e entra na nova caixinha, mantendo zero duplicação e exclusão de cancelados. Corrigida a paridade de visualização de caixinhas entre o App (\`/budgets\`) e o resumo do WhatsApp adicionando os vínculos reativos de \`userLinks\` nas dependências do \`useMemo\` de \`budgetStats\` em \`Budgets.tsx\` e \`Dashboard.tsx\`. | **Concluído** |
| **Persistência Obrigatória de Budget no WhatsApp e Paridade Total App × WhatsApp (v0.0.58)** | **BUGFIX CRÍTICO DE PARIDADE**: Corrigida a causa raiz da divergência entre a resposta conversacional do WhatsApp e a tela \`/budgets\` do App. Em todos os caminhos de criação no WhatsApp (texto, áudio, fluxo conversacional de desambiguação e hook \`transactions_integrity.js\`), a caixinha decidida/anunciada é imediatamente persistida no campo \`budget\` de \`transactions\`. Backfill idempotente executado (migração 0031) garantindo que transações ativas antigas com budget vazio tenham o campo preenchido fielmente pelo resolver determinístico único, corrigindo os lançamentos Mercado Violeta e Rascal para 100% de paridade e mantendo isolamento de cancelados. | **Concluído** |
| **Desacoplamento e Autonomia Total das Caixinhas (v0.0.59)** | **AUTONOMIA TOTAL DAS CAIXINHAS**: Remoção completa do conceito de "categoria da caixinha" (\`category\` em \`budgets\`). Caixinhas passam a ser 100% autônomas com nome, figurinha (ícones, emojis ou bichinhos), cor e teto próprios. O modal de criar e editar caixinha (\`/budgets\`) foi totalmente limpo, eliminando seletor de categoria e ramificações. Gastos alimentam a caixinha unicamente via campo gravado \`budget\`, vínculos parametrizados (\`category_caixinha_links\`) ou matching inteligente. Zero regressão na regra de ouro (cada lançamento conta em no máximo 1 caixinha e cancelados são excluídos). | **Concluído** |
| **Resumo de Caixinhas no WhatsApp 100% Determinístico da Base (v0.0.62/v0.0.66)** | **BUGFIX DEFINITIVO DE INTERCEPTAÇÃO**: Correção cirúrgica da interceptação do resumo determinístico no webhook do WhatsApp. O bloco de checagem e montagem chamava \`caixinhasEngine\` não declarada no escopo local, gerando ReferenceError engolido que desviava a mensagem para o \`$ai.agent\`. Corrigido para invocar as funções locais estritas (\`localIsCaixinhasOverviewIntent\`, \`localBuildCaixinhasSummaryForUser\` e \`localBuildCaixinhasContextPrompt\`) 100% embutidas no corpo do callback do webhook sem require. Resumo das caixinhas ativas e contexto anti-alucinação funcionando de forma determinística direta da base. | **Concluído** |
| **Desambiguação e Escolha de Caixinha Inline no WhatsApp (v0.0.69)** | **FLUXO CONVERSACIONAL 100% INLINE**: Implementação e embutimento completo do fluxo de escolha de caixinha (\`localHandleCaixinhaFlow\`, \`localTryParseSpendingExpense\`, \`localGetCandidateBudgetsForCategory\`) 100% inline no callback do webhook e da rota \`/simulate\` sem dependência de require(). Quando um gasto pertence a categoria com 2+ caixinhas ativas vinculadas, a gravação é pausada, o bot envia a pergunta numerada (1️⃣ Caixinha A / 2️⃣ Caixinha B) e salva o estado em \`pending_caixinha\`. Ao receber "1", "2" ou o nome da caixinha, a transação é gravada (em centavos, active, com budget vinculado), confirmando valor e saldo restante do teto. Categorias com vínculo único gravam direto sem pergunta. Integridade protegida em \`transactions_integrity.js\`. | **Concluído** |
| **Desambiguação de Categoria em 2 Níveis no WhatsApp (v0.0.71)** | **PERGUNTA DE CATEGORIA ANTES DA CAIXINHA (NÍVEL 1)**: Implementação embutida e rígida no webhook do WhatsApp para desambiguação de categorias com similaridade concorrente (ex.: "Padaria" casando tanto com "Alimentação Essencial" quanto com "Alimentação Não Essencial"). O matcher coleta todas as categorias candidatas empatadas no score máximo. Se houver 2+, suspende o registro e pergunta amigavelmente com numeração (1️⃣/2️⃣) e salva em \`pending_category\`. Após a resposta do cliente, emenda diretamente no fluxo de caixinha: se a categoria escolhida tiver 2+ caixinhas ativas, pergunta a caixinha (Nível 2); se tiver vínculo único, grava direto e confirma o teto; se tiver 0 caixinhas, encaminha para fallback. Resumo determinístico e cenários A–AJ mantidos 100% íntegros. | **Concluído** |

---

## 2. Respondido / Aguardando Decisão

| Item | Tópico | Posição Técnica / Status Atual | Status |
| :--- | :--- | :--- | :--- |
| **Item 1 (ex-Item 2)** | Impacto do áudio no custo | **Respondido**: O custo de transcrição de áudio via Groq Whisper large-v3-turbo é de cerca de **R$ 0,001 por áudio** (frações mínimas de centavo), sendo considerado desprezível no custo unitário por cliente. | **Respondido/Aguardando decisão** |
| **Item 2 (ex-Item 4)** | Previsão de custo por cliente/mês | **Respondido**: Modelo unitário calibrado e auditável no backoffice (áudio R$ 0,001, IA R$ 0,02, utility R$ 0,04, mensagens de serviço R$ 0,00). Custo médio estimado entre R$ 1,50 e R$ 3,50/cliente/mês dependendo do engajamento. | **Respondido/Aguardando decisão** |
| **Item 3 (ex-Item 21)** | Cyber security | **Processo contínuo**: Aplicação das melhores práticas (mascaramento estrito de tokens, endpoints protegidos por papéis, validação de payload da Meta, SSL forçado e políticas de acesso). Continua como rotina permanente de segurança. | **Respondido/Aguardando decisão** |
| **Item 4 (ex-Item 35)** | Campo de nome social no cadastro | **Respondido**: Não é obrigatório (LGPD minimiza coleta de dados). O agente utiliza o nome informado no cadastro e usa o nome de perfil do WhatsApp (\`Profile.Name\` enviado pela Meta) como fallback automático empático. Caso desejado futuramente, um campo opcional "Como prefere ser chamada(o)?" pode ser adicionado no perfil sem bloqueio de código. **Sem pendência de código no momento**. | **Respondido/Aguardando decisão** |
| **Item 5 (ex-Item 41 — novo)** | Bloqueio de exclusão de mensagens no WhatsApp pelo cliente | **Respondido**: Não é possível bloquear — a exclusão de mensagens é ação do aparelho/aplicativo do próprio cliente, fora do alcance de qualquer API. O que o Consciente garante é que todo o histórico de mensagens recebidas e enviadas fica preservado na base própria (coleção de conversas/mensagens do agente, visível no Backoffice em **Histórico WhatsApp** do detalhe do cliente) para auditoria, independentemente de o cliente apagar as mensagens no app dele. | **Respondido/Aguardando decisão** |
| **Item 6 (ex-Item 44 — novo)** | Cancelamento da assinatura anual no meio da vigência (multa?) | **Respondido**: A partir da v0.0.95 a assinatura anual é **PAGAMENTO ÚNICO** (Pix ou cartão à vista, validade +12 meses), sem assinatura recorrente na Stripe — não existe "cancelar no meio da vigência" nem cobrança futura a interromper; o cliente pagou e usa os 12 meses inteiros. A questão de multa fica **sem objeto**. Se um dia o caminho recorrente anual for reativado, a decisão de política (prorrogação de acesso vs. créditos vs. multa) é decisão de negócio da usuária. | **Respondido/Aguardando decisão** |

---

## 3. Backlog (Pendentes — Reorganizados por Similaridade Temática)

> **Renumeração**: A lista completa foi reorganizada por temas e renumerada sequencialmente (Itens 1 a 6 na seção Respondido e Itens 7 a 30 aqui), preservando em cada linha a referência do número antigo ("ex-Item N"). Para não colidir com o ex-Item 37 histórico (Tarifas), os novos itens 37 a 44 da usuária aparecem como "ex-Item 37 (novo)" a "ex-Item 44 (novo)". O ex-Item 40 (novo) foi para Concluídos e os ex-Itens 41 e 44 (novos) para Respondido/Aguardando Decisão.

### (a) Comunicação proativa com o cliente via WhatsApp
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 7 (ex-Item 3)** | Mensagem da manhã via WhatsApp | Envio pró-ativo matinal com status financeiro e lembrete de gastos. **Dependência**: Requer modelo de mensagem (utility template) aprovado pela Meta no WhatsApp Manager. |
| **Item 8 (ex-Item 38 — novo) → MOVIDO PARA CONCLUÍDOS (v0.0.99)** | ~~Lembrete noturno de lançamento~~ | Atendido na v0.0.99: monitoramento diário da base ativa (ativa, trial ou cancelada com vigência futura), verificação de gastos no dia (fuso BRT) e envio automático via WhatsApp às 20h30 BRT com template Meta utility (\`lembrete_noturno_lancamento\`), fallback para texto quando dentro da janela de 24h, deduplicação em \`proactive_logs\` e rotas de teste/diagnóstico para admin. Ver tabela de Concluídos e Cenário AO. |
| **Item 9 (ex-Item 32)** | Rotina de fechamento de mês via WhatsApp | Visão geral do fechamento mensal das caixinhas, parabenizando o empenho ou incentivando caso tenha estourado, com oferta de ajuda para planejar o mês seguinte. **Sinergia**: Mesma infraestrutura de job agendado e aprovação de template Meta dos Itens 7 (ex-Item 3) e 8 (ex-Item 38), aproveitando a formatação visual do Item 19 (concluído). |
| **Item 10 (ex-Item 26)** | Feedbacks via WhatsApp + alerta imediato | Canal conversacional para o cliente enviar sugestões e elogios, gerando alerta imediato para a administradora. |

### (b) Billing e financeiro
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 11 (ex-Item 43 — novo) → MOVIDO PARA CONCLUÍDOS (v0.0.97)** | ~~Indicador visual coerente quando a assinatura está Cancelada~~ | Atendido na v0.0.97: escudo ShieldAlert âmbar + badge "Cancelada" em \`/settings\` quando status cancelado com acesso futuro; ativa e trial seguem verdes. Ver tabela de Concluídos. |
| **Item 12 (ex-Item 24)** | Billing + dashboard de assinaturas | Módulo financeiro de cobrança e controle de planos pagos/recorrentes. **Status**: Implementado com integração DIRETA à API Stripe via \`$http\` (sem dependência de conectores Skip, padrão Meta Cloud API). Parametrização no Backoffice Admin (\`stripe_config\`: secret key mascarada, webhook signing secret whsec, price IDs mensal/anual). **Pendente**: usuária colar a secret key (\`sk_live_...\`), o whsec e os price IDs na sub-seção "Configuração Stripe" do Backoffice e validar um pagamento real ponta a ponta (ver cenário AL). |
| **Item 13 (ex-Item 34)** | Billing: visão acumulada de custos vs faturamento bruto | No módulo de billing, exibir a visão comparativa acumulada de custos operacionais da infraestrutura (Meta + Groq + IA) versus faturamento bruto (receita líquida até o momento). **Sinergia**: Complementa diretamente o Item 12 (ex-Item 24) e se alimenta da modelagem de custos do Item 9 (concluído). |
| **Item 14 (ex-Item 37)** | Billing próprio — tela de tarifas ajustáveis no backoffice | Hoje os custos de fornecedores estão fixos em real cravados no código (áudio R$ 0,001 por transcrição, mensagem de IA R$ 0,02, utility R$ 0,04). Na fase de escala, criar tela de 'Tarifas' no backoffice para ajustar esses valores (e eventual conversão de câmbio) sem mexer em código. Faz parte do módulo de billing, que tem duas faces: billing dos clientes (assinatura/trial — o que eles pagam) e billing próprio (o que pagamos aos fornecedores). **Status**: Backlog — fase de escala. **Sinergia**: Complementa os Itens 9 (concluído), 12 e 13. |
| **Item 15 (ex-Item 42 — novo) → MOVIDO PARA CONCLUÍDOS (v0.0.99)** | ~~E-mail de aviso pré-cobrança (3 dias e 1 dia antes)~~ | Atendido na v0.0.99: envio automático diário às 09h00 BRT com aviso de 3 dias e 1 dia antes da renovação da assinatura mensal recorrente com cartão, template HTML responsivo Consciente, deduplicação em \`proactive_logs\` (cliente + kind + data) e proteção estrita: plano anual à vista (pagamento único), canceladas, trial e expiradas NUNCA recebem. Ver tabela de Concluídos e Cenário AP. |
| **Item 15b (ex-Item 42 — novo, renovação Pix) → MOVIDO PARA CONCLUÍDOS (v0.0.101)** | ~~Comunicação proativa de renovação Pix (30 e 7 dias antes da validade)~~ | Atendido na v0.0.101: rotina agendada diária às 10h30 BRT (\`cronAdd proactive_pix_renewal\`) que avisa clientes do plano anual à vista (\`billing_mode=one_time\`) com validade a exatamente 30 e 7 dias de expirar, por E-MAIL (HTML Consciente, link \`/settings?section=assinatura\`) E WhatsApp amigável. Dedupe rígido em \`proactive_logs\` (\`renewal_30d:<user>:<data>\` / \`renewal_7d:<user>:<data>\`) e blindagem: clientes com assinatura recorrente ativa (\`stripe_subscription_id\`) NUNCA recebem — a renovação deles é automática. Falha de SMTP/WhatsApp não trava o job. Rotas admin \`/trigger-pix-renewal\` (com dry_run) e \`/status\`. Ver tabela de Concluídos e Cenário AQ. |
| **Item 32 (novo)** | Sincronização App → Stripe parte obrigatoriamente de "Planos e Preços" | Sincronização App → Stripe deve partir **OBRIGATORIAMENTE** dos dados da tela **"Planos e Preços"** (fonte única de gestão). Eliminar os price_ids soltos da tela **"Configuração Stripe"** (\`price_id_mensal\`, \`price_id_anual_recorrente\` e o legado \`price_id_anual\`), pois só geram confusão — o sync deve parear por \`stripe_price_id\` das linhas de plano. **Sinergia**: corrige os fallbacks do sync de produtos citados no Item 12 (ex-Item 24) e alinha-se à importação de Prices como rascunhos (Item 31, v0.0.110), tornando \`subscription_plans\` a única fonte de verdade dos preços. |

### (c) Suporte e relacionamento
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 16 (ex-Item 25)** | Módulo de suporte | Central de tickets e atendimento integrado para clientes solicitarem ajuda à equipe humana do Consciente. Complementado pelo Item 17 (ex-Item 30). **Complexidade**: Média. |
| **Item 17 (ex-Item 30)** | Alerta ao admin a cada abertura de pedido de suporte | Notificação automática (email/alerta) para a administradora ao abrir ticket. **Complexidade**: Rápida execução. **Sinergia**: Complementa o Item 16 (ex-Item 25, suporte) e compartilha a infraestrutura de alerta imediato do Item 10 (ex-Item 26). |

### (d) Qualidade, testes e infraestrutura
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 18 (ex-Item 37 — novo)** | Agente de testes regressivos automatizado (WhatsApp + app + iOS) | Como automatizar os testes regressivos simulando um usuário de teste no WhatsApp e também navegando no app? Avaliar construir um agente (ou similar) que execute essa automação — a usuária possui um número de teste gerado pela própria Meta, que pode ser usado por esse agente de testes no WhatsApp. **Complexidade**: Maior / infraestrutura. **Nota técnica (iOS)**: como não há iPhone físico para teste, avaliar serviços de teste em dispositivos reais na nuvem (dispositivos iOS remotos) para validar o funcionamento do app no iOS. |
| **Item 19 (ex-Item 39 — novo) → MOVIDO PARA CONCLUÍDOS (v0.0.98)** | ~~Teste de Eco~~ | Atendido na v0.0.98 com escopo definido: comando de diagnóstico \`#eco\`/\`/eco\` que valida ponta a ponta o caminho do webhook (recebimento Meta → persistência wamid → envio Meta Graph API) SEM consumir IA; também disponível no \`/simulate\` do Backoffice. Ver tabela de Concluídos. |
| **Item 20 (ex-Item 29)** | Teste de carga | Arquitetura do teste de carga já formulada (simulação concorrente no webhook e no pipeline do agente) para validação de volume antes do lançamento comercial aberto. **Status**: definição pronta (era Respondido/Aguardando decisão); permanece pendente de execução. |
| **Item 21 (ex-Item 7)** | Observabilidade | Painel de telemetria em tempo real com alertas de indisponibilidade do webhook, Meta API ou provedores de IA. |
| **Item 22 (ex-Item 15)** | Backup automatizado da base | Rotina automatizada e versionada de snapshots do banco em produção. |
| **Item 23 (ex-Item 8)** | GitHub e controle de versão | Sincronização externa de repositório e esteira de CI/CD (ação da usuária para provisionamento de chaves/repositório). |
| **Item 31 (novo, v0.0.103) → MOVIDO PARA CONCLUÍDOS (v0.0.110)** | ~~Importar preços da Stripe como rascunhos pendentes de vigência~~ | Atendido na v0.0.110: botão "Importar preços da Stripe" no Backoffice chama a rota \`POST /backend/v1/admin/billing/stripe/import-prices\` e traz os Prices da conta Stripe (produto Consciente) como RASCUNHOS (\`active = false\`, sem vigência, destacados em âmbar) para definição de vigência/\`plan_type\` antes de ativar na tabela \`subscription_plans\`, com dedupe por \`stripe_price_id\` (Price já presente nunca duplica). Ver tabela de Concluídos e Cenário AS. |

### (e) Produto / Caixinhas
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 24 (ex-Itens 10+11)** | Lançamento sem caixinha | Tratamento conversacional de despesas que não se enquadram nas caixinhas existentes: agente sugere alocar em "Outros" ou criar nova caixinha. **Complexidade**: Média. |
| **Item 25 (ex-Item 33)** | Controle de vigência de caixinhas por mês | Permitir que o cliente tenha conjuntos distintos de caixinhas a cada mês (ex.: Mês 1 com Alimentação/Transporte/Moradia; Mês 2 sem Moradia, com Pets). **Novo item de modelo de dados**: requer campo de vigência/validade mensal (\`valid_from\` / \`valid_until\` ou budgets isolados por mês). **Sinergia**: Itens 26 (ex-Item 6, investimento) e 24 (ex-Itens 10+11, sem caixinha). Esforço médio-alto. |
| **Item 26 (ex-Item 6)** | Regras de investimento | **Explicadas**: Regras conceituais e diferenciação entre reserva de emergência, aportes e metas foram explicadas. **Pendente decisão** sobre formato da caixinha de investimento (se terá teto reverso ou meta de acúmulo). **Status**: movido do Respondido para o tema Produto/Caixinhas — aguarda só a decisão de negócio. |

### (f) Onboarding, segurança e plataforma
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 27 (ex-Item 1)** | E-mail de confirmação obrigatório | Exigir verificação estrita de e-mail antes da liberação total de acessos críticos na plataforma web. **Complexidade**: Rápida execução. |
| **Item 28 (ex-Item 17)** | PWA instalável no celular | Manifesto web, service worker e suporte a instalação como Progressive Web App em iOS e Android com ícone Consciente. Complementa o Item 18 (ex-Item 37 — novo, testes em dispositivos iOS remotos). |
| **Item 29 (ex-Item 18)** | Captcha no cadastro | Proteção contra cadastros automatizados (bots) na tela de registro com hCaptcha/Turnstile. |
| **Item 30 (ex-Item 14)** | Portal de Planejadores Financeiros | Painel dedicado para planejadores credenciados acompanharem clientes mediante termo de consentimento LGPD explícito. |
`

export const TESTES_REGRESSIVOS_MARKDOWN = `# Roteiro de Testes Regressivos Obrigatório — Consciente

Este roteiro é **obrigatório após qualquer ajuste sistêmico** no Consciente. Nenhuma entrega deve ser considerada concluída sem a validação dos itens essenciais deste documento. Mantém todos os cenários essenciais A a Z intactos e adiciona o cenário AA para o fallback embutido e resiliente no WhatsApp sem erros de escopo.
> **Atualização v0.0.102**: MAPEAMENTO DEFINITIVO dos 4 Prices da Stripe via API (produto prod_Va2uSpOiSeedcC): R$ 19,90/mês → \`price_1UZ11R31gAsdzIHftUWaEJB0\`; R$ 29,90/mês → \`price_1UZ11Q31gAsdzIHfLP1oZJKS\`; R$ 214,90/ano ("Por ano") → \`price_1UZ11Q31gAsdzIHfGEinrGPA\`; R$ 322,90/ano ("Por ano") → \`price_1UZ11O31gAsdzIHfNapN7q6b\`. Migração 0045 corrigiu as 4 linhas de \`subscription_plans\` (linhas de valor PADRÃO apontavam para os price_ids PROMOCIONAIS) e preencheu \`stripe_config.price_id_anual_recorrente\`. O price_id_anual confirmado NÃO é o mensal bugado da v0.0.95 — é o Price anual "Por ano" correto. Também mantém: correção do carregamento do engine proativo nos crons (require() → fallback globalThis) e do bug \`res.rawText\` (v0.0.101); crons \`proactive_nightly_reminder\`, \`proactive_precharge_email\` e \`proactive_pix_renewal\` rodando sem "GoError: Invalid module".
> **Atualização v0.0.103**: novo hook de integridade de vigência de planos no Backoffice (\`subscription_plans_vigencia.js\`, Billing → Planos): sobreposição de vigências do MESMO plan_type rejeitada, \`valid_until <= valid_from\` rejeitado, trilhas mensal/anual independentes, janelas em sequência permitidas (janelas semiabertas [from, until)) e linhas inativas/overrides fora da checagem. Novo cenário **AR — Virada de Vigência de Plano (regra AG)** e linha de vigência no bloco AL.
> **Atualização v0.0.104**: fim do "Something went wrong" no Backoffice: a rota admin de salvar planos repassa o BadRequestError do hook de vigência (HTTP 400 com a mensagem amigável) e o Frontend extrai a mensagem real do corpo da resposta (message/error/data) — o toast exibe o erro em português citando plano e período; validação continua bloqueando o salvamento do plano conflitante.
> **Atualização v0.0.105**: validação de vigência movida para DENTRO da rota admin de salvar planos (checagem inline antes do $app.save — o hook de coleção sozinho não barrava o salvamento pela rota; reproduzido por teste HTTP real: POST sobreposto → 400 em português, nada gravado). Coluna Stripe da aba Assinaturas dos Clientes não exibe mais "Sem assinatura Stripe" para pagamento único (one_time Pix/cartão) — exibe "Pagamento único (Pix/cartão)"; endpoint de assinaturas agora expõe billing_mode/payment_amount_cents/payment_paid_at/access_until.
> **Atualização v0.0.106**: correção do caminho de erro da validação de vigência — a rota admin \`POST /backend/v1/admin/billing/plans\` repassa o status e a mensagem originais do hook (HTTP 400 em português citando plano e período) e o frontend extrai a mensagem real do corpo da resposta com \`getBackendErrorMessage\` (message/error/data, sem prefixo GoError, bloqueando o genérico "Something went wrong" do SDK) em todos os toasts de erro do Backoffice.
> **Atualização v0.0.107**: regra de VIGÊNCIA INCLUSIVA nas duas pontas — a comparação de sobreposição foi corrigida de \`<\` para \`<=\`: nem a data de início nem a data de fim de vigências do MESMO plan_type podem coincidir (termina 01/12 + começa 01/12 = CONFLITO rejeitado com 400; termina 30/11 + começa 01/12 = OK, exige 1 dia de folga entre janelas consecutivas). Migração 0046 encurtou a vigência da linha promocional para terminar 30/11/2026, alinhando os dados à regra. Teste real reproduzido via API HTTP autenticada: mensal e anual com fronteira igual → 400 com mensagem amigável; janela válida → 200.
> **Atualização v0.0.108**: fronteira inclusiva COMPROVADA via API real no backend vivo — sobreposição no MESMO dia rejeitada com 400 e mensagem amigável (trilhos mensal e anual); rótulo do Backoffice "Pagamento único (Pix/cartão)" substituindo o resíduo "Sem assinatura Stripe" para clientes com \`billing_mode = one_time\`. Auto-teste temporário de vigência (cron \`vigencia_selftest\`, rota de diagnóstico \`test-vigencia\`, migração 0051 e usuário de teste) removido na v0.0.109 — a regra permanece 100% na rota POST e no hook de coleção.
> **Atualização v0.0.110**: nova funcionalidade **Importação de Preços da Stripe como Rascunhos** (Billing → Planos e Preços): botão "Importar preços da Stripe" traz os Prices da conta Stripe como linhas rascunho (\`active = false\`, sem vigência, destaque âmbar), com dedupe por \`stripe_price_id\` (os 4 Prices reais jamais duplicam — aparecem como "já existentes"). Rascunho fica fora da oferta pública e fora da checagem de vigência até definir vigência/plan_type e ativar. Novo cenário **AS — Importação de Preços da Stripe**.
> **Atualização v0.0.111**: refinamentos do Backoffice Billing (Billing → Planos e Preços e Configuração Stripe): (1) tooltips nos botões "Importar preços da Stripe" (Stripe → App) e "Sincronizar produtos na Stripe" (App → Stripe); (2) botão **Salvar** de cada Price só habilita com alteração real na linha (dirty-save, volta a desabilitar após salvar); (3) **Histórico por plano**: nova coleção \`subscription_plans_audit\` (migração 0052) + rota \`GET /backend/v1/admin/billing/plans/history\` — botão "Histórico" por linha abre dialog com ação (criado/editado/vigência definida/importado), campo alterado com valor anterior → novo, autor e data/hora; (4) campos de Price ID da Configuração Stripe auditados contra o código: \`price_id_mensal\` e \`price_id_anual_recorrente\` são lidos pelo sync de produtos (fallback), \`price_id_anual\` confirmado LEGADO (nunca lido). Novo cenário **AT — Tooltips, Dirty-Save e Histórico de Preços**.
> **Atualização v0.0.116**: **Crons Proativos Blindados contra Ordem de Carregamento da JSVM** — os logs de cron em produção mostravam os jobs de e-mail pré-cobrança (12h) e aviso de renovação Pix (13h30) ABORTANDO com "engine indisponível — job abortado": o orquestrador resolvia \`globalThis.__proactiveEngine\`, mas ela não estava disponível no pool no momento do disparo (mesma família do bug v0.0.115). Correção (padrão v0.0.116): os 3 crons proativos movidos para o orquestrador \`pocketbase/hooks/proactive_crons.js\` com resolução DEFENSIVA (typeof + try) e FALLBACK 100% INLINE idêntico à engine por job (pré-cobrança: busca de ativos + janelas 3d/1d + dedupe em \`proactive_logs\` + envio de e-mail; renovação Pix: one_time anual + janelas 30d/7d + e-mail + WhatsApp com fallback de template; lembrete noturno 20h30: idem). Horários, rotas de trigger/dry-run e coleções INALTERADOS. Removido o cron residual \`CRON_VERIFY_DECODER\` (resquício de diagnóstico que rodava dentro do budget-check a cada hora desde antes da v0.0.109) — o budget-check segue criando alertas de caixinha normalmente.
> **Atualização v0.0.115**: reparo do toast de erro do cenário AU — a prova real da dona exibiu o erro CRU da JSVM ("Erro ao salvar plano — Object has no member '__vigenciaCobertura'") em vez da mensagem amigável em português: a chamada \`globalThis.__vigenciaCobertura(...)\` na rota admin dependia de ordem de carregamento de hooks (globalThis não compartilhado com segurança entre módulos/pools da JSVM). Correção: consumidores resolvem a função de forma DEFENSIVA (typeof + try) com FALLBACK 100% inline da mesma lógica; caminho de erro devolve sempre 400/500 com mensagem em PT; \`getBackendErrorMessage\` restaurada em \`src/lib/pocketbase/errors.ts\` (build quebrava com MISSING_EXPORT); hook de referência renomeado para slug válido (deploy falhava: "invalid slug"). Prova por API real: POST com buraco (05/12 após 30/11) → 400 em PT citando o intervalo; vigências contíguas → 200.
> **Atualização v0.0.114**: **Cobertura Contínua de Vigências por Trilha** (Billing → Planos e Preços, pedido da dona): da data corrente em diante, nenhuma data futura pode ficar sem plano ativo definido — o salvamento de plano simula a linha de vigências ativas de cada trilha (mensal e anual separadamente) e rejeita com 400 qualquer lacuna de datas ≥ 1 dia citando o intervalo sem cobertura; a trilha precisa sempre terminar numa linha aberta (valid_until vazio). Rascunhos da importação da Stripe continuam fora da checagem até serem ativados. Nova rota de diagnóstico \`GET /backend/v1/admin/billing/plans/coverage\` (admin). Novo cenário **AU — Cobertura Contínua de Vigências por Trilha**.

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

---

## O) Resumo Visual Padronizado das Caixinhas no WhatsApp (Item 19)
1. **Passo a passo**:
   - Abra o WhatsApp do cliente cadastrado ou acione o modal "Testar Mensagem" em Minha Conta.
   - Envie uma mensagem como *"quais são minhas caixinhas?"* ou *"resumo das minhas caixinhas"*.
   - **Comportamento Esperado**:
     - A resposta inicia com o cabeçalho padronizado: \`📊 *Suas Caixinhas — Mês de [Mês]*\`.
     - Cada caixinha ativa é exibida com seu emoji, nome em negrito, barra de 10 blocos proporcionais (\`▓▓▓▓░░░░░░\`), percentual de consumo e valores (\`Gasto: R$ X / Teto: R$ Y\`).
     - Caixinhas com consumo >= 80% recebem marcador \`⚠️\` e caixinhas estouradas recebem \`🚨\` com valor excedente.
     - Linha divisória e rodapé com total gasto, total dos tetos e saldo restante no mês.
     - Lançamentos normais de despesa (ex: "almoço 35") continuam sendo registrados sem regressão.

---

## P) Atualização da Foto de Perfil do WhatsApp via API no Painel Admin (Item 20)
1. **Passo a passo**:
   - Acesse \`/settings\` como Administradora (\`barbara.ferreira.leal@gmail.com\`).
   - Na seção Canal Oficial WhatsApp Business, localize o card "Foto de Perfil do WhatsApp via API".
   - **Comportamento Esperado**:
     - Exibe aviso claro explicando que o nome de exibição exige revisão humana no WhatsApp Manager, mas a foto pode ser alterada diretamente via API.
     - Permite selecionar uma imagem JPEG/PNG de até 5MB com pré-visualização.
     - Ao clicar em "Atualizar Foto via API", o backend processa o Resumable Upload da Meta e aplica no perfil comercial, exibindo mensagem de sucesso ("Foto atualizada com sucesso — pode levar alguns minutos para aparecer para os clientes").
     - O token permanente da Meta permanece 100% restrito ao backend sem qualquer vazamento na tela.

---

## Q) Detalhes por Cliente no Backoffice com Dados Reais (Correção do Item 31)

1. **Acesso ao Detalhe do Cliente no /admin**:
   - Faça login como Administradora (\`barbara.ferreira.leal@gmail.com\`).
   - Acesse o Backoffice (\`/admin\`).
   - Localize um cliente com caixinhas configuradas e movimentações.
   - Clique no botão **"Detalhes"**.

2. **Verificação da Aba Caixinhas (Gasto Real vs Teto)**:
   - Abra a aba **"Caixinhas"**:
     - **Verificação**: Os valores de **Teto** e **Gasto no Mês** NÃO estão zerados nem em branco.
     - As caixinhas configuradas do cliente são listadas com seus nomes, ícones e cores oficiais.
     - O valor do Teto corresponde ao campo \`amount\` cadastrado para a caixinha.
     - O valor do Gasto reflete a soma real das despesas (\`type = 'despesa'\`) daquela categoria no mês de referência.
     - A barra de progresso reflete visualmente a proporção gasta em relação ao teto.

3. **Verificação da Aba Transações (Últimas Transações com Valores Reais)**:
   - Abra a aba **"Transações"**:
     - **Verificação**: As últimas transações do cliente são exibidas com valores preenchidos em Real (ex.: \`R$ 35,00\`, \`R$ 120,00\`), tipo (despesa/receita), caixinha correspondente, origem (\`whatsapp_text\`, \`whatsapp_audio\`, \`manual\`) e data/hora.
     - Nada aparece zerado ou como \`R$ 0,00\` indevido quando há transações com valor real.

4. **Verificação da Aba Histórico WhatsApp (Conversas do Agente)**:
   - Abra a aba **"Histórico WhatsApp"**:
     - **Verificação**: O painel exibe as mensagens trocadas entre o cliente e o agente financeiro no WhatsApp (mensagens recebidas \`incoming\` e enviadas \`outgoing\` pelo agente), com texto completo e carimbo de data/hora.
     - As mensagens são carregadas e renderizadas a partir das conversas ativas do agente nativo (\`financeiro-whatsapp\`).

---

## R) Upload de Foto de Perfil JPEG Pequeno e Tratamento de Erros da Meta (Correção do Item 36)

1. **Aceitação de Arquivo JPEG Válido Pequeno (ex.: 37.1 KB)**:
   - Acesse \`/settings\` como Administradora.
   - No card "Foto de Perfil do WhatsApp via API", clique em "Escolher Imagem...".
   - Selecione um arquivo JPEG válido de tamanho reduzido (ex.: 37 KB ou arquivo .jpg/.jpeg padrão).
   - **Verificação**:
     - O arquivo NÃO é rejeitado com mensagem genérica enganosa de formato ou tamanho.
     - A pré-visualização carrega normalmente e exibe o tamanho real em KB.
     - Ao clicar em "Atualizar Foto via API", o upload é submetido à Meta Graph API.
     - Em caso de sucesso, toast verde confirma a atualização do perfil.

2. **Exibição do Erro Real da Meta Sem Mensagem Enganosa**:
   - Se o token da Meta estiver inválido, expirado ou a Meta recusar por qualquer motivo:
     - **Verificação**: O alerta vermelho exibe o erro REAL retornado pela Meta (ex.: "Meta recusou a criação da sessão de upload: (...)", "Token inválido ou expirado" ou mensagem específica da Graph API).
     - **NUNCA** é exibida a mensagem enganosa "preciso utilizar uma imagem jpeg ou png de no máximo 5MB" quando o arquivo já cumpria esses requisitos.
   - O token da Meta permanece protegido e nunca é exposto na mensagem nem no console do cliente.

---

## S) Guardrail de Temas do Agente (Item 22)

1. **Tentativa de Conversa Fora do Escopo Financeiro**:
   - Abra o WhatsApp com o agente Consciente ou envie mensagem pelo simulador admin.
   - Envie uma pergunta completamente fora do escopo, por exemplo:
     - *"Quem descobriu o Brasil?"*
     - *"Qual a previsão do tempo para amanhã?"*
     - *"Me conte uma piada sobre futebol."*
   - **Comportamento Esperado**:
     - O agente responde com gentileza, brevidade e empatia, explicando que seu foco exclusivo é cuidar das finanças pessoais e das caixinhas do cliente.
     - **NUNCA** responde com fatos históricos gerais, previsões climáticas ou piadas abertas.
     - Encerra convidando o cliente a registrar algum gasto, tirar dúvidas sobre o saldo das caixinhas ou ver o resumo do mês.

---

## T) Gasto Retroativo via WhatsApp e Interface (Item 28)

1. **Envio de Lançamento com Data Passada**:
   - Pelo WhatsApp do cliente, envie mensagens com menção explícita de tempo passado:
     - *"Ontem gastei 35 no almoço"*
     - *"Terça feira gastei 120 no mercado"*
     - *"Dia 10 gastei 50 na farmácia"*
   - **Comportamento Esperado**:
     - O agente reconhece a data correta no passado e registra a transação com o campo \`date\` referente ao dia mencionado (e não o dia de hoje).
     - O campo \`is_retroactive\` é gravado como \`true\` na base.
     - A resposta empática do agente cita expressamente a data original considerada (ex: *"Lançamento de R$ 35,00 em Alimentação registrado com a data de ontem (...)"*).
     - No extrato de Transações (\`/transactions\`) e no Backoffice (\`/admin\`), o lançamento exibe o badge discreto **"Retroativo"** e a data original informada.

---

## U) Cancelar Último Lançamento via WhatsApp (Item 23)

1. **Solicitação de Cancelamento pelo Cliente**:
   - No WhatsApp, envie um gasto: *"Gastei 45 no uber"*.
   - Aguarde a confirmação de lançamento do agente.
   - Logo em seguida, envie: *"Cancela o último lançamento"* ou *"Apaga esse gasto de 45"*.
   - **Comportamento Esperado — Confirmação Segura**:
     - O agente NÃO cancela no susto; ele identifica o último lançamento do cliente e responde pedindo confirmação explícita:
       \`Tem certeza que deseja cancelar o lançamento de R$ 45,00 (Transporte) feito hoje? Responda SIM para confirmar.\`
   - **Confirmação Efetiva**:
     - O cliente responde: *"SIM"*.
     - O agente confirma com empatia: \`Lançamento de R$ 45,00 cancelado com sucesso. O valor foi estornado do total da caixinha.\`
     - O campo \`status\` da transação é atualizado para \`'cancelled'\` (deleção lógica auditável).
     - Se o cliente responder *"NÃO"* ou outra coisa, o cancelamento é descartado com aviso de segurança.

---

## W) Idempotência do Webhook WhatsApp (Prevenção de Duplicidade por Retry da Meta)

1. **Reenvio de Mensagem de Áudio ou Texto**:
   - Quando a Meta reenvia um webhook devido à latência de processamento de áudio/IA (>5 segundos):
     - **Verificação**: O webhook detecta o \`wamid\` já processado na coleção \`whatsapp_processed_messages\` e no cache em memória.
     - O processamento repetido é descartado silenciosamente com log informativo.
     - **NUNCA** são geradas duas mensagens de confirmação para o cliente.
     - **NUNCA** ocorre a falsa resposta de "esse gasto já está registrado e não vou lançar de novo".
   - O gasto permanece lançado com sucesso uma única vez, com status \`active\` e \`is_retroactive\` devidamente sinalizado caso tenha data anterior.

---

## V) Totais e Caixinhas Apenas com Transações Ativas (Item 27)

1. **Exclusão Lógica e Recálculo Automático**:
   - Acesse o Dashboard (\`/\`), Caixinhas (\`/budgets\`) e Relatórios (\`/reports\`). Observe os totais de despesas e barras de consumo das caixinhas.
   - Acesse Transações (\`/transactions\`):
     - Localize um lançamento ativo e clique em "Excluir" (ou cancele um gasto pelo WhatsApp conforme o cenário U).
     - Verifique que na lista com o filtro "Somente Ativos" a transação não é exibida.
     - No filtro padrão "Todos os Status" ou no filtro "Cancelados", a transação aparece identificada com o badge **"Cancelado"** ou **"Excluído"**, texto tachado e sem botões de re-edição.
   - **Verificação nos Totais**:
     - No **Dashboard**: os cartões de "Total de Despesas", "Saldo do Mês" e as barras de progresso das caixinhas deduzem imediatamente o valor cancelado/excluído.
     - Em **Caixinhas**: o teto consumido e a porcentagem gasta da categoria ignoram transações canceladas/excluídas.
     - Em **Relatórios**: o resumo executivo, total de despesas e gráficos excluem registros inativos.
     - No **Backoffice Admin**: o histórico de transações do cliente mantém o registro visível com o badge de status para fins de auditoria, mas sem inflar totais ativos.

---

## X) Histórico Visível de Transações Canceladas na Visão do Cliente e Isolamento Estrito de Totais

1. **Visibilidade Imediata de Transações Canceladas (Transparência ao Cliente)**:
   - Acesse a tela de Transações (\`/transactions\`) como cliente comum (sem selecionar nenhum filtro manual).
   - **Verificação do Filtro Padrão**:
     - O seletor de "Status" inicia automaticamente selecionado em **"Todos os Status"**.
     - Todos os lançamentos ativos e cancelados aparecem listados cronologicamente na consulta normal.
     - Lançamentos cancelados exibem:
       - Linha com opacidade reduzida (\`opacity-60\`).
       - Descrição com formatação tachada (\`line-through\`).
       - Badge destacado vermelho/rosa **"Cancelado"** ao lado da descrição e no card mobile.
       - Botões de "Editar" e "Excluir" ocultos para transações canceladas ou excluídas.
     - O cliente vê imediatamente na listagem que seu pedido de cancelamento (feito via WhatsApp ou painel) foi efetivado com sucesso, construindo relação de confiança com o app.
   - **Refinamento Opcional por Filtro**:
     - Ao selecionar "Somente Ativos", a lista oculta os cancelados e mostra apenas transações ativas.
     - Ao selecionar "Cancelados", a lista exibe exclusivamente os lançamentos cancelados.
     - Ao retornar para "Todos os Status", o histórico completo é restaurado.

2. **Isolamento Absoluto de Totais e Somatórias (REGRA SEM EXCEÇÃO)**:
   - Em **nenhuma hipótese** um lançamento cancelado (\`status = 'cancelled'\`) ou excluído (\`status = 'deleted'\`) pode compor somas, médias ou totais financeiros em qualquer tela do app:
     - **Na tela de Transações (\`/transactions\`)**: a listagem serve para conferência e auditoria visual; nenhum valor cancelado é computado em somas ou resumos.
     - **No Dashboard (\`/\`)**: "Total de Despesas", "Saldo do Mês", "Total de Receitas" e consumo por caixinha consideram estritamente \`status = 'active'\` (com fallback retrocompatível para registros antigos sem campo status).
     - **Em Caixinhas / Orçamentos (\`/budgets\`)**: o teto consumido (R$ gasto) e as barras de porcentagem consideram unicamente transações ativas. Lançamento cancelado é 100% estornado da caixinha correspondente.
     - **Em Relatórios (\`/reports\`)**: resumo executivo, total geral, despesas por categoria e evolução mensal filtram rigorosamente \`status = 'active'\`.
     - **Em Categorias (\`/categories\`)**: a contagem de lançamentos do mês e o total acumulado por categoria ignoram cancelados. A verificação para exclusão de categoria barra apenas se houver transações ATIVAS vinculadas.
     - **No Backoffice (/admin)**: os cartões de métricas globais e o detalhe do cliente somam exclusivamente despesas ativas.

---

## Y) Fallback Inteligente e Diferenciação de Mensagens no WhatsApp (Prevenção de Falso Erro de Gasto)

1. **Mensagens que NÃO são Lançamentos Financeiros (Saudação e Verificação de Status)**:
   - No WhatsApp do Consciente (ou via simulação de mensagem), envie uma pergunta comum: *"Oi, deu certo?"* ou *"Olá, tudo bem?"*.
   - **Comportamento Esperado — NUNCA tratar como erro de gasto**:
     - Em caso de oscilação momentânea ou timeout da IA do agente:
       - O agente **NUNCA** responde com: \`Não consegui processar seu gasto agora... envie com o valor e a categoria\`.
       - O agente responde de forma acolhedora e contextual:
         - Para *"Oi, deu certo?"*: \`Olá! O Consciente está aqui com você! 👋 Tivemos uma oscilação rápida agora há pouco e sua última solicitação pode não ter sido concluída. Você pode me mandar novamente o que gostaria de registrar ou checar? Se foi um gasto, pode mandar o valor e a caixinha (ex: "Almoço 35").\`
         - Para *"Oi"*, *"Olá"*, *"Bom dia"*: \`Olá! Eu sou o Consciente - Seu parceiro nas finanças! 👋 Como posso te ajudar agora? Você pode registrar um gasto (ex: "Almoço 35"), ver o resumo das caixinhas enviando "resumo", ou tirar uma dúvida financeira!\`
   - O cliente tem a sensação de que o assistente compreendeu que ele não estava tentando lançar um gasto, preservando a humanização do produto.

2. **Mensagens que SÃO Lançamentos Financeiros**:
   - Envie um gasto explícito: *"Almoço 42"* ou *"Gastei 120 no mercado"*.
   - Se ocorrer oscilação na chamada ao agente:
     - O fallback orienta educadamente a reenviar o valor e categoria para registrar na caixinha.

3. **Mensagens de Áudio com Oscilação**:
   - Se o áudio sofrer instabilidade na transcrição ou no agente:
     - A resposta explica que o áudio foi recebido, mas houve oscilação momentânea, convidando gentilmente a reenviar ou digitar em texto curto.

4. **Resiliência dos Módulos Auxiliares**:
   - Os hooks \`reliability_helper.js\` e \`caixinhas_summary_helper.js\` devem carregar sem erro em qualquer escopo do runtime Goja JSVM (via \`globalThis\` ou caminhos relativos de \`require\`), garantindo que o guardrail de temas (Cenário S), parser de datas retroativas (Cenário T) e cancelamentos (Cenário U) operem sem falhas silenciosas.

---

## Z) Edição de Caixinha Existente (Ícone com 3 Abas, Nome, Cor e Teto) em /budgets

1. **Abertura do Modal de Edição de Caixinha Existente**:
   - Acesse a tela de **Caixinhas** (\`/budgets\`).
   - Em qualquer caixinha existente (exemplo: *"Alimentação - VA"* ou *"Pet"*), clique no botão de **Editar** (ícone de lápis).
   - O modal **"Editar Caixinha"** deve se abrir exibindo:
     - **Categoria da Caixinha**: pré-selecionada com a categoria correspondente e exibindo o ícone/cor atual.
     - **Nome da Caixinha**: campo de texto editável com o nome atual preenchido.
     - **Seletor de Figurinha / Ícone com 3 Abas**:
       - Aba **Ícones**: coleção de ícones vetoriais modernos (utensílios, compras, carro, casa, coração, avião, presente, café, etc.).
       - Aba **Emojis**: seleção de emojis populares (🍔 Hambúrguer, 🛒 Carrinho, 🚗 Carro, 🏠 Casa, ✈️ Avião, 💊 Saúde, 🎓 Estudos, ☕ Café, 🎬 Lazer, etc.).
       - Aba **🐱 Bichinhos**: biblioteca completa de animais carismáticos (🐱 Gatinho, 🐶 Cachorrinho, 🐾 Patinhas, 🐻 Ursinho, 🐼 Panda, 🐨 Coala, 🦁 Leãozinho, 🐰 Coelhinho, 🦊 Raposa, 🐯 Tigrinho, 🐧 Pinguim, 🦉 Corujinha, 🦋 Borboleta, 🐝 Abelhinha, etc.).
     - **Pré-visualização do Ícone**: miniatura com a cor selecionada atualizando dinamicamente.
     - **Cor da Caixinha**: paleta de cores elegantes para personalização do badge e da barra.
     - **Teto da Caixinha (R$)**: valor numérico formatado em moeda (ex: \`R$ 1.000,00\`).
     - **Mês de Referência**: mês de vigência da caixinha (ex: \`novembro de 2026\`).

2. **Alteração de Ícone para Bichinho ou Emoji**:
   - Selecione a aba **🐱 Bichinhos** e clique em uma figurinha diferente (ex: troque para **Panda 🐼** ou **Abelhinha 🐝**).
   - Opcionalmente ajuste a cor ou o nome (ex: *"Alimentação & Mercado"*).
   - Mantenha ou ajuste o teto (ex: \`R$ 1.200,00\`).
   - Clique em **Salvar Caixinha**.

3. **Verificação de Refletância Imediata no App**:
   - **Na tela de Caixinhas (\`/budgets\`)**: o cartão exibe imediatamente o novo ícone, o novo nome e o teto atualizado.
   - **No Dashboard (\`/\`)**: o card da caixinha e a lista de consumo mostram o novo ícone e nome.
   - **No Extrato (\`/transactions\`)**: as transações vinculadas àquela caixinha exibem a nova figurinha e nome.
   - **No Modal de Novo Lançamento**: ao selecionar a caixinha, o ícone novo aparece no seletor e no preview.
   - **No Resumo do WhatsApp**: ao solicitar o resumo pelo WhatsApp ("resumo"), o helper utiliza o novo emoji/bichinho correspondente na barra visual de progresso.

4. **Zero Regressão de Tetos e Mês de Referência**:
   - O teto e o mês continuam gravados com precisão no registro de \`budgets\`, sem duplicar registros para o mesmo mês e sem alterar lançamentos passados.

---

## AA) Fallback Embutido e Resiliente do WhatsApp (Zero Erro de Escopo e Resposta Acolhedora)

1. **Deploy dos Hooks sem Hook Scoping Error**:
   - O deploy de backend (\`deploy_backend\`) e a inicialização dos hooks do PocketBase ocorrem sem nenhuma falha de escopo Goja (ex.: \`Hook scoping error: top-level declaration\`).
   - Todas as funções auxiliares de fallback inteligente e tentativas de reconexão residem inline dentro do escopo dos próprios handlers e callbacks ou via \`globalThis\`.

2. **Resposta Acolhedora em Mensagens Não-Financeiras Durante Falha**:
   - Envie uma mensagem não-financeira como *"Oi"*, *"Olá"*, *"Tudo bem?"* ou *"Oi, deu certo?"*.
   - Em caso de indisponibilidade ou timeout da IA ou de módulos externos:
     - O Consciente responde com mensagem acolhedora e contextual, cumprimentando e oferecendo ajuda.
     - **Critério Obrigatório**: O agente **NUNCA** responde exigindo valor e categoria (ex.: *"envie o valor e a categoria"*) para conversas comuns ou saudações.

3. **Fallback Correto em Lançamentos Financeiros**:
   - Envie um gasto explícito (ex.: *"Almoço 35"* ou *"Mercado 120"*).
   - Se a IA estiver inoperante ou sofrer timeout:
     - O fallback orienta educadamente a enviar novamente o valor e a caixinha, preservando a coerência do atendimento financeiro.

4. **Zero Regressão dos Cenários A a Z**:
   - Todos os fluxos de áudio, resumos visuais de caixinhas, filtros de transações, edição com 3 abas de ícones/bichinhos e isolamento de permissões continuam 100% íntegros.

---

## AB) Alinhamento e Match Unificado de Caixinhas entre o WhatsApp e o App (Fonte Única de Verdade)

1. **Contexto e Causa Raiz Solucionada**:
   - No WhatsApp, o usuário pode registrar ou reclassificar lançamentos com categorias semânticas (ex.: *"Alimentação Essencial"* ou *"Alimentação Não Essencial"*) ou notas direcionando para a caixinha (ex.: *"Alimentação - VA"* ou *"VR"*).
   - Anteriormente, o resumo do WhatsApp calculava os gastos somando transações vinculadas às caixinhas por aproximação ou notas, enquanto o App exigia igualdade estrita do ID de categoria (\`t.category === b.category\`). Como resultado, as caixinhas de alimentação apareciam com gastos preenchidos no WhatsApp mas totalmente vazias no App.
   - **Comportamento Unificado**:
     - O matcher unificado em \`src/lib/caixinhaMatcher.ts\` e \`caixinhas_summary_helper.js\` agora reconhece consistentemente tanto o vínculo direto por ID, quanto associações semânticas por note/observação (ex.: *"Alimentação - VA"*, *"VR"*, *"VA"*), sufixos característicos e subcategorias contidas no nome da caixinha.

2. **Verificação no App - Tela de Caixinhas (\`/budgets\`)**:
   - Acesse a tela de **Caixinhas** (\`/budgets\`).
   - As caixinhas de alimentação com teto definido (ex.: *"Alimentação - VA"* com teto de R$ 1.000,00 e *"Alimentação - VR"* com teto de R$ 1.200,00):
     - Mostram exatamente os mesmos valores apurados no resumo do WhatsApp (ex.: **R$ 214,56** de R$ 1.000,00 no VA e **R$ 190,00** de R$ 1.200,00 no VR).
     - Cada cartão de caixinha exibe uma seção expansível/visível de **Lançamentos vinculados** detalhando os gastos pertinentes (ex.: *"Mercado Violeta - R$ 214,56"* sob a caixinha VA, e *"Rascal - R$ 190,00"* sob a caixinha VR).

3. **Verificação no Dashboard (\`/\`)**:
   - Na visão geral do Dashboard, o bloco de Caixinhas do Mês exibe os gastos consumidos e as barras de porcentagem correspondentes aos valores do WhatsApp.
   - Na lista de transações recentes, os lançamentos exibem o nome da caixinha efetiva vinculada e, quando aplicável, o badge de sub-classificação (*"Essencial"* ou *"Não Essencial"*).

4. **Verificação na Lista de Transações (\`/transactions\`)**:
   - A listagem de lançamentos identifica claramente a qual caixinha cada transação pertence (ex.: *"Alimentação - VA"* com badge *"Essencial"* para Mercado Violeta; *"Alimentação - VR"* com badge *"Não Essencial"* para Rascal).

5. **Garantia de Isolamento de Transações Canceladas/Excluídas (Zero Regressão)**:
   - Apenas lançamentos com status ativo (\`status === 'active'\`) são contabilizados nos totais das caixinhas.
   - Lançamentos cancelados ou excluídos permanecem visíveis para auditoria mas jamais somam nem alteram as barras de progresso.

---

## AC) Parametrização Categoria↔Caixinhas por Cliente (Vínculos N:N) e Zero Regressão

1. **Contexto e Regra de Negócio**:
   - Cada cliente possui realidade financeira e arranjos de benefícios próprios (ex.: VR, VA, Alimentação Essencial, Lazer).
   - O cliente pode decidir livremente quais categorias alimentam quais caixinhas:
     - Uma mesma categoria pode alimentar mais de uma caixinha (ex.: *"Alimentação Essencial"* soma tanto em *"Alimentação VA"* quanto em *"Alimentação VR"*).
     - Uma caixinha pode receber lançamentos de múltiplas categorias.
   - Quando o cliente parametriza vínculos para uma caixinha, os lançamentos ativos dessas categorias somam nas caixinhas vinculadas.
   - **Zero Regressão**: Clientes que ainda não configuraram vínculos explícitos continuam com o comportamento padrão anterior (matching por ID de categoria, notas semânticas e sufixos VA/VR) 100% preservado.

2. **Passo a Passo de Verificação no App (/budgets)**:
   - Acesse **Caixinhas** (\`/budgets\`).
   - Clique em **Editar** em uma caixinha (ex.: *"Alimentação - VA"*).
   - No modal, alterne para a aba **"Categorias Vinculadas"**:
     - O sistema lista todas as categorias disponíveis do cliente (cadastradas + observadas em lançamentos).
     - Marque a categoria *"Alimentação Essencial"*.
     - O aviso explicativo destaca que os lançamentos desta categoria somarão nesta caixinha e que categorias podem alimentar mais de uma caixinha.
     - Clique em **Salvar Caixinha**.
   - Em seguida, edite a caixinha *"Alimentação - VR"*, vá na aba **"Categorias Vinculadas"** e marque também *"Alimentação Essencial"*. Salve.

3. **Verificação de Vínculos e Isolamento de Cancelados**:
   - Desmarque a categoria no modal de edição da caixinha: o vínculo deixa de existir imediatamente.
   - Lançamentos com \`status === 'cancelled'\` ou \`status === 'deleted'\` continuam visíveis no extrato mas **NUNCA** entram em nenhuma soma de caixinha.

---

## AD) Escolha Obrigatória de Caixinha e Não Duplicação de Gastos (Item 29 / v0.0.56)

1. **Objetivo do Teste**:
   - Garantir que cada transação conte em no máximo UMA única caixinha, eliminando qualquer duplicação de saldo e respeitando a escolha do cliente.

2. **Cenário 1 — WhatsApp com Categoria Vinculada a Múltiplas Caixinhas**:
   - Certifique-se de que a categoria *"Alimentação Essencial"* possui vínculos com duas ou mais caixinhas (ex.: *"Alimentação VA"* e *"Alimentação VR"*).
   - No WhatsApp, envie um gasto: *"Almoço 190 Alimentação Essencial"*.
   - **Comportamento Esperado**:
     - A transação **NÃO** é gravada imediatamente no banco.
     - O contato fica com pendência salva (\`pending_caixinha\`).
     - A IA responde perguntando em qual caixinha alocar com lista numerada e amigável:
       \`Esse gasto de R$ 190,00 entra em qual caixinha?\`
       \`1️⃣ Alimentação VA\`
       \`2️⃣ Alimentação VR\`
       \`Responda com o número ou nome da caixinha.\`
   - Responda *"1"* (ou *"Alimentação VA"*):
     - A IA grava a transação com \`budget\` apontando para a caixinha escolhida.
     - A IA confirma: \`Pronto! Registrei seu gasto de R$ 190,00 na caixinha 🍽️ Alimentação VA!\`
     - No resumo visual das caixinhas e no App, o valor de R$ 190,00 aparece **somente** na caixinha *"Alimentação VA"*, sem duplicar na *"Alimentação VR"*.
   - Se o cliente responder algo inválido (ex.: *"batata"*), a IA repete educadamente a pergunta listando as opções disponíveis.

3. **Cenário 2 — WhatsApp com Categoria Vinculada a Uma Única Caixinha**:
   - Configure a categoria *"Transporte"* com vínculo em apenas uma caixinha: *"Transporte Diário"*.
   - No WhatsApp, envie: *"Uber 25 Transporte"*.
   - **Comportamento Esperado**:
     - A IA grava a transação diretamente com \`budget\` preenchido para *"Transporte Diário"*.
     - A confirmação informa expressamente a caixinha: \`Anotado! Uber de R$ 25,00 na caixinha 🚗 Transporte Diário.\`

4. **Cenário 3 — Lançamento Manual no App (TransactionModal)**:
   - Abra o painel web e clique em **"Novo Lançamento"**.
   - Digite valor, descrição e selecione a categoria *"Alimentação Essencial"* (que possui 2 vínculos).
   - **Comportamento Esperado**:
     - O modal exibe imediatamente um seletor obrigatório: *"Caixinha (obrigatório — categoria vinculada a 2 caixinhas)"*.
     - O botão **"Salvar Lançamento"** fica **desabilitado** até que o usuário clique em uma das caixinhas candidatas.
     - Selecione *"Alimentação VR"* e clique em Salvar: a transação é criada com o campo \`budget\` preenchido.
     - A despesa soma exclusivamente na caixinha *"Alimentação VR"*.
   - Ao selecionar uma categoria com vínculo único, a caixinha correspondente é pré-selecionada e um aviso visual indica o direcionamento automático.

5. **Cenário 4 — Cliente Sem Vínculos Parametrizados (Fallback Retrocompatível)**:
   - Para um cliente que não configurou nenhum vínculo na coleção \`category_caixinha_links\`, envie ou lance um gasto normalmente.
   - O matcher continua aplicando o fallback histórico (matching semântico por categoria / anotação / sufixos) resolvendo para uma única caixinha estável sem quebrar nem exigir fluxo adicional.

6. **Cenário 5 — Isolamento Estrito de Transações Canceladas**:
   - Transações com status \`cancelled\` ou \`deleted\` continuam excluídas de qualquer soma de caixinha, dashboard ou resumo de WhatsApp.

---

## AE) Remanejamento de Transação entre Caixinhas no App e Paridade com WhatsApp (v0.0.57)

1. **Objetivo do Teste**:
   - Validar que o cliente consegue editar uma transação existente no painel web, alterar a caixinha efetiva para a qual o gasto está alocado e visualizar a atualização imediata dos totais de teto vs. realizado em \`/budgets\`, mantendo paridade exata com o resumo do WhatsApp.

2. **Cenário 1 — Remanejamento de Caixinha na Edição da Transação**:
   - Acesse a tela de **Transações** (\`/transactions\`).
   - Localize uma transação existente de despesa (ex.: *"Mercado Violeta"* ou *"Rascal"*).
   - Clique em **Editar**.
   - No modal de edição (\`TransactionModal\`), localize a seção **"Caixinha do Gasto"**.
   - Escolha outra caixinha ativa disponível (ex.: altere de *"Alimentação - Crédito"* para *"Alimentação - VA"* ou *"Alimentação - VR"*).
   - Clique em **Salvar Lançamento**.
   - **Comportamento Esperado**:
     - O lançamento é atualizado com sucesso.
     - O badge e ícone da categoria efetiva no extrato refletem a caixinha escolhida.
     - Na tela **Caixinhas** (\`/budgets\`), o valor gasto da caixinha de origem diminui instantaneamente e o valor da nova caixinha aumenta exatamente pelo mesmo valor.
     - A transação continua contando em **UMA única caixinha**, sem duplicações.
     - No card da caixinha em \`/budgets\`, o lançamento é exibido na lista de lançamentos vinculados com o indicador *"Fixada"*.

3. **Cenário 2 — Opção de Desvincular para Automático / Sem Caixinha Fixa**:
   - Abra novamente a transação editada e selecione *"Automático / Sem caixinha fixa"*.
   - Salve. O campo \`budget\` é limpo (\`null\`), permitindo que a regra automática por categoria ou vínculos N:N atue normalmente.

4. **Cenário 3 — Paridade Exata de Valores entre App e WhatsApp**:
   - No WhatsApp, envie *"resumo"* para receber o comparativo visual das caixinhas.
   - Abra a tela \`/budgets\` do App no mesmo mês.
   - **Comportamento Esperado**:
     - Os valores de **Gasto Realizado**, **Teto Planejado** e **Percentual** de cada caixinha no App coincidem **exatamente centavo por centavo** com os valores enviados no WhatsApp.
     - Nenhuma caixinha apresenta lançamentos de outra caixinha fixada.

---

## AF) Persistência de Budget no Registro via WhatsApp e Paridade com App (v0.0.58)

1. **Objetivo do Teste**:
   - Garantir que qualquer gasto registrado pelo WhatsApp (texto ou áudio) tenha sua caixinha efetiva salva de forma obrigatória no campo \`budget\` da coleção \`transactions\` na base, eliminando qualquer discrepância entre a fala do agente e a tela \`/budgets\` do aplicativo.

2. **Cenário 1 — Registro via WhatsApp com Categoria de Vínculo Único**:
   - Envie um gasto por texto ou áudio em categoria que possui vínculo único em \`category_caixinha_links\`.
   - O agente confirma a caixinha vinculada.
   - **Verificação no Banco**:
     - A transação criada em \`transactions\` possui o campo \`budget\` preenchido com o ID exato da caixinha anunciada.
   - **Verificação no App**:
     - Na tela \`/budgets\`, o valor entra imediatamente na caixinha correspondente e os totais batem com o resumo visual emitido pelo WhatsApp.

3. **Cenário 2 — Registro via WhatsApp com Múltiplas Caixinhas Candidatas**:
   - Envie um gasto em categoria com mais de uma caixinha vinculada.
   - O agente envia a pergunta numerada de opções de caixinhas e salva o estado em \`pending_caixinha\`.
   - O cliente responde com o número ou nome da caixinha desejada.
   - O agente confirma o registro na caixinha escolhida.
   - **Verificação no Banco**:
     - A transação é salva com o campo \`budget\` preenchido com o ID da caixinha escolhida.
     - O campo \`pending_caixinha\` do contato é limpo.

4. **Cenário 3 — Paridade de Lançamentos Históricos (Mercado Violeta e Rascal)**:
   - Verifique as transações de teste Mercado Violeta (R$ 214,56) e Rascal (R$ 190,00).
   - O campo \`budget\` na base está preenchido com a caixinha resolvida determinística.
   - O resumo de caixinhas no WhatsApp e a tela \`/budgets\` do App batem 100% centavo a centavo.

5. **Cenário 4 — Resumo Exclusivamente Determinístico**:
   - Ao solicitar visão de caixinhas ("quais são minhas caixinhas?", "resumo"), o texto gerado é emitido exclusivamente pelo helper determinístico (\`caixinhas_summary_helper.js\` / \`resolveTxBudget\`), sem cálculos ou números inventados pela LLM.

6. **Cenário 5 — Isolamento de Cancelados**:
   - Transações com status \`cancelled\` continuam estritamente excluídas de qualquer soma ou teto.

---

## AG) Autonomia das Caixinhas sem Campo Categoria e Alimentação Parametrizada (v0.0.59)

1. **Objetivo do Teste**:
   - Garantir que a caixinha seja criada e editada como entidade 100% autônoma (apenas nome, figurinha, cor, teto e mês), sem qualquer campo ou seletor de categoria da caixinha.
   - Garantir que lançamentos alimentem a caixinha exclusivamente através de:
     a) Campo direto \`budget\` fixado na transação;
     b) Vínculo parametrizado em \`category_caixinha_links\` (aba "Categorias Vinculadas");
     c) Matching semântico / IA resiliente;
     NUNCA por campo de categoria da própria caixinha.

2. **Cenário 1 — Criação de Caixinha Autônoma no App**:
   - Acesse a tela \`/budgets\` e clique em "Nova Caixinha".
   - **Verificação Visual**: O modal abre na aba "Teto e Aparência" contendo exclusivamente Nome da Caixinha, Figurinha/Ícone (abas Ícones, Emojis e Bichinhos 🐱), Cor da Caixinha, Teto (R$) e Mês de Referência. Nenhum seletor de "Categoria da Caixinha" ou toggle de modo existe.
   - Preencha Nome ("Viagem de Férias"), escolha uma figurinha de bichinho (ex.: 🦁), cor e valor de R$ 3.000,00.
   - Salve. A caixinha é criada com sucesso e renderizada no card com seu nome, ícone e cor próprios.

3. **Cenário 2 — Parametrização de Categorias Vinculadas**:
   - Abra a edição da caixinha recém-criada e alterne para a aba "Categorias Vinculadas".
   - Marque a categoria correspondente (ex.: "Transporte" ou "Lazer").
   - Salve a caixinha.
   - Registre uma despesa na categoria selecionada.
   - **Comportamento Esperado**: O consumo da caixinha reflete a transação, respeitando a regra de ouro de contagem em exatamente UMA caixinha (zero duplicidade).

4. **Cenário 3 — Edição Sem Categoria**:
   - Clique em "Editar" em qualquer caixinha existente.
   - O modal carrega os valores atuais (nome, figurinha, cor e teto) sem qualquer campo ou erro de categoria.
   - Modifique o nome ou a cor e salve. Os dados persistem sem erros no banco e refletem em tempo real no Dashboard, Extrato e WhatsApp.

5. **Cenário 4 — Exclusão Estrita de Cancelados e Zero Duplicidade**:
   - Cancele um lançamento vinculado via WhatsApp ou altere para \`cancelled\`.
   - O consumo da caixinha é recalculado imediatamente sem o valor cancelado.

---

## AH) Resumo do WhatsApp 100% Determinístico da Base — Caixinha Excluída Some na Hora e Totais Batem com o App (v0.0.62)

1. **Objetivo do Teste**:
   - Garantir que o resumo de caixinhas exibido no WhatsApp seja 100% determinístico, calculado diretamente da base de dados no exato momento da solicitação e NUNCA gerado pelo agente de IA.
   - Eliminar qualquer possibilidade de a memória da conversa ressuscitar caixinhas deletadas ou gerar rodapé aritmético discrepante dos itens listados.
   - Garantir que as mensagens enviadas para a IA em outros contextos recebam a lista fresca de caixinhas ativas com instrução anti-alucinação.

2. **Cenário 1 — Solicitação de "Resumo" no WhatsApp (Bypass da IA)**:
   - Com o cliente autenticado e com caixinhas ativas, envie a mensagem "Resumo", "resumo" ou "quais são minhas caixinhas" no WhatsApp.
   - **Comportamento Esperado**:
     - A resposta é montada e devolvida diretamente pelo motor determinístico **100% inline** do \`whatsapp_bridge.js\` (seção 1.6 — funções \`inlineIsCaixinhasOverviewIntent\` e \`inlineBuildCaixinhasSummaryForUser\`), sem passar pelo \`$ai.agent\` e SEM nenhuma dependência de \`require\`/\`globalThis\`/\`caixinhas_summary_helper.js\` no caminho crítico do webhook (o helper externo quebrou em produção com \`GoError: Invalid module\`).
     - O visual traz cada caixinha ativa existente na base (nome, ícone, barra \`▓░\`, percentual, gasto/teto e saldo restante).
     - Nenhuma caixinha excluída (ex.: *"Alimentação - Crédito"*) é exibida.
     - O rodapé com "Total Gasto no Mês", "Total dos Tetos" e "Saldo Restante no Mês" é somado estritamente dos ITENS LISTADOS na mensagem (consistência matemática absoluta centavo a centavo).
     - Os números e percentuais batem 100% com a tela \`/budgets\` do aplicativo.

3. **Cenário 2 — Caixinha Deletada Some Imediatamente do Resumo do WhatsApp**:
   - Exclua uma caixinha no aplicativo (tela \`/budgets\`).
   - Envie imediatamente "resumo" no WhatsApp.
   - **Comportamento Esperado**:
     - A caixinha excluída não aparece no resumo do WhatsApp em nenhuma hipótese.
     - Os totais de tetos e gastos refletem na hora a nova composição da base de dados.

4. **Cenário 3 — Demais Mensagens Enviadas para a IA com Contexto Fresco**:
   - Envie uma mensagem conversacional ou lançamento financeiro (ex.: "almoço 35 reais" ou "onde posso economizar?").
   - A requisição segue para o \`$ai.agent\`.
   - **Comportamento Esperado**:
     - O prompt do agente recebe a injeção do estado oficial e fresco de caixinhas ativas da base de dados daquele mês (também 100% inline no \`whatsapp_bridge.js\`, via \`inlineBuildCaixinhasContextPrompt\`).
     - O agente respeita a instrução explícita de não citar caixinhas excluídas e não tenta calcular totais ou saldos por conta própria.

5. **Cenário 4 — Resiliência com Mensagem Honesta de Erro**:
   - Em caso improvável de falha de conexão com a base na montagem do resumo, o sistema retorna uma mensagem honesta e transparente convidando a consultar o app, JAMAIS caindo em fallback para o \`$ai.agent\` gerar números fictícios.

6. **Cenário 5 — Casos de Borda da Interceptação (AH-5)**:
   - Envie \`resumo\`, \`Resumo\`, \`RESUMO\`, \`resumo!\`, \`meu resumo\`, \`visão geral\`, \`quais são minhas caixinhas\`, \`como estão minhas caixinhas\` e \`ver resumo\`.
   - Envie também mensagens com valores monetários que NÃO são resumo (ex.: \`almoço 35\`, \`uber 20 reais\`): elas devem continuar indo para a IA como lançamento.
   - **Comportamento Esperado**:
     - TODAS as variantes de pedido de resumo caem na interceptação determinística (log \`[whatsapp_bridge] Interceptação determinística de resumo (inline)\`), sem nenhum \`Chamando $ai.agent\`.
     - Lançamentos com valores continuam fluindo normalmente para o agente (zero regressão).
     - Mensagens não-financeiras ("oi", "obrigada") continuam com o fallback acolhedor do agente.

7. **Cenário 6 — Idempotência e Zero Duplicidade no Resumo (AH-6)**:
   - Solicite "resumo" duas vezes seguidas e confira os valores.
   - **Comportamento Esperado**:
     - Cada transação ativa é somada em exatamente UMA caixinha (campo \`budget\` persistido + fallback determinístico por vínculo/desempate textual).
     - Transações \`cancelled\` nunca entram em nenhuma soma.
     - Os percentuais exibidos (ex.: VA 21%, VR 16%) batem com o gasto/teto da tela \`/budgets\`.
     - Os totais do rodapé ("Total Gasto no Mês", "Total dos Tetos", "Saldo Restante") são iguais à soma exata dos itens listados — nenhuma aritmética divergente (regressão do R$ 5.450,00 é impossível por construção).

8. **Cenário 7 — Saúde do Módulo na JSVM (v0.0.63/v0.0.66)**:
   - Após o deploy do backend, verifique nos logs (\`list_logs source=hooks\`):
   - **Comportamento Esperado**:
     - Nenhum erro de carregamento de módulo (\`GoError: Invalid module\` ou similar) e nenhum log de \`caixinhas_summary_helper não carregado via require\` — a interceptação de resumo não depende mais de módulo externo.
   - Envie a mensagem \`Resumo\` no WhatsApp.
   - **Comportamento Esperado**:
     - Aparece no log a linha \`[whatsapp_bridge] Interceptação determinística de resumo (inline) para usuário ...\`.
     - NÃO aparece \`Chamando $ai.agent\` para essa mensagem.
     - A resposta entregue contém as caixinhas ativas da base e os totais batendo com o app.

---

## AI) Resolução Cirúrgica do Resumo Determinístico no Webhook POST (v0.0.66)
1. **Problema**: O callback do webhook POST continha referências ao identificador não declarado \`caixinhasEngine\` na checagem de intenção (\`caixinhasEngine.isCaixinhasOverviewIntent\`), na geração do resumo (\`caixinhasEngine.buildCaixinhasSummaryForUser\`) e na injeção anti-alucinação (\`caixinhasEngine.buildCaixinhasContextPrompt\`). Isso gerava ReferenceError silencioso capturado no try/catch, fazendo com que \`isCaixinhasOverview\` permanecesse falso e a mensagem fosse repassada indevidamente ao \`$ai.agent\`.
2. **Correção**:
   - Substituição de \`caixinhasEngine.isCaixinhasOverviewIntent\` por \`localIsCaixinhasOverviewIntent\` (função inline já existente no callback).
   - Substituição de \`caixinhasEngine.buildCaixinhasSummaryForUser\` por \`localBuildCaixinhasSummaryForUser\` (função inline já existente no callback).
   - Substituição de \`caixinhasEngine.buildCaixinhasContextPrompt\` por \`localBuildCaixinhasContextPrompt\` (função inline já existente no callback).
   - Remoção da tentativa de require no boot de \`reliabilityHelper\` no top-level, eliminando ruído de "Invalid module" no log.
3. **Validação**: Backend deployed e compilado limpo; zero chamadas a módulo externo.

---

## AJ) Desambiguação de Caixinha e Registro Seguro no WhatsApp (v0.0.69)
1. **Objetivo**: Garantir que, quando uma categoria estiver vinculada a 2 ou mais caixinhas candidatas ativas em \`category_caixinha_links\`, o sistema suspenda a gravação imediata, pergunte educadamente ao usuário no WhatsApp ("1️⃣ Caixinha A ou 2️⃣ Caixinha B?") e só grave a transação após a resposta, atribuindo unicamente a caixinha escolhida. Vínculos únicos registram direto sem pergunta.
2. **Implementação**:
   - Funções locais \`localHandleCaixinhaFlow\`, \`localTryParseSpendingExpense\`, \`localGetCandidateBudgetsForCategory\` e auxiliares declaradas 100% inline dentro do callback do webhook e da rota \`/simulate\` em \`pocketbase/hooks/whatsapp_bridge.js\` seguindo o padrão estrito \`localXxx\` sem qualquer \`require()\`.
   - Estado pendente salvo no campo \`pending_caixinha\` do registro \`whatsapp_contacts\` correspondente.
   - Resposta do usuário ("1", "2" ou nome da caixinha) processa e grava a transação na coleção \`transactions\` (\`amount\` em centavos, \`type = 'despesa'\`, \`source = 'whatsapp_text'\`, \`status = 'active'\`, \`budget = chosenBudget.id\`), calcula o valor restante do teto no mês e limpa a pendência.
   - Proteção de integridade em \`pocketbase/hooks/transactions_integrity.js\` mantida: quando há 2+ caixinhas ativas vinculadas, \`resolvedBudgetId\` permanece estritamente vazio no hook para não fazer suposições automáticas.
3. **Validação**:
   - Envio de gasto cuja categoria possui 2 caixinhas ativas (ex.: "18 padaria" em Alimentação vinculada a "Alimentação - VR" e "Supermercado - VA"): bot responde perguntando "1️⃣ Alimentação - VR / 2️⃣ Supermercado - VA". Nenhuma transação é gravada ainda.
   - Resposta do cliente com "1": transação gravada com sucesso com budget da caixinha 1, confirmando valor e saldo restante do teto.
   - Envio de gasto em categoria com vínculo único: gravação instantânea e confirmação direta sem pergunta.

---

## AK) Desambiguação de Categoria (Nível 1) e Emenda com Caixinha (v0.0.71)
1. **Objetivo**: Garantir que, quando um gasto informado no WhatsApp apresentar similaridade com mais de uma categoria cadastrada do usuário (exemplo clássico: *"Padaria R$ 12"* casando com a mesma pontuação tanto para *"Alimentação Essencial"* quanto para *"Alimentação Não Essencial"*), o sistema suspenda imediatamente o registro e questione educadamente a categoria antes de qualquer outra ação.
2. **Fluxo em 2 Níveis**:
   - **Nível 1 (Categoria)**:
     - \`localTryParseSpendingExpense\` coleta todas as categorias que atingem o score máximo (\`candidateCategories\`).
     - Se \`candidateCategories.length > 1\`: grava o estado pendente no campo \`pending_category\` da tabela \`whatsapp_contacts\` e envia mensagem numerada:
       > *"Esse gasto de R$ 12,00 (Padaria) é de qual categoria?*
       >
       > *1️⃣ Alimentação Essencial*
       > *2️⃣ Alimentação Não Essencial*
       >
       > *Responda com o número ou o nome da categoria! 😊"*
     - Nenhuma transação é gravada na coleção \`transactions\` nesta etapa.
   - **Emenda com Nível 2 (Caixinha)**:
     - O cliente responde com "1", "2" ou o nome da categoria (ex.: "Alimentação Essencial").
     - O webhook limpa \`pending_category\` e consulta as caixinhas ativas vinculadas à categoria escolhida (\`localGetCandidateBudgetsForCategory\`):
       - Se houver **2 ou mais caixinhas candidatas**: salva \`pending_caixinha\` e envia a pergunta numerada de caixinha (1️⃣ Alimentação - VA / 2️⃣ Alimentação - VR).
       - Se houver **exatamente 1 caixinha candidata**: grava a transação na hora com \`budget\` preenchido, calcula e exibe o saldo restante do teto no mês.
       - Se houver **0 caixinhas candidatas**: cai no fluxo seguro de despesa sem caixinha fixa.
3. **Casos Especiais e Proteções**:
   - Opção de cancelamento em qualquer nível: envio de "cancelar" ou termos negativos limpa a pendência e confirma que nada foi alterado.
   - Resposta inválida: repete educadamente a lista de opções com número emoji e instrução clara.
   - Gastos com categoria clara e pontuação única: continuam gravando direto (se vínculo único) ou indo direto para a pergunta de caixinha (se 2+ caixinhas), com zero regressão.
   - Resumo determinístico das caixinhas: mantido 100% inline, com cálculo direto da base e sem intervenção de IA.

---

## AL) Assinatura (Billing Stripe) — Plano, Checkout, Carência, Bloqueio e Cancelamento
> **Status (v0.0.92)**: integração DIRETA com a API da Stripe via \`$http\` concluída e em produção (sem depender de conectores Skip). Antes de testar o checkout, a administradora deve colar a Secret Key (\`sk_live_...\`), o Webhook Signing Secret (\`whsec_...\`) e os Price IDs dos planos Mensal e Anual na aba **Billing > Configuração Stripe** do Backoffice Admin (\`/admin\`). Se as credenciais ainda não estiverem preenchidas, clicar em "Assinar" exibe mensagem amigável e clara orientando a configuração no Backoffice (sem erro 500 nem falha silenciosa). Após preencher as credenciais, o botão "Assinar" abre imediatamente o checkout seguro oficial da Stripe (\`checkout.stripe.com\`).
> **Vigência de planos (v0.0.103)**: os preços exibidos e cobrados no checkout vêm das linhas vigentes de \`subscription_plans\` — vigências do mesmo plan_type NÃO se sobrepõem (salvar duas linhas sobrepostas do mesmo tipo é rejeitado no Backoffice com erro amigável citando plano e período), fim antes do início (\`valid_until <= valid_from\`) é rejeitado, mensal/anual são trilhas INDEPENDENTES e janelas EM SEQUÊNCIA são permitidas (ex.: Black November "até 30/11" seguida do Padrão "a partir de 01/12" — janelas semiabertas [from, until)). A tabela governa apenas NOVAS contratações: assinaturas ativas não são alteradas pela virada. Regras validadas no cenário AR.

1. **Fluxo de Assinatura Bem-Sucedido (Caminho Feliz)**:
   - Acesse \`/settings\` como cliente e abra a seção **Assinatura** (ou o deep-link \`/settings?section=assinatura\`).
   - Na tela de planos, escolha o plano: **Mensal R$ 19,90** ou **Anual R$ 214,90** (preço promocional Black November; valores parametrizáveis no Backoffice Admin com vigência geral e por cliente).
   - Clique em assinar: o checkout abre em produção no Stripe (página segura da Stripe, nunca com cartão dentro do app).
   - Conclua um pagamento válido de teste.
   - **Comportamento Esperado**:
     - Após o pagamento, a conta do cliente fica com assinatura **"ativa"** (refletida na tela de Assinatura e na gestão de billing do Backoffice \`/admin\`).
     - O agente do WhatsApp funciona normalmente: lançamentos por texto/áudio, desambiguações, resumo de caixinhas e consultas — 100% dos cenários A a AK íntegros.
     - Nenhum aviso de carência ou bloqueio é exibido enquanto a assinatura está ativa.

2. **Fluxo de Falha — Pagamento Recusado e Carência de 7 Dias**:
   - Simule um pagamento falhado no Stripe (cartão recusado) ou marque a assinatura como inadimplente.
   - **Comportamento Esperado — Período de Carência (7 dias)**:
     - No app, o cliente mantém acesso **SOMENTE a consultas** (dashboard, caixinhas, extrato, relatórios — leitura).
     - No WhatsApp, o envio de mensagens de gasto fica **suspenso**: o agente responde com gentileza, sem registrar lançamentos, convidando o cliente a reassinar e regularizar o pagamento.
     - Nenhum lançamento novo é gravado na base durante a carência.

3. **Após os 7 Dias de Carência — Bloqueio Total** (válido para inadimplência, NÃO para cancelamento voluntário):
   - Passado o período de carência sem regularização, a conta entra em **bloqueio total**: sem lançamentos no WhatsApp e sem acesso às funções do app, apenas com orientação para reassinar.
   - Ao regularizar o pagamento (reassinar via checkout Stripe), a conta volta a "ativa" imediatamente e todos os fluxos (WhatsApp + app) são restaurados sem perda de dados.

4. **Cancelamento Voluntário — Acesso Garantido até o Fim do Período Pago** (decisão da usuária, v0.0.89):
   - **Filosofia**: a Stripe encerra a assinatura **imediatamente** (garantia de que nenhuma cobrança futura será feita), MAS o cliente continua usando o app e o WhatsApp **até o fim do período que já pagou** (~30 dias no plano mensal; ~12 meses no anual).
   - A data final de acesso é persistida no campo \`access_until\` do usuário (vem do \`current_period_end\` da resposta do cancelamento na Stripe; fallback: vigência já gravada em \`subscription_expires_at\`).
   - Na tela **Minha Conta**, o status exibido passa a "Cancelada" imediatamente, SEMPRE acompanhado da data final em destaque: **"Cancelada — acesso garantido até 09/12/2026"** (bloco âmbar de alta visibilidade).
   - O toast de confirmação do cancelamento informa a mesma data real (ex.: "Acesso garantido até 09/12/2026") — sem prometer nada diferente.
   - O agente no WhatsApp continua aceitando lançamentos normalmente durante o período de acesso garantido (o gate trata cancelado-com-access_until-futuro como ativo).
   - **Depois da data**: o cliente cai no fluxo normal de não-assinante (bloqueio de lançamentos no WhatsApp e no app, com convite a reassinar). Nenhum dado é perdido; a conta nunca é excluída.
   - **Reativação**: ao assinar de novo (checkout Stripe), o campo \`access_until\` é limpo e a assinatura volta a "ativa" com nova vigência — sem resíduo do cancelamento anterior.
   - A blindagem anti-fantasma do \`/billing/status\` (que rebaixa "ativa" sem evidência Stripe para trial) NUNCA rebaixa um registro "cancelado" com access_until futuro — estados distintos por design.
   - Nada de logout ou reset de dados ao cancelar (comportamento preservado desde sempre).
   - _Teste AL-4 (cancelamento):_ logada como cliente com assinatura ativa → Minha Conta → "Cancelar assinatura" → confirmar → status vira "Cancelada" com o bloco âmbar mostrando a data final de acesso; o app segue 100% utilizável e o WhatsApp segue registrando lançamentos; nenhuma nova fatura é gerada na Stripe.
   - _Teste AL-5 (pós-período):_ com \`access_until\` no passado (ajuste manual em Admin → Collections → users ou esperando a data chegar), o /billing/status retorna "cancelado" sem acesso; o WhatsApp recusa lançamentos com convite a reassinar; Minha Conta exibe "período já pago foi encerrado".

5. **Plano Anual — Dois Caminhos Coexistem (v0.0.93; à vista unificado na v0.0.95; recorrente RESTAURADO na v0.0.100)**:
   - **Contexto**: contas Stripe domiciliadas no Brasil não oferecem Pix recorrente (Pix Automático), apenas Pix de pagamento único. Decisão da usuária (v0.0.95): o plano anual tem um botão à vista (Pix OU cartão) em checkout \`mode=payment\`, e a mensal segue recorrente por cartão. **Decisão da dona (v0.0.100): a assinatura anual volta a ter cobrança RECORRENTE, sem eliminar o Pix à vista — os dois caminhos coexistem.**
   - **DOIS botões no card Anual (v0.0.100)**:
     1. **"Assinar Anual (recorrente)"** (\`mode=subscription\`): usa o campo \`price_id_anual_recorrente\` do Backoffice (Billing → Configuração Stripe). **Na v0.0.102 o campo foi preenchido pela migração 0045** com o Price real da Stripe de recorrência **"Por ano"** (R$ 214,90/ano, \`price_1UZ11Q31gAsdzIHfGEinrGPA\`), mapeado por consulta à API da Stripe — não é preciso preencher manualmente. O \`price_id_anual\` não é usado pelo checkout recorrente (confirmado pela API: é o Price anual "Por ano" correto, mantido como referência documental).
     2. **"Anual à vista no Pix — pagamento único"** (\`mode=payment\`, Pix ou cartão): valida 12 meses (\`access_until\`), sem renovação automática — comportamento v0.0.95 preservado.
   - **Backend (\`billing_stripe.js\`)**: o endpoint \`POST /backend/v1/billing/create-checkout-session\` recebe \`billing_mode\` (\`recurring\` ou \`one_time\`). Em \`one_time\`, a sessão é criada com \`mode=payment\` e metadados \`billing_mode=one_time\` + \`user_id\` + \`plan_type=anual\` + \`price_cents\`. **NÃO envia \`payment_method_types\`**: a Stripe RECUSA o parâmetro na criação de Checkout Session com 400 — era a causa do 502 em ~80ms com o botão preso em "Redirecionando" (v0.0.93→94). Com os métodos automáticos do Dashboard, o checkout exibe sozinho os habilitados na conta (cartão + Pix para contas domiciliadas no Brasil). Como um \`price_\` criado como recorrente é recusado em mode=payment, a cobrança one-time usa \`price_data\` com o \`unit_amount\` do plano resolvido (override do Backoffice respeitado).
   - **Webhook \`checkout.session.completed\` trata os dois modos (v0.0.100)**: \`mode=subscription\` (anual recorrente) → cria assinatura recorrente com \`stripe_subscription_id\`, \`subscription_plan=anual\`, vigência = \`current_period_end\` da Stripe (+12 meses por ciclo, sincronizada do objeto da Stripe); \`mode=payment\` (one_time) → comportamento atual: \`billing_mode=one_time\`, \`access_until = agora + 12 meses\` e **NUNCA grava \`stripe_subscription_id\`** (regra v0.0.95, blindada na v0.0.100).
   - **E-mail pré-cobrança contempla a anual recorrente (v0.0.100)**: o portão do job AP (que exigia subId) agora inclui a anual recorrente com janela de **7 dias / 1 dia** (renovação anual) e rótulo "Plano Anual Recorrente" com valor de R$ 214,90; a mensal segue com 3 dias / 1 dia e R$ 19,90. Não há duplicação: quem entrou via Pix à vista segue fora desse fluxo (cobre o cenário AQ).
   - **Ativação (webhook \`checkout.session.completed\` com \`mode=payment\`)**: grava \`subscription_status=active\`, \`subscription_plan=anual\`, \`access_until = agora + 12 meses\` (espelhado em \`subscription_expires_at\`), registra no histórico de assinaturas com tipo \`checkout.completed\` e \`billing_mode=one_time\` — SEM criar assinatura Stripe nem \`customer.subscription\`, e NUNCA gravando \`stripe_subscription_id\`. O \`sync-session\` (usado no retorno do checkout) aplica a MESMA regra, então o acesso ativa mesmo se o webhook demorar.
   - **Portões (app + WhatsApp)**: conta ativa por pagamento único passa nos mesmos portões de assinatura ativa. Quando \`access_until\` expira, \`/billing/status\` e o gate do WhatsApp rebaixam para "cancelado" sem acesso (fluxo de não-assinante: convite a reassinar; dados preservados).
  - **Ativação sem subId obsoleto (v0.0.95)**: webhook e sync-session LIMPAM qualquer \`stripe_subscription_id\` remanescente ao ativar um perfil one-time (sobrou da assinatura mensal anterior); a migração 0042 fez o backfill do registro afetado. Sem isso, \`/billing/status\` reportava \`has_stripe_subscription=true\` e a tela voltava a mostrar "Gerenciar assinatura" (portal com a fatura antiga de R$ 19,90). \`/billing/status\` também expõe \`billing_mode\`, \`payment_amount_cents\` e \`payment_paid_at\` (último registro de checkout no histórico).
  - **Portais e cancelamento blindados no backend (v0.0.95)**: \`create-portal-session\` e \`cancel-subscription\` recusam com mensagem clara (400) um perfil one-time ativo (active + plan anual + access_until futuro + sem subId), explicando que não há assinatura a gerenciar/cancelar — o front oculta os botões e o hook é a última linha de defesa.
  - **Sem portal nem cancelamento**: para esse perfil não existe assinatura a cancelar — os botões "Gerenciar assinatura (cartão, faturas)" e "Cancelar assinatura" ficam ocultos e, no lugar deles, um painel destaca: valor pago (R$ 214,90), data do pagamento e "acesso garantido até [data]", com a nota de que não há renovação automática nem assinatura a cancelar.
  - **Retorno do checkout sem ambiguidade**: o checkout one-time usa \`success_url\`/\`cancel_url\` no MESMO host de onde veio o clique (\`{origem}/settings?section=assinatura&checkout=success&session_id={CHECKOUT_SESSION_ID}\`), com allowlist de hosts no hook — o cliente SEMPRE volta ao app logado e vê o banner "Pagamento confirmado! Sua assinatura está ativa 🎉" com plano e validade; a tela "Tudo pronto — você concluiu o pagamento ou esta sessão expirou" da Stripe deixa de fazer parte do fluxo. O botão "Tentar novamente" do cancelamento retoma o MESMO plano em que estava (anual → one_time).
  - **Nome da cobrança no Pix ("Stripe")**: LIMITAÇÃO ESTRUTURAL da Stripe — o Pix é emitido pela Stripe Brasil Soluções de Pagamento - Instituição de Pagamento Ltda. (CNPJ 22.121.209/0001-46, via instituição parceira), e o campo "Nome da cobrança" do app do banco mostra o nome da INSTITUIÇÃO emissora, não do vendedor. Não existe parâmetro de API, Dashboard nem statement descriptor que altere esse nome (descriptor serve só a cartão). Mitigações já no lugar: branding "Consciente (Powered by BFL Soluções em Tecnologia LTDA)" na página do checkout, e-mail de recibo da Stripe e tela Minha Conta com resumo claro do pagamento.
   - _Teste AL-6 (Pix anual — caminho feliz, v0.0.100):_ logada como cliente → Minha Conta → botão "Anual à vista no Pix — pagamento único" → checkout Stripe abre com Pix e cartão → pagar via Pix → retorno AUTOMÁTICO a \`/settings?section=assinatura\` (sem tela "Tudo pronto" da Stripe) → banner "Pagamento confirmado! Sua assinatura está ativa 🎉" com plano Anual e validade = hoje + 12 meses; histórico registra "pagamento único anual via Pix"; \`stripe_subscription_id\` permanece VAZIO (regra v0.0.95).
   - _Teste AL-7 (one-time pelo cartão):_ mesmo fluxo escolhendo cartão na mesma sessão — ativação idêntica (é o mesmo checkout mode=payment), com histórico \`billing_mode=one_time\`.
   - _Teste AL-7b (retorno ao app):_ pagar em outra aba/dispositivo e voltar → o app logado abre em \`/settings?section=assinatura\` e exibe o banner de confirmação com plano e validade; NUNCA a tela "Você concluiu o pagamento ou esta sessão de checkout expirou" da Stripe.
   - _Teste AL-7c (anual RECORRENTE — caminho feliz, v0.0.100; mapeamento automático v0.0.102):_ Minha Conta → botão "Assinar Anual (recorrente)" → o checkout \`mode=subscription\` abre com o Price "Por ano" R$ 214,90 (\`price_1UZ11Q31gAsdzIHfGEinrGPA\`, preenchido pela migração 0045 — sem passo manual no Backoffice) → pagar → status fica "Ativa" com vigência = \`current_period_end\` da Stripe (~12 meses), \`stripe_subscription_id\` preenchido e \`billing_mode\` recorrente; portal e cancelamento funcionam para esse perfil. Se \`price_id_anual_recorrente\` estiver vazio, o checkout falha 400 amigável (defesa no hook).
   - _Teste AL-7d (pré-cobrança contempla a anual recorrente, v0.0.100):_ cliente anual recorrente ativo com renovação em ~7 dias → \`POST /backend/v1/proactive/trigger-precharge\` com \`{ dry_run: true }\` mostra a janela \`precharge_7d\` e o e-mail (disparo real) chega com rótulo "Plano Anual Recorrente", valor R$ 214,90 e data da renovação — dedupe \`precharge_7d:<user>:<data>\` impede reenvio no mesmo dia. Cliente anual recorrente NÃO entra no fluxo do cenário AQ.
   - _Teste AL-8 (expiração do pagamento único):_ com \`access_until\` no passado (ajuste manual em Admin → Collections → users), \`/billing/status\` retorna status sem acesso e o WhatsApp recusa lançamentos com convite a reassinar — igual ao AL-5.
   - _Teste AL-9 (sem portal e com resumo do pagamento):_ logada com plano one-time ativo → os botões "Gerenciar assinatura" e "Cancelar assinatura" NÃO aparecem; aparece o painel do pagamento único com Valor pago, Data do pagamento e validade. Chamada direta a create-portal-session ou cancel-subscription nessa condição responde 400 com a mensagem explicativa (defesa no hook).
   - _Teste AL-10 (mensal intocada):_ o botão "Assinar Mensal" continua abrindo checkout recorrente (\`mode=subscription\`) por cartão, com carência/bloqueio/cancelamento funcionando como nos testes 1–4. Os DOIS botões do card Anual coexistem — ausência de qualquer um deles é regressão da v0.0.100.
   - _Teste AL-11 (falha do checkout Pix — erro amigável, v0.0.94):_ clicar em "Anual à vista no Pix" com a Stripe recusando (ex.: secret key inválida no Backoffice ou instabilidade) → o botão NÃO fica preso em "Redirecionando": volta ao normal em seguida e aparece toast vermelho com mensagem amigável em português (motivo informado pela Stripe, quando houver); o log de hooks registra "[billing] Falha Stripe Checkout (4xx)" — nunca falha silenciosa. Mesma verificação para "Assinar Mensal", "Assinar Anual (recorrente)" (este também quando \`price_id_anual_recorrente\` está vazio no Backoffice) — o erro amigável vale para todos os modos.
   - _Teste AL-12 (cancelamento vira mensal):_ logada como cliente mensal ativo → Cancelar → o registro fica "Cancelada" COM \`stripe_subscription_id\` preservado → o /billing/status segue exibindo portal e cancelamento (portal mostra o histórico de faturas dela). Perfil one-time NUNCA entra nesse fluxo (sem subId).
   - **REGRA PERMANENTE (vale para sempre)**: TODA funcionalidade nova ou ajustada — regra nova ou mudança em regra preexistente — deve obrigatoriamente ser incluída neste roteiro de testes regressivos (\`docsContent.ts\`) NA MESMA entrega. Funcionalidade sem cenário de regressão é considerada incompleta.

---

## AM) Teste de Eco no WhatsApp — Diagnóstico Ponta a Ponta do Webhook (ex-Item 39, v0.0.98)
> **Escopo definido (v0.0.98)**: comando de diagnóstico \`#eco\` (ou \`/eco\`) que valida o caminho completo do webhook do WhatsApp — recebimento pela Meta → resolução de identidade → persistência por wamid → envio de volta pela Meta Graph API — SEM consumir IA. Interceptação no webhook REAL e no \`/simulate\` do Backoffice, mantendo deduplicação por wamid, rate limit e todas as demais interceptações (resumo de caixinhas, desambiguações, cancelamento) intactas. Log de diagnóstico \`[ECO]\` nos hooks.

1. **Caminho Feliz — WhatsApp real (número de teste da Meta)**:
   - Envie pelo número de teste da Meta a mensagem: \`#eco mensagem-de-teste\` (variante \`/eco mensagem-de-teste\` também é aceita).
   - **Comportamento Esperado**:
     - O WhatsApp devolve a MESMA mensagem de volta ("Você enviou: \\"mensagem-de-teste\\""), precedida do cabeçalho "🔁 Teste de Eco — Consciente" e do wamid da mensagem recebida.
     - **NENHUMA resposta da IA é gerada** (nenhum gasto registrado, nenhuma saudação do agente, nenhuma pergunta de caixinha).
     - A mensagem fica contabilizada (\`messages_count\` +1) e o log de hooks registra \`[whatsapp_bridge] [ECO] Interceptação de Teste de Eco\` com from, wamid e payload.

2. **Espelho no Simulador do Backoffice (\`/simulate\`)**:
   - No Backoffice (\`/admin\`), use o simulador de WhatsApp com \`phone_number\` de teste e \`message\` = \`#eco teste via simulador\`.
   - **Comportamento Esperado**:
     - A resposta da API contém \`echo_test: true\` e o campo \`reply\` com a confirmação de eco (sem campo de erro de IA).
     - A resposta espelhada aparece no painel do simulador; se \`send_remote\` habilitado, o eco também chega no WhatsApp real do número informado.
     - Log de hooks registra \`[whatsapp_bridge] [simulate] [ECO]\`.

3. **Zero regressão nas demais interceptações**:
   - Mensagem normal de gasto ("gastei 20 no mercado") NÃO dispara eco — segue para a IA/caixinha como sempre.
   - "#caixinhas" / resumo determinístico e demais comandos seguem funcionando (cenários AH–AK intactos).
   - Nenhuma mensagem duplicada: deduplicação por wamid continua vigente (cenário W).

---

## AN) Escudo e Badge da Assinatura Cancelada — Âmbar em /settings (ex-Item 43, v0.0.97)
> **Objetivo**: o escudo da tela Minha Conta (\`/settings\`, seção Assinatura) não pode mais parecer "verde/ok" quando a assinatura está cancelada. Com status cancelado e acesso futuro, o indicador vira âmbar de alerta; ativa e trial permanecem verdes.

1. **Cancelada com acesso futuro (âmbar)**:
   - Cancelar a assinatura (AL-4) e abrir \`/settings\` → Assinatura.
   - **Comportamento Esperado**:
     - O badge de status mostra **"Cancelada"** (feminino, nunca "Cancelado") em âmbar (amber-100/amber-800).
     - O ícone de escudo é **ShieldAlert âmbar** (não ShieldCheck verde).
     - O bloco de alta visibilidade exibe **"Cancelada — acesso garantido até DD/MM/AAAA"** com a data real do \`access_until\`.

2. **Sem regressão — ativa e trial seguem verdes**:
   - Assinatura ativa (mensal ou anual one-time): escudo ShieldCheck **verde** + badge "Ativa"/"Trial" verde, como antes da mudança.
   - Trial em andamento: escudo verde + contagem de dias de teste — inalterado.

3. **Cancelada sem acesso (cinza-slate)**:
   - Com \`access_until\` no passado (AL-5): badge "Cancelada" cinza-slate neutro, sem bloco âmbar de acesso — mensagem de "período já pago foi encerrado" com convite a reassinar. Nunca verde, nunca âmbar sem acesso.

---

## AO) Lembrete Noturno Amigável via WhatsApp (ex-Item 38, v0.0.99)
> **Escopo definido (v0.0.99)**: rotina agendada diária às 20h30 BRT (\`cronAdd proactive_nightly_reminder\`) que monitora clientes ativos (assinatura ativa, trial gratuito ou cancelada com vigência futura em \`access_until\`). Para quem NÃO fez nenhum lançamento de gasto no dia corrente (fuso \`America/Sao_Paulo\`), envia mensagem amigável via WhatsApp perguntando se está tudo bem e se a pessoa realmente não tem nenhum gasto para lançar — caso tenha, se gostaria de aproveitar e lançar agora. Clientes que já registraram gasto no dia NÃO recebem nada.

1. **Cliente sem lançamentos no dia (caminho feliz)**:
   - Cliente ativo que passou o dia sem mandar nenhum gasto (0 transações ativas do tipo \`expense\` com data de hoje).
   - Às 20h30 BRT (ou via disparo manual admin \`POST /backend/v1/proactive/trigger-nightly\` com \`dry_run: false\`):
   - **Comportamento Esperado**:
     - O sistema identifica elegibilidade do cliente (\`eligible: true\`, \`today_expenses_count: 0\`).
     - Se o cliente mandou mensagem nas últimas 24h, o sistema envia o texto amigável humanizado diretamente via Meta Cloud API; se a conversa estiver fora da janela de 24h, dispara via **template Meta utility** \`lembrete_noturno_lancamento\` com o primeiro nome do cliente na variável {{1}}.
     - Grava registro na coleção \`proactive_logs\` com \`kind = 'nightly_reminder'\`, \`status = 'sent'\`, canal \`whatsapp\` e chave de deduplicação \`user:nightly_reminder:YYYY-MM-DD\`.
     - Mensagem recebida no WhatsApp do cliente:
       > *"Oi, [Nome]! Tudo bem por aí? Passando rapidinho para saber se o seu dia foi tranquilo e se você realmente não teve nenhum gasto para anotar hoje. Se tiver tido algum, quer aproveitar e mandar agora? Estou por aqui para te ajudar! 😊"*

2. **Cliente que já lançou gasto no dia (não envio)**:
   - Cliente ativo que já mandou ao menos um gasto hoje (ex.: R$ 15 no café ou R$ 50 no mercado registrado via WhatsApp ou App).
   - **Comportamento Esperado**:
     - A rotina calcula \`today_expenses_count > 0\` e pula o cliente (\`status = 'skipped'\`, motivo *"Cliente já registrou N gasto(s) hoje"*).
     - **NENHUMA mensagem** é enviada no WhatsApp.
     - Zero ruído e zero interrupção para o cliente que já alimentou o sistema.

3. **Deduplicação estrita (zero mensagens duplicadas no mesmo dia)**:
   - Se o job rodar novamente ou for acionado manualmente uma segunda vez na mesma data:
   - **Comportamento Esperado**:
     - O sistema consulta a coleção \`proactive_logs\` pelo \`dedupe_key\` (\`user:nightly_reminder:YYYY-MM-DD\`).
     - Constatando registro existente, pula o envio com status \`skipped\` ("Lembrete noturno já enviado hoje para este usuário").
     - Nenhuma mensagem duplicada é enviada.

4. **Portão de vigência e inadimplência**:
   - Assinatura ativa ou trial: elegível.
   - Cancelada COM vigência futura (\`access_until > agora\`): elegível (WhatsApp trata vigência futura como ativo, com acesso total).
   - Cancelada SEM vigência (\`access_until < agora\` ou inexistente): NÃO elegível (\`status = 'skipped'\`, motivo *"Sem assinatura/acesso ativo"*).
   - Inadimplente (\`past_due\`, \`unpaid\`): NÃO elegível.

5. **Validação e auditoria operacional (Admin)**:
   - Endpoint \`GET /backend/v1/proactive/status\` (autenticado como admin) retorna status da rotina, contagem de logs recentes e detalhes do template \`lembrete_noturno_lancamento\`.
   - Endpoint \`POST /backend/v1/proactive/trigger-nightly\` aceita \`{ dry_run: true }\` para simular a varredura sem enviar WhatsApp de verdade, inspecionando quantos clientes receberiam.

---

## AP) E-mail de Aviso Pré-Cobrança da Assinatura Recorrente (ex-Item 42, v0.0.99)
> **Escopo definido (v0.0.99)**: rotina agendada diária às 09h00 BRT (\`cronAdd proactive_precharge_email\`) que monitora clientes com assinatura mensal recorrente via cartão (\`stripe_subscription_id\` preenchido e status ativo). Envia e-mail de aviso prévio com 3 dias de antecedência e novamente com 1 dia de antecedência da próxima renovação.

1. **Janela de 3 dias antes da renovação (caminho feliz)**:
   - Cliente mensal recorrente ativo cuja próxima data de cobrança (\`current_period_end\` retornado da Stripe ou \`subscription_expires_at\` sincronizado) cai exatamente daqui a 3 dias (fuso BRT).
   - **Comportamento Esperado**:
     - O job identifica a janela de 3 dias e dispara e-mail com assunto:
       > *"Lembrete: sua assinatura do Consciente renova em 3 dias 💳"*
     - Corpo do e-mail em HTML responsivo com branding oficial Consciente (gradiente esmeralda, tipografia clara, razão social BFL Soluções em Tecnologia), informando:
       - Nome do cliente;
       - Nome do plano ("Plano Mensal Consciente");
       - Valor da renovação (R$ 19,90);
       - Data exata da cobrança formatada em português (DD/MM/AAAA);
       - Botão com link direto para a tela Minha Conta (\`/settings?section=assinatura\`) para gerenciar cartão ou cancelar a qualquer momento sem atrito.
     - Grava log em \`proactive_logs\` com \`kind = 'precharge_3d'\`, canal \`email\` e dedupe key \`user:precharge_3d:YYYY-MM-DD\`.

2. **Janela de 1 dia antes da renovação (caminho feliz)**:
   - Cliente mensal recorrente ativo cuja próxima cobrança cai amanhã (1 dia).
   - **Comportamento Esperado**:
     - O job identifica a janela de 1 dia e dispara e-mail com assunto:
       > *"Sua assinatura do Consciente renova amanhã 💳"*
     - Grava log em \`proactive_logs\` com \`kind = 'precharge_1d'\`, canal \`email\` e dedupe key \`user:precharge_1d:YYYY-MM-DD\`.

3. **Plano Anual à vista (pagamento único via Pix/cartão) NUNCA recebe**:
   - Cliente com plano anual (v0.0.95: \`billing_mode = one_time\`, validade de 12 meses, sem assinatura recorrente Stripe e sem \`stripe_subscription_id\`).
   - **Comportamento Esperado**:
     - O job identifica a ausência de assinatura recorrente (\`stripe_subscription_id\` vazio ou status não recorrente).
     - **NENHUM e-mail** é enviado.
     - Motivo documentado: o anual é pagamento único à vista e não possui cobrança futura automática.

4. **Contas canceladas, expiradas e em trial NUNCA recebem**:
   - Assinatura já cancelada (mesmo que com dias restantes de vigência): NÃO tem próxima cobrança futura → **NÃO recebe**.
   - Assinatura expirada ou inativa: **NÃO recebe**.
   - Usuário em período de teste gratuito (trial) sem cartão/assinatura recorrente criada: **NÃO recebe**.

5. **Deduplicação estrita (uma mensagem por janela por ciclo)**:
   - Se o job rodar múltiplas vezes no mesmo dia, o \`dedupe_key\` atômico impede reenvio do aviso de 3 dias ou de 1 dia para o mesmo ciclo.

6. **Validação operacional via Backoffice (Admin)**:
   - Endpoint \`POST /backend/v1/proactive/trigger-precharge\` com \`{ dry_run: true }\` lista os clientes nas janelas de 3d e 1d sem enviar e-mails reais.
   - Endpoint \`POST /backend/v1/proactive/test-email\` permite enviar um e-mail de teste real para o e-mail da administradora (\`to\`, \`days_ahead = 3\` ou \`1\`) para homologar a formatação visual e entregabilidade do SMTP.

---

## AQ) Aviso de Renovação do Plano Anual à vista (Pix) — 30 e 7 dias antes da validade (v0.0.101)
> **Escopo definido (v0.0.101)**: rotina agendada diária às 10h30 BRT (\`cronAdd proactive_pix_renewal\`) que monitora clientes com plano anual à vista (\`billing_mode = 'one_time'\` pago via Pix/cartão, v0.0.95) cuja validade (\`access_until\` / \`payment_paid_at\` + 12 meses) está a **exatamente 30 dias** ou a **exatamente 7 dias** de expirar (fuso BRT). Envia AVISO duplo (e-mail HTML Consciente + mensagem amigável no WhatsApp) convidando à renovação ANTES do acesso expirar. **NUNCA** envia para quem tem assinatura recorrente ativa (\`stripe_subscription_id\` preenchido) — a renovação deles é automática (AL-7c) e já coberta pelo cenário AP.

1. **Janela de 30 dias antes da validade (caminho feliz)**:
   - Cliente com plano anual à vista ativo, pago em DD/MM cuja validade cai daqui a exatamente 30 dias (fuso BRT).
   - **Comportamento Esperado**:
     - \`POST /backend/v1/proactive/trigger-pix-renewal\` com \`{ dry_run: true }\` lista o cliente com \`window = 'renewal_30d'\` e a data exata de validade.
     - Disparo real (dry_run false ou cron): e-mail com assunto em tom amigável Consciente ("Seu Consciente renova em 30 dias — quer continuar com a gente? 💚"), corpo HTML responsivo com branding oficial (razão social BFL Soluções em Tecnologia), valor do plano anual (R$ 214,90), data da validade e botão/link direto para \`/settings?section=assinatura\` para renovar.
     - Mensagem WhatsApp amigável no mesmo disparo, convidando à renovação antes do vencimento (sem link de checkout automático — a renovação é feita pela cliente em Minha Conta).
     - Grava registro em \`proactive_logs\` com \`kind = 'renewal_30d'\` e dedupe key \`renewal_30d:<user_id>:<data>\`.

2. **Janela de 7 dias antes da validade (caminho feliz)**:
   - Mesmo cliente, com a validade daqui a exatamente 7 dias.
   - **Comportamento Esperado**:
     - Mesmo fluxo da janela de 30d, com \`window = 'renewal_7d'\`, tom de urgência leve ("faltam só 7 dias") e link/CTA para \`/settings?section=assinatura\`.
     - Grava registro com \`kind = 'renewal_7d'\` e dedupe key \`renewal_7d:<user_id>:<data>\`.

3. **NUNCA envia para assinatura recorrente ativa (blindagem)**:
   - Cliente com \`stripe_subscription_id\` preenchido (mensal recorrente ou anual recorrente AL-7c) — mesmo que o access_until esteja na janela:
   - **Comportamento Esperado**:
     - A rotina pula o cliente (\`status = 'skipped'\`, motivo "possui assinatura recorrente ativa — renovação automática").
     - Nenhum e-mail, nenhuma mensagem WhatsApp.
     - Cobre o AL-7d: cliente anual recorrente NÃO entra no fluxo do cenário AQ.

4. **Dedupe rígido (zero duplicatas no mesmo dia)**:
   - Job rodando 2+ vezes no mesmo dia (cron + trigger manual), para as MESMAS janelas \`renewal_30d\` / \`renewal_7d\`:
   - **Comportamento Esperado**:
     - Segunda execução encontra o registro em \`proactive_logs\` pela dedupe key atômica (\`renewal_30d:<user_id>:<data>\` / \`renewal_7d:<user_id>:<data>\`) e pula o envio com \`status = 'skipped'\` ("aviso já enviado hoje").
     - Zero e-mails duplicados, zero mensagens WhatsApp duplicadas.

5. **Falha de SMTP/WhatsApp nunca trava o job**:
   - Simule falha de SMTP (SMTP não configurado no painel PocketBase) ou falha de envio na Meta:
   - **Comportamento Esperado**:
     - O erro é registrado em \`proactive_logs\` (\`status = 'failed'\` com motivo) e nos logs de hooks, SEM interromper o processamento dos demais clientes da rodada.
     - O job seguinte (dia seguinte) tenta de novo, já que dedupe só grava quando o envio realmente aconteceu.

6. **Validação operacional via Backoffice (Admin)**:
   - Endpoint \`POST /backend/v1/proactive/trigger-pix-renewal\` com \`{ dry_run: true }\` lista quem receberia o aviso (janelas 30d/7d), SEM enviar nada — deve incluir apenas clientes one_time com validade nas janelas exatas, nunca clientes recorrentes.
   - Endpoint \`GET /backend/v1/proactive/status\` mostra o engine proativo carregado (require + fallback globalThis), contagem de logs recentes e últimos registros de renovação Pix.
   - Verificação do cron (Admin → logs de hooks): às 10h30 BRT o \`[cron:proactive_pix_renewal]\` roda SEM "GoError: Invalid module" (correção v0.0.101 do fallback globalThis no engine).

---

## AR) Virada de Vigência de Plano — Preços Black November → Padrão (regra AG da tabela subscription_plans, v0.0.103)
> **Escopo (v0.0.103)**: hook de integridade \`subscription_plans_vigencia.js\` no Backoffice (Billing → Planos): vigências do MESMO plan_type não podem se sobrepor; \`valid_until <= valid_from\` é rejeitado; trilhas mensal e anual são INDEPENDENTES (sobreposição entre tipos diferentes é permitida); janelas em sequência são permitidas (uma linha "válida até 30/11" seguida de outra "a partir de 01/12" — janelas semiabertas [from, until)); linhas inativas e linhas com \`user_override\` (vigência por cliente) ficam FORA da checagem. A tabela de planos governa apenas NOVAS contratações — assinantes atuais não são afetados pela virada.

1. **Véspera da virada (30/11/2026) — preços Black November ativos**:
   - Abrir Minha Conta (\`/settings?section=assinatura\`) como cliente.
   - **Comportamento Esperado**:
     - Os cards de plano exibem **Mensal R$ 19,90** e **Anual R$ 214,90** (Black November), resolvidos das linhas ativas de \`subscription_plans\` vigentes na data (Mensal Black November e Anual Black November, válidas até 30/11/2026).

2. **Dia da virada (01/12/2026) — preços Padrão sem intervenção manual**:
   - No dia 01/12, recarregar a mesma tela (ou conferir após a virada).
   - **Comportamento Esperado**:
     - Os cards passam a exibir **Mensal R$ 29,90** e **Anual R$ 322,90** (Padrão) automaticamente — a troca acontece só pela vigência das linhas (janela Black November "até 30/11" encerra; linhas Padrão "a partir de 01/12" entram), sem editar nada no Backoffice nem mexer em código.

3. **Assinantes atuais não afetados pela virada**:
   - Cliente com assinatura ativa contratada no preço promocional: em 01/12 o valor dela NÃO muda — a virada de vigência governa apenas novas contratações/renovações de checkout; contratos ativos seguem pelo valor contratado (cancelamento e portal ver cenário AL-4/AL-12).

4. **Validação da integridade de vigência no Backoffice (Billing → Planos, admin)** — fonte única da regra é a rota \`POST /backend/v1/admin/billing/plans\` (v0.0.105: checagem inline na rota, antes do \`$app.save\`; v0.0.107: fronteira INCLUSIVA nas duas pontas, comparação \`<=\`):
   - Tentar salvar uma linha MENSAL terminando **30/11/2026** quando "Mensal Padrão" já começa **01/12/2026** (janelas consecutivas tocando a fronteira):
     - **Comportamento Esperado (v0.0.107/v0.0.108, REGRA DA FRONTEIRA INCLUSIVA)**: o dia de fronteira pertence a UMA SÓ vigência — salvar linha mensal terminando **30/11/2026** quando outra já começa **01/12/2026** é CONFLITO REJEITADO (janelas consecutivas exigem 1 dia de folga); salvar com fronteira no MESMO dia também é rejeitado. Salvamento bloqueado com HTTP 400 e mensagem amigável citando o plano conflitante e o período — nada é gravado, nunca erro 500 nem falha silenciosa (comprovado por teste HTTP real em 15/11/2026 contra o backend vivo, v0.0.108: POST com fronteira igual → 400 "Já existe um plano mensal vigente no período ...: ... Ajuste a vigência para não sobrepor essa linha."; POST válido → 200).
   - Tentar salvar uma linha ANUAL com a mesma fronteira (termina 01/12/2026 + começa 01/12/2026): REJEITADA igual — a REGRA DA FRONTEIRA INCLUSIVA vale para o trilho anual também (mesma mensagem, citando o plano anual conflitante; comprovado via API real na v0.0.108).
   - **PROVA DOCUMENTADA (v0.0.108, registrada em 15/11/2026 — teste HTTP REAL contra o backend vivo)**: com login de admin autenticado, \`POST /backend/v1/admin/billing/plans\` tentando salvar linha MENSAL terminando **30/11/2026** quando outra mensal já começa **01/12/2026** → resposta **HTTP 400** com mensagem amigável em pt-BR ("Já existe um plano mensal vigente no período ... Ajuste a vigência para não sobrepor essa linha."), NADA gravado em \`subscription_plans\`; POST subsequente com vigência VÁLIDA (sequência 30/11 → 01/12, com 1 dia de folga na fronteira inclusiva) → **HTTP 200** com toast verde "Plano salvo!". Mesma prova repetida no trilho ANUAL (fronteira 01/12+01/12 → 400). Este parágrafo é o registro formal da prova — nenhuma nova execução é necessária; regressão desta regra = falha do roteiro.
   - Tentar salvar uma linha com \`valid_until <= valid_from\` (ex.: de 10/12 a 05/12): REJEITADA com erro amigável de "fim antes do início".
   - Salvar uma linha ANUAL com janela que conflita só com a trilho MENSAL: ACEITA — as trilhas mensal e anual são independentes.
   - Salvar linha mensal "válida até 30/11" quando já existe outra "a partir de 01/12" (sequência, sem sobreposição): ACEITA (janelas semiabertas [from, until); fronteira inclusiva exige 1 dia de folga entre janelas consecutivas do mesmo tipo).
   - Linhas inativas e linhas com \`user_override\` (vigência por cliente) continuam salvas mesmo se sobrepostas à trilha geral — ficam fora da checagem e convivem com ela.

5. **Mensageria do erro de vigência no Backoffice (v0.0.104)**:
   - Repetir o item 4.1 (salvar linha mensal sobreposta) e observar o TOAST vermelho:
     - **Comportamento Esperado (v0.0.104)**: o toast exibe a MENSAGEM COMPLETA do hook em português — ex.: "Já existe um plano mensal válido no período 01/12/2026 em diante: Mensal Padrão. Ajuste a vigência para não sobrepor essa linha." — NUNCA o texto genérico em inglês "Something went wrong." O plano conflitante NÃO é salvo e a tabela não recarrega com a linha sobreposta.
   - Salvar depois uma linha VÁLIDA (sem sobreposição): toast verde "Plano salvo!" e tabela recarregada — salvamento normal sem regressão.
   - Cobertura estendida: os demais salvamentos do Backoffice (Dados Legais, Configuração Stripe) seguem a mesma regra — erro com mensagem própria é exibido tal como o backend devolveu; frases genéricas do SDK em inglês nunca aparecem.

6. **Fonte única da validação na rota de salvar plano (v0.0.105)**:
   - **Correção de causa raiz**: a usuária salvou "Mensal Padrão" com vigência sobreposta e recebeu "Plano salvo!" — a checagem vivia só no hook de coleção (\`onRecordUpdate\`), que não é acionado de forma confiável quando a rota admin regrava o registro via \`$app.save\`; o erro de 400 também podia ser engolido pelo catch da rota.
   - **Comportamento Esperado (v0.0.105)**: a MESMA checagem de vigência roda INLINE dentro da rota \`POST /backend/v1/admin/billing/plans\` (fonte única, antes do \`$app.save\`) — qualquer sobreposição do mesmo \`plan_type\` é devolvida como HTTP 400 em português citando plano e período, e NADA é gravado. Reproduzido por teste HTTP real contra o backend (login admin + POST na rota real): POST sobreposto → 400 "Já existe um plano mensal vigente no período..."; POST válido → 200.
   - O hook de coleção \`subscription_plans_vigencia.js\` continua como blindagem para gravações DIRETAS na coleção (painel PocketBase), com a mesma regra — agora idêntica à da rota (mesma comparação, mesma mensagem).
   - Salvamentos válidos continuam com o toast verde "Plano salvo!" e a recarga da tabela.

7. **Resíduo de UI "Sem assinatura Stripe" para pagamento único (v0.0.105)**:
   - **Correção**: na aba "Assinaturas dos Clientes" do Backoffice, a coluna Stripe mostrava "Sem assinatura Stripe" para quem pagou à vista (one_time Pix/cartão) — a ausência de \`stripe_subscription_id\` é o comportamento CORRETO desde a v0.0.95 e não deve ser sinalizada como problema.
   - **Comportamento Esperado (v0.0.105)**: cliente one_time pago exibe "Pagamento único (Pix/cartão)"; quem tem assinatura recorrente continua "Assinatura vinculada"; só quem não tem nenhum dos dois continua vendo "Sem assinatura Stripe". O endpoint \`GET /backend/v1/admin/billing/subscriptions\` agora expõe \`billing_mode\`, \`payment_amount_cents\`, \`payment_paid_at\` e \`access_until\`.

---

## AS) Importação de Preços da Stripe como Rascunhos (v0.0.110)
> **Escopo (v0.0.110)**: botão "Importar preços da Stripe" no Backoffice (Billing → Planos e Preços) chama a rota \`POST /backend/v1/admin/billing/stripe/import-prices\` (hook \`billing_stripe.js\`, lógica 100% inline no callback, \`$http.send\` com Bearer da secret key de \`stripe_config\`), que lista os Prices ativos do produto Consciente (\`prod_Va2uSpOiSeedcC\`) na API da Stripe e grava cada um como linha RASCUNHO em \`subscription_plans\` (\`active = false\`, sem \`valid_from\`/\`valid_until\`, \`stripe_price_id\` preenchido). Dedupe por \`stripe_price_id\` em TODAS as linhas (ativas ou não).

1. **Clicar "Importar preços da Stripe" (com Prices já mapeados na tabela)**:
   - No Backoffice (Billing → Planos e Preços), clicar no botão **"Importar preços da Stripe"**.
   - **Comportamento Esperado**: toast de resumo com o resultado da importação — ex.: "0 importados, 4 já existentes" (formato "X importados, Y já existentes"); a tabela de planos recarrega.

2. **Dedupe por \`stripe_price_id\` (clique repetido nunca duplica)**:
   - Clicar no botão novamente (e quantas vezes quiser).
   - **Comportamento Esperado**: os 4 Prices reais da conta Stripe (mensal promo \`…ftUWaEJB0\` R$ 19,90/mês, mensal padrão \`…fLP1oZJKS\` R$ 29,90/mês, anual promo \`…fGEinrGPA\` R$ 214,90/ano, anual padrão \`…fNapN7q6b\` R$ 322,90/ano) aparecem como "já existentes" no toast e NENHUMA linha nova é criada para eles — o dedupe compara \`stripe_price_id\` contra TODAS as linhas de \`subscription_plans\` (ativas ou não).

3. **Price NOVO criado na Stripe → rascunho âmbar sem vigência**:
   - Criar um Price novo no produto Consciente na Stripe (ex.: promoção futura) e clicar "Importar preços da Stripe".
   - **Comportamento Esperado**: o Price novo entra na tabela como linha RASCUNHO destacada em âmbar com badge "Rascunho — defina a vigência": \`active = false\`, sem \`valid_from\`/\`valid_until\`, label com o nome da Stripe + valor em R$ + periodicidade; o toast passa a contar "1 importado, 4 já existentes".

4. **Rascunho fora da oferta pública e fora do hook de vigência**:
   - Enquanto \`active = false\` e sem vigência, conferir \`/settings?section=assinatura\` (como cliente) e tentar salvar outras linhas no Backoffice.
   - **Comportamento Esperado**: o rascunho NÃO aparece nos cards de plano da oferta pública (resolvida só por linhas ativas vigentes) e NÃO dispara a checagem de vigência (hook/rota ignoram linhas inativas — regra do cenário AR preservada); salvamentos de outras linhas continuam funcionando normalmente com o rascunho presente.

5. **Definir vigência/\`plan_type\` e ATIVAR o rascunho**:
   - Editar o rascunho: definir \`plan_type\` (mensal/anual), \`valid_from\`/\`valid_until\` coerentes com a regra do cenário AR (fronteira inclusiva, sem sobrepor vigência do mesmo tipo) e marcar ATIVO.
   - **Comportamento Esperado**: salvamento OK (toast verde "Plano salvo!"), a linha sai da condição de rascunho (para de exibir o destaque âmbar e o badge) e passa a valer conforme a vigência — entrando na oferta pública quando dentro da janela; se a vigência salva sobrepor outra do mesmo tipo, HTTP 400 com mensagem amigável e nada é gravado (cenário AR).

6. **Proteção sem secret key**:
   - Se a secret key da Stripe não estiver configurada (\`stripe_config\` vazio), clicar "Importar preços da Stripe".
   - **Comportamento Esperado**: a rota devolve HTTP 400 com mensagem amigável ("A secret key da Stripe ainda não foi configurada...") — nada é importado e nunca erro 500.

---

## AT) Tooltips, Dirty-Save e Histórico de Preços (v0.0.112)
> **Escopo (v0.0.112)**: refinamentos do Backoffice (Billing → Planos e Preços e Configuração Stripe) pedidos pela dona: (1) tooltips explicando a DIREÇÃO de cada integração nos botões "Importar preços da Stripe" (Stripe → App) e "Sincronizar produtos na Stripe" (App → Stripe), SEM confirmação extra no Sincronizar; (2) dirty-save por linha: o botão **Salvar** de cada Price só habilita com alteração real nos campos daquela linha e volta a desabilitar após salvar; (3) **Histórico por plano**: botão "Histórico" em cada linha abre dialog com a trilha gravada na coleção \`subscription_plans_audit\` (migração 0052) via rota \`GET /backend/v1/admin/billing/plans/history?plan_id=\` — quem alterou, quando e o que mudou por campo (antes → depois). A gravação da trilha é inline nas rotas admin: criar/editar/definir_vigencia no POST de plano e \`importar\` na rota de importação. Campos de Price ID da Configuração Stripe auditados: \`price_id_mensal\` e \`price_id_anual_recorrente\` servem ao sync de produtos (fallback/pareamento), \`price_id_anual\` é legado e nunca é lido.

1. **Tooltips de direção nos botões Importar e Sincronizar**:
   - No Backoffice (Billing → Planos e Preços), passar o mouse (ou focar) sobre o botão **"Importar preços da Stripe"** e depois sobre **"Sincronizar produtos na Stripe"**.
   - **Comportamento Esperado**: tooltip visível em cada um, explicando a direção — Importar: "Traz os Prices da Stripe para o app (Stripe → App): cria rascunhos pendentes de vigência." / Sincronizar: "Envia os dados do app para a Stripe (App → Stripe): cria/atualiza os produtos, sem confirmação extra." Nenhuma janela de confirmação adicional abre ao clicar em Sincronizar.

2. **Dirty-save: linha sem mudança tem Salvar desabilitado**:
   - Abrir/recarregar a tabela "Planos e Preços" e, SEM tocar em nenhum campo de uma linha, observar o botão **Salvar** dessa linha.
   - **Comportamento Esperado**: o botão Salvar da linha está DESABILITADO (nada mudou); editar qualquer campo da linha (nome, preço, vigência, ativo) habilita o botão imediatamente; após salvar com sucesso (toast verde "Plano salvo!" e recarga da tabela), o botão volta a ficar DESABILITADO (a linha volta ao estado salvo).

3. **Trilha de alterações por plano (botão Histórico)**:
   - Editar um Price (ex.: alterar o preço), salvar, e clicar no botão **Histórico** dessa linha.
   - **Comportamento Esperado**: abre um dialog com a trilha legível, mais recente primeiro — cada entrada mostra a AÇÃO (Criado / Editado / Vigência definida / Importado), AUTOR (e-mail de quem gravou), DATA/HORA e as MUDANÇAS por campo no formato "Campo: antes → depois" (ex.: "Preço: 1990 → 2990"). A trilha vem da rota \`GET /backend/v1/admin/billing/plans/history?plan_id=\` (coleção \`subscription_plans_audit\`, leitura restrita a admin).

4. **Importação registra entrada "Importado" na trilha**:
   - Criar um Price novo na Stripe (ou usar um Price que ainda não esteja na tabela) e clicar "Importar preços da Stripe"; depois abrir o Histórico da linha importada.
   - **Comportamento Esperado**: a importação gravou uma entrada com ação "Importado" citando o \`stripe_price_id\` e o autor — a linha importada já nasce com trilha (rascunho âmbar conforme cenário AS).

5. **Ação "Vigência definida" e blindagem da trilha**:
   - Definir vigência/plan_type num rascunho e ativar (fluxo do cenário AS passo 5), depois abrir o Histórico dessa linha.
   - **Comportamento Esperado**: a gravação entrou com ação "Vigência definida" mostrando os campos de vigência antes → depois; falha de auditoria (ex.: coleção indisponível) nunca bloqueia o salvamento do plano — o plano é salvo e o erro é só logado no servidor ("Auditoria falhou (plano salvo, sem trilha)").

---

## AU) Cobertura Contínua de Vigências por Trilha (v0.0.114)
> **Escopo (v0.0.114)**: regra pedida pela dona — "da data corrente em diante, o sistema não pode permitir que uma data ou intervalo de datas futuras fique sem plano definido" (senão um cliente que chega para se cadastrar não encontra plano disponível). Além do hook de integridade de sobreposição (fronteira INCLUSIVA, cenário AR), o salvamento de plano no Backoffice (rota \`POST /backend/v1/admin/billing/plans\`, hook \`billing_stripe.js\`) e o hook de coleção (\`subscription_plans_vigencia.js\`) agora SIMULAM a linha de vigências ativas de CADA trilha (mensal e anual separadamente) incluindo a linha que está sendo salva, e rejeitam com 400 qualquer lacuna de datas ≥ 1 dia entre "hoje ou depois" e o fim da trilha. A trilha precisa SEMPRE terminar numa linha aberta (valid_until vazio) que cubra o futuro. Rascunhos (linhas inativas da importação da Stripe) continuam fora da checagem até definirem vigência e serem ativados. Nova rota de diagnóstico \`GET /backend/v1/admin/billing/plans/coverage\` (admin) devolve a simulação por trilha sem gravar nada. Implementação única em \`globalThis.__vigenciaCobertura\` (registrada por \`subscription_plans_vigencia.js\`), consumida pela rota admin e pelos hooks de coleção.
> **Nota v0.0.115 (defeito corrigido nesta rodada)**: a primeira prova real do cenário AU exibiu o erro CRU da JSVM no toast — "Erro ao salvar plano — Object has no member '__vigenciaCobertura'" — porque a chamada \`globalThis.__vigenciaCobertura(...)\` dependia da ordem de carregamento dos hooks. Correção: todos os consumidores resolvem a função de forma DEFENSIVA (typeof + try) com FALLBACK 100% inline da mesma lógica, e o caminho de erro devolve SEMPRE 400 com a mensagem amigável em português citando o intervalo — nunca erro cru em inglês nem "Something went wrong". Ao reproduzir este cenário, confirme que o toast traz a mensagem em PT citando o intervalo sem cobertura.

1. **Buraco de datas é rejeitado citando o intervalo (exemplo da dona)**:
   - Estar com a trilha mensal coberta (ex.: "Mensal (Black November)" de 01/01/2024 a 30/11/2026 e "Mensal Padrão" de 01/12/2026 em diante). Editar o "Mensal Padrão" (ou criar uma linha mensal ativa) para começar em **05/12/2026** em diante, e salvar.
   - **Comportamento Esperado**: HTTP 400 com mensagem amigável em pt-BR: "A trilha mensal ficaria SEM cobertura entre 2026-12-01 e 2026-12-05 — nenhuma data futura pode ficar sem plano definido: um cliente que chegar nesse período (ex.: 03/12/2026) não encontraria plano disponível. Ajuste as vigências para que a trilha seja contínua (ex.: uma termina 30/11 e a próxima começa 01/12)." O plano NÃO é salvo e o toast do Backoffice mostra essa mensagem (getBackendErrorMessage extrai a mensagem real do corpo 400).

2. **Mesma rejeição na trilha anual**:
   - Repetir o teste na trilha anual: linha anual termina 30/11/2026 e a nova anual ativa começa 05/12/2026 (sem fim).
   - **Comportamento Esperado**: 400 com a mesma mensagem citando "A trilha anual ficaria SEM cobertura entre 2026-12-01 e 2026-12-05 ...".

3. **Vigências contíguas continuam aceitas (fronteira inclusiva)**:
   - Voltar as vigências ao estado contíguo (mensal termina 30/11/2026, próxima mensal começa 01/12/2026 em diante) e salvar.
   - **Comportamento Esperado**: salvamento OK ("Plano salvo com sucesso!") — o dia de fronteira pertence a uma só vigência; não há buraco (nem sobreposição, cenário AR).

4. **Trilha sem linha aberta cobrindo o futuro é rejeitada**:
   - Simular (via API/rota de cobertura) uma trilha em que TODAS as linhas têm valid_until preenchido (nenhuma "em diante") — ex.: definir vigência final na linha que hoje fecha a trilha.
   - **Comportamento Esperado**: 400 com mensagem "A trilha [mensal|anual] terminaria em [data] e ficaria SEM cobertura a partir do dia seguinte — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante) ...". Na rota \`GET /backend/v1/admin/billing/plans/coverage\`, a trilha correspondente aparece com \`ok: false\` e o mesmo texto.

5. **Rascunhos da importação continuam fora da checagem; diagnóstico de cobertura**:
   - Com rascunhos inativos da importação da Stripe na tabela (cenário AS) e as trilhas ativas contínuas, clicar "Importar preços da Stripe" novamente e salvar/editar rascunhos sem ativar.
   - **Comportamento Esperado**: nada muda na validação — rascunhos (active = false) não entram na simulação de cobertura; eles SÓ são validados ao definir vigência e ativar. Em \`GET /backend/v1/admin/billing/plans/coverage\`, com as trilhas contíguas, ambas aparecem \`ok: true\` com as linhas simuladas a partir de hoje.

---
`
