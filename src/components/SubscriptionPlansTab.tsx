import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { billingService, type BillingStatusResponse } from '@/services/finance'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  Clock,
  Loader2,
  Calendar,
  ExternalLink,
  Ban,
  CheckCircle2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import LegalFooter from '@/components/LegalFooter'

export const SubscriptionPlansTab: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<BillingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<
    'mensal' | 'anual' | 'portal' | 'cancel' | null
  >(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadStatus = async () => {
    try {
      setLoading(true)
      const res = await billingService.getStatus()
      setData(res)
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('Não foi possível carregar os dados de assinatura.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // Checa se voltou do checkout com sucesso
    const checkoutResult = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')
    if (checkoutResult === 'success' && sessionId) {
      setSuccessMsg('Pagamento recebido com sucesso! Sincronizando assinatura...')
      billingService
        .syncSession(sessionId)
        .then((res) => {
          if (res.success) {
            setSuccessMsg(
              'Assinatura ativada com sucesso! Seu agente no WhatsApp já está 100% liberado.',
            )
            loadStatus()
          } else {
            setSuccessMsg(
              'Pagamento confirmado! A ativação pode levar alguns instantes; se o status não mudar, aguarde um minuto e recarregue a página.',
            )
            loadStatus()
          }
        })
        .catch(() => {
          // Sincronização falhou, mas o webhook da Stripe também ativa a
          // assinatura — orientamos a recarregar em vez de alarmar.
          setSuccessMsg(
            'Pagamento confirmado! Se o status não atualizar em instantes, recarregue a página.',
          )
          loadStatus()
        })
    } else if (checkoutResult === 'cancelled') {
      setErrorMsg('Processo de pagamento cancelado. Você pode tentar novamente a qualquer momento.')
    }
  }, [searchParams])

  const handleCheckout = async (planType: 'mensal' | 'anual') => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setActionLoading(planType)
    try {
      const origin = window.location.origin
      // URLs de retorno apontam para a seção real da aba de assinatura
      const successUrl = `${origin}/settings?section=assinatura&checkout=success&session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${origin}/settings?section=assinatura&checkout=cancelled`

      const res = await billingService.createCheckoutSession(planType, successUrl, cancelUrl)
      if (res?.url) {
        window.location.href = res.url
        return
      }
      setErrorMsg('Não foi possível iniciar o checkout. Tente novamente ou fale com o suporte.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(
        msg || 'Não foi possível iniciar o checkout. Tente novamente ou fale com o suporte.',
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (
      !window.confirm(
        'Tem certeza que deseja cancelar sua assinatura do Consciente? Você perderá acesso às caixinhas e ao agente no WhatsApp.',
      )
    ) {
      return
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setActionLoading('cancel')
    try {
      const res = await billingService.cancelSubscription()
      if (res.success) {
        setSuccessMsg('Assinatura cancelada com sucesso.')
        loadStatus()
      } else {
        setErrorMsg(res.message || 'Erro ao cancelar assinatura.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg || 'Falha ao cancelar assinatura.')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePortal = async () => {
    setActionLoading('portal')
    try {
      const res = await billingService.createPortalSession(window.location.href)
      if (res?.url) {
        window.location.href = res.url
        return
      }
      setErrorMsg(
        'Não foi possível acessar o portal de faturamento. Tente novamente ou fale com o suporte.',
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(
        msg ||
          'Não foi possível acessar o portal de faturamento. Tente novamente ou fale com o suporte.',
      )
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Carregando planos e dados de assinatura...</p>
      </div>
    )
  }

  const status = data?.status || 'trial'
  const mensalPlan = data?.plans?.mensal
  const anualPlan = data?.plans?.anual

  return (
    <div className="space-y-8">
      {/* Mensagens de Alerta */}
      {errorMsg && (
        <Alert
          variant="destructive"
          className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-700 dark:text-red-300">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            {successMsg}
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de Status Atual */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Status da sua Assinatura
              </CardTitle>
              <CardDescription>
                Acompanhe o estado da sua conta, renovação e funcionalidades liberadas
              </CardDescription>
            </div>
            <div>
              {status === 'active' && (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-3 py-1 text-xs">
                  <Check className="w-3.5 h-3.5 mr-1" /> Assinatura Ativa (
                  {data?.plan === 'anual' ? 'Anual' : 'Mensal'})
                </Badge>
              )}
              {status === 'trial' && (
                <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1 text-xs">
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Período de Avaliação (Trial)
                </Badge>
              )}
              {status === 'carencia' && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1 text-xs">
                  <Clock className="w-3.5 h-3.5 mr-1" /> Em Carência (7 dias)
                </Badge>
              )}
              {status === 'bloqueado' && (
                <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-1 text-xs">
                  <Ban className="w-3.5 h-3.5 mr-1" /> Bloqueado por Inadimplência
                </Badge>
              )}
              {status === 'cancelado' && (
                <Badge className="bg-slate-600 text-white font-semibold px-3 py-1 text-xs">
                  Assinatura Cancelada
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2 text-sm text-slate-600 dark:text-slate-300">
          {status === 'carencia' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs leading-relaxed space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Aviso de Carência por Falha no Pagamento
              </div>
              <p>
                Houve uma falha na renovação da sua assinatura. Durante a carência de 7 dias você
                mantém acesso às consultas aqui no app, mas o agente no WhatsApp fica suspenso até a
                regularização do pagamento.
              </p>
              {data?.carencia_until && (
                <p className="font-semibold">
                  Prazo de carência até: {new Date(data.carencia_until).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          )}

          {status === 'bloqueado' && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs leading-relaxed space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Conta Bloqueada por Inadimplência
              </div>
              <p>
                O prazo de carência expirou. Reative seu plano abaixo para desbloquear imediatamente
                todas as funcionalidades do aplicativo e o envio pelo WhatsApp.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">Titular</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {data?.user_info.full_name || data?.user_info.name}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">CPF Cadastrado</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {data?.user_info.cpf
                  ? `${data.user_info.cpf.slice(0, 3)}.***.***-${data.user_info.cpf.slice(-2)}`
                  : 'Não informado'}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">Vigência / Renovação</span>
              <strong className="text-slate-900 dark:text-slate-100">
                {data?.expires_at
                  ? new Date(data.expires_at).toLocaleDateString('pt-BR')
                  : 'Sem data de expiração'}
              </strong>
            </div>
          </div>

          {status === 'active' && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePortal}
                disabled={actionLoading === 'portal'}
                className="text-xs text-slate-700 dark:text-slate-200"
              >
                {actionLoading === 'portal' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                )}
                Gerenciar Cartão e Faturas na Stripe
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                {actionLoading === 'cancel' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : null}
                Cancelar Assinatura
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de Planos: Mensal e Anual */}
      <div>
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <Badge className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100">
            Oferta Especial Black November
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Escolha o Plano Ideal para seu Controle Financeiro
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Acesso total ao parceiro financeiro no WhatsApp (áudio, texto e fotos) + painel de
            Caixinhas completo. Cancele a qualquer momento com apenas 1 clique.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Card Mensal */}
          <Card className="relative border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-600 transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {mensalPlan?.name || 'Plano Mensal'}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-indigo-300 text-indigo-600 dark:text-indigo-400 text-xs"
                >
                  Recorrente
                </Badge>
              </div>
              <CardDescription>Flexibilidade mensal total sem fidelidade</CardDescription>
              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  {mensalPlan ? formatCurrency(mensalPlan.price_cents) : 'R$ 19,90'}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">/mês</span>
              </div>
              {mensalPlan?.is_override && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Desconto especial individual aplicado à sua conta
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Envio de gastos no WhatsApp por texto e voz</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Classificação automática com Caixinhas inteligentes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Resumo do dia determinístico e relatórios</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Cancelamento fácil a qualquer momento</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={() => handleCheckout('mensal')}
                disabled={actionLoading !== null}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white font-medium"
              >
                {actionLoading === 'mensal' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Abrindo Stripe...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Assinar Mensal
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Card Anual (Destaque) */}
          <Card className="relative border-indigo-500 dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-lg flex flex-col justify-between ring-2 ring-indigo-500/20">
            <div className="absolute -top-3 right-6 bg-indigo-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
              Mais Econômico (10% OFF)
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {anualPlan?.name || 'Plano Anual'}
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </CardTitle>
                <Badge className="bg-indigo-600 text-white text-xs">Recomendado</Badge>
              </div>
              <CardDescription>Economia garantida com tranquilidade o ano todo</CardDescription>
              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  {anualPlan ? formatCurrency(anualPlan.price_cents) : 'R$ 214,90'}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">/ano</span>
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                Equivalente a apenas{' '}
                {anualPlan ? formatCurrency(Math.round(anualPlan.price_cents / 12)) : 'R$ 17,90'}
                /mês
              </div>
              {anualPlan?.is_override && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Desconto especial individual aplicado à sua conta
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>
                    <strong>Tudo do plano mensal</strong>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Economia de 10% no valor anual total</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Proteção contra reajustes de preço durante 12 meses</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Acesso prioritário a novas funcionalidades e relatórios</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={() => handleCheckout('anual')}
                disabled={actionLoading !== null}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30"
              >
                {actionLoading === 'anual' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Abrindo Stripe...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Assinar Anual (10% OFF)
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Caixa de Segurança e Termos de Recorrência */}
      <div className="max-w-4xl mx-auto p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <div className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Transparência, Segurança e Garantia CDC
        </div>
        <p className="leading-relaxed">
          • <strong>Pagamento 100% seguro:</strong> processado diretamente pela Stripe com
          certificado PCI-DSS Nível 1. O Consciente nunca armazena seus dados de cartão de crédito.
        </p>
        <p className="leading-relaxed">
          • <strong>Consentimento de renovação:</strong> a assinatura é recorrente e renovada
          automaticamente no final de cada período (mensal ou anual) até que você solicite o
          cancelamento.
        </p>
        <p className="leading-relaxed">
          • <strong>Direito de arrependimento (Art. 49 do CDC):</strong> você pode cancelar sua
          compra e solicitar reembolso integral em até 7 dias corridos após a primeira contratação
          via suporte.
        </p>
        <p className="leading-relaxed">
          • <strong>Cancelamento sem burocracia:</strong> cancele quando quiser diretamente nesta
          página ou pelo portal da Stripe sem taxas ou multas de rescisão.
        </p>
      </div>

      {/* Rodapé Legal conforme Decreto 7.962/2013 */}
      <LegalFooter />
    </div>
  )
}

export default SubscriptionPlansTab
