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
     - **Leitura da Chave de STT (\`stt_api_key\`) do Banco**: o hook consulta dinamicamente a coleção \`whatsapp_status\` pelo campo \`stt_api_key\` configurado pela admin em Configurações. Se presente, utiliza a chave primária; se ausente, faz fallback para variáveis de ambiente (\`GROQ_API_KEY\`, \`OPENAI_API_KEY\`, \`OPENROUTER_API_KEY\`).
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
     - Vê: Dashboard, Caixinhas, Extrato de Transações, Categorias, Relatórios e Configurações de Perfil/Senha.
     - **Não vê dados técnicos**: canal WhatsApp, token de acesso, Phone ID, WABA ID ou webhook URL.
     - **Não vê rota de Backoffice**: barrado com mensagem amigável de Acesso Restrito em \`/admin\`.
   - **Administrador (\`admin\`)**:
     - Conta da dona do produto (\`barbara.ferreira.leal@gmail.com\`) promovida automaticamente.
     - Vê dados técnicos em Configurações (\`/settings\`), aviso oficial no Assistente (\`/assistant\`) e acesso ao Backoffice (\`/admin\`) e Documentação Técnica.

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

Documento oficial de controle de pendências e prioridades do produto (itens 1 a 36). Este documento serve como guia estratégico para os próximos passos de evolução, mantido e reavaliado a cada ciclo de desenvolvimento.

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
| **Item 20: Foto de perfil do WhatsApp via API (admin)** | Capacidade de atualizar o avatar oficial do número de atendimento diretamente pela tela de Configurações (\`/settings\`) via Resumable Upload da Meta API e \`whatsapp_business_profile\`, com nota explicativa sobre o nome de exibição. | **Concluído** |
| **Item 31: Bug do Backoffice — Detalhes por cliente zerados/em branco** | **BUG CORRIGIDO**: O endpoint \`/backend/v1/admin/clients/:id\` calculava caixinhas a partir de campos inexistentes (\`limit_cents\` em vez de \`amount\`) e não calculava o gasto real do mês. Além disso, as transações buscavam \`amount_cents\` e o histórico de mensagens buscava apenas em tabela não utilizada. Corrigido com agregação real de transações do mês vs teto, mapeamento de \`amount\` e leitura do histórico ativo de mensagens do agente via \`$ai.agent('financeiro-whatsapp')\`. | **Concluído** |
| **Item 36: Bug do Upload de Foto de Perfil — Rejeição de JPEG pequeno com mensagem enganosa** | **BUG CORRIGIDO**: Causa raiz identificada e resolvida: o runtime JSVM (Goja) do PocketBase não populava \`findUploadedFile\` em chamadas multipart do browser, deixando \`fileBytes\` vazio e disparando a mensagem 400 antes de chegar à Meta. O frontend (\`finance.ts\`) agora converte a imagem para Base64/JSON antes do envio e o backend decodifica de forma segura via \`$security.base64Decode\`, com descoberta dinâmica de App ID e upload direto na Meta Graph API. A mensagem genérica foi removida e qualquer retorno da Meta é exibido com seu motivo real. | **Concluído** |
| **Item 22: Guardrail de temas do agente** | Regras estritas de moderação no system prompt do agente (\`financeiro-whatsapp\`) para declinar educadamente assuntos fora de finanças pessoais (ex.: "Quem descobriu o Brasil?") e conduzir o cliente de volta com foco e empatia. | **Concluído** |
| **Item 23: Cancelar/substituir lançamento** | Fluxo conversacional seguro de cancelamento via WhatsApp: cliente pede para cancelar ("cancela o último", "apaga esse lançamento"), o agente solicita confirmação simples ("Tem certeza que deseja cancelar o lançamento de R$ X? Responda SIM para confirmar"), e após "SIM" atualiza o status para \`cancelled\`. Transação cancelada é excluída dos totais e do saldo. | **Concluído** |
| **Item 27: Deleção lógica com status e histórico visível** | Implementado campo \`status\` (\`active\`, \`cancelled\`, \`deleted\`) na coleção de transações com backfill retrocompatível idempotente. Deleções no painel e cancelamentos no WhatsApp são puramente lógicos para auditoria e histórico de segurança. Na listagem de Transações do cliente (\`/transactions\`), o filtro padrão exibe todos os lançamentos (ativos + cancelados), com canceladas visualmente diferenciadas (badge "Cancelado", texto tachado e opacidade) para dar segurança e transparência imediata ao cliente de que o cancelamento foi atendido. REGRA ABSOLUTA: totais, somatórias, gráficos e métricas de todas as telas (Transações, Dashboard, Caixinhas, Relatórios e Backoffice) consideram estritamente lançamentos \`active\`. | **Concluído** |
| **Item 28: Gasto retroativo (lado do agente)** | Capacidade do agente interpretar datas passadas na fala ou texto ("ontem gastei 35", "terça gastei 50"), registrar com o campo \`date\` correspondente e \`is_retroactive = true\`. A confirmação do agente menciona explicitamente a data original e a interface exibe o badge "Retroativo". | **Concluído** |
| **Idempotência de Webhook WhatsApp (Meta retry)** | Proteção estrita contra retries automáticos da Meta (>5s): deduplicação por \`wamid\` (message_id) em memória rápida com TTL e persistência na coleção \`whatsapp_processed_messages\`. Evita mensagens duplicadas ou falsas rejeições de duplicidade. | **Concluído** |
| **Garantia de Integridade de Status e Retroativo** | Hook \`transactions_integrity.js\` garante que toda transação nasça com \`status='active'\` e tenha \`is_retroactive=true\` sempre que a data informada diferir do dia da mensagem. Proteção de deleção lógica definitiva. | **Concluído** |
| **Tratamento de Fallback Inteligente e Resiliência de IA/Áudio** | Correção do bug de mensagens não-financeiras ("Oi, deu certo?") recebendo erro de gasto. Diferenciação contextual entre mensagens de gasto, conversas/dúvidas e saudações; timeouts ajustados de áudio (12s) para não acumular fila; e carregamento resiliente de módulos auxiliares (\`reliability_helper\` e \`caixinhas_summary_helper\`) em ambientes isolados do Goja JSVM. | **Concluído** |

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
| **Item 24** | Billing + dashboard de assinaturas | Módulo financeiro de cobrança e controle de planos pagos/recorrentes. **Dependência**: Aguarda definição final da precificação e gateways de pagamento (ex: Stripe/Asaas). |
| **Item 34** | Billing: visão acumulada de custos vs faturamento bruto | No módulo de billing, exibir a visão comparativa acumulada de custos operacionais da infraestrutura (Meta + Groq + IA) versus faturamento bruto (receita líquida até o momento). **Sinergia**: Complementa diretamente o Item 24 e se alimenta da modelagem de custos do Item 9. |
`

export const TESTES_REGRESSIVOS_MARKDOWN = `# Roteiro de Testes Regressivos Obrigatório — Consciente

Este roteiro é **obrigatório após qualquer ajuste sistêmico** no Consciente. Nenhuma entrega deve ser considerada concluída sem a validação dos itens essenciais deste documento. Mantém os cenários essenciais A a X intactos e adiciona o cenário Y para o tratamento inteligente de fallback e resiliência de mensagens não-financeiras no WhatsApp.

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
   - Abra o WhatsApp do cliente cadastrado ou acione o modal "Testar Mensagem" em Configurações.
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
`
