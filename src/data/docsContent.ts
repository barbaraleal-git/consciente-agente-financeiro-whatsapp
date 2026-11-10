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

Documento oficial de controle de pendências e prioridades do produto (itens 1 a 37). Este documento serve como guia estratégico para os próximos passos de evolução, mantido e reavaliado a cada ciclo de desenvolvimento.

**Regra Permanente**: Zero regressão. Tudo o que já foi validado e entregue deve obrigatoriamente se manter estável a cada nova iteração.

---

## Legenda de Status

- **Concluído**: Funcionalidade ou correção entregue, testada e validada em produção.
- **Respondido / Aguardando Decisão**: Dúvida ou definição já esclarecida tecnicamente; não há pendência de código imediata ou aguarda direcionamento estratégico de negócio.
- **Backlog**: Item pendente de desenvolvimento, reclassificado por esforço/velocidade de entrega.

---

## 1. Itens Concluídos

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
| **Parametrização Categoria↔Caixinhas por Cliente (Vínculos N:N Personalizados)** | Atendimento ao pedido da usuária: o próprio cliente define quais categorias de lançamentos podem ser consideradas em quais caixinhas (ex.: *"Alimentação Essencial"* alimentando tanto a caixinha *Alimentação VR* quanto *Alimentação VA*; *"Alimentação Não Essencial"* em *VR* e em *Lazer*). Modelada nova coleção idempotente \`category_caixinha_links\`, aba *"Categorias Vinculadas"* no modal de edição de caixinhas (\`/budgets\`), matcher unificado (\`caixinhaMatcher.ts\` e \`caixinhas_summary_helper.js\`) com fallback retrocompatível de zero regressão para clientes sem vínculos e isolamento total de cancelados. | **Concluído** |
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
| **Item 2** | Impacto do áudio no custo | **Respondido**: O custo de transcrição de áudio via Groq Whisper large-v3-turbo é de cerca de **R$ 0,001 por áudio** (frações mínimas de centavo), sendo considerado desprezível no custo unitário por cliente. | **Respondido/Aguardando decisão** |
| **Item 4** | Previsão de custo por cliente/mês | **Respondido**: Modelo unitário calibrado e auditável no backoffice (áudio R$ 0,001, IA R$ 0,02, utility R$ 0,04, mensagens de serviço R$ 0,00). Custo médio estimado entre R$ 1,50 e R$ 3,50/cliente/mês dependendo do engajamento. | **Respondido/Aguardando decisão** |
| **Item 6** | Regras de investimento | **Explicadas**: Regras conceituais e diferenciação entre reserva de emergência, aportes e metas foram explicadas. **Pendente decisão** sobre formato da caixinha de investimento (se terá teto reverso ou meta de acúmulo). | **Respondido/Aguardando decisão** |
| **Item 21** | Cyber security | **Processo contínuo**: Aplicação das melhores práticas (mascaramento estrito de tokens, endpoints protegidos por papéis, validação de payload da Meta, SSL forçado e políticas de acesso). Continua como rotina permanente de segurança. | **Respondido/Aguardando decisão** |
| **Item 29** | Teste de carga | **Definido como será feito**: Arquitetura do teste de carga formulada (simulação concorrente no webhook e no pipeline do agente) para validação de volume antes do lançamento comercial aberto. | **Respondido/Aguardando decisão** |
| **Item 35** | Campo de nome social no cadastro | **Respondido**: Não é obrigatório (LGPD minimiza coleta de dados). O agente utiliza o nome informado no cadastro e usa o nome de perfil do WhatsApp (\`Profile.Name\` enviado pela Meta) como fallback automático empático. Caso desejado futuramente, um campo opcional "Como prefere ser chamada(o)?" pode ser adicionado no perfil sem bloqueio de código. **Sem pendência de código no momento**. | **Respondido/Aguardando decisão** |

---

## 3. Backlog (Pendentes — Reclassificados por Velocidade e Complexidade)

### 3.1. Rápida Execução / Alto Impacto Imediato
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 1** | E-mail de confirmação obrigatório | Exigir verificação estrita de e-mail antes da liberação total de acessos críticos na plataforma web. |
| **Item 30** | Alerta ao admin a cada abertura de pedido de suporte | Notificação automática (email/alerta) para a administradora ao abrir ticket. **Sinergia**: Complementa o Item 25 (suporte) e compartilha a infraestrutura de alerta imediato do Item 26. |

### 3.2. Média Complexidade
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 3** | Mensagem da manhã via WhatsApp | Envio pró-ativo matinal com status financeiro e lembrete de gastos. **Dependência**: Requer modelo de mensagem (utility template) aprovado pela Meta no WhatsApp Manager. |
| **Item 10+11** | Lançamento sem caixinha | Tratamento conversacional de despesas que não se enquadram nas caixinhas existentes: agente sugere alocar em "Outros" ou criar nova caixinha. |
| **Item 25** | Módulo de suporte | Central de tickets e atendimento integrado para clientes solicitarem ajuda à equipe humana do Consciente. Complementado pelo Item 30. |
| **Item 26** | Feedbacks via WhatsApp + alerta imediato | Canal conversacional para o cliente enviar sugestões e elogios, gerando alerta imediato para a administradora. |
| **Item 32** | Rotina de fechamento de mês via WhatsApp | Visão geral do fechamento mensal das caixinhas, parabenizando o empenho ou incentivando caso tenha estourado, com oferta de ajuda para planejar o mês seguinte. **Sinergia**: Mesma infraestrutura de job agendado e aprovação de template Meta do Item 3, aproveitando a formatação visual do Item 19. |
| **Item 33** | Controle de vigência de caixinhas por mês | Permitir que o cliente tenha conjuntos distintos de caixinhas a cada mês (ex.: Mês 1 com Alimentação/Transporte/Moradia; Mês 2 sem Moradia, com Pets). **Novo item de modelo de dados**: requer campo de vigência/validade mensal (\`valid_from\` / \`valid_until\` ou budgets isolados por mês). **Sinergia**: Itens 6 (investimento) e 10/11 (sem caixinha). Esforço médio-alto. |

### 3.3. Complexidade Maior / Infraestrutura / Comercial
| Item | Funcionalidade | Descrição / Sinergias |
| :--- | :--- | :--- |
| **Item 7** | Observabilidade | Painel de telemetria em tempo real com alertas de indisponibilidade do webhook, Meta API ou provedores de IA. |
| **Item 8** | GitHub e controle de versão | Sincronização externa de repositório e esteira de CI/CD (ação da usuária para provisionamento de chaves/repositório). |
| **Item 14** | Portal de Planejadores Financeiros | Painel dedicado para planejadores credenciados acompanharem clientes mediante termo de consentimento LGPD explícito. |
| **Item 15** | Backup automatizado da base | Rotina automatizada e versionada de snapshots do banco em produção. |
| **Item 17** | PWA instalável no celular | Manifesto web, service worker e suporte a instalação como Progressive Web App em iOS e Android com ícone Consciente. |
| **Item 18** | Captcha no cadastro | Proteção contra cadastros automatizados (bots) na tela de registro com hCaptcha/Turnstile. |
| **Item 24** | Billing + dashboard de assinaturas | Módulo financeiro de cobrança e controle de planos pagos/recorrentes. **Status**: Implementado com integração DIRETA à API Stripe via \`$http\` (sem dependência de conectores Skip, padrão Meta Cloud API). Parametrização no Backoffice Admin (\`stripe_config\`: secret key mascarada, webhook signing secret whsec, price IDs mensal/anual). **Pendente**: usuária colar a secret key (\`sk_live_...\`), o whsec e os price IDs na sub-seção "Configuração Stripe" do Backoffice e validar um pagamento real ponta a ponta (ver cenário AL). |
| **Item 34** | Billing: visão acumulada de custos vs faturamento bruto | No módulo de billing, exibir a visão comparativa acumulada de custos operacionais da infraestrutura (Meta + Groq + IA) versus faturamento bruto (receita líquida até o momento). **Sinergia**: Complementa diretamente o Item 24 e se alimenta da modelagem de custos do Item 9. |
| **Item 37** | Billing próprio — tela de tarifas ajustáveis no backoffice | Hoje os custos de fornecedores estão fixos em real cravados no código (áudio R$ 0,001 por transcrição, mensagem de IA R$ 0,02, utility R$ 0,04). Na fase de escala, criar tela de 'Tarifas' no backoffice para ajustar esses valores (e eventual conversão de câmbio) sem mexer em código. Faz parte do módulo de billing, que tem duas faces: billing dos clientes (assinatura/trial — o que eles pagam) e billing próprio (o que pagamos aos fornecedores). **Status**: Backlog — fase de escala. **Sinergia**: Complementa os Itens 9, 24 e 34. |
`

