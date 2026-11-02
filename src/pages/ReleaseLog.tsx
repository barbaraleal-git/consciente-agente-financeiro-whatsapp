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
    version: '0.0.34',
    date: '03/11/2026',
    title:
      'Campo Admin de Chave de Transcrição de Voz (STT) e Leitura Dinâmica pelo Hook do WhatsApp',
    tag: 'Atual',
    highlights: [
      'Campo seguro no Painel Admin: em Configurações (exclusivo para administradores), adição de campo para colar a chave de transcrição de voz (Groq/OpenAI) com padrão seguro do token da Meta — o valor é persistido no banco e nunca é reexibido na tela.',
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
      'Papéis Admin × Cliente e Restrição de Visão: cliente comum não vê dados técnicos de infraestrutura (token Meta, Phone Number ID, WABA ID, URL de Webhook ou listas de contatos). Configurações técnicas agora são exclusivas para admin.',
      'Proteção de API no Backend: endpoints técnicos (/backend/v1/whatsapp/status, /token, /send-test, /contacts) recusam clientes comuns com HTTP 403 Forbidden.',
      'Backoffice Administrativo (/admin): visão operacional para suporte com contagens e métricas (total de clientes, ativos 7d/30d, transações, conversas), lista com busca em tempo real/ordenação e modal de detalhe com caixinhas (gasto vs teto), extrato e histórico de mensagens.',
      'Ações de suporte no Backoffice: zerar fio da conversa (limpeza de thread travada) e vincular/desvincular o WhatsApp do cliente.',
      'Ícone de Olho Fechado em Campos de Senha: novo componente de olho fechado realista (pálpebra curva com cílios, sem risco sobreposto) em Login, Cadastro, Recuperação e Configurações.',
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
      'Ícone do campo de senha reformulado: padrão oculto com desenho de olho fechado de verdade (pálpebra curva com cílios, sem barra por cima), abrindo para olho aberto ao clicar em Login, Cadastro, Redefinição e Configurações.',
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
      'Inclusão opcional do telefone com DDD na tela de cadastro e gestão direta em Configurações > Perfil.',
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
              Configurações
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
