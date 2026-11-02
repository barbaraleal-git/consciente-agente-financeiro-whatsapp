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
    version: 'v1.6.0',
    date: '02/11/2026',
    title: 'Novo Ícone Olho Fechado em Senhas e Indicação Imediata de Recebimento no WhatsApp',
    tag: 'Atual',
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
