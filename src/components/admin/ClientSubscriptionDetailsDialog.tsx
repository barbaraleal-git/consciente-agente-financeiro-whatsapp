import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Download } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import { getBackendErrorMessage } from '@/lib/pocketbase/errors'
import {
  billingService,
  type AdminClientDetailsResponse,
  type AdminClientStatementItem,
} from '@/services/finance'
import { useToast } from '@/hooks/use-toast'

/**
 * v0.0.119 (pedido da dona): visão completa de um cliente na aba Assinaturas
 * dos Clientes — dados da assinatura + extrato cronológico de TODAS as
 * cobranças desde a assinatura (route 12b do backend), com total pago,
 * contagem de cobranças e exportação CSV.
 */

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa',
  trial: 'Trial',
  carencia: 'Carência',
  bloqueado: 'Bloqueado',
  cancelado: 'Cancelada',
}

const PAY_STATUS_LABEL: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
  '—': '—',
}

const PAY_STATUS_BADGE: Record<string, string> = {
  pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  falhou: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelado: 'bg-slate-100 text-slate-600 border-slate-200',
  '—': 'bg-slate-100 text-slate-500 border-slate-200',
}

/**
 * v0.0.119: rótulo amigável do tipo de evento do extrato (100% PT-BR), a
 * partir do event_type registrado em subscriptions_history / na Stripe.
 */
export const getEventLabel = (item: AdminClientStatementItem): string => {
  const et = String(item.event_type || '')
  const reason = String(item.billing_reason || '')
  if (et.indexOf('one_time') >= 0) return 'Assinatura anual (pagamento único)'
  if (et === 'stripe.invoice' || et.indexOf('invoice') >= 0) {
    if (reason === 'subscription_cycle') return 'Renovação (ciclo da assinatura)'
    if (reason === 'subscription_create') return 'Assinatura inicial'
    if (reason === 'subscription_update') return 'Renovação (atualização da assinatura)'
    if (reason === 'manual') return 'Cobrança manual'
    return 'Cobrança Stripe'
  }
  if (et.indexOf('payment_failed') >= 0) return 'Falha de cobrança'
  if (et.indexOf('payment_pending') >= 0 || et.indexOf('processing') >= 0)
    return 'Cobrança pendente'
  if (et.indexOf('payment') >= 0) return 'Pagamento confirmado'
  if (et.indexOf('created') >= 0 || et.indexOf('checkout') >= 0) return 'Assinatura inicial'
  if (et.indexOf('renew') >= 0 || et.indexOf('cycle') >= 0) return 'Renovação'
  if (et.indexOf('cancel') >= 0) return 'Assinatura cancelada'
  if (et.indexOf('expired') >= 0 || et.indexOf('bloque') >= 0) return 'Acesso expirado/bloqueado'
  if (et.indexOf('trial') >= 0) return 'Início de trial'
  if (et.indexOf('status') >= 0) return 'Mudança de status'
  return et || 'Evento'
}

