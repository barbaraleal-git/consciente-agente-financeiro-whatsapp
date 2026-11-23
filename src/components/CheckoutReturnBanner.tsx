/**
 * Confirmação visual pós-checkout (sucesso, pendência ou cancelamento).
 *
 * Estado derivado de ?checkout=success|cancelled|portal_return na URL de
 * retorno enviada à Stripe — nunca silêncio: pagamento confirmado tem festa,
 * webhook em trânsito tem mensagem neutra com auto-refresh, cancelamento tem
 * tom acolhedor e botão "Tentar novamente", nunca um erro vermelho.
 */
import { useEffect, useRef, useState } from 'react'
import { PartyPopper, Hourglass, Undo2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { billingService, BillingStatusResponse } from '@/services/finance'
import { useAuth } from '@/context/AuthContext'

export type CheckoutReturnState = 'success' | 'cancelled' | 'portal_return'

export interface CheckoutReturnBannerProps {
  returnState: CheckoutReturnState
  sessionId?: string
  billing: BillingStatusResponse | null
  onDismiss: () => void
  onRetryCheckout: (planType: 'mensal' | 'anual') => Promise<unknown>
}

function isConfirmed(billing: BillingStatusResponse | null): boolean {
  // ANUAL VIA PIX (pagamento único): a confirmação pode vir de uma assinatura
  // recorrente OU de um pagamento único (access_until ativo, sem subscription).
  if (billing?.status !== 'active') return false
  return !!billing.has_stripe_subscription || !!billing.access_active
}

function formatDateOnly(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

export function CheckoutReturnBanner({
  returnState,
  sessionId,
  billing,
  onDismiss,
  onRetryCheckout,
}: CheckoutReturnBannerProps) {
  const { user, refreshUser } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const autoSyncDone = useRef(false)

  const confirmed = isConfirmed(billing)

  // Webhook em trânsito: mensagem neutra + auto-refresh (status + sync-session)
  useEffect(() => {
    if (returnState !== 'success' || confirmed) return
    if (autoSyncDone.current) return
    autoSyncDone.current = true
    const timer = setTimeout(async () => {
      setSyncing(true)
      try {
        await billingService.getStatus()
        if (sessionId && user) {
          await billingService.syncSession(sessionId)
        }
        await refreshUser()
      } catch {
        // segue pendente; o usuário ainda pode usar o botão manual
      } finally {
        setSyncing(false)
      }
    }, 3500)
    return () => clearTimeout(timer)
  }, [returnState, confirmed, sessionId, user, refreshUser])

  useEffect(() => {
    if (returnState === 'success' && confirmed) {
      const plan = billing?.plan === 'anual' ? 'Anual' : 'Mensal'
      toast({
        title: 'Pagamento confirmado! Sua assinatura está ativa 🎉',
        description: `Plano ${plan}${
          billing?.expires_at ? ' • válida até ' + formatDateOnly(billing.expires_at) : ''
        }`,
        duration: 10000,
      })
      // Limpa os params da URL depois da festa (F5 não refaz a festa nem repete o toast)
      const url = new URL(window.location.href)
      url.searchParams.delete('checkout')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnState, confirmed])

  if (returnState === 'success' && !confirmed) {
    return (
      <div className="rounded-xl border border-brand-petrol/30 bg-brand-petrol/5 p-4 text-sm text-[#1E4A5A] flex items-start gap-3">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-brand-petrol" />
        <div className="flex-1">
          <p className="font-semibold">Pagamento recebido! Ativando sua assinatura…</p>
          <p className="mt-1 text-brand-petrol">
            Em instantes ela aparece aqui como ativa. Nada mais é preciso fazer — pode fechar e
            voltar depois.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-brand-petrol/40 text-brand-petrol hover:bg-brand-petrol/10"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true)
              try {
                if (sessionId && user) {
                  await billingService.syncSession(sessionId)
                }
                await billingService.getStatus()
                await refreshUser()
              } catch {
                /* silencioso: o estado pendente continua visível */
              } finally {
                setSyncing(false)
              }
            }}
          >
            {syncing ? 'Verificando…' : 'Verificar novamente'}
          </Button>
        </div>
      </div>
    )
  }

  if (returnState === 'success' && confirmed) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 relative">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-emerald-700/60 hover:text-emerald-900 p-1"
          aria-label="Fechar aviso"
        >
          ✕
        </button>
        <div className="flex items-start gap-3">
          <PartyPopper className="h-8 w-8 shrink-0 text-emerald-600" />
          <div>
            <h3 className="text-lg font-bold text-emerald-900">
              Pagamento confirmado! Sua assinatura está ativa 🎉
            </h3>
            <p className="mt-1 text-emerald-800 text-sm">
              Plano <strong>{billing?.plan === 'anual' ? 'Anual' : 'Mensal'}</strong>
              {billing?.expires_at ? ` • válida até ${formatDateOnly(billing.expires_at)}` : ''}.
              Bom proveito — pode registrar suas despesas no WhatsApp normalmente!
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (returnState === 'cancelled') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Você não concluiu a assinatura</p>
            <p className="mt-1 text-amber-800">
              Sem problema — nada foi cobrado. Quando quiser, é só tentar de novo.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
              // Retoma o checkout do MESMO plano em que estava (anual volta
              // como pagamento único — o hook resolve o default do plano).
              onClick={() => onRetryCheckout(billing?.plan === 'anual' ? 'anual' : 'mensal')}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // portal_return: volta do portal da Stripe (cancelou/reativou/alterou dados)
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
      <div className="flex items-start gap-3">
        <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <div>
          <p className="font-semibold">Você voltou do portal de assinatura</p>
          <p className="mt-1">
            O status abaixo já reflete o estado atual da sua assinatura na Stripe.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CheckoutReturnBanner
