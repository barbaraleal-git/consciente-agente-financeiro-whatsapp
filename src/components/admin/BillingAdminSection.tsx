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
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import { getBackendErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  billingService,
  adminService,
  getStripeStatusText,
  type AdminSubscriptionsResponse,
  type SubscriptionPlanItem,
  type CompanyLegalInfo,
  type StripeAdminConfig,
} from '@/services/finance'
import { ClientSubscriptionDetailsDialog } from './ClientSubscriptionDetailsDialog'
import {
  Loader2,
  RefreshCw,
  Save,
  Users,
  Tag,
  ShieldCheck,
  CreditCard,
  Download,
  Sparkles,
  Clock,
  Ban,
  XCircle,
  CheckCircle2,
  KeyRound,
  Receipt,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  History,
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

  // v0.0.119: visão completa de um cliente — diálogo "Detalhes" com extrato
  // cronológico de todas as cobranças desde a assinatura (rota 12b do backend).
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null)

  const [plansLoading, setPlansLoading] = useState(true)
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([])
  const [planDrafts, setPlanDrafts] = useState<Record<string, SubscriptionPlanItem>>({})
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)

  // v0.0.117 (pedido da dona — autonomia para ajustes emergenciais): o banner
  // vermelho PERSISTENTE dentro do frame de Planos e Preços consulta o
  // diagnóstico existente GET /backend/v1/admin/billing/plans/coverage
  // (v0.0.114, reutilizado) e fica visível enquanto QUALQUER trilha (mensal ou
  // anual) estiver com intervalo futuro sem cobertura — recarregar a tela não
  // faz o aviso sumir enquanto o buraco existir; com a cobertura completa o
  // banner NÃO aparece.
  type CoverageTrilha = { plan_type: string; ok: boolean; error: string }
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageTrilhas, setCoverageTrilhas] = useState<CoverageTrilha[]>([])
  const coverageGaps = coverageTrilhas.filter((t) => !t.ok && t.error)

  const loadPlansCoverage = async () => {
    try {
      setCoverageLoading(true)
      const res = await billingService.adminGetPlansCoverage()
      setCoverageTrilhas(res.trilhas || [])
    } catch {
      // Diagnóstico indisponível não pode quebrar a tela — banner fica oculto.
      setCoverageTrilhas([])
    } finally {
      setCoverageLoading(false)
    }
  }

  // v0.0.111: estado "dirty" por linha — compara o rascunho com os valores
  // carregados do plano; o botão Salvar só habilita com mudança real.
  const isPlanDirty = (plan: SubscriptionPlanItem, draft: SubscriptionPlanItem) =>
    Math.round(plan.price_cents) !== Math.round(draft.price_cents) ||
    (plan.valid_from || '').slice(0, 10) !== (draft.valid_from || '').slice(0, 10) ||
    (plan.valid_until || '').slice(0, 10) !== (draft.valid_until || '').slice(0, 10) ||
    Boolean(plan.active) !== Boolean(draft.active)

  // v0.0.111: auditoria por plano — diálogo "Histórico" lê a coleção
  // subscription_plans_audit (trilha gravada pelas rotas admin do backend).
  type AuditChange = { campo: string; label: string; antes: string; depois: string }
  type AuditRow = {
    id: string
    action: string
    plan_name: string
    actor_email: string
    created: string
    changes: AuditChange[]
  }
  const [historyPlan, setHistoryPlan] = useState<SubscriptionPlanItem | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRows, setHistoryRows] = useState<AuditRow[]>([])

  const AUDIT_ACTION_LABEL: Record<string, string> = {
    criar: 'Plano criado',
    editar: 'Plano editado',
    definir_vigencia: 'Vigência definida',
    importar: 'Importado da Stripe (rascunho)',
  }

  const formatAuditValue = (campo: string, valor: string) => {
    if (campo === 'price_cents') return valor === '' ? '—' : formatCurrency(Number(valor) || 0)
    if (campo === 'active') return valor === 'true' ? 'Ativo' : 'Inativo'
    return valor === '' ? '—' : valor
  }

  const openPlanHistory = async (plan: SubscriptionPlanItem) => {
    setHistoryPlan(plan)
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryRows([])
    try {
      // v0.0.111: lê a trilha pela rota admin (mesma checagem de admin das
      // outras rotas de billing — não depende da regra de coleção).
      const token = pb.authStore.token
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL || ''}/backend/v1/admin/billing/plans/history?plan_id=${encodeURIComponent(plan.id)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || 'Falha ao carregar histórico.')
      }
      const items = (data && Array.isArray(data.history) ? data.history : []) as Array<{
        id: string
        action: string
        plan_name: string
        actor_email: string
        created: string
        changes: unknown
      }>
      const rows: AuditRow[] = items.map((item) => {
        let changes: AuditChange[] = []
        try {
          const raw = item.changes
          if (typeof raw === 'string') {
            changes = JSON.parse(raw) as AuditChange[]
          } else if (Array.isArray(raw)) {
            changes = raw as AuditChange[]
          }
        } catch {
          changes = []
        }
        return {
          id: String(item.id || ''),
          action: String(item.action || ''),
          plan_name: String(item.plan_name || ''),
          actor_email: String(item.actor_email || ''),
          created: String(item.created || ''),
          changes,
        }
      })
      setHistoryRows(rows)
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível carregar o histórico deste plano.'
      toast({ title: 'Erro no histórico', description: msg, variant: 'destructive' })
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

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
    loadPlansCoverage()
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
        // v0.0.117: buraco de cobertura NÃO bloqueia mais — o backend responde
        // 200 com "warning" em PT descrevendo o intervalo descoberto. Toast de
        // ALERTA (destructive/âmbar) mantendo o plano salvo; o banner vermelho
        // persistente aparece via loadPlansCoverage (abaixo).
        if (res.warning) {
          toast({
            title: 'Plano salvo com AVISO',
            description: res.warning,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Plano salvo!',
            description: res.message || 'Preço atualizado com sucesso.',
          })
        }
        // v0.0.111: Salvar volta ao estado desabilitado imediatamente — o
        // rascunho passa a valer como os valores recém-salvos até o reload.
        setPlanDrafts((prev) => ({ ...prev, [plan.id]: { ...plan } }))
        await loadPlans()
        await loadPlansCoverage()
      } else {
        toast({
          title: 'Erro ao salvar plano',
          description: res.message || 'Tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      // v0.0.104: extrai a mensagem amigável do corpo da resposta (ex.: erro do
      // hook de vigência: "Já existe um plano mensal válido no período ...") —
      // nunca mostra "Something went wrong" quando a resposta traz mensagem própria.
      const msg = getBackendErrorMessage(err, 'Falha ao salvar plano. Tente novamente.')
      toast({ title: 'Erro ao salvar plano', description: msg, variant: 'destructive' })
    } finally {
      setSavingPlanId(null)
    }
  }

  // v0.0.110 (item 31): importa os Prices da Stripe como rascunhos pendentes
  // de vigência; resumo "X importados, Y já existentes" no toast e tabela recarregada.
  const handleImportPrices = async () => {
    try {
      setImportLoading(true)
      const res = await billingService.adminImportStripePrices()
      const imported = res.imported || 0
      const already = res.already_existing || 0
      toast({
        title: 'Importação concluída',
        description:
          res.message ||
          `${imported} preço(s) importado(s) como rascunho, ${already} já existente(s).`,
      })
      await loadPlans()
    } catch (err: unknown) {
      const msg = getBackendErrorMessage(
        err,
        'Falha ao importar preços da Stripe. Tente novamente.',
      )
      toast({ title: 'Erro na importação', description: msg, variant: 'destructive' })
    } finally {
      setImportLoading(false)
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
      const msg = getBackendErrorMessage(err, 'Falha ao configurar produtos na Stripe.')
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
      const msg = getBackendErrorMessage(err, 'Falha ao salvar dados legais.')
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
        description: getBackendErrorMessage(err, 'Não foi possível salvar os dados.'),
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
              {/* v0.0.119: KPIs financeiros do topo da aba */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium text-slate-500">Clientes</p>
                    <p className="text-lg font-bold text-slate-900">{subsData.clients.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium text-slate-500">Pagantes ativos</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {statusMetrics?.paying_active ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {statusMetrics?.one_time_count ?? 0} pagamento(s) único(s)
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium text-slate-500">MRR aproximado</p>
                    <p className="text-lg font-bold text-indigo-700">
                      {formatCurrency(statusMetrics?.mrr_cents ?? 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium text-slate-500">Receita acumulada</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(statusMetrics?.total_revenue_cents ?? 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

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
                      <TableHead className="font-semibold text-slate-700 text-right">
                        Detalhes
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subsData.clients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">
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
                              {getStripeStatusText(c)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setDetailsClientId(c.id)}
                              >
                                <Receipt className="w-3.5 h-3.5 mr-1" /> Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <ClientSubscriptionDetailsDialog
                userId={detailsClientId}
                open={detailsClientId !== null}
                onOpenChange={(open) => {
                  if (!open) setDetailsClientId(null)
                }}
              />
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
                <div className="flex flex-wrap items-center gap-2">
                  {/* v0.0.111: tooltips explicando a direção de cada operação */}
                  <TooltipProvider delayDuration={200}>
                    {/* v0.0.110 (item 31): importar Prices da Stripe como rascunhos */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleImportPrices}
                          disabled={importLoading}
                          className="text-xs"
                        >
                          {importLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Importar preços da Stripe
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Traz Prices existentes na sua conta Stripe como rascunhos pendentes de
                        vigência (Stripe → App).
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
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
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Cria o produto Consciente e os preços na sua conta Stripe a partir dos
                        planos do app (App → Stripe).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* v0.0.117 (pedido da dona): AVISO CONSTANTE EM VERMELHO dentro do
                  frame de Planos e Preços enquanto qualquer trilha (mensal/anual)
                  estiver com intervalo futuro sem cobertura — consulta o
                  diagnóstico GET /plans/coverage (v0.0.114) e permanece após
                  recarregar a tela enquanto o buraco existir. Cobertura
                  completa = banner não aparece. */}
              {coverageGaps.length > 0 && (
                <div
                  role="alert"
                  data-testid="coverage-gap-banner"
                  className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="space-y-1">
                      <p className="font-bold text-red-900">
                        Há um intervalo de datas sem plano definido — ajuste o mais rápido possível
                      </p>
                      {coverageGaps.map((t) => (
                        <p key={t.plan_type} className="text-red-800">
                          <span className="font-semibold">
                            Trilha {t.plan_type === 'anual' ? 'anual' : 'mensal'}:
                          </span>{' '}
                          {t.error}
                        </p>
                      ))}
                      <p className="text-[11px] text-red-700">
                        Um cliente que chegar num dia sem plano não conseguirá assinar. O salvamento
                        foi permitido, mas esta faixa permanece até a cobertura voltar a ser
                        contínua.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                        // v0.0.110 (item 31): rascunho = inativo sem vigência
                        // (ex.: linha importada da Stripe à espera de vigência)
                        const isRascunho = !p.active && !p.valid_from && !p.valid_until
                        return (
                          <TableRow
                            key={p.id}
                            className={
                              isRascunho
                                ? 'border-b border-amber-100 bg-amber-50/40'
                                : 'border-b border-slate-100'
                            }
                          >
                            <TableCell>
                              <div className="text-xs font-semibold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {p.plan_type === 'anual' ? 'Cobrança anual' : 'Cobrança mensal'}
                                {isOverride && ' • preço especial por cliente'}
                              </div>
                              {isRascunho && (
                                <Badge className="mt-1 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-medium">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Rascunho — defina a vigência
                                </Badge>
                              )}
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
                              <div className="flex items-center justify-end gap-1.5">
                                {/* v0.0.111: histórico de alterações do Price/plano */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPlanHistory(p)}
                                  title="Ver histórico de alterações deste plano"
                                  className="h-8 text-xs"
                                >
                                  <History className="w-3.5 h-3.5 mr-1" />
                                  Histórico
                                </Button>
                                {/* v0.0.111: Salvar só habilita com mudança real na linha */}
                                <Button
                                  size="sm"
                                  onClick={() => handleSavePlan(draft)}
                                  disabled={savingPlanId === p.id || !isPlanDirty(p, draft)}
                                  title={
                                    !isPlanDirty(p, draft)
                                      ? 'Faça uma alteração nesta linha para habilitar o Salvar'
                                      : isRascunho
                                        ? 'Defina a vigência e ative para publicar aos clientes'
                                        : undefined
                                  }
                                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                  {savingPlanId === p.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  Salvar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* v0.0.111: diálogo de histórico de alterações do plano */}
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base">
                      Histórico de alterações — {historyPlan?.name || 'Plano'}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Trilha de auditoria deste Price/plano (mais recente primeiro): o que mudou,
                      quem mudou e quando.
                    </DialogDescription>
                  </DialogHeader>
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-sm text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      Carregando histórico...
                    </div>
                  ) : historyRows.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Nenhuma alteração registrada ainda para este plano.
                    </div>
                  ) : (
                    <ol className="space-y-3">
                      {historyRows.map((row) => (
                        <li
                          key={row.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {AUDIT_ACTION_LABEL[row.action] || row.action}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatDateTime(row.created)}
                            </span>
                          </div>
                          {row.actor_email && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              por {row.actor_email}
                            </div>
                          )}
                          {row.changes.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {row.changes.map((ch, ci) => (
                                <li key={ci} className="text-[11px] text-slate-700">
                                  <span className="font-medium">{ch.label}</span>:{' '}
                                  <span className="text-slate-500 line-through">
                                    {formatAuditValue(ch.campo, String(ch.antes))}
                                  </span>{' '}
                                  → {formatAuditValue(ch.campo, String(ch.depois))}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </DialogContent>
              </Dialog>
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
                    {/* v0.0.111: campo de referência — o checkout usa a tabela de
                    planos (Planos e Preços), não este campo. */}
                    Somente referência: o checkout usa os IDs da tabela &quot;Planos e Preços&quot;,
                    não este campo.
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
                    {/* v0.0.111: validado em código — NENHUMA rota lê este campo. */}
                    Legado (v0.0.98): nenhuma rota do backend lê este campo. A fonte única dos Price
                    IDs é a tabela &quot;Planos e Preços&quot;.
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