export const TESTES_REGRESSIVOS_MARKDOWN = `# Roteiro de Testes Regressivos Obrigatório — Consciente

Este roteiro é **obrigatório após qualquer ajuste sistêmico** no Consciente. Nenhuma entrega deve ser considerada concluída sem a validação dos itens essenciais deste documento. Mantém todos os cenários essenciais A a Z intactos e adiciona o cenário AA para o fallback embutido e resiliente no WhatsApp sem erros de escopo.

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

5. **Plano Anual via Pix — Pagamento Único (v0.0.93)**:
   - **Contexto**: contas Stripe domiciliadas no Brasil não oferecem Pix recorrente (Pix Automático), apenas Pix de pagamento único. Decisão da usuária: o plano anual passa a poder ser pago à vista (Pix OU cartão) em checkout \`mode=payment\`; a mensal segue recorrente por cartão exatamente como está.
   - **Onde**: Minha Conta (\`/settings\`) → seção Assinatura → card do plano **Anual** tem DOIS botões: "Assinar Anual" (cartão, recorrente — como já era) e "Anual à vista no Pix — pagamento único" (novo). O card Mensal permanece com um único botão.
   - **Backend (\`billing_stripe.js\`)**: o endpoint existente \`POST /backend/v1/billing/create-checkout-session\` recebe \`billing_mode=one_time\`; nesse modo a sessão é criada com \`mode=payment\` e metadados \`billing_mode=one_time\` + \`user_id\` + \`plan_type=anual\` + \`price_cents\`. **NÃO envia \`payment_method_types\`**: a Stripe RECUSA o parâmetro na criação de Checkout Session com 400 ("The \`payment_method_types\` parameter is no longer supported… Payment methods are now managed from your Dashboard Payment Method settings") — era a causa do 502 em ~80ms com o botão preso em "Redirecionando" (v0.0.93→94). Com os métodos automáticos do Dashboard, o checkout exibe sozinho os habilitados na conta (cartão + Pix para contas domiciliadas no Brasil). Como um \`price_\` criado como recorrente é recusado em mode=payment, a cobrança usa \`price_data\` one-time com o \`unit_amount\` do plano resolvido (override do Backoffice respeitado) — sem tocar no Price ID recorrente existente (decisão documentada no código).
   - **Ativação (webhook \`checkout.session.completed\` com \`mode=payment\`)**: grava \`subscription_status=active\`, \`subscription_plan=anual\`, \`access_until = agora + 12 meses\` (espelhado em \`subscription_expires_at\`), registra no histórico de assinaturas com tipo \`checkout.completed\` e \`billing_mode=one_time\` — SEM criar assinatura Stripe nem \`customer.subscription\`, e NUNCA gravando \`stripe_subscription_id\`. O \`sync-session\` (usado no retorno do checkout) aplica a MESMA regra, então o acesso ativa mesmo se o webhook demorar.
   - **Portões (app + WhatsApp)**: conta ativa por pagamento único passa nos mesmos portões de assinatura ativa. Quando \`access_until\` expira, \`/billing/status\` e o gate do WhatsApp rebaixam para "cancelado" sem acesso (fluxo de não-assinante: convite a reassinar; dados preservados).
   - **Sem portal nem cancelamento**: para esse perfil não existe assinatura a cancelar — os botões "Gerenciar assinatura (cartão, faturas)" e "Cancelar assinatura" ficam ocultos e um texto explica: "Plano anual pago à vista (pagamento único) — válido até [data]".
   - _Teste AL-6 (Pix anual — caminho feliz):_ logada como cliente → Minha Conta → "Anual à vista no Pix — pagamento único" → checkout Stripe abre com Pix e cartão → pagar via Pix → retorno a \`/settings?section=assinatura\` → status "Assinatura Ativa" com "Válida até" = hoje + 12 meses; histórico registra "pagamento único anual via Pix"; banner de retorno confirma sucesso.
   - _Teste AL-7 (one-time pelo cartão):_ mesmo fluxo escolhendo cartão na mesma sessão — ativação idêntica (é o mesmo checkout mode=payment), com histórico \`billing_mode=one_time\`.
   - _Teste AL-8 (expiração do pagamento único):_ com \`access_until\` no passado (ajuste manual em Admin → Collections → users), \`/billing/status\` retorna status sem acesso e o WhatsApp recusa lançamentos com convite a reassinar — igual ao AL-5.
   - _Teste AL-9 (sem portal):_ logada com plano one-time ativo → os botões "Gerenciar assinatura" e "Cancelar assinatura" NÃO aparecem; aparece o texto do pagamento único com a data de validade.
   - _Teste AL-10 (mensal intocada):_ o botão "Assinar Mensal" continua abrindo checkout recorrente (\`mode=subscription\`) por cartão, com carência/bloqueio/cancelamento funcionando como nos testes 1–4.
   - _Teste AL-11 (falha do checkout Pix — erro amigável, v0.0.94):_ clicar em "Anual à vista no Pix" com a Stripe recusando (ex.: secret key inválida no Backoffice ou instabilidade) → o botão NÃO fica preso em "Redirecionando": volta ao normal em seguida e aparece toast vermelho com mensagem amigável em português (motivo informado pela Stripe, quando houver); o log de hooks registra "[billing] Falha Stripe Checkout (4xx)" — nunca falha silenciosa. Mesma verificação para "Assinar Mensal" (mensal por cartão) — o erro amigável vale para ambos os modos.
   - **REGRA PERMANENTE (vale para sempre)**: TODA funcionalidade nova ou ajustada — regra nova ou mudança em regra preexistente — deve obrigatoriamente ser incluída neste roteiro de testes regressivos (\`docsContent.ts\`) NA MESMA entrega. Funcionalidade sem cenário de regressão é considerada incompleta.

---
`