const exportStatementCsv = (statement: AdminClientStatementItem[], userName: string) => {
  const header = ['Data', 'Descrição', 'Valor (R$)', 'Status', 'Canal', 'Origem', 'ID Stripe']
  const lines = statement.map((it) => {
    const row = [
      formatDateTime(it.date),
      getEventLabel(it),
      ((it.amount_cents || 0) / 100).toFixed(2).replace('.', ','),
      PAY_STATUS_LABEL[it.payment_status] || it.payment_status || '—',
      it.channel || '—',
      it.source === 'stripe' ? 'Stripe' : 'App',
      it.stripe_invoice_id || '',
    ]
    return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
  })
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `extrato-${(userName || 'cliente').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface Props {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ClientSubscriptionDetailsDialog: React.FC<Props> = ({
  userId,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<AdminClientDetailsResponse | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setDetails(null)
      try {
        const res = await billingService.adminGetClientSubscriptionDetails(userId)
        if (!cancelled) setDetails(res)
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = getBackendErrorMessage(
            err,
            'Falha ao carregar os detalhes da assinatura do cliente.',
          )
          toast({ title: 'Erro nos detalhes', description: msg, variant: 'destructive' })
          onOpenChange(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, userId, toast, onOpenChange])

  const user = details?.user
  const statement = useMemo(() => details?.statement ?? [], [details])
  const totals = details?.totals

  const subscriptionDate = user?.created ? formatDateTime(user.created) : '—'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {user ? `${user.full_name || user.name || user.email}` : 'Detalhes do cliente'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-brand-petrol" />
            Carregando detalhes...
          </div>
        ) : !user ? (
          <div className="py-8 text-center text-sm text-slate-500">Nenhum detalhe carregado.</div>
        ) : (
          <div className="space-y-4">
            {/* ---- Dados da assinatura ---- */}
            <div className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <div className="flex justify-between gap-2 sm:col-span-2">
                <span className="text-slate-500">E-mail</span>
                <span className="font-medium text-slate-800 text-right break-all">
                  {user.email}
                </span>
              </div>
              {user.phone && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Telefone</span>
                  <span className="font-mono text-slate-700">{user.phone}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Status</span>
                <span className="font-medium text-slate-800">
                  {STATUS_LABEL[user.subscription_status] || user.subscription_status}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Plano</span>
                <span className="font-medium text-slate-800">
                  {user.subscription_plan === 'anual' ? 'Anual' : 'Mensal'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Cliente desde</span>
                <span className="text-slate-700">{subscriptionDate}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Modo de cobrança</span>
                <span className="font-medium text-slate-800">
                  {user.billing_mode === 'one_time'
                    ? 'Pagamento único (Pix/cartão)'
                    : 'Assinatura recorrente'}
                </span>
              </div>
              {user.billing_mode === 'one_time' && user.payment_amount_cents > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Valor pago à vista</span>
                  <span className="font-medium text-emerald-700">
                    {formatCurrency(user.payment_amount_cents)}{' '}
                    {user.payment_paid_at ? `em ${formatDateTime(user.payment_paid_at)}` : ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Acesso até</span>
                <span className="text-slate-700">
                  {user.access_until || user.subscription_expires_at
                    ? formatDateTime(user.access_until || user.subscription_expires_at)
                    : '—'}
                </span>
              </div>
              {user.carencia_until && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Carência até</span>
                  <span className="text-amber-700">{formatDateTime(user.carencia_until)}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">IDs Stripe</span>
                <span className="font-mono text-[10px] text-slate-500 text-right break-all">
                  {user.stripe_customer_id || '—'}
                  {user.stripe_subscription_id ? ` · ${user.stripe_subscription_id}` : ''}
                </span>
              </div>
            </div>

            {/* ---- Extrato cronológico ---- */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Extrato de cobranças desde a assinatura
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    exportStatementCsv(statement, user.full_name || user.name || user.email)
                  }
                  disabled={statement.length === 0}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
                </Button>
              </div>

              {details?.stripe_error && (
                <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                  {details.stripe_error}
                </div>
              )}

              {statement.length === 0 ? (
                <div className="rounded-md border border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
                  Nenhuma cobrança registrada desde a assinatura.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600">
                        <th className="text-left font-semibold px-2.5 py-2">Data</th>
                        <th className="text-left font-semibold px-2.5 py-2">Descrição</th>
                        <th className="text-right font-semibold px-2.5 py-2">Valor</th>
                        <th className="text-center font-semibold px-2.5 py-2">Status</th>
                        <th className="text-center font-semibold px-2.5 py-2">Canal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.map((it) => (
                        <tr key={it.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-2.5 py-2 whitespace-nowrap text-slate-600">
                            {formatDateTime(it.date)}
                          </td>
                          <td className="px-2.5 py-2 text-slate-800">
                            {getEventLabel(it)}
                            {it.status_from || it.status_to ? (
                              <div className="text-[10px] text-slate-400">
                                {it.status_from || '—'} → {it.status_to || '—'}
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`px-2.5 py-2 text-right whitespace-nowrap font-medium ${
                              it.amount_cents > 0 ? 'text-slate-800' : 'text-slate-400'
                            }`}
                          >
                            {it.amount_cents > 0 ? formatCurrency(it.amount_cents) : '—'}
                          </td>
                          <td className="px-2.5 py-2 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                PAY_STATUS_BADGE[it.payment_status] ||
                                'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {PAY_STATUS_LABEL[it.payment_status] || it.payment_status || '—'}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2 text-center text-slate-600">
                            {it.channel || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ---- Rodapé: total pago + contagem ---- */}
            {totals && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-emerald-800 font-semibold">
                    Total pago desde a assinatura:{' '}
                  </span>
                  <span className="text-emerald-900 font-bold">
                    {formatCurrency(totals.total_paid_cents)}
                  </span>
                </div>
                <div className="text-emerald-800">
                  {totals.payments_count} cobrança(s) paga(s) · {totals.statement_count} evento(s)
                  no extrato
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
