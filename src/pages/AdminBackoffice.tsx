import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  adminService,
  AdminMetrics,
  AdminClientSummary,
  AdminClientDetail,
  AdminCostsResponse,
} from '@/services/finance'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { renderCaixinhaIcon } from '@/lib/caixinhaIcons'
import {
  Users,
  Activity,
  CreditCard,
  MessageSquare,
  Search,
  RefreshCw,
  Phone,
  PhoneOff,
  Trash2,
  ExternalLink,
  ShieldAlert,
  BookOpen,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  UserCheck,
  DollarSign,
  Mic,
  Bot,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react'

export const AdminBackoffice: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [clients, setClients] = useState<AdminClientSummary[]>([])
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<
    'name' | 'created' | 'transactions_count' | 'caixinhas_count'
  >('created')
  const [sortAsc, setSortAsc] = useState(false)

  // Seção de Custos por Cliente
  const [costsLoading, setCostsLoading] = useState(false)
  const [costsData, setCostsData] = useState<AdminCostsResponse | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [costSortField, setCostSortField] = useState<
    'estimated_cost_brl' | 'tx_total_count' | 'tx_audio_count' | 'ai_messages_count' | 'client_name'
  >('estimated_cost_brl')
  const [costSortAsc, setCostSortAsc] = useState(false)

  // Modal de Detalhe do Cliente
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [clientDetail, setClientDetail] = useState<AdminClientDetail | null>(null)
  const [detailMonth, setDetailMonth] = useState<string>(new Date().toISOString().slice(0, 7))

  // Ações de suporte
  const [actionLoading, setActionLoading] = useState(false)
  const [customPhoneInput, setCustomPhoneInput] = useState('')

  const isAdmin = user?.role === 'admin' || user?.email === 'barbara.ferreira.leal@gmail.com'

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await adminService.getOverview()
      setMetrics(res.metrics)
      setClients(res.clients)
      await loadCosts(selectedMonth)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar backoffice',
        description: err.message || 'Acesso negado ou erro no servidor',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCosts = async (month: string) => {
    try {
      setCostsLoading(true)
      const res = await adminService.getCosts(month)
      setCostsData(res)
    } catch (err: any) {
      console.log('Erro ao carregar custos:', err)
    } finally {
      setCostsLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth)
    loadCosts(newMonth)
  }

  const openClientDetail = async (clientId: string, monthToLoad?: string) => {
    try {
      setSelectedClientId(clientId)
      const m = monthToLoad || selectedMonth || new Date().toISOString().slice(0, 7)
      setDetailMonth(m)
      setDetailLoading(true)
      const data = await adminService.getClientDetail(clientId, m)
      setClientDetail(data)
      setCustomPhoneInput(data.client.phone || '')
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir detalhe',
        description: err.message || 'Falha ao buscar dados do cliente',
        variant: 'destructive',
      })
      setSelectedClientId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleResetThread = async () => {
    if (!selectedClientId) return
    if (
      !confirm(
        'Deseja realmente zerar o fio de conversa (thread) do agente para este cliente? O contexto será limpo e ele poderá recomeçar normalmente.',
      )
    ) {
      return
    }
    try {
      setActionLoading(true)
      const res = await adminService.resetClientThread(selectedClientId)
      toast({
        title: 'Fio de conversa resetado',
        description: res.message || 'Contexto da conversa zerado com sucesso.',
      })
      // Recarrega detalhe
      const updated = await adminService.getClientDetail(selectedClientId)
      setClientDetail(updated)
    } catch (err: any) {
      toast({
        title: 'Erro ao resetar thread',
        description: err.message || 'Falha na operação',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleWhatsapp = async (action: 'link' | 'unlink' | 'toggle') => {
    if (!selectedClientId) return
    try {
      setActionLoading(true)
      const res = await adminService.toggleClientWhatsapp(
        selectedClientId,
        action,
        customPhoneInput,
      )
      toast({
        title: 'Vínculo WhatsApp atualizado',
        description: res.message,
      })
      // Recarrega detalhe e lista geral
      const updated = await adminService.getClientDetail(selectedClientId)
      setClientDetail(updated)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar vínculo WhatsApp',
        description: err.message || 'Falha na operação',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients
      .filter((c) => {
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        let valA: any = a[sortField]
        let valB: any = b[sortField]
        if (typeof valA === 'string') {
          valA = valA.toLowerCase()
          valB = (valB || '').toLowerCase()
        }
        if (valA < valB) return sortAsc ? -1 : 1
        if (valA > valB) return sortAsc ? 1 : -1
        return 0
      })
  }, [clients, search, sortField, sortAsc])

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Acesso Restrito</h1>
        <p className="text-slate-600 max-w-md mt-2">
          Esta área é restrita a administradores do Consciente. Se você acredita que deveria ter
          acesso, entre em contato com o suporte.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-slate-900">Backoffice Administrativo</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Admin
            </Badge>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Gestão operacional de clientes, métricas do produto e suporte de conversas WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="flex items-center gap-2 bg-white text-indigo-700 hover:text-indigo-800 border-indigo-200"
          >
            <a href="/admin/docs">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Documentação do Sistema
            </a>
          </Button>

          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Cartões de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total de Clientes</CardTitle>
            <Users className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? metrics.total_clients : '-'}
            </div>
            <p className="text-xs text-slate-500 mt-1">Contas cadastradas no Consciente</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Clientes Ativos (7d / 30d)
            </CardTitle>
            <Activity className="w-4 h-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? `${metrics.active_clients_7d} / ${metrics.active_clients_30d}` : '-'}
            </div>
            <p className="text-xs text-slate-500 mt-1">Interagiram ou lançaram gastos</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total de Transações
            </CardTitle>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? metrics.total_transactions : '-'}
            </div>
            <p className="text-xs text-slate-500 mt-1">Gastos e receitas registrados</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Conversas WhatsApp</CardTitle>
            <MessageSquare className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? metrics.active_whatsapp_conversations : '-'}
            </div>
            <p className="text-xs text-slate-500 mt-1">Contatos com histórico no bot</p>
          </CardContent>
        </Card>
      </div>

      {/* Card Principal: Custo Operacional Mensal Acumulado por Cliente (Item 9) */}
      <Card className="border-indigo-100 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/30">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </span>
                <CardTitle className="text-xl font-bold tracking-tight text-white">
                  Custo Mensal Acumulado por Cliente
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 font-medium">
                  Operacional
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm text-slate-300 mt-1">
                Estimativa baseada no consumo real: Áudio R$ 0,001 (Groq Whisper) • IA R$ 0,02 •
                Utility R$ 0,04 • Leitura/Typing R$ 0.
              </CardDescription>
            </div>

            {/* Seletor Histórico de Mês */}
            <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
              <Calendar className="w-4 h-4 text-emerald-400 ml-1.5" />
              <label htmlFor="admin-month-select" className="text-xs text-slate-300 font-medium">
                Mês:
              </label>
              <select
                id="admin-month-select"
                aria-label="Selecionar mês de referência"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                disabled={costsLoading}
                className="bg-slate-900 text-white text-xs rounded border border-slate-700 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
              >
                {costsData?.available_months.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === new Date().toISOString().slice(0, 7) ? '(Mês Corrente)' : ''}
                  </option>
                ))}
                {!costsData?.available_months.includes(selectedMonth) && (
                  <option value={selectedMonth}>{selectedMonth}</option>
                )}
              </select>
            </div>
          </div>
        </CardHeader>

        {/* Resumo de Custos do Mês */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Custo Total Estimado</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5 text-emerald-600">
                R${' '}
                {costsData
                  ? costsData.totals.total_estimated_cost_brl.toFixed(4).replace('.', ',')
                  : '0,0000'}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Mês {costsData?.month || selectedMonth}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
                Respostas de IA (R$ 0,02)
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {costsData ? costsData.totals.total_ai_messages : 0}
              </div>
              <span className="text-[11px] text-indigo-600 font-medium block mt-0.5">
                R${' '}
                {costsData ? costsData.totals.cost_ai_brl.toFixed(4).replace('.', ',') : '0,0000'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium flex items-center gap-1">
                <Mic className="w-3.5 h-3.5 text-purple-500" />
                Áudios Transcritos (R$ 0,001)
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {costsData ? costsData.totals.total_audio_tx : 0}
              </div>
              <span className="text-[11px] text-purple-600 font-medium block mt-0.5">
                R${' '}
                {costsData
                  ? costsData.totals.cost_audio_brl.toFixed(4).replace('.', ',')
                  : '0,0000'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Lançamentos no Mês
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {costsData ? costsData.totals.total_tx : 0}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {costsData
                  ? `${costsData.totals.total_text_tx} texto / ${costsData.totals.total_audio_tx} áudio`
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabela de Custos Ordenada por Cliente */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 border-b border-slate-200">
                  <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
                  <TableHead className="font-semibold text-slate-700">WhatsApp</TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/70"
                    onClick={() => {
                      if (costSortField === 'tx_total_count') setCostSortAsc(!costSortAsc)
                      else {
                        setCostSortField('tx_total_count')
                        setCostSortAsc(false)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Lançamentos (Texto / Áudio)
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/70"
                    onClick={() => {
                      if (costSortField === 'ai_messages_count') setCostSortAsc(!costSortAsc)
                      else {
                        setCostSortField('ai_messages_count')
                        setCostSortAsc(false)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Mensagens IA (R$ 0,02)
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/70 text-right"
                    onClick={() => {
                      if (costSortField === 'estimated_cost_brl') setCostSortAsc(!costSortAsc)
                      else {
                        setCostSortField('estimated_cost_brl')
                        setCostSortAsc(false)
                      }
                    }}
                  >
                    <div className="flex items-center justify-end gap-1 text-emerald-800">
                      Custo Estimado Mês (R$)
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {costsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                      Calculando custos operacionais do mês...
                    </TableCell>
                  </TableRow>
                ) : !costsData || costsData.clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhum cliente com consumo registrado neste mês.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...costsData.clients]
                    .sort((a, b) => {
                      let valA: any = a[costSortField]
                      let valB: any = b[costSortField]
                      if (typeof valA === 'string') {
                        valA = valA.toLowerCase()
                        valB = (valB || '').toLowerCase()
                      }
                      if (valA < valB) return costSortAsc ? -1 : 1
                      if (valA > valB) return costSortAsc ? 1 : -1
                      return 0
                    })
                    .map((c) => (
                      <TableRow key={c.client_id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="font-semibold text-slate-900">{c.client_name}</div>
                          <div className="text-xs text-slate-500">{c.client_email}</div>
                        </TableCell>
                        <TableCell>
                          {c.has_whatsapp_linked ? (
                            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {c.client_phone || 'Vinculado'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-slate-300" />
                              Não vinculado
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 text-xs">
                            <span className="font-semibold text-slate-900">{c.tx_total_count}</span>{' '}
                            <span className="text-slate-500">
                              ({c.tx_text_count} txt / {c.tx_audio_count} áudio)
                            </span>
                          </div>
                          {c.tx_audio_count > 0 && (
                            <div className="text-[11px] text-purple-600">
                              Áudio: R$ {c.cost_audio_brl.toFixed(4).replace('.', ',')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs">
                            {c.ai_messages_count}
                          </div>
                          <div className="text-[11px] text-indigo-600">
                            R$ {c.cost_ai_brl.toFixed(4).replace('.', ',')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-sm text-emerald-700">
                            R$ {c.estimated_cost_brl.toFixed(4).replace('.', ',')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {c.estimated_cost_brl === 0
                              ? 'Sem custo no mês'
                              : `${Math.round((c.estimated_cost_brl / (costsData?.totals.total_estimated_cost_brl || 1)) * 100)}% do total`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openClientDetail(c.client_id, selectedMonth)}
                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Geral de Clientes (Gestão de Contas) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Clientes do Consciente ({filteredClients.length})
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Selecione um cliente para ver suas caixinhas, transações e histórico de conversa.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 border-b border-slate-200">
                  <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
                  <TableHead className="font-semibold text-slate-700">WhatsApp</TableHead>
                  <TableHead className="font-semibold text-slate-700">Onboarding</TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/70"
                    onClick={() => {
                      if (sortField === 'caixinhas_count') setSortAsc(!sortAsc)
                      else {
                        setSortField('caixinhas_count')
                        setSortAsc(false)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Caixinhas
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/70"
                    onClick={() => {
                      if (sortField === 'transactions_count') setSortAsc(!sortAsc)
                      else {
                        setSortField('transactions_count')
                        setSortAsc(false)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Transações
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/70"
                    onClick={() => {
                      if (sortField === 'created') setSortAsc(!sortAsc)
                      else {
                        setSortField('created')
                        setSortAsc(false)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Cadastro
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Nenhum cliente encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        {c.has_whatsapp_linked ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-medium text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {c.phone || 'Vinculado'}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <XCircle className="w-3.5 h-3.5 text-slate-300" />
                            Não vinculado
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.onboarding_completed ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          >
                            Concluído
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                          >
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {c.caixinhas_count}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {c.transactions_count}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(c.created)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openClientDetail(c.id)}
                          className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhe do Cliente */}
      <Dialog
        open={!!selectedClientId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClientId(null)
            setClientDetail(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Detalhes do Cliente: {clientDetail?.client.name || 'Carregando...'}
            </DialogTitle>
            <DialogDescription>
              {clientDetail?.client.email} • ID: {clientDetail?.client.id}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !clientDetail ? (
            <div className="py-12 flex justify-center items-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
              Carregando dados do cliente...
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {/* Seção de Ações Rápidas de Suporte */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Ações de Suporte ao Cliente
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Resolva travamentos de conversa e controle de número de WhatsApp.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading}
                    onClick={handleResetThread}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1 text-amber-600" />
                    Zerar Fio da Conversa
                  </Button>

                  {clientDetail.whatsapp.is_linked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => handleToggleWhatsapp('unlink')}
                      className="border-rose-300 text-rose-800 hover:bg-rose-50"
                    >
                      <PhoneOff className="w-4 h-4 mr-1 text-rose-600" />
                      Desvincular WhatsApp
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => handleToggleWhatsapp('link')}
                      className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      <Phone className="w-4 h-4 mr-1 text-emerald-600" />
                      Vincular WhatsApp
                    </Button>
                  )}
                </div>
              </div>

              {/* Informações Básicas do WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white border border-slate-200 rounded-lg text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Status WhatsApp</span>
                  <span className="font-medium text-slate-800">
                    {clientDetail.whatsapp.is_linked ? 'Conectado / Vinculado' : 'Desconectado'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Número do Cliente</span>
                  <span className="font-medium text-slate-800">
                    {clientDetail.whatsapp.phone || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Última Interação</span>
                  <span className="font-medium text-slate-800">
                    {clientDetail.whatsapp.last_interaction
                      ? formatDate(clientDetail.whatsapp.last_interaction)
                      : 'Nenhuma'}
                  </span>
                </div>
              </div>

              {/* Card de Custo Mensal Estimado no Detalhe Individual do Cliente */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-slate-900 text-sm">
                        Custo Estimado no Mês ({clientDetail.estimated_cost?.month || detailMonth}):
                      </span>
                      <span className="text-lg font-extrabold text-emerald-700">
                        R${' '}
                        {clientDetail.estimated_cost
                          ? clientDetail.estimated_cost.total_cost_brl.toFixed(4).replace('.', ',')
                          : '0,0000'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        • Mensagens de IA: {clientDetail.estimated_cost?.ai_messages_count || 0} (R${' '}
                        {(clientDetail.estimated_cost?.cost_ai_brl || 0)
                          .toFixed(4)
                          .replace('.', ',')}
                        )
                      </span>
                      <span>
                        • Lançamentos de áudio: {clientDetail.estimated_cost?.tx_audio_count || 0}{' '}
                        (R${' '}
                        {(clientDetail.estimated_cost?.cost_audio_brl || 0)
                          .toFixed(4)
                          .replace('.', ',')}
                        )
                      </span>
                      <span>
                        • Total de lançamentos: {clientDetail.estimated_cost?.tx_total_count || 0} (
                        {clientDetail.estimated_cost?.tx_text_count || 0} texto)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="client-detail-month"
                      className="text-xs text-slate-500 font-medium"
                    >
                      Mês:
                    </label>
                    <select
                      id="client-detail-month"
                      aria-label="Selecionar mês no detalhe do cliente"
                      value={detailMonth}
                      onChange={(e) => {
                        const newM = e.target.value
                        setDetailMonth(newM)
                        if (selectedClientId) openClientDetail(selectedClientId, newM)
                      }}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-mono text-slate-800"
                    >
                      {costsData?.available_months.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Abas: Caixinhas, Transações e Histórico de Conversa */}
              <Tabs defaultValue="caixinhas" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="caixinhas">
                    Caixinhas ({clientDetail.caixinhas.length})
                  </TabsTrigger>
                  <TabsTrigger value="transactions">
                    Últimas Transações ({clientDetail.recent_transactions.length})
                  </TabsTrigger>
                  <TabsTrigger value="conversation">
                    Histórico Conversa ({clientDetail.conversation_history.length})
                  </TabsTrigger>
                </TabsList>

                {/* Aba: Caixinhas */}
                <TabsContent value="caixinhas" className="mt-4 space-y-3">
                  {clientDetail.caixinhas.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      O cliente ainda não possui caixinhas configuradas.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clientDetail.caixinhas.map((b) => {
                        const pct =
                          b.limit_cents > 0 ? Math.round((b.spent_cents / b.limit_cents) * 100) : 0
                        return (
                          <div
                            key={b.id}
                            className="p-3.5 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50/50"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: b.color || '#10b981' }}
                              >
                                {renderCaixinhaIcon(b.icon, 'w-5 h-5')}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 text-sm">
                                  {b.category_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Gasto: {formatCurrency(b.spent_cents)} / Teto:{' '}
                                  {formatCurrency(b.limit_cents)}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                pct > 100
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 text-xs'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs'
                              }
                            >
                              {pct}%
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Aba: Transações */}
                <TabsContent value="transactions" className="mt-4">
                  {clientDetail.recent_transactions.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      Nenhuma transação registrada para este cliente.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs font-semibold">Data</TableHead>
                            <TableHead className="text-xs font-semibold">Descrição</TableHead>
                            <TableHead className="text-xs font-semibold">Status</TableHead>
                            <TableHead className="text-xs font-semibold">Caixinha</TableHead>
                            <TableHead className="text-xs font-semibold text-right">
                              Valor
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientDetail.recent_transactions.map((t) => {
                            const isCancelled = t.status === 'cancelled'
                            const isDeleted = t.status === 'deleted'
                            return (
                              <TableRow
                                key={t.id}
                                className={`text-xs ${
                                  isCancelled || isDeleted ? 'opacity-60 bg-slate-50/50' : ''
                                }`}
                              >
                                <TableCell className="text-slate-500 whitespace-nowrap">
                                  <div>
                                    <span>{formatDate(t.date || t.created)}</span>
                                    {t.is_retroactive && (
                                      <span className="block text-[10px] text-amber-600 font-medium">
                                        Data original
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-slate-800">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={
                                        isCancelled || isDeleted
                                          ? 'line-through text-slate-400'
                                          : ''
                                      }
                                    >
                                      {t.description}
                                    </span>
                                    {t.is_retroactive && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 font-medium"
                                      >
                                        Retroativo
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isCancelled ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-semibold"
                                    >
                                      Cancelado
                                    </Badge>
                                  ) : isDeleted ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-semibold"
                                    >
                                      Excluído
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                                    >
                                      Ativo
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{t.category_name}</TableCell>
                                <TableCell
                                  className={`text-right font-semibold tabular-nums ${
                                    isCancelled || isDeleted
                                      ? 'line-through text-slate-400'
                                      : t.type === 'expense'
                                        ? 'text-rose-600'
                                        : 'text-emerald-600'
                                  }`}
                                >
                                  {t.type === 'expense' ? '-' : '+'}
                                  {formatCurrency(t.amount_cents)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Aba: Conversa WhatsApp */}
                <TabsContent value="conversation" className="mt-4">
                  {clientDetail.conversation_history.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      Nenhuma mensagem registrada no histórico deste contato.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      {clientDetail.conversation_history.map((m) => {
                        const isIncoming = m.direction === 'incoming'
                        return (
                          <div
                            key={m.id}
                            className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg text-xs leading-relaxed ${
                                isIncoming
                                  ? 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              <div className="font-semibold mb-1 opacity-75">
                                {isIncoming ? 'Cliente' : 'Consciente (Agente)'} •{' '}
                                {formatDate(m.created)}
                              </div>
                              <div className="whitespace-pre-wrap">{m.message_text}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedClientId(null)
                setClientDetail(null)
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminBackoffice
