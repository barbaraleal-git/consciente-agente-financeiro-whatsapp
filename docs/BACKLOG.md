# Backlog / Pendências — Consciente (Seu parceiro nas finanças)

Documento oficial de controle de pendências e prioridades do produto. Este documento serve como guia estratégico para os próximos passos de evolução, mantido e reavaliado a cada ciclo de desenvolvimento.

**Regra Permanente**: Zero regressão. Tudo o que já foi validado e entregue deve obrigatoriamente se manter estável a cada nova iteração.

---

## Legenda de Status

- **Concluído**: Funcionalidade entregue, testada e validada em produção.
- **Respondido/Aguardando decisão**: Dúvida ou definição já esclarecida tecnicamente; aguarda direcionamento ou decisão estratégica de negócio.
- **Backlog**: Item pendente de desenvolvimento e priorizado para as próximas versões.

---

## 1. Itens Concluídos

| Item / Funcionalidade                                        | Descrição / Detalhes                                                                                                                                                                                                                                                                                      | Status        |
| :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ |
| **Áudio no WhatsApp**                                        | Transcrição de mensagens de voz (STT) com pipeline multi-estratégia (Groq Whisper large-v3-turbo / large-v3 com chave dinâmica lida do banco e fallback OpenAI Whisper), conversor Base64 puro em JS, tratamento empático de inaudível e registro em centavos na caixinha correta. Validado pela usuária. | **Concluído** |
| **Rastreabilidade de origem dos lançamentos**                | Identificação precisa da origem da despesa (\`whatsapp_text\`, \`whatsapp_audio\`, \`manual\`, \`import\`) com preservação em \`message_timestamp\` da data/hora exata do envio original na Meta e badges visuais dedicados no extrato e dashboard.                                                       | **Concluído** |
| **Separação de visões cliente × admin**                      | Isolamento estrito de permissões: cliente comum não vê dados técnicos (Meta token, Phone ID, WABA ID, Webhook) e tem acesso barrado no backoffice. Administradora (\`barbara.ferreira.leal@gmail.com\`) com privilégios completos.                                                                        | **Concluído** |
| **Backoffice /admin**                                        | Painel operacional completo com métricas globais da base, clientes ativos (7d/30d), total de transações, conversas no WhatsApp, lista paginada com busca em tempo real, ordenação dinâmica, modal de detalhe por cliente e ações de suporte (zerar fio de conversa e vincular/desvincular WhatsApp).      | **Concluído** |
| **Item 5: Documentos visíveis no /admin/docs**               | Disponibilização da especificação de Arquitetura Técnica (\`docs/ARQUITETURA.md\`), Roteiro de Testes Regressivos (\`docs/TESTES_REGRESSIVOS.md\`) e Backlog de Pendências diretamente na tela de documentação para administradores.                                                                      | **Concluído** |
| **Item 9: Custo mensal acumulado por cliente no backoffice** | Painel de custos operacionais detalhado no \`/admin\` com modelagem em R$ (R$ 0,001 áudio Groq, R$ 0,02 IA, R$ 0,04 utility), seletor de histórico de meses, cartões de consolidação mensal e exibição no detalhe individual do cliente.                                                                  | **Concluído** |
| **Item 12: Figurinhas de bichinhos nas caixinhas**           | Aba dedicada com figurinhas de animais (Gatinho 🐱, Cachorrinho 🐶, Patinhas 🐾, Ursinho 🐻, Panda 🐼, Coala 🐨, Leão 🦁, Coelhinho 🐰, Raposa 🦊, Pinguim 🐧, etc.) disponíveis na criação de caixinhas, refletidas em Caixinhas, Dashboard, Extrato e Modais.                                           | **Concluído** |
| **Item 13: Filtro padrão = mês corrente nas telas**          | Telas de Transações, Dashboard e Relatórios iniciam automaticamente filtradas pelo mês corrente (1º dia até a data atual), com seletor flexível para outros períodos.                                                                                                                                     | **Concluído** |
| **Item 16: Correção do bug do backoffice (erro 500)**        | Resolução definitiva da falha no endpoint \`/backend/v1/admin/overview\` com consultas seguras em \`whatsapp_contacts\` sem dependência de tabelas inexistentes.                                                                                                                                          | **Concluído** |
| **Item 19: Resumo visual das caixinhas no WhatsApp**         | Resumo padronizado com barras em caracteres de bloco proporcionais (\`▓▓▓▓░░░░░░\`), percentual de consumo, cabeçalho ("📊 _Suas Caixinhas — Mês de [Mês]_"), rodapé com saldo/estouro consolidado e marcadores automáticos (\`⚠️\` para ≥80% e \`🚨\` para estouro).                                     | **Concluído** |
| **Item 20: Foto de perfil do WhatsApp via API (admin)**      | Capacidade de atualizar o avatar oficial do número de atendimento diretamente pela tela de Configurações (\`/settings\`) via Resumable Upload da Meta API e \`whatsapp_business_profile\`, com nota explicativa sobre o nome de exibição.                                                                 | **Concluído** |

---

## 2. Respondido / Aguardando Decisão

| Item        | Tópico                            | Posição Técnica / Status Atual                                                                                                                                                                                                           | Status                            |
| :---------- | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| **Item 2**  | Impacto do áudio no custo         | **Respondido**: O custo de transcrição de áudio via Groq Whisper large-v3-turbo é de cerca de **R$ 0,001 por áudio** (frações mínimas de centavo), sendo considerado desprezível no custo unitário por cliente.                          | **Respondido/Aguardando decisão** |
| **Item 4**  | Previsão de custo por cliente/mês | **Respondido**: Modelo unitário calibrado e auditável no backoffice (áudio R$ 0,001, IA R$ 0,02, utility R$ 0,04, mensagens de serviço R$ 0,00). Custo médio estimado entre R$ 1,50 e R$ 3,50/cliente/mês dependendo do engajamento.     | **Respondido/Aguardando decisão** |
| **Item 6**  | Regras de investimento            | **Explicadas**: Regras conceituais e diferenciação entre reserva de emergência, aportes e metas foram explicadas. **Pendente decisão** sobre formato da caixinha de investimento (se terá teto reverso ou meta de acúmulo).              | **Respondido/Aguardando decisão** |
| **Item 21** | Cyber security                    | **Processo contínuo**: Aplicação das melhores práticas (mascaramento estrito de tokens, endpoints protegidos por papéis, validação de payload da Meta, SSL forçado e políticas de acesso). Continua como rotina permanente de segurança. | **Respondido/Aguardando decisão** |
| **Item 29** | Teste de carga                    | **Definido como será feito**: Arquitetura do teste de carga formulada (simulação concorrente no webhook e no pipeline do agente) para validação de volume antes do lançamento comercial aberto.                                          | **Respondido/Aguardando decisão** |

---

## 3. Backlog (Pendentes)

| Item           | Funcionalidade                           | Descrição / Dependências                                                                                                                                                                          | Status      |
| :------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------- |
| **Item 1**     | E-mail de confirmação obrigatório        | Exigir verificação estrita de e-mail antes da liberação total de acessos críticos na plataforma web.                                                                                              | **Backlog** |
| **Item 3**     | Mensagem da manhã via WhatsApp           | Envio pró-ativo matinal com status financeiro e lembrete de gastos. **Dependência**: Requer modelo de mensagem (utility template) submetido e aprovado pela Meta no WhatsApp Manager.             | **Backlog** |
| **Item 7**     | Observabilidade                          | Painel de monitoramento em tempo real com alertas imediatos para a administradora em caso de oscilação do webhook, Meta API ou provedores de IA.                                                  | **Backlog** |
| **Item 8**     | GitHub e controle de versão              | Sincronização externa de repositório e esteira de CI/CD (ação da usuária para provisionamento de credenciais).                                                                                    | **Backlog** |
| **Item 10+11** | Lançamento sem caixinha                  | Tratamento conversacional de despesas que não se enquadram nas caixinhas existentes: agente pergunta se deseja criar nova caixinha ou alocar em visão "fora de caixinha" no painel.               | **Backlog** |
| **Item 14**    | Portal de Planejadores Financeiros       | Painel dedicado para planejadores credenciados acompanharem clientes mediante termo de consentimento explícito e seguro.                                                                          | **Backlog** |
| **Item 15**    | Backup da base em produção               | Rotina automatizada e versionada de snapshot e exportação periódica do banco de dados em produção.                                                                                                | **Backlog** |
| **Item 17**    | PWA instalável no celular                | Manifesto web, service worker e suporte a instalação como Progressive Web App em iOS e Android com ícone Consciente.                                                                              | **Backlog** |
| **Item 18**    | Captcha no cadastro                      | Proteção contra cadastros automatizados (bots) na tela de registro com hCaptcha/Turnstile.                                                                                                        | **Backlog** |
| **Item 22**    | Guardrail de temas do agente             | Regras estritas de moderação para que o agente recuse educadamente conversas fora do escopo financeiro do Consciente.                                                                             | **Backlog** |
| **Item 23**    | Cancelar/substituir lançamento           | Permitir que o cliente cancele ou retifique um lançamento recente via WhatsApp ou painel. **Dependência**: Requer item 27 (deleção lógica).                                                       | **Backlog** |
| **Item 24**    | Billing + dashboard de assinaturas       | Módulo financeiro de cobrança e controle de planos pagos/recorrentes. **Dependência**: Aguarda definição final da precificação e gateways de pagamento (ex: Stripe/Asaas).                        | **Backlog** |
| **Item 25**    | Módulo de suporte                        | Central de tickets e atendimento integrado para clientes solicitarem ajuda à equipe humana do Consciente.                                                                                         | **Backlog** |
| **Item 26**    | Feedbacks via WhatsApp + alerta imediato | Canal conversacional para o cliente enviar sugestões e elogios, gerando alerta em tempo real para a administradora.                                                                               | **Backlog** |
| **Item 27**    | Deleção lógica com status                | Implementar status de exclusão (\`active\`, \`cancelled\`, \`deleted\`) em lançamentos para auditoria e histórico de segurança.                                                                   | **Backlog** |
| **Item 28**    | Gasto retroativo                         | Capacidade do agente interpretar datas passadas na fala ou texto ("ontem gastei 50", "terça-feira gastei 30"). Carimbos estruturais já existem no banco; falta ajuste no prompt/parser do agente. | **Backlog** |
