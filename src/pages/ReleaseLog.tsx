import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  CheckCircle2,
  FileText,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Smartphone,
  BookOpen,
} from 'lucide-react'

interface ReleaseEntry {
  version: string
  date: string
  title: string
  tag: string
  highlights: string[]
  details: string[]
}

const RELEASES: ReleaseEntry[] = [
  {
    version: '0.0.103',
    date: '15/11/2026',
    title:
      'Hook de Integridade de Vigência dos Planos no Backoffice (subscription_plans_vigencia) e Cenário AR no Roteiro Regressivo',
    tag: 'Atual',
    highlights: [
      'Novo hook de integridade de vigência (Billing → Planos): sobreposição de vigências do MESMO plan_type é REJEITADA — tentar salvar duas linhas mensais (ou duas anuais) com janelas que se cruzam falha com erro amigável citando o plano conflitante e o período.',
      'Fim antes do início rejeitado: linhas com valid_until <= valid_from (ex.: de 10/12 a 05/12) são recusadas com erro amigável — nunca erro 500 nem falha silenciosa.',
      'Trilhas mensal e anual INDEPENDENTES: sobreposição entre tipos diferentes é permitida (uma linha mensal e uma anual podem coexistir na mesma janela).',
      'Janelas em sequência permitidas: "válida até 30/11" seguida de "a partir de 01/12" é aceita (janelas semiabertas [from, until)) — a virada Black November → Padrão (R$ 19,90/214,90 → R$ 29,90/322,90 em 01/12/2026) acontece sem intervenção manual.',
      'Linhas inativas e overrides (vigência por cliente) ficam FORA da checagem: convivem com a trilha geral sem disparar conflito.',
      'A tabela de planos governa apenas NOVAS contratações: assinantes atuais não são afetados pela virada de vigência.',
      'Documentação atualizada: cenário AR "Virada de Vigência de Plano (regra AG)" no roteiro regressivo, linha de vigência no bloco AL, backlog "Importar preços da Stripe como rascunhos pendentes de vigência" e versão 0.0.103.',
    ],
    details: [
      'Hook pocketbase/hooks/subscription_plans_vigencia.js (onRecordCreate/onRecordUpdate em subscription_plans, lógica 100% inline nos callbacks) — validação de janelas semiabertas por plan_type, sem tocar em assinaturas ativas.',
      'src/data/docsContent.ts: cenário AR, bloco AL (regras de vigência), item de backlog na seção Qualidade/infraestrutura.',
      'src/pages/ReleaseLog.tsx e package.json na versão 0.0.103.',
    ],
  },
  {
    version: '0.0.102',
    date: '14/11/2026',
    title:
      'Mapeamento Definitivo dos 4 Prices da Stripe (consulta real à API) e Correção dos Planos Padrão',
    tag: 'Estável',
    highlights: [
      'Mapa REAL da Stripe obtido por consulta à API (produto prod_Va2uSpOiSeedcC): R$ 19,90/mês → price_1UZ11R31gAsdzIHftUWaEJB0; R$ 29,90/mês → price_1UZ11Q31gAsdzIHfLP1oZJKS; R$ 214,90/ano ("Por ano") → price_1UZ11Q31gAsdzIHfGEinrGPA; R$ 322,90/ano ("Por ano") → price_1UZ11O31gAsdzIHfNapN7q6b.',
      'Migração 0045 corrigiu as 4 linhas de subscription_plans: as linhas de valor PADRÃO (Mensal Padrão R$ 29,90 e Anual Padrão R$ 322,90) apontavam para os price_ids PROMOCIONAIS e agora apontam para os IDs reais dos seus valores/intervalos.',
      'stripe_config.price_id_anual_recorrente preenchido com o Price anual recorrente "Por ano" (R$ 214,90) — o botão "Assinar Anual (recorrente)" de Minha Conta volta a funcionar (antes devolvia erro amigável de configuração ausente).',
      'Confirmado pelo mapa da API: o price_id_anual gravado (price_...GEinrGPA) NÃO é o Price mensal bugado da v0.0.95 — é o Price anual "Por ano" correto. price_id_mensal (R$ 19,90) também já estava correto.',
      'Fluxo Pix à vista (mode=payment, price_data com o valor do plano) intocado; engine proativo e orquestrador (v0.0.101) intocados.',
    ],
    details: [
      'Nova migração pocketbase/migrations/0045_map_stripe_prices.js (idempotente) aplicada e verificada na base viva.',
      'Atualizado src/data/docsContent.ts (roteiro regressivo, bloco AL) com o mapa definitivo dos 4 Prices.',
      'Sem alteração em proactive_notifications.js, proactive_notifications_engine.js e no fluxo de checkout mode=payment.',
    ],
  },
  {
    version: '0.0.58',
    date: '05/11/2026',
    title:
      'Persistência Obrigatória de Caixinha (Budget) no Registro via WhatsApp e Paridade 100% com o App',
    tag: 'Atual',
    highlights: [
      'Persistência da Caixinha no Registro: Em todos os caminhos de criação de transação no WhatsApp (mensagens de texto, áudio transcrito, fluxo de desambiguação de pendência e hook de integridade), a caixinha decidida é imediatamente gravada no campo budget da coleção transactions.',
      'Paridade Total de Visão WhatsApp × App: O resumo visual do WhatsApp e a tela /budgets do aplicativo refletem exatamente a mesma alocação centavo por centavo, resolvendo a divergência reportada nas transações Mercado Violeta (R$ 214,56) e Rascal (R$ 190,00).',
      'Resumo Exclusivamente Determinístico: A visão geral de caixinhas no WhatsApp ("quais são minhas caixinhas?", "resumo") é gerada estritamente pelo helper determinístico (caixinhas_summary_helper.js / resolveTxBudget), impedindo que a LLM invente valores ou calcule caixinhas por conta própria.',
      'Backfill Idempotente Permanente: Migração 0031 preenche o campo budget de transações ativas antigas com budget vazio utilizando a regra única determinística (budget > vínculo único > desempate > fallback), preservando o isolamento de cancelados/deletados.',
    ],
    details: [
      'Migração pocketbase/migrations/0031_backfill_transaction_budgets.js criada e aplicada com sucesso.',
      'Atualizados pocketbase/hooks/transactions_integrity.js, pocketbase/hooks/reliability_helper.js, pocketbase/hooks/whatsapp_bridge.js e pocketbase/hooks/caixinhas_summary_helper.js.',
      'Roteiro de Testes Regressivos (Cenário AF) e Backlog atualizados em src/data/docsContent.ts.',
    ],
  },
  {
    version: '0.0.57',
    date: '05/11/2026',
    title:
      'Remanejamento de Transação entre Caixinhas no App e Unificação de Visão WhatsApp vs. App',
    tag: 'Estável',
    highlights: [
      'Remanejamento de Caixinha no App: Na tela de transações, ao editar qualquer despesa (manual ou recebida via WhatsApp), a/o cliente pode alterar para qual caixinha o gasto é alocado ou retornar para "Automático / Sem caixinha fixa".',
      'Atualização Imediata dos Totais: Ao salvar a edição com nova caixinha, o valor sai imediatamente da caixinha anterior e entra na nova caixinha, contando exatamente uma única vez (zero duplicação e sem afetar cancelados).',
      'Unificação da Visão App e WhatsApp: Corrigida a reatividade do useMemo em Budgets.tsx e Dashboard.tsx que dependia dos vínculos category_caixinha_links. Agora a tela /budgets e o resumo do WhatsApp refletem exatamente a mesma agregação.',
      'Indicação Visual na Lista de Lançamentos: Os lançamentos vinculados no card da caixinha exibem a tag "Fixada" quando foram alocados explicitamente para aquela caixinha pelo cliente.',
    ],
    details: [
      'Atualizado src/components/TransactionModal.tsx para permitir remanejamento livre entre caixinhas ativas com campo budget persistido e suporte a desvinculação.',
      'Atualizado src/pages/Budgets.tsx e src/pages/Dashboard.tsx incluindo userLinks nas dependências do useMemo de budgetStats e tag visual de caixinha fixada.',
      'Atualizados src/data/docsContent.ts e Roteiro de Testes Regressivos (Cenário AE).',
    ],
  },
  {
    version: '0.0.56',
    date: '05/11/2026',
    title:
      'Escolha Obrigatória de Caixinha no WhatsApp e no App (Regra de Não Duplicação de Gastos)',
    tag: 'Estável',
    highlights: [
      'Regra de Ouro Atendida: Cada transação ativa soma em exatamente UMA única caixinha, eliminando duplicidade no histórico e em novos gastos.',
      'Fluxo de Desambiguação no WhatsApp: Quando a categoria do gasto possui múltiplos vínculos de caixinhas (ex.: Alimentação VA e VR), a IA suspende o registro imediato, salva a pendência em pending_caixinha e pergunta ao cliente em lista numerada qual caixinha usar. Ao responder, a transação é criada com o campo budget vinculado e confirmada.',
      'Vínculo Único Direto: Categorias com vínculo único gravam diretamente o budget e informam a caixinha na confirmação da mensagem.',
      'Seleção Obrigatória no App (TransactionModal): Ao lançar despesa manual numa categoria com múltiplas caixinhas candidatas, o modal exige a seleção da caixinha e mantém o botão salvar desabilitado até a escolha.',
      'Fallback Estável Retrocompatível: Clientes sem vínculos parametrizados mantêm o matching histórico sem quebra, e transações canceladas continuam estritamente excluídas de qualquer soma.',
    ],
    details: [
      'Atualizados pocketbase/hooks/reliability_helper.js e pocketbase/hooks/whatsapp_bridge.js para gerenciar pending_caixinha e desambiguação conversacional.',
      'Atualizado src/components/TransactionModal.tsx para carregar categoryCaixinhaLinksService e exigir caixinha em categorias ambíguas.',
      'docs/TESTES_REGRESSIVOS.md (novo cenário AD), docs/BACKLOG.md e src/data/docsContent.ts atualizados.',
    ],
  },
  {
    version: '0.0.41',
    date: '03/11/2026',
    title:
      'Correção da Causa Raiz do Upload de Foto de Perfil WhatsApp na Meta (Item 36) e Compatibilidade Base64 no JSVM',
    tag: 'Estável',
    highlights: [
      'Causa Raiz Identificada e Corrigida (Item 36): No ambiente PocketBase JSVM (Goja), e.findUploadedFile lançava silenciosamente ou retornava indefinido para multipart FormData do browser, deixando o buffer de bytes vazio e disparando a mensagem 400 antes da Meta. O serviço frontend (finance.ts) foi atualizado para serializar o arquivo em Base64 e enviar via JSON tipado (image_base64), com fallback robusto no backend para e.findUploadedFiles() com reader.read.',
      'Avanço de Sessão Resumable Upload na Meta: o hook whatsapp_bridge.js agora descobre dinamicamente o App ID via /app e /debug_token com fallback para o Phone Number ID e WABA ID, chamando o Resumable Upload oficial e repassando o profile_picture_handle gerado para o whatsapp_business_profile.',
      'Eliminação Definitiva da Mensagem Enganosa: a mensagem genérica que exigia "jpeg ou png de no máximo 5MB" foi removida da rota; qualquer recusa real da Meta é entregue na tela com a mensagem exata retornada pela Meta Graph API.',
      'Roteiro de Testes Regressivos Validado: Cenários A a R 100% íntegros; zero regressão em backoffice, caixinhas, transações e webhook do WhatsApp.',
    ],
    details: [
      'Frontend em src/services/finance.ts converte File para DataURL/Base64 antes do POST para /backend/v1/whatsapp/profile-picture.',
      'Backend pocketbase/hooks/whatsapp_bridge.js suporta Base64 e multipart com reader Goja e descobre alvos de upload dinamicamente.',
      'docs/BACKLOG.md, docs/TESTES_REGRESSIVOS.md e docsContent.ts atualizados.',
    ],
  },
  {
    version: '0.0.40',
    date: '03/11/2026',
    title:
      'Correção de Detalhes do Cliente no Backoffice (Item 31), Upload de Foto de Perfil JPEG Pequeno (Item 36) e Backlog Integrado (Itens 1 a 36)',
    tag: 'Estável',
    highlights: [
      'Correção Crítica do Backoffice (Item 31): corrigido o endpoint /backend/v1/admin/clients/:id para mapear o teto real da caixinha (campo amount), calcular o gasto real do mês por agregação das despesas do cliente, exibir valores reais em R$ das últimas 20 transações e recuperar o histórico ativo de conversas do WhatsApp direto do agente nativo $ai.agent("financeiro-whatsapp") via listMessages/listConversations.',
      'Correção do Upload de Foto de Perfil (Item 36): corrigida a validação de arquivo no frontend (Settings.tsx) e backend (whatsapp_bridge.js) para aceitar JPEGs válidos pequenos (ex.: 37.1 KB) sem falsas rejeições de MIME; normalização de cabeçalhos e exibição do erro real retornado pela Meta Graph API sem mascarar com a mensagem genérica enganosa de formato ou 5MB.',
      'Integração Completa do Backlog (Itens 30 a 36): lista oficial expandida de 1 a 36 no docs/BACKLOG.md, src/data/docsContent.ts e tela /admin/docs, com estrutura de 3 seções (Concluídos, Respondidos e Backlog) e reclassificação de pendências por velocidade e complexidade.',
      'Novos Itens de Backlog Mapeados com Sinergias: Item 30 (Alerta admin suporte, sinergia com 25 e 26), Item 32 (Rotina de fechamento de mês WhatsApp, sinergia com 3 e template visual 19), Item 33 (Controle de vigência mensal de caixinhas, sinergia com 6 e 10/11) e Item 34 (Billing: custos vs faturamento bruto, sinergia com 24 e 9). Item 35 respondido sem pendência de código (LGPD e fallback no perfil WhatsApp).',
      'Roteiro Regressivo Atualizado: Cenários A a P preservados 100% intactos com adição dos novos cenários Q (detalhes com dados reais no backoffice) e R (upload de foto JPEG pequeno e mensagens de erro da Meta).',
      'Zero Vazamento de Segredos: Token permanente da Meta e chave de transcrição continuam estritamente mascarados no backend.',
    ],
    details: [
      'Hook pocketbase/hooks/admin_backoffice.js atualizado com agregações reais de transações por categoria, cálculo de gastos mensais, campo amount e busca de mensagens via $ai.agent("financeiro-whatsapp").',
      'Hook pocketbase/hooks/whatsapp_bridge.js e src/pages/Settings.tsx com validação tolerante de imagem (MIME/extensão) e propagação do erro real da Meta.',
      'docs/BACKLOG.md, docs/TESTES_REGRESSIVOS.md, docs/ARQUITETURA.md e src/data/docsContent.ts atualizados.',
    ],
  },
  {
    version: '0.0.39',
    date: '03/11/2026',
    title:
      'Documento Formal de Backlog / Pendências no /admin/docs e Versionamento de Prioridades do Produto',
    tag: 'Estável',
    highlights: [
      'Documento formal "Backlog / Pendências" criado em docs/BACKLOG.md e disponibilizado em /admin/docs como aba dedicada.',
      'Lista completa com numeração oficial mantida e três status em texto claro: Concluído, Respondido/Aguardando decisão e Backlog.',
      'Itens Concluídos devidamente registrados e mapeados: Áudio no WhatsApp, Rastreabilidade de origem, Separação cliente × admin, Backoffice /admin, Item 5 (Documentos no /admin/docs), Item 9 (Custo mensal no backoffice), Item 12 (Figurinhas de bichinhos), Item 13 (Filtro mês corrente), Item 16 (Correção erro 500), Item 19 (Resumo visual no WhatsApp) e Item 20 (Foto de perfil via API).',
      'Itens Respondidos / Aguardando decisão documentados com síntese técnica: Item 2 (Impacto do áudio no custo: desprezível a R$ 0,001), Item 4 (Previsão de custo por cliente/mês), Item 6 (Regras de investimento explicadas; pendente formato de caixinha), Item 21 (Cyber security contínua) e Item 29 (Teste de carga estruturado).',
      'Itens de Backlog (16 itens) organizados com descrições objetivas e dependências identificadas para os próximos passos.',
      'Zero regressão: webhook Meta Cloud API, agente IA nativo, regras de centavos, custos por cliente e roteiro de testes mantidos intactos.',
    ],
    details: [
      'docs/BACKLOG.md criado com formatação Markdown estruturada e tabelas de status.',
      'src/data/docsContent.ts atualizado exportando BACKLOG_MARKDOWN.',
      'src/pages/AdminDocs.tsx atualizado com aba "Backlog / Pendências" e ícone ListTodo, com renderização Markdown legível.',
    ],
  },
  {
    version: '0.0.38',
    date: '03/11/2026',
    title:
      'Resumo Visual Padronizado das Caixinhas no WhatsApp e Atualização da Foto de Perfil via Meta API — Itens 19 e 20 da Lista do MVP',
    tag: 'Estável',
    highlights: [
      'Item 19 — Resumo Visual Padronizado das Caixinhas no WhatsApp: Sempre que o cliente solicita visão geral de suas caixinhas ("quais são minhas caixinhas?", "resumo das caixinhas", etc.), a resposta segue estritamente um layout visual em texto com barras em caracteres de bloco proporcionais (▓▓▓▓░░░░░░), percentual de consumo e tetos.',
      'Cabeçalho e Rodapé Padronizados: Topo com mês corrente ("📊 Suas Caixinhas — Mês de X") e rodapé com consolidado do mês (total gasto, total dos tetos e saldo restante ou estouro geral).',
      'Alertas Visuais Embutidos: Caixinhas com ≥80% do teto ganham marcador de atenção (⚠️) com saldo restante em evidência; caixinhas estouradas (≥100%) recebem marcação crítica imediata (🚨 Estourada por R$ X).',
      'Item 20 — Foto de Perfil do WhatsApp via API no Painel Admin: No painel exclusivo de administradores (Minha Conta > Canal Oficial WhatsApp Business), a administradora pode selecionar uma foto (JPEG/PNG) e atualizar o avatar oficial do número via Resumable Upload da Meta e whatsapp_business_profile.',
      'Nota Explicativa sobre Nome de Exibição: Aviso claro informando que o nome de exibição do WhatsApp exige revisão humana pela Meta no WhatsApp Manager e não pode ser trocado por API, enquanto a foto pode ser atualizada diretamente pelo painel.',
      'Segurança e Zero Regressão: Token da Meta e chaves permanecem estritamente mascarados; fluxos de áudio, despesas retroativas, webhook da Meta e Cenários A–N permanecem 100% íntegros.',
    ],
    details: [
      'Helper pocketbase/hooks/caixinhas_summary_helper.js criado com detecção de intenção e montagem formatada do resumo com emojis de bichinhos e categorias.',
      'Hook pocketbase/hooks/whatsapp_bridge.js integrado ao helper no webhook e no endpoint de simulação.',
      'Migração 0024_update_finance_agent_caixinhas_summary.js aplicada reforçando as diretrizes visuais no prompt do agente.',
      'Endpoint POST /backend/v1/whatsapp/profile-picture implementado com suporte a Resumable Upload da Meta e vínculo via profile_picture_handle.',
      'Interface em src/pages/Settings.tsx e método whatsappService.updateProfilePicture em finance.ts.',
      'Documentos docs/ARQUITETURA.md e docs/TESTES_REGRESSIVOS.md atualizados com os novos Cenários O e P.',
    ],
  },
  {
    version: '0.0.37',
    date: '03/11/2026',
    title:
      'Custo Mensal Acumulado por Cliente no Backoffice Admin (/admin) — Item 9 da Lista de Prioridades',
    tag: 'Estável',
    highlights: [
      'Visão de Custos no Backoffice Admin (/admin): novo card dedicado com cálculo automático do custo operacional mensal acumulado estimado de cada cliente e totais consolidados no topo.',
      'Modelagem unitária de custos em R$: Transações por áudio no WhatsApp a R$ 0,001 (Groq Whisper); Mensagens de IA geradas pelo agente a R$ 0,02; Mensagens ativas/utility fora de 24h a R$ 0,04; Mensagens de serviço (checks azuis e typing) a R$ 0.',
      'Ordenação inteligente por custo: tabela de clientes ordenada decrescentemente pelo maior custo estimado primeiro, com contagem de lançamentos (texto e áudio), mensagens de IA e sub-valores.',
      'Seletor histórico de meses: capacidade de alternar entre o mês corrente e meses anteriores (histórico dos últimos 6 meses) sem recarregar a tela.',
      'Custo no Detalhe Individual do Cliente: modal de suporte exibe o custo mensal estimado do cliente selecionado e decomposição de consumo com seu próprio seletor de mês.',
      'Rota backend dedicada e segura: GET /backend/v1/admin/costs e GET /backend/v1/admin/clients/:id com suporte a parâmetro ?month=YYYY-MM e proteção estrita contra acesso não-admin (HTTP 403 Forbidden).',
      'Zero regressão: /backend/v1/admin/overview e rotas existentes operando sem erro 500, webhook da Meta intacto, envio direto preservado e documentação técnica atualizada (Cenário N adicionado aos testes regressivos).',
    ],
    details: [
      'Hook pocketbase/hooks/admin_backoffice.js enriquecido com a rota GET /backend/v1/admin/costs e suporte a month no detalhe do cliente.',
      'Serviço finance.ts com interfaces AdminCostsResponse, AdminClientCostItem e método adminService.getCosts.',
      'Interface src/pages/AdminBackoffice.tsx atualizada com card principal de custos, indicadores por tipo de custo, tabela ordenada e card no modal de detalhes.',
      'Docs docs/ARQUITETURA.md, docs/TESTES_REGRESSIVOS.md (Cenário N) e docsContent.ts atualizados.',
    ],
  },
  {
    version: '0.0.35',
    date: '03/11/2026',
    title:
      'Lote 1 de Melhorias do MVP: Correção Crítica do Backoffice /admin, Filtro Padrão Mês Corrente, Figurinhas de Bichinhos nas Caixinhas e Documentação Técnica no Admin',
    tag: 'Estável',
    highlights: [
      'BUG CRÍTICO do Backoffice resolvido: endpoint /backend/v1/admin/overview corrigido com tratamento seguro e compatível com as coleções existentes; rota responde HTTP 200 com métricas reais e lista de clientes.',
      'Filtro padrão = Mês Corrente (1º dia do mês até hoje): aplicado por padrão em Transações, Dashboard e Relatórios, mantendo a flexibilidade para o usuário alternar para qualquer período manualmente.',
      'Figurinhas de bichinhos nas caixinhas: adicionada aba com opções amigáveis de bichinhos (Gatinho 🐱, Cachorrinho 🐶, Patinhas 🐾, Ursinho 🐻, Panda 🐼, Coala 🐨, Leão 🦁, Coelhinho 🐰, Raposa 🦊, Pinguim 🐧 e outros), exibidas em Caixinhas, Dashboard, Extrato de Transações e Modal de Lançamento.',
      'Documentação Técnica visível no Admin (/admin/docs): nova página no menu de Administrador com renderização legível (títulos, listas, tabelas e código) dos documentos docs/ARQUITETURA.md e docs/TESTES_REGRESSIVOS.md.',
      'Zero regressão estrutural: preservados webhook da Meta, disparos diretos via Meta Cloud API, pipeline de áudio STT Groq com chave dinâmica, valores em centavos, rastreabilidade de origem e papéis admin vs cliente.',
    ],
    details: [
      'Hook pocketbase/hooks/admin_backoffice.js ajustado com queries seguras em whatsapp_contacts (sem dependência de coleção inexistente whatsapp_messages) e suporte a conversation_id.',
      'src/pages/Transactions.tsx e src/pages/Reports.tsx configurados com default "thisMonth" (Mês corrente).',
      'src/lib/caixinhaIcons.tsx expandido com BICHINHO_ICONS e utilitários isEmojiIcon / getEmojiFromIconId / renderCaixinhaIcon.',
      'src/pages/Budgets.tsx e src/pages/Categories.tsx com abas para seleção de bichinhos amigáveis e ícones gerais.',
      'Nova rota /admin/docs e página src/pages/AdminDocs.tsx criada com tabs para ARQUITETURA.md e TESTES_REGRESSIVOS.md (cenários A a M).',
    ],
  },
  {
    version: '0.0.34',
    date: '03/11/2026',
    title:
      'Campo Admin de Chave de Transcrição de Voz (STT) e Leitura Dinâmica pelo Hook do WhatsApp',
    tag: 'Estável',
    highlights: [
      'Campo seguro no Painel Admin: em Minha Conta (exclusivo para administradores), adição de campo para colar a chave de transcrição de voz (Groq/OpenAI) com padrão seguro do token da Meta — o valor é persistido no banco e nunca é reexibido na tela.',
      'Indicador claro stt_configurado: badge dinâmico no painel indicando se a transcrição de voz está ativa ("Chave de transcrição configurada ✓" / "Não configurada").',
      'Leitura dinâmica no hook whatsapp_bridge.js: o pipeline de áudio lê a chave stt_api_key diretamente de whatsapp_status no momento da transcrição, priorizando Groq Whisper Large v3 (compatível com OpenAI whisper) ou OpenAI direta.',
      'Contingência empática preservada: caso nenhuma chave de transcrição esteja configurada ou ocorra ruído inaudível, o agente envia mensagem acolhedora orientando o usuário a digitar o gasto.',
      'Zero regressão: webhook da Meta, disparos diretos via Meta Cloud API, gravação em centavos e papéis admin vs cliente 100% preservados.',
    ],
    details: [
      'Migração 0023_add_stt_api_key_to_whatsapp_status.js já aplicada adicionando o campo stt_api_key à coleção whatsapp_status.',
      'Hook pocketbase/hooks/whatsapp_bridge.js atualizado com rota POST /backend/v1/whatsapp/stt-key e rota GET /backend/v1/whatsapp/status expondo flag stt_configurado.',
      'Interface em src/pages/Settings.tsx com campo seguro, botão salvar e indicador de status.',
      'Serviço finance.ts atualizado com método saveSttKey e tipagem stt_configurado.',
    ],
  },
  {
    version: '0.0.32',
    date: '02/11/2026',
    title:
      'Correção de Diagnóstico e Resiliência do Pipeline de Áudio (STT) com Encoder Puro e Orientação Acolhedora',
    tag: 'Estável',
    highlights: [
      'Diagnóstico de causa raiz no backend: identificada ausência da função $security.base64Encode no runtime Goja do PocketBase (causando falha silenciosa no conversor anterior) e incompatibilidade do gateway interno de chat com transcrição de áudio.',
      'Implementação de encoder base64 puro em JavaScript: compatível com qualquer tamanho de stream binário (downloadRes.raw e downloadRes.body) sem depender de extensões Goja ausentes.',
      'Cadeia de provedores resiliente: suporte a GROQ_API_KEY (Groq Whisper v3), OPENROUTER_API_KEY (Whisper Large v3) e OPENAI_API_KEY (Whisper-1), com logs explícitos de cada tentativa.',
      'Mensagem acolhedora e honesta: quando o áudio não pode ser transcrito por oscilação ou ausência de chave de provedor, o agente orienta o usuário de forma transparente e amigável ("Recebi seu áudio aqui no Consciente! No momento tivemos uma instabilidade na conversão de voz para texto... Você pode digitar rapidinho o gasto aqui para mim? Já registro direto na sua caixinha!"), sem culpar a fala nem a pessoa.',
      'Zero regressão: webhook da Meta, fluxo de texto, registro de centavos, data/hora original da Meta e segurança permanecem 100% intactos.',
    ],
    details: [
      'Hook pocketbase/hooks/whatsapp_bridge.js atualizado com encoder Base64 puro e resposta de áudio acolhedora.',
      'Docs de arquitetura e testes regressivos atualizados com os achados de diagnóstico.',
    ],
  },
  {
    version: '0.0.30',
    date: '02/11/2026',
    title: 'Pipeline de Transcrição de Áudio Multi-Estratégia e Rastreabilidade Completa de Origem',
    tag: 'Estável',
    highlights: [
      'Pipeline multi-estratégia de áudio (STT): tentativa 1 com modelos multimodais de alta performance via OpenRouter (Gemini 2.0 Flash / Gemini 1.5 / GPT-4o Audio) utilizando áudio nativo em base64 com input_audio; tentativa 2 via endpoint Whisper multipart FormData nativo do PocketBase ($filesystem.fileFromBytes); tentativa 3 com fallback direto para OpenAI Whisper.',
      'Logs analíticos por etapa: rastreamento completo de bytes baixados da Meta Graph API, codificação em base64, requisições HTTP enviadas a cada modelo e tempo de resposta, permitindo diagnóstico imediato.',
      'Comunicação honesta e transparente: em caso de oscilação técnica ou áudio sem fala audível, o agente responde cordialmente pelo WhatsApp explicando a situação e orientando a reenviar o áudio ou digitar o gasto (ex.: "Almoço 35 reais"), sem culpar a fala do usuário nem fingir falso entendimento.',
      'Rastreabilidade refinada de origem: distinção completa entre whatsapp_text, whatsapp_audio e manual no modelo de dados, registrando message_timestamp com a data/hora original da mensagem enviada na Meta.',
      'Interface com badges e data/hora original: Dashboard e Extrato de Transações agora exibem badge dedicado "Áudio WhatsApp" com ícone de microfone e data-hora exata do envio original.',
    ],
    details: [
      'Hook pocketbase/hooks/whatsapp_bridge.js refatorado com a cadeia multi-estratégia (Gemini 2.0 Flash, Whisper multipart e OpenAI direto), logs estruturados e propagação de message_timestamp.',
      'Extrato de Transações (src/pages/Transactions.tsx) e Dashboard (src/pages/Dashboard.tsx) integrados com renderização do badge "Áudio WhatsApp" e formatação de message_timestamp.',
      'Documentação técnica atualizada em docs/ARQUITETURA.md e roteiro regressivo detalhado em docs/TESTES_REGRESSIVOS.md com zero regressão.',
    ],
  },
  {
    version: '0.0.28',
    date: '02/11/2026',
    title:
      'Correção do Pipeline de Transcrição de Áudio (Voice Message WhatsApp) com Multipart FormData Nativo e Tratamento Preciso',
    tag: 'Estável',
    highlights: [
      'Correção da causa raiz da transcrição de áudio: o payload enviado para a API Whisper agora utiliza FormData multipart nativo do PocketBase com $filesystem.fileFromBytes(audioBytes, "audio.ogg"), eliminando a falha de codificação que provocava respostas falsas de "não entendi".',
      'Download do binário da Meta preservado como slice de bytes (res.body) em vez de conversão prematura para texto plano (res.rawText), preservando a integridade dos cabeçalhos e codecs Ogg/Opus do WhatsApp.',
      'Suporte a endpoints de IA resilientes: resolução dinâmica de SKIP_AI_GATEWAY_URL / SKIP_AI_CHAT_URL e SKIP_AI_GATEWAY_API_KEY / SKIP_AI_CHAT_API_KEY com fallback ordenado e timeout otimizado de 30s.',
      'Distinção honesta e clara de erros: mensagens de voz inaudíveis ou com falhas técnicas transitórias não respondem mais fingindo que a usuária não soube falar; o agente instrui objetivamente como reenviar ou digitar.',
      'Preservação total do fluxo do agente: uma vez transcrito, o áudio alimenta o mesmo agente nativo financeiro-whatsapp com data atual e registro em centavos na caixinha correspondente.',
    ],
    details: [
      'Hook pocketbase/hooks/whatsapp_bridge.js ajustado com tentativa Whisper via FormData ($filesystem.fileFromBytes) e logs analíticos detalhados de cada etapa (bytes baixados, status HTTP, texto extraído).',
      'Documentação central atualizada em docs/ARQUITETURA.md e docs/TESTES_REGRESSIVOS.md refletindo o pipeline robusto de voz.',
      'Zero impacto e zero regressão no restante das funcionalidades (webhooks Meta Graph API, regras de centavos, papéis admin x cliente, backoffice e reset).',
    ],
  },
  {
    version: '0.0.27',
    date: '02/11/2026',
    title:
      'Limpeza de Card Obsoleto no Assistente, Eliminação de Dados Fictícios e Restrição Rigorosa de Visão de Canal',
    tag: 'Estável',
    highlights: [
      'Página Assistente (/assistant) limpa para clientes comuns: clientes visualizam exclusivamente a janela de conversa e ferramentas de histórico funcional, sem nenhum card técnico de canal WhatsApp ou conector.',
      'Aviso de Canal Oficial restrito a Administradores: administradores visualizam na lateral o número oficial real (+55 11 94998-9868) com status dinâmico da Meta Cloud API via whatsapp_status.',
      'Eliminação total de dados fictícios: número legado "+55 (11) 98765-4321" e frases obsoletas de "conector do dono" completamente removidas de todas as telas.',
      'Validação de importação funcional mantida: ferramenta de transferência de histórico .txt do WhatsApp preservada com backend real de categorização e parse assíncrono.',
    ],
    details: [
      'Card Canal WhatsApp Real obsoleto substituído por visão restrita ao papel admin em src/pages/Assistant.tsx.',
      'Fallback de telefone em Settings.tsx e placeholder em Register.tsx atualizados para o número oficial real.',
      'Documentação técnica em docs/TESTES_REGRESSIVOS.md atualizada com os novos cenários de teste para o Assistente.',
    ],
  },
  {
    version: '0.0.25 (v1.7.0)',
    date: '02/11/2026',
    title:
      'Registro de Gastos por Áudio no WhatsApp, Papéis Admin × Cliente, Backoffice /admin, Ícone de Olho Fechado e Status de Leitura/Digitando',
    tag: 'Estável',
    highlights: [
      'Áudio via WhatsApp: reconhecimento automático de mensagens de voz (audio/voice), download seguro do binário pela Meta Cloud API, transcrição inteligente de fala para texto (STT) e reuso do mesmo fluxo do agente financeiro para registro da despesa na caixinha correta em centavos.',
      'Tratamento amigável de áudio inaudível: resposta empática e imediata caso o áudio esteja silencioso ou com ruído, orientando o cliente a gravar mais perto do microfone ou enviar por texto.',
      'Papéis Admin × Cliente e Restrição de Visão: cliente comum não vê dados técnicos de infraestrutura (token Meta, Phone Number ID, WABA ID, URL de Webhook ou listas de contatos). Dados técnicos exibidos em Minha Conta agora são exclusivos para admin.',
      'Proteção de API no Backend: endpoints técnicos (/backend/v1/whatsapp/status, /token, /send-test, /contacts) recusam clientes comuns com HTTP 403 Forbidden.',
      'Backoffice Administrativo (/admin): visão operacional para suporte com contagens e métricas (total de clientes, ativos 7d/30d, transações, conversas), lista com busca em tempo real/ordenação e modal de detalhe com caixinhas (gasto vs teto), extrato e histórico de mensagens.',
      'Ações de suporte no Backoffice: zerar fio da conversa (limpeza de thread travada) e vincular/desvincular o WhatsApp do cliente.',
      'Ícone de Olho Fechado em Campos de Senha: novo componente de olho fechado realista (pálpebra curva com cílios, sem risco sobreposto) em Login, Cadastro, Recuperação e Minha Conta.',
      'Indicação de Leitura e Digitando via Meta Status API: confirmação imediata de recebimento no WhatsApp com checks azuis (read) e três pontinhos (typing indicator) com custo zero de mensagens.',
      'Auto-promoção idempotente da dona do produto (barbara.ferreira.leal@gmail.com) para o papel admin via migração e no login.',
    ],
    details: [
      'Versão oficial 0.0.25 alinhada ao package.json e documentada em docs/ARQUITETURA.md e docs/TESTES_REGRESSIVOS.md.',
      'Hook pocketbase/hooks/whatsapp_bridge.js atualizado com download de mídia pela Meta Graph API e transcrição STT para mensagens de voz.',
      'Novo hook pocketbase/hooks/admin_backoffice.js com rotas /admin/overview, /admin/clients/{id}, reset-thread e toggle-whatsapp protegidas por role admin.',
      'Página src/pages/AdminBackoffice.tsx integrada com atalho na Sidebar e proteção de rota.',
      'Componente EyeClosedIcon integrado aos formulários com senha para UX refinada.',
      'Meta Status API chamada de forma não-bloqueante no webhook para resposta ágil sem regressões.',
    ],
  },
  {
    version: '0.0.24 (v1.6.0)',
    date: '02/11/2026',
    title: 'Novo Ícone Olho Fechado em Senhas e Indicação Imediata de Recebimento no WhatsApp',
    tag: 'Estável',
    highlights: [
      'Ícone do campo de senha reformulado: padrão oculto com desenho de olho fechado de verdade (pálpebra curva com cílios, sem barra por cima), abrindo para olho aberto ao clicar em Login, Cadastro, Redefinição e Minha Conta.',
      'Indicação imediata de recebimento no WhatsApp: ao receber mensagem no webhook, marca imediatamente como lida (checks azuis) e ativa os três pontinhos ("digitando...") via Meta Status API.',
      'Custo ZERO na Meta: a API de status não consome mensagens nem gera cobrança de conversa.',
      'Tolerância a falha estrita (fail-safe): qualquer oscilação da Meta é apenas logada e nunca atrasa nem bloqueia a resposta do agente.',
    ],
    details: [
      'Componente EyeClosedIcon em SVG dedicado criado e aplicado nas telas de autenticação e no modal de alteração de senha.',
      'Webhook em pocketbase/hooks/whatsapp_bridge.js atualizado com sendMetaStatusAndTyping imediato no caminho de entrada.',
      'Zero regressão: nenhuma coleção alterada, sem exposição de tokens e sem interferência no webhook de verificação.',
    ],
  },
  {
    version: 'v1.5.0',
    date: '02/11/2026',
    title: 'Renovação do Token Permanente da Meta WhatsApp Cloud API',
    tag: 'Estável',
    highlights: [
      'Atualização do token de acesso permanente da Meta Cloud API (WhatsApp Business) diretamente no banco.',
      'Validação bem-sucedida contra a Meta Graph API (HTTP 200 OK) no canal +55 11 94998-9868.',
      'Preservação integral do estado zerado para testes: 0 cadastros reais, 0 transações, 0 caixinhas.',
      'Zero exposição de segredos ou tokens em código versionado.',
    ],
    details: [
      'Registro único em whatsapp_status atualizado com o novo token de sistema permanente.',
      'Pipeline de envio e webhook mantidos com 100% de estabilidade (zero regressão).',
    ],
  },
  {
    version: 'v1.4.0',
    date: '01/11/2026',
    title: 'Correção de Reconhecimento no WhatsApp, Documentação Técnica e Script de Reset',
    tag: 'Estável',
    highlights: [
      'Correção definitiva do reconhecimento de contas recém-cadastradas no WhatsApp.',
      'Critério unificado de cadastro completo: usuário existente + tolerância de email + onboarding de caixinhas.',
      'Inclusão opcional do telefone com DDD na tela de cadastro e gestão direta em Minha Conta > Perfil.',
      'Mensagem para números não vinculados agora inclui links diretos para Cadastro e Login com instruções claras.',
      'Documentação técnica oficial criada em docs/ARQUITETURA.md e roteiro em docs/TESTES_REGRESSIVOS.md.',
      'Script de reset permanente em scripts/reset-dev.js preservando canal Meta Cloud API intacto.',
    ],
    details: [
      'Webhook do WhatsApp ajustado para auto-associar o telefone e nunca mais rejeitar usuários com caixinhas prontas.',
      'Prompt do agente $ai.agent("financeiro-whatsapp") reforçado com tolerância e proibição explícita de pedir finalização de cadastro para contas ativas.',
      'Criação do Runbook de zeragem seguro e guia de leitura de logs do webhook para suporte ágil.',
    ],
  },
  {
    version: 'v1.3.0',
    date: '31/10/2026',
    title: 'Valores em Centavos no Banco e Auto-Recuperação de Conversas Expiradas',
    tag: 'Estável',
    highlights: [
      'Padronização do amount em centavos (reais * 100) em transações e caixinhas.',
      'Recuperação automática de erro "conversation not found" no webhook e na simulação.',
      'Transações históricas incorretas migradas para centavos.',
    ],
    details: ['Garantia de que 100 reais salva 10000 centavos e R$ 45 salva 4500 centavos.'],
  },
  {
    version: 'v1.2.0',
    date: '30/10/2026',
    title: 'Rebranding Oficial para "Consciente" e Envio Direto via Meta Cloud API',
    tag: 'Estável',
    highlights: [
      'Marca atualizada para "Consciente - Seu parceiro nas finanças" em todas as telas, emails e prompts.',
      'Disparo direto via Meta Graph API (graph.facebook.com) com token em whatsapp_status.',
      'Remoção de referências a marcas antigas ou conectores externos.',
    ],
    details: ['Token permanente da Meta salvo com segurança e mascarado no frontend.'],
  },
  {
    version: 'v1.1.0',
    date: '28/10/2026',
    title: 'Onboarding Guiado de Caixinhas e Caixinhas Personalizadas',
    tag: 'Estável',
    highlights: [
      'Fluxo de onboarding com seleção de categorias e tetos em 2–3 passos.',
      'Criação de caixinhas personalizadas (ex.: "Viagem a Paris") com ícone e cor customizados.',
      'Adoção do termo amigável "Caixinhas" em toda a interface.',
    ],
    details: ['Adição do campo onboarding_completed aos usuários e persistência dos budgets.'],
  },
]

export const ReleaseLog: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Histórico de Versões e Releases
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Consciente - Seu parceiro nas finanças • Registro oficial de melhorias e correções
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar ao App
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="border-indigo-100 bg-indigo-50/60 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 space-y-1">
              <p className="font-semibold">
                Compromisso com a Estabilidade e Documentação do Produto
              </p>
              <p className="leading-relaxed text-indigo-800">
                Todas as alterações sistêmicas seguem a documentação técnica central em{' '}
                <code className="px-1 py-0.5 bg-indigo-100 rounded font-mono">
                  docs/ARQUITETURA.md
                </code>{' '}
                e o roteiro obrigatório em{' '}
                <code className="px-1 py-0.5 bg-indigo-100 rounded font-mono">
                  docs/TESTES_REGRESSIVOS.md
                </code>
                , assegurando que nenhuma conquista alcançada seja perdida em novas atualizações.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Release Timeline */}
        <div className="space-y-6">
          {RELEASES.map((rel) => (
            <Card key={rel.version} className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-slate-100 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs">
                      {rel.version}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal border-slate-300">
                      {rel.date}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[11px] ${
                        rel.tag === 'Atual'
                          ? 'bg-emerald-100 text-emerald-800 font-semibold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rel.tag}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Canal Oficial WhatsApp: +55 11 94998-9868
                  </span>
                </div>
                <CardTitle className="text-base font-bold text-slate-900 pt-2">
                  {rel.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Principais entregas e melhorias incorporadas nesta versão
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4 bg-white">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Destaques desta versão
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {rel.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {rel.details.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-slate-400" />
                      Detalhes de Implementação
                    </h4>
                    <ul className="space-y-1 text-[11px] text-slate-600">
                      {rel.details.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-slate-400">-</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Links */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Infraestrutura validada com Meta Cloud API e PocketBase Cloud</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/settings" className="hover:text-indigo-600 underline">
              Minha Conta
            </Link>
            <Link to="/onboarding" className="hover:text-indigo-600 underline">
              Onboarding
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReleaseLog
