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
  type StripeAdminConfig,
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
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react'

type AdminTab = 'clientes' | 'planos' | 'stripe' | 'legal'

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
      label: 'Cancelada',
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

  // Sub-seção Configuração Stripe
  const [stripeLoading, setStripeLoading] = useState(true)
  const [stripeConfig, setStripeConfig] = useState<StripeAdminConfig | null>(null)
  const [stripeSecretKeyInput, setStripeSecretKeyInput] = useState('')
  const [stripeWhsecInput, setStripeWhsecInput] = useState('')
  const [stripePriceMensalInput, setStripePriceMensalInput] = useState('')
  const [stripePriceAnualInput, setStripePriceAnualInput] = useState('')
  // v0.0.98: Price anual RECORRENTE ("Por ano", R$ 214,90) — novo campo. O antigo
  // price_id_anual era um Price recorrente MENSAL bugado e nunca é usado.
  const [stripePriceAnualRecorrenteInput, setStripePriceAnualRecorrenteInput] = useState('')
  const [savingStripe, setSavingStripe] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showWhsec, setShowWhsec] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)

  const webhookPublicUrl = `${import.meta.env.VITE_POCKETBASE_URL || ''}/backend/v1/stripe/webhook`

  const loadStripeConfig = async () => {
    try {
      setStripeLoading(true)
      const res = await billingService.adminGetStripeConfig()
      setStripeConfig(res)
      setStripePriceMensalInput(res.price_id_mensal || '')
      setStripePriceAnualInput(res.price_id_anual || '')
      setStripePriceAnualRecorrenteInput(res.price_id_anual_recorrente || '')
    } catch {
      toast({
        title: 'Aviso de configuração Stripe',
        description: 'Não foi possível carregar o status da Stripe ou ainda não configurado.',
      })
    } finally {
      setStripeLoading(false)
    }
  }

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
    loadStripeConfig()
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

  const handleSaveStripeConfig = async () => {
    try {
      setSavingStripe(true)
      const payload: {
        secret_key?: string
        webhook_signing_secret?: string
        price_id_mensal?: string
        price_id_anual?: string
        price_id_anual_recorrente?: string
      } = {
        price_id_mensal: stripePriceMensalInput.trim(),
        price_id_anual: stripePriceAnualInput.trim(),
        price_id_anual_recorrente: stripePriceAnualRecorrenteInput.trim(),
      }

      if (stripeSecretKeyInput.trim()) {
        payload.secret_key = stripeSecretKeyInput.trim()
      }
      if (stripeWhsecInput.trim()) {
        payload.webhook_signing_secret = stripeWhsecInput.trim()
      }

      const res = await billingService.adminSaveStripeConfig(payload)
      toast({
        title: 'Configuração Stripe salva',
        description: res.message || 'Credenciais e Price IDs gravados com sucesso!',
      })
      setStripeSecretKeyInput('')
      setStripeWhsecInput('')
      await loadStripeConfig()
      await loadPlans()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar configuração Stripe',
        description: err instanceof Error ? err.message : 'Não foi possível salvar os dados.',
        variant: 'destructive',
      })
    } finally {
      setSavingStripe(false)
    }
  }

  const handleCopyWebhookUrl = () => {
    try {
      navigator.clipboard.writeText(webhookPublicUrl)
      setCopiedWebhookUrl(true)
      setTimeout(() => setCopiedWebhookUrl(false), 2000)
      toast({
        title: 'URL copiada',
        description: 'Cole esta URL no painel da Stripe em Webhooks.',
      })
    } catch {
      toast({
        title: 'URL do Webhook',
        description: webhookPublicUrl,
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Mini-tabs internas do módulo de billing */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['clientes', 'Assinaturas dos Clientes', Users],
            ['planos', 'Planos e Preços', Tag],
            ['stripe', 'Configuração Stripe', KeyRound],
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
                  Canceladas: {statusMetrics?.cancelado ?? 0}
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

      {/* ============ ABA: CONFIGURAÇÃO STRIPE (DIRETA) ============ */}
      {adminTab === 'stripe' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  Integração Direta com a API da Stripe
                </h3>
                {stripeConfig?.configured ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Configurado
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Pendente de Chaves
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Conexão direta à Stripe via HTTPS sem depender de conectores externos. As
                credenciais são armazenadas de forma segura no banco e retornadas sempre mascaradas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStripeConfig}
              disabled={stripeLoading}
              className="text-xs h-8 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${stripeLoading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
          </div>

          {stripeLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando dados da Stripe...
            </div>
          ) : (
            <>
              {/* Endpoint Webhook */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                      Endpoint do Webhook Stripe
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cadastre esta URL no seu painel da Stripe (
                      <code className="text-indigo-600">Developers &gt; Webhooks</code>) escutando
                      os eventos:
                      <span className="font-mono text-[11px] text-slate-700 block mt-1">
                        checkout.session.completed, invoice.payment_succeeded,
                        invoice.payment_failed, customer.subscription.deleted
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyWebhookUrl}
                    className="h-8 text-xs shrink-0"
                  >
                    {copiedWebhookUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copiar URL
                      </>
                    )}
                  </Button>
                </div>
                <div className="font-mono text-xs text-slate-800 bg-white border border-slate-200 rounded px-2.5 py-1.5 break-all select-all">
                  {webhookPublicUrl}
                </div>
              </div>

              {/* Formulário de Credenciais e Price IDs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Secret Key */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Chave Secreta da Stripe (Secret Key)
                    </Label>
                    {stripeConfig?.masked_secret_key && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Gravada: {stripeConfig.masked_secret_key}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showSecretKey ? 'text' : 'password'}
                      placeholder={
                        stripeConfig?.has_secret_key
                          ? 'Deixe em branco para manter a chave atual ou cole uma nova sk_live_...'
                          : 'Cole aqui sua chave secreta da Stripe (sk_live_... ou sk_test_...)'
                      }
                      value={stripeSecretKeyInput}
                      onChange={(e) => setStripeSecretKeyInput(e.target.value)}
                      className="text-xs font-mono pr-10 bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    A chave nunca é exibida em texto claro após salva. Usada para criar sessões de
                    checkout seguras.
                  </p>
                </div>

                {/* Webhook Signing Secret */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Webhook Signing Secret (whsec_...)
                    </Label>
                    {stripeConfig?.masked_webhook_signing_secret && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Gravado: {stripeConfig.masked_webhook_signing_secret}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showWhsec ? 'text' : 'password'}
                      placeholder={
                        stripeConfig?.has_webhook_signing_secret
                          ? 'Deixe em branco para manter o secret atual ou cole um novo whsec_...'
                          : 'Cole aqui o segredo de assinatura do Webhook (whsec_...)'
                      }
                      value={stripeWhsecInput}
                      onChange={(e) => setStripeWhsecInput(e.target.value)}
                      className="text-xs font-mono pr-10 bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWhsec(!showWhsec)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showWhsec ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Utilizado para validar criptograficamente a assinatura HMAC-SHA256
                    (Stripe-Signature) das notificações.
                  </p>
                </div>

                {/* Price ID Mensal */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Price ID Mensal (R$ 19,90)
                  </Label>
                  <Input
                    placeholder="price_1Q..."
                    value={stripePriceMensalInput}
                    onChange={(e) => setStripePriceMensalInput(e.target.value)}
                    className="text-xs font-mono bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-500">
                    ID do preço recorrente mensal criado no painel da Stripe.
                  </p>
                </div>

                {/* Price ID Anual (legado, não usado) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Price ID Anual (legado — não usado)
                  </Label>
                  <Input
                    placeholder="price_1Q..."
                    value={stripePriceAnualInput}
                    onChange={(e) => setStripePriceAnualInput(e.target.value)}
                    className="text-xs font-mono bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-500">
                    Era um Price recorrente MENSAL bugado (v0.0.95). Mantido apenas para histórico —
                    nunca é usado nos checkouts.
                  </p>
                </div>

                {/* Price ID Anual Recorrente (v0.0.98) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Price ID Anual Recorrente (R$ 214,90 /ano)
                  </Label>
                  <Input
                    placeholder="price_1Q..."
                    value={stripePriceAnualRecorrenteInput}
                    onChange={(e) => setStripePriceAnualRecorrenteInput(e.target.value)}
                    className="text-xs font-mono bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-500">
                    Price com recorrência &quot;Por ano&quot; (faturamento a cada 12 meses), usado
                    no botão &quot;Assinar Anual (recorrente)&quot; da Minha Conta.
                  </p>
                </div>
              </div>

              {/* Rodapé de Ação */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  {stripeConfig?.updated && (
                    <span>
                      Última atualização: {new Date(stripeConfig.updated).toLocaleString('pt-BR')}
                      {stripeConfig.updated_by && ` por ${stripeConfig.updated_by}`}
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleSaveStripeConfig}
                  disabled={savingStripe}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm w-full sm:w-auto"
                >
                  {savingStripe ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  Salvar Configuração Stripe
                </Button>
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
