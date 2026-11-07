import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/formatters'
import {
  billingService,
  adminService,
  type AdminSubscriptionsResponse,
  type SubscriptionPlanItem,
  type CompanyLegalInfo,
} from '@/services/finance'
import {
  Loader2,
  RefreshCw,
  Save,
  Users,
  Tag,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Clock,
  Ban,
  XCircle,
  CheckCircle2,
} from 'lucide-react'

type AdminTab = 'clientes' | 'planos' | 'legal'

const EMPTY_LEGAL_INFO: CompanyLegalInfo = {
  company_name: '',
  trade_name: '',
  cnpj: '',
  address_full: '',
  email_contact: '',
  support_phone_or_bot: '',
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ReactNode }> =
  {
    active: {
      label: 'Ativa',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    },
    trial: {
      label: 'Trial',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: <Sparkles className="w-3 h-3 mr-1" />,
    },
    carencia: {
      label: 'Carência',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <Clock className="w-3 h-3 mr-1" />,
    },
    bloqueado: {
      label: 'Bloqueado',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <Ban className="w-3 h-3 mr-1" />,
    },
    cancelado: {
      label: 'Cancelado',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: <XCircle className="w-3 h-3 mr-1" />,
    },
  }

export const BillingAdminSection: React.FC = () => {
  const { toast } = useToast()
  const [adminTab, setAdminTab] = useState<AdminTab>('clientes')

  const [subsLoading, setSubsLoading] = useState(true)
  const [subsData, setSubsData] = useState<AdminSubscriptionsResponse | null>(null)

  const [plansLoading, setPlansLoading] = useState(true)
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([])
  const [planDrafts, setPlanDrafts] = useState<Record<string, SubscriptionPlanItem>>({})
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)

  const [legalLoading, setLegalLoading] = useState(true)
  const [legal, setLegal] = useState<CompanyLegalInfo | null>(null)
  const [legalError, setLegalError] = useState<string | null>(null)
  const [savingLegal, setSavingLegal] = useState(false)

  const loadSubscriptions = async () => {
    try {
      setSubsLoading(true)
      const res = await billingService.adminGetSubscriptions()
      setSubsData(res)
    } catch {
      toast({
        title: 'Erro ao carregar assinaturas',
        description: 'Não foi possível listar o status de assinatura dos clientes.',
        variant: 'destructive',
      })
    } finally {
      setSubsLoading(false)
    }
  }

  const loadPlans = async () => {
    try {
      setPlansLoading(true)
      const res = await billingService.adminGetPlans()
      setPlans(res.plans || [])
      const drafts: Record<string, SubscriptionPlanItem> = {}
      for (const p of res.plans || []) drafts[p.id] = { ...p }
      setPlanDrafts(drafts)
      if (res.legal_info) setLegal(res.legal_info)
    } catch {
      toast({
        title: 'Erro ao carregar planos',
        description: 'Verifique se você está autenticado como administrador.',
        variant: 'destructive',
      })
    } finally {
      setPlansLoading(false)
    }
  }

  const loadLegal = async () => {
    try {
      setLegalLoading(true)
      setLegalError(null)
      const res = await billingService.adminGetPlans()
      setLegal(res.legal_info || { ...EMPTY_LEGAL_INFO })
    } catch {
      // Sem dados legais (ou sem permissão/erro): abre o formulário vazio em vez de travar
      setLegal({ ...EMPTY_LEGAL_INFO })
      setLegalError(
        'Não foi possível carregar os dados legais salvos. O formulário foi aberto vazio — preencha e salve.',
      )
    } finally {
      setLegalLoading(false)
    }
  }

  useEffect(() => {
    loadSubscriptions()
    loadPlans()
    loadLegal()
  }, [])

  const handleSavePlan = async (plan: SubscriptionPlanItem) => {
    if (!plan.price_cents || plan.price_cents <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'Informe um preço em centavos maior que zero.',
        variant: 'destructive',
      })
      return
    }
    try {
      setSavingPlanId(plan.id)
      const res = await billingService.adminSavePlan(plan)
      if (res.success) {
        toast({
          title: 'Plano salvo!',
          description: res.message || 'Preço atualizado com sucesso.',
        })
        await loadPlans()
      } else {
        toast({
          title: 'Erro ao salvar plano',
          description: res.message || 'Tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar plano.'
      toast({ title: 'Erro ao salvar plano', description: msg, variant: 'destructive' })
    } finally {
      setSavingPlanId(null)
    }
  }

  const handleSetupStripe = async () => {
    try {
      setSetupLoading(true)
      const res = await billingService.adminSetupStripeProducts()
      toast({
        title: res.success ? 'Produtos Stripe configurados' : 'Aviso da Stripe',
        description: res.message || 'Verifique os produtos/preços criados na Stripe.',
      })
      await loadPlans()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao configurar produtos na Stripe.'
      toast({ title: 'Erro na configuração Stripe', description: msg, variant: 'destructive' })
    } finally {
      setSetupLoading(false)
    }
  }

  const handleSaveLegal = async () => {
    if (!legal) return
    try {
      setSavingLegal(true)
      const res = await billingService.adminSaveLegalInfo(legal)
      if (res.success) {
        setLegalError(null)
        toast({
          title: 'Dados legais salvos!',
          description: 'As informações do rodapé e das telas de cobrança foram atualizadas.',
        })
      } else {
        toast({
          title: 'Erro ao salvar dados legais',
          description: res.message || 'Tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar dados legais.'
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' })
    } finally {
      setSavingLegal(false)
    }
  }

  const statusMetrics = useMemo(() => subsData?.metrics, [subsData])

  return (
    <div className="space-y-4">
      {/* Mini-tabs internas do módulo de billing */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['clientes', 'Assinaturas dos Clientes', Users],
            ['planos', 'Planos e Preços', Tag],
            ['legal', 'Dados Legais', ShieldCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setAdminTab(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              adminTab === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ============ ABA: ASSINATURAS DOS CLIENTES ============ */}
      {adminTab === 'clientes' && (
        <div className="space-y-3">
          {subsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando assinaturas...
            </div>
          ) : !subsData ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Não foi possível carregar as assinaturas.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Ativas: {statusMetrics?.active ?? 0}
                </Badge>
                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Trial: {statusMetrics?.trial ?? 0}
                </Badge>
                <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                  Carência: {statusMetrics?.carencia ?? 0}
                </Badge>
                <Badge className="bg-rose-50 text-rose-700 border border-rose-200">
                  Bloqueados: {statusMetrics?.bloqueado ?? 0}
                </Badge>
                <Badge className="bg-slate-100 text-slate-600 border border-slate-200">
                  Cancelados: {statusMetrics?.cancelado ?? 0}
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-slate-400">Total: {subsData.clients.length}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSubscriptions}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 border-b border-slate-200">
                      <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
                      <TableHead className="font-semibold text-slate-700">Plano</TableHead>
                      <TableHead className="font-semibold text-slate-700">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700">
                        Vigência / Carência
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">Stripe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subsData.clients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-500">
                          Nenhum cliente encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      subsData.clients.map((c) => {
                        const cfg = STATUS_CONFIG[c.subscription_status] || STATUS_CONFIG.cancelado
                        return (
                          <TableRow key={c.id} className="border-b border-slate-100">
                            <TableCell>
                              <div className="text-xs font-semibold text-slate-900">
                                {c.full_name || c.name}
                              </div>
                              <div className="text-[11px] text-slate-500">{c.email}</div>
                              {c.phone && (
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {c.phone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {c.subscription_plan === 'anual' ? 'Anual' : 'Mensal'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[11px] ${cfg.badgeClass}`}>
                                {cfg.icon}
                                {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {c.subscription_status === 'carencia' && c.carencia_until
                                ? `Carência até ${new Date(c.carencia_until).toLocaleDateString('pt-BR')}`
                                : c.subscription_expires_at
                                  ? `Renova em ${new Date(c.subscription_expires_at).toLocaleDateString('pt-BR')}`
                                  : '—'}
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-500">
                              {c.stripe_subscription_id
                                ? 'Assinatura vinculada'
                                : 'Sem assinatura Stripe'}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ ABA: PLANOS E PREÇOS ============ */}
      {adminTab === 'planos' && (
        <div className="space-y-3">
          {plansLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando planos...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500 max-w-2xl">
                  Os preços abaixo valem para todos os clientes dentro da vigência informada
                  (valid_from / valid_until). Para dar um preço especial a um cliente específico,
                  crie um registro com o campo <strong>user_override</strong> apontando para o
                  cliente — o preço de override tem prioridade sobre o preço geral.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetupStripe}
                  disabled={setupLoading}
                  className="text-xs"
                >
                  {setupLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Sincronizar produtos na Stripe
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 border-b border-slate-200">
                      <TableHead className="font-semibold text-slate-700">Plano</TableHead>
                      <TableHead className="font-semibold text-slate-700">Preço (R$)</TableHead>
                      <TableHead className="font-semibold text-slate-700">Vigência de</TableHead>
                      <TableHead className="font-semibold text-slate-700">Vigência até</TableHead>
                      <TableHead className="font-semibold text-slate-700">Ativo</TableHead>
                      <TableHead className="font-semibold text-slate-700">
                        Override (cliente)
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">
                        Stripe Price ID
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-sm text-slate-500">
                          Nenhum plano cadastrado. Use "Sincronizar produtos na Stripe" para criar
                          os planos a partir da sua conta Stripe.
                        </TableCell>
                      </TableRow>
                    ) : (
                      plans.map((p) => {
                        const draft = planDrafts[p.id] || p
                        const isOverride = Boolean(p.user_override)
                        return (
                          <TableRow key={p.id} className="border-b border-slate-100">
                            <TableCell>
                              <div className="text-xs font-semibold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {p.plan_type === 'anual' ? 'Cobrança anual' : 'Cobrança mensal'}
                                {isOverride && ' • preço especial por cliente'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={draft.price_cents > 0 ? draft.price_cents / 100 : ''}
                                onChange={(e) =>
                                  setPlanDrafts((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      ...draft,
                                      price_cents: Math.round(Number(e.target.value) * 100),
                                    },
                                  }))
                                }
                                className="w-24 h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={
                                  draft.valid_from ? String(draft.valid_from).slice(0, 10) : ''
                                }
                                onChange={(e) =>
                                  setPlanDrafts((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, valid_from: e.target.value },
                                  }))
                                }
                                className="w-36 h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={
                                  draft.valid_until ? String(draft.valid_until).slice(0, 10) : ''
                                }
                                onChange={(e) =>
                                  setPlanDrafts((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, valid_until: e.target.value },
                                  }))
                                }
                                className="w-36 h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={Boolean(draft.active)}
                                onCheckedChange={(checked) =>
                                  setPlanDrafts((prev) => ({
                                    ...prev,
                                    [p.id]: { ...draft, active: checked },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-500 max-w-40">
                              {p.user_override_info
                                ? `${p.user_override_info.name} (${p.user_override_info.email})`
                                : isOverride
                                  ? 'Cliente vinculado'
                                  : 'Preço geral (todos)'}
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-400 font-mono">
                              {p.stripe_price_id || '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleSavePlan(draft)}
                                disabled={savingPlanId === p.id}
                                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {savingPlanId === p.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <Save className="w-3.5 h-3.5 mr-1" />
                                )}
                                Salvar
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ ABA: DADOS LEGAIS ============ */}
      {adminTab === 'legal' && (
        <div className="space-y-3">
          {legalLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando dados legais...
            </div>
          ) : (
            <>
              {legalError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {legalError}
                </div>
              )}
              <p className="text-xs text-slate-500 max-w-2xl">
                Dados exibidos no rodapé legal do app e na tela de planos, conforme o Decreto
                Federal nº 7.962/2013 (Comércio Eletrônico) e o CDC.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Razão Social</Label>
                  <Input
                    value={legal?.company_name || ''}
                    onChange={(e) =>
                      setLegal((prev) => (prev ? { ...prev, company_name: e.target.value } : prev))
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">
                    Marca / Nome Fantasia
                  </Label>
                  <Input
                    value={legal?.trade_name || ''}
                    onChange={(e) =>
                      setLegal((prev) => (prev ? { ...prev, trade_name: e.target.value } : prev))
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">CNPJ</Label>
                  <Input
                    value={legal?.cnpj || ''}
                    onChange={(e) =>
                      setLegal((prev) => (prev ? { ...prev, cnpj: e.target.value } : prev))
                    }
                    className="text-sm bg-slate-50 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">
                    Email de Contato/Suporte
                  </Label>
                  <Input
                    type="email"
                    value={legal?.email_contact || ''}
                    onChange={(e) =>
                      setLegal((prev) => (prev ? { ...prev, email_contact: e.target.value } : prev))
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium text-slate-700">Endereço Completo</Label>
                  <Input
                    value={legal?.address_full || ''}
                    onChange={(e) =>
                      setLegal((prev) => (prev ? { ...prev, address_full: e.target.value } : prev))
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">
                    WhatsApp/Canal de Suporte
                  </Label>
                  <Input
                    value={legal?.support_phone_or_bot || ''}
                    onChange={(e) =>
                      setLegal((prev) =>
                        prev ? { ...prev, support_phone_or_bot: e.target.value } : prev,
                      )
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">
                    Dias de Trial (padrão)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={legal?.trial_days_default ?? ''}
                    onChange={(e) =>
                      setLegal((prev) =>
                        prev ? { ...prev, trial_days_default: Number(e.target.value) } : prev,
                      )
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">
                    Dias de Carência (padrão)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={legal?.carencia_days_default ?? ''}
                    onChange={(e) =>
                      setLegal((prev) =>
                        prev ? { ...prev, carencia_days_default: Number(e.target.value) } : prev,
                      )
                    }
                    className="text-sm bg-slate-50"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveLegal}
                  disabled={savingLegal}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm"
                >
                  {savingLegal ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  Salvar Dados Legais
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default BillingAdminSection
