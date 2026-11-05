import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  transactionsService,
  budgetsService,
  categoriesService,
  categoryCaixinhaLinksService,
  alertsService,
  type Transaction,
  type Budget,
  type Category,
  type CategoryCaixinhaLink,
  type Alert,
} from '@/services/finance'
import { useRealtime } from '@/hooks/use-realtime'
import {
  formatCurrency,
  formatDate,
  getCurrentMonthStr,
  formatMonthName,
  formatDateTime,
  getSourceLabel,
} from '@/lib/formatters'
import { renderCaixinhaIcon } from '@/lib/caixinhaIcons'
import { getBudgetSpent, getEffectiveCategory } from '@/lib/caixinhaMatcher'
import { MessageSquare, Mic, PenLine, FileSpreadsheet, Bot, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  AlertTriangle,
  Receipt,
  ArrowRight,
  Sparkles,
  PiggyBank,
} from 'lucide-react'

export const Dashboard: React.FC = () => {
  const currentMonth = getCurrentMonthStr()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [userLinks, setUserLinks] = useState<CategoryCaixinhaLink[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [txData, bData, cData, aData, linksData] = await Promise.all([
        transactionsService.getFullList(),
        budgetsService.list(currentMonth),
        categoriesService.list(),
        alertsService.list(),
        categoryCaixinhaLinksService.listByUser().catch(() => [] as CategoryCaixinhaLink[]),
      ])
      setTransactions(txData)
      setBudgets(bData)
      setCategories(cData)
      setAlerts(aData)
      setUserLinks(linksData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const handleRefresh = () => loadData()
    window.addEventListener('finance-refresh', handleRefresh)
    return () => window.removeEventListener('finance-refresh', handleRefresh)
  }, [currentMonth])

  // Realtime
  useRealtime<Transaction>('transactions', () => loadData())
  useRealtime<Budget>('budgets', () => loadData())
  useRealtime<CategoryCaixinhaLink>('category_caixinha_links', () => loadData())

  // Calculate monthly metrics (apenas transações com status 'active'; retrocompatível se status for vazio)
  const activeTransactions = useMemo(() => {
    return transactions.filter((t) => (t.status || 'active') === 'active')
  }, [transactions])

  const monthlyMetrics = useMemo(() => {
    // Current month transactions (somente ativas)
    const thisMonthTxs = activeTransactions.filter((t) => t.date.startsWith(currentMonth))

    let income = 0
    let expense = 0
    let investment = 0

    thisMonthTxs.forEach((t) => {
      if (t.type === 'receita') income += t.amount
      else if (t.type === 'despesa') expense += t.amount
      else if (t.type === 'investimento') investment += t.amount
    })

    const netBalance = income - expense - investment

    // Calculate previous month for trend comparison
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    const prevMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const prevMonthTxs = activeTransactions.filter((t) => t.date.startsWith(prevMonthStr))

    let prevIncome = 0
    let prevExpense = 0
    prevMonthTxs.forEach((t) => {
      if (t.type === 'receita') prevIncome += t.amount
      else if (t.type === 'despesa') prevExpense += t.amount
    })
    const prevBalance = prevIncome - prevExpense

    let balanceDiff = 0
    if (prevBalance !== 0) {
      balanceDiff = Math.round(((netBalance - prevBalance) / Math.abs(prevBalance)) * 100)
    }

    // Total budget defined & remaining
    const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0)
    const budgetRemaining = Math.max(0, totalBudget - expense)

    return {
      income,
      expense,
      investment,
      netBalance,
      balanceDiff,
      totalBudget,
      budgetRemaining,
      thisMonthTxs,
    }
  }, [activeTransactions, budgets, currentMonth])

  // Category distribution for current month (utiliza caixinha/categoria efetiva)
  const categoryExpenses = useMemo(() => {
    const map: Record<string, { name: string; color: string; amount: number }> = {}

    monthlyMetrics.thisMonthTxs
      .filter((t) => t.type === 'despesa')
      .forEach((t) => {
        const eff = getEffectiveCategory(t, categories, budgets, userLinks)
        const name = eff.name || 'Outros'
        const color = eff.color || '#64748b'

        if (!map[name]) {
          map[name] = { name, color, amount: 0 }
        }
        map[name].amount += t.amount
      })

    const list = Object.values(map).sort((a, b) => b.amount - a.amount)
    const total = monthlyMetrics.expense || 1

    return list.map((item) => ({
      ...item,
      percentage: Math.round((item.amount / total) * 100),
    }))
  }, [monthlyMetrics, categories, budgets, userLinks])

  // Last 6 months evolution data (somente transações ativas)
  const evolutionData = useMemo(() => {
    const months: Array<{ label: string; monthStr: string; income: number; expense: number }> = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

      let inc = 0
      let exp = 0

      activeTransactions
        .filter((t) => t.date.startsWith(monthStr))
        .forEach((t) => {
          if (t.type === 'receita') inc += t.amount
          else if (t.type === 'despesa') exp += t.amount
        })

      months.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        monthStr,
        income: inc,
        expense: exp,
      })
    }
    return months
  }, [activeTransactions])

  // Recent transactions (latest 6 ativas para o extrato rápido)
  const recentTransactions = useMemo(() => {
    return [...activeTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  }, [activeTransactions])

  const maxEvolutionValue = useMemo(() => {
    const max = Math.max(...evolutionData.map((d) => Math.max(d.income, d.expense)), 10000)
    return max
  }, [evolutionData])

  return (
    <div className="space-y-6">
      {/* Top Banner / Monthly Balance */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 sm:p-8 shadow-lg shadow-indigo-950/20">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
                Saldo do Mês • {formatMonthName(currentMonth)}
              </span>
              <Badge className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px]">
                Tempo Real
              </Badge>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight tabular-nums">
              {formatCurrency(monthlyMetrics.netBalance)}
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-indigo-200 pt-1">
              {monthlyMetrics.balanceDiff >= 0 ? (
                <span className="flex items-center text-emerald-400 font-medium">
                  <TrendingUp className="w-4 h-4 mr-1 inline" />+{monthlyMetrics.balanceDiff}% em
                  relação ao mês anterior
                </span>
              ) : (
                <span className="flex items-center text-rose-300 font-medium">
                  <TrendingDown className="w-4 h-4 mr-1 inline" />
                  {monthlyMetrics.balanceDiff}% em relação ao mês anterior
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <Button
              asChild
              variant="secondary"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm text-xs sm:text-sm font-medium"
            >
              <Link to="/assistant">
                <Sparkles className="w-4 h-4 mr-1.5 text-indigo-300" />
                Falar com Agente WhatsApp
              </Link>
            </Button>
            <Button
              asChild
              className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-md text-xs sm:text-sm font-medium"
            >
              <Link to="/transactions">
                <Receipt className="w-4 h-4 mr-1.5" />
                Ver Lançamentos
              </Link>
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas */}
        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Receitas do Mês
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(monthlyMetrics.income)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Entradas contabilizadas</p>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Despesas do Mês
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(monthlyMetrics.expense)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Gastos diários e fixos</p>
          </CardContent>
        </Card>

        {/* Investimentos */}
        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Investimentos
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(monthlyMetrics.investment)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Aportes e reservas</p>
          </CardContent>
        </Card>

        {/* Restante nas Caixinhas */}
        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Restante nas Caixinhas
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {monthlyMetrics.totalBudget > 0
                ? formatCurrency(monthlyMetrics.budgetRemaining)
                : 'Não definido'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {monthlyMetrics.totalBudget > 0
                ? `De ${formatCurrency(monthlyMetrics.totalBudget)} estipulado`
                : 'Defina caixinhas para acompanhar'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart (Last 6 months) */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Evolução Financeira (Últimos 6 Meses)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Comparativo mensal de receitas vs despesas
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-slate-600">Receitas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500" />
                <span className="text-slate-600">Despesas</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            {/* Custom SVG Area / Bar Visualization */}
            <div className="h-64 flex flex-col justify-end">
              <div className="grid grid-cols-6 gap-2 sm:gap-4 h-52 items-end border-b border-slate-100 pb-2">
                {evolutionData.map((d, idx) => {
                  const incHeight = maxEvolutionValue > 0 ? (d.income / maxEvolutionValue) * 100 : 0
                  const expHeight =
                    maxEvolutionValue > 0 ? (d.expense / maxEvolutionValue) * 100 : 0

                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                        {/* Income bar */}
                        <div
                          className="w-3 sm:w-5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500 group-hover:brightness-110 relative"
                          style={{ height: `${Math.max(incHeight, 4)}%` }}
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-20 shadow">
                            + {formatCurrency(d.income)}
                          </div>
                        </div>

                        {/* Expense bar */}
                        <div
                          className="w-3 sm:w-5 bg-gradient-to-t from-red-600 to-red-400 rounded-t-sm transition-all duration-500 group-hover:brightness-110 relative"
                          style={{ height: `${Math.max(expHeight, 4)}%` }}
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-20 shadow">
                            - {formatCurrency(d.expense)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 mt-2 truncate">
                        {d.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Distribution by Category (Donut chart & List) */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-600" />
              Despesas por Categoria
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribuição no mês atual
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {categoryExpenses.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhuma despesa registrada neste mês.
              </div>
            ) : (
              <>
                {/* Visual proportion bar */}
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
                  {categoryExpenses.map((cat, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.color,
                      }}
                      title={`${cat.name}: ${cat.percentage}%`}
                    />
                  ))}
                </div>

                {/* Categories list */}
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {categoryExpenses.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-slate-700 truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono w-8 text-right">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Transactions & Budget Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Lançamentos Recentes
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Últimas movimentações no seu controle
              </CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              <Link to="/transactions">
                Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhuma transação cadastrada ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.category)
                  const isExp = tx.type === 'despesa'
                  const isInc = tx.type === 'receita'

                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {(() => {
                          const eff = getEffectiveCategory(tx, categories, budgets, userLinks)
                          return (
                            <>
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
                                style={{
                                  backgroundColor: eff ? `${eff.color}20` : '#f1f5f9',
                                  color: eff ? eff.color : '#64748b',
                                }}
                              >
                                {eff.icon ? (
                                  renderCaixinhaIcon(eff.icon, 'w-4 h-4 text-base')
                                ) : (
                                  <Receipt className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">
                                  {tx.description}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
                                  <span className="font-medium text-slate-700">{eff.name}</span>
                                  {eff.badge && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                      {eff.badge}
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>{formatDate(tx.date)}</span>
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs sm:text-sm font-bold tabular-nums ${
                            isInc ? 'text-emerald-600' : isExp ? 'text-red-600' : 'text-indigo-600'
                          }`}
                        >
                          {isInc ? '+' : isExp ? '-' : ''} {formatCurrency(tx.amount)}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400">
                          {tx.source === 'whatsapp_audio' ? (
                            <Mic className="w-3 h-3 text-indigo-500" />
                          ) : tx.source === 'whatsapp_text' || tx.source === 'whatsapp' ? (
                            <MessageSquare className="w-3 h-3 text-emerald-500" />
                          ) : tx.source === 'import' ? (
                            <FileSpreadsheet className="w-3 h-3 text-sky-500" />
                          ) : tx.source === 'agent' ? (
                            <Bot className="w-3 h-3 text-purple-500" />
                          ) : (
                            <PenLine className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{getSourceLabel(tx.source)}</span>
                        </div>
                        {tx.message_timestamp && (
                          <div
                            className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-0.5"
                            title="Data e hora da mensagem original"
                          >
                            <Clock className="w-2.5 h-2.5 text-slate-300" />
                            <span>{formatDateTime(tx.message_timestamp)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Status das Caixinhas */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alertas das Caixinhas
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Acompanhamento de metas deste mês
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {budgets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhuma caixinha configurada.{' '}
                <Link to="/budgets" className="text-indigo-600 hover:underline">
                  Criar caixinha
                </Link>
              </div>
            ) : (
              <div className="space-y-3.5">
                {budgets.slice(0, 4).map((b) => {
                  const cat = categories.find((c) => c.id === b.category)
                  // Calculate spent in this caixinha com matching unificado e vínculos de categorias
                  const spent = getBudgetSpent(
                    b,
                    monthlyMetrics.thisMonthTxs,
                    categories,
                    budgets,
                    userLinks,
                  )

                  const pct = Math.min(Math.round((spent / (b.amount || 1)) * 100), 100)
                  const isWarning = pct >= 80 && pct < 90
                  const isExceeded = pct >= 90

                  return (
                    <div key={b.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs shrink-0"
                            style={{ backgroundColor: cat?.color || '#64748b' }}
                          >
                            {renderCaixinhaIcon(cat?.icon, 'w-3 h-3 text-xs')}
                          </span>
                          <span className="font-medium text-slate-800 truncate">
                            {cat?.name || 'Categoria'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                          {formatCurrency(spent)} / {formatCurrency(b.amount)}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={`h-2 ${
                          isExceeded
                            ? '[&>div]:bg-red-500'
                            : isWarning
                              ? '[&>div]:bg-amber-500'
                              : '[&>div]:bg-emerald-500'
                        }`}
                      />
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{pct}% utilizado</span>
                        {isExceeded && <span className="text-red-500 font-semibold">Crítico</span>}
                        {isWarning && <span className="text-amber-500 font-semibold">Atenção</span>}
                      </div>
                    </div>
                  )
                })}

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full text-xs mt-2 border-slate-200"
                >
                  <Link to="/budgets">Gerenciar todas as caixinhas</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>{' '}
      </div>
    </div>
  )
}

export default Dashboard
