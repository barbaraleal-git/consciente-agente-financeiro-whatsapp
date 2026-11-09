import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  CreditCard,
  Sparkles,
  Loader2,
  ShieldCheck,
  MessageCircle,
  CalendarDays,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { billingService, BillingStatusResponse, CompanyLegalInfo } from '@/services/finance'
import { useAuth } from '@/context/AuthContext'
import { LegalFooter } from '@/components/LegalFooter'
import { CheckoutReturnBanner, CheckoutReturnState } from '@/components/CheckoutReturnBanner'

type PlanType = 'mensal' | 'anual'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Assinatura Ativa',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  trial: { label: 'Período de Teste', className: 'bg-sky-100 text-sky-800 border-sky-300' },
  carencia: { label: 'Em Carência', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  bloqueado: { label: 'Bloqueado', className: 'bg-red-100 text-red-800 border-red-300' },
  cancelado: { label: 'Cancelado', className: 'bg-slate-100 text-slate-700 border-slate-300' },
}

const FEATURE_LIST = [
  'Registro de despesas e receitas ilimitado pelo WhatsApp',
  'Caixinhas (orçamentos) com alertas inteligentes',
  'Resumo financeiro diário/semanal/mensal no WhatsApp',
  'Relatórios e exportação',
  'Suporte prioritário',
]

export const SubscriptionPlansTab: React.FC = () => {
  const { toast } = useToast()
  const { refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<PlanType | null>(null)
  const [managing, setManaging] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null)
  const [legal, setLegal] = useState<CompanyLegalInfo | null>(null)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  const checkoutParam = searchParams.get('checkout') as CheckoutReturnState | null
  const sessionIdParam = searchParams.get('session_id') || undefined
  const returnState: CheckoutReturnState | null =
    checkoutParam === 'success' ||
    checkoutParam === 'cancelled' ||
    checkoutParam === 'portal_return'
      ? checkoutParam
      : null

  const loadBilling = useCallback(async () => {
    try {
      const status = await billingService.getStatus()
      setBilling(status)
      setLegal(status.legal_info || null)
    } catch {
      toast({
        title: 'Erro ao carregar assinatura',
        description: 'Não foi possível obter o status atual. Tente recarregar a página.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadBilling()
  }, [loadBilling])

  // Ao voltar do checkout/portal: recarrega status + usuário logado (sem logout)
  useEffect(() => {
    if (!returnState) return
    refreshUser()
  }, [returnState, refreshUser])

  const clearReturnParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('checkout')
        next.delete('session_id')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const handleCheckout = useCallback(
    async (planType: PlanType): Promise<unknown> => {
      setStarting(planType)
      try {
        const origin = window.location.origin
        const successUrl = `${origin}/settings?section=assinatura&checkout=success&session_id={CHECKOUT_SESSION_ID}`
        const cancelUrl = `${origin}/settings?section=assinatura&checkout=cancelled`
        const res = await billingService.createCheckoutSession(planType, successUrl, cancelUrl)
        if (res?.url) {
          // Redirect na MESMA aba — sessão do PocketBase (authStore localStorage)
          // é preservada porque o retorno é no MESMO host de onde o usuário saiu.
          window.location.href = res.url
          return null
        }
        throw new Error('sem url')
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message)
            : 'Falha ao iniciar o checkout. Tente novamente.'
        toast({
          title: 'Não foi possível iniciar o checkout',
          description: msg,
          variant: 'destructive',
        })
        return null
      } finally {
        setStarting(null)
      }
    },
    [toast],
  )

  const handleManage = useCallback(async () => {
    setManaging(true)
    try {
      const res = await billingService.createPortalSession(
        `${window.location.origin}/settings?section=assinatura&checkout=portal_return`,
      )
      if (res?.url) {
        window.location.href = res.url
        return
      }
      throw new Error('sem url')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : 'Falha ao abrir o portal. Tente novamente.'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
      setManaging(false)
    }
  }, [toast])

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    try {
      const res = await billingService.cancelSubscription()
      toast({ title: 'Assinatura cancelada', description: res.message || 'Status atualizado.' })
      await loadBilling()
      await refreshUser()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : 'Falha ao cancelar. Tente novamente.'
      toast({ title: 'Erro ao cancelar', description: msg, variant: 'destructive' })
    } finally {
      setCancelling(false)
    }
  }, [loadBilling, refreshUser, toast])

  const statusInfo = billing ? STATUS_BADGE[billing.status] || STATUS_BADGE.trial : null
  const isActive = billing?.status === 'active'
  const planLabel = billing?.plan === 'anual' ? 'Anual' : 'Mensal'
  const trialDaysLeft = useMemo(() => {
    if (!billing || billing.status !== 'trial' || !billing.expires_at) return null
    const diff = new Date(billing.expires_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [billing])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando sua assinatura…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Banner de retorno do checkout/portal — nunca silêncio */}
      {returnState && !dismissedBanner && (
        <CheckoutReturnBanner
          returnState={returnState}
          sessionId={sessionIdParam}
          billing={billing}
          onDismiss={() => {
            setDismissedBanner(true)
            clearReturnParams()
          }}
          onRetryCheckout={handleCheckout}
        />
      )}

      {/* Status atual */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Sua Assinatura
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Status atual da sua conta Consciente.
              </CardDescription>
            </div>
            {statusInfo && (
              <Badge variant="outline" className={`text-[11px] ${statusInfo.className}`}>
                {statusInfo.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {billing && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                    Plano
                  </p>
                  <p className="font-semibold text-slate-900 mt-0.5">{planLabel}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                    {billing.status === 'active'
                      ? 'Válida até'
                      : billing.status === 'trial'
                        ? 'Teste até'
                        : 'Renova em'}
                  </p>
                  <p className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-slate-500" />
                    {billing.expires_at ? formatDate(billing.expires_at) : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                    Valor
                  </p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {billing.plans?.[billing.plan]
                      ? formatCurrency(billing.plans[billing.plan].price_cents)
                      : '—'}
                    <span className="text-xs font-normal text-slate-500">
                      {billing.plan === 'anual' ? ' /ano' : ' /mês'}
                    </span>
                  </p>
                  {isActive && billing.plans?.[billing.plan]?.is_override && (
                    <p className="text-[10px] text-amber-700 mt-1">Preço promocional no cadastro</p>
                  )}
                </div>
              </div>

              {billing.status === 'trial' && trialDaysLeft !== null && (
                <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
                  Você tem <strong>{trialDaysLeft} dia(s)</strong> de teste. Assine para continuar
                  usando o agente no WhatsApp sem interrupções.
                </p>
              )}
              {billing.status === 'carencia' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  O último pagamento não passou. Você está em carência até{' '}
                  <strong>
                    {billing.carencia_until ? formatDate(billing.carencia_until) : '—'}
                  </strong>
                  . Atualize seu cartão no portal para evitar o bloqueio.
                </p>
              )}
              {billing.status === 'bloqueado' && (
                <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  Sua assinatura está bloqueada por falta de pagamento. Atualize o pagamento no
                  portal para reativar.
                </p>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2 pt-1">
                {!isActive && (
                  <Button
                    size="sm"
                    onClick={() => handleCheckout(billing?.plan === 'anual' ? 'anual' : 'mensal')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {billing.status === 'trial' ? 'Assinar agora' : 'Reativar assinatura'}
                  </Button>
                )}
                {(isActive || billing.has_stripe_customer) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManage}
                    disabled={managing}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    {managing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gerenciar assinatura (cartão, faturas)
                  </Button>
                )}
                {isActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cancelar assinatura
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Planos */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Planos disponíveis
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Cancele quando quiser. Sem multa, sem burocracia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['mensal', 'anual'] as PlanType[]).map((pt) => {
            const plan = billing?.plans?.[pt]
            const isCurrent = isActive && billing?.plan === pt
            return (
              <div
                key={pt}
                className={`rounded-xl border p-4 flex flex-col ${
                  isCurrent ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {plan?.name || (pt === 'anual' ? 'Anual' : 'Mensal')}
                  </span>
                  {pt === 'anual' && (
                    <Badge
                      className="bg-indigo-100 text-indigo-700 border-indigo-200"
                      variant="outline"
                    >
                      Economize 10%
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge
                      className="bg-emerald-600 text-white border-emerald-700"
                      variant="outline"
                    >
                      <Check className="w-3 h-3 mr-1" /> Atual
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {plan ? formatCurrency(plan.price_cents) : '—'}
                  <span className="text-sm font-normal text-slate-500">
                    {pt === 'anual' ? ' /ano' : ' /mês'}
                  </span>
                </p>
                <Separator className="my-3" />
                <ul className="space-y-1.5 text-xs text-slate-600 flex-1">
                  {FEATURE_LIST.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isActive && (
                  <Button
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={starting !== null}
                    onClick={() => handleCheckout(pt)}
                  >
                    {starting === pt ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirecionando…
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Assinar {pt === 'anual' ? 'Anual' : 'Mensal'}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Segurança e suporte */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Pagamento processado pela Stripe (PCI-DSS)
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          Dúvidas: {legal?.support_phone_or_bot || '+55 (11) 94998-9868'}
        </span>
      </div>

      <LegalFooter />
    </div>
  )
}

export default SubscriptionPlansTab
