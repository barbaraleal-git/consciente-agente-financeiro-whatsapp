import React, { useEffect, useState, useMemo } from 'react'
import {
  transactionsService,
  categoriesService,
  type Transaction,
  type Category,
} from '@/services/finance'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Download,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
} from 'lucide-react'

export const Reports: React.FC = () => {
  const [period, setPeriod] = useState<'7days' | '30days' | 'thisMonth' | 'semester' | 'year'>(
    'thisMonth',
  )
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [txs, cats] = await Promise.all([
        transactionsService.getFullList(),
        categoriesService.list(),
      ])
      setTransactions(txs)
      setCategories(cats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter transactions according to selected period (somente transações ativas nos totais/relatórios)
  const filteredTxs = useMemo(() => {
    const now = new Date()

    return transactions.filter((t) => {
      if ((t.status || 'active') !== 'active') return false

      const txDate = new Date(t.date)
      const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24)

      if (period === '7days') return diffDays <= 7 && diffDays >= -1
      if (period === '30days') return diffDays <= 30 && diffDays >= -1
      if (period === 'thisMonth') {
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        return t.date.startsWith(ym)
      }
      if (period === 'semester') return diffDays <= 180 && diffDays >= -1
      if (period === 'year') return diffDays <= 365 && diffDays >= -1
      return true
    })
  }, [transactions, period])

  // Executive summary
  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    let investment = 0

    filteredTxs.forEach((t) => {
      if (t.type === 'receita') income += t.amount
      else if (t.type === 'despesa') expense += t.amount
      else if (t.type === 'investimento') investment += t.amount
    })

    const net = income - expense - investment
    return { income, expense, investment, net }
  }, [filteredTxs])

  // Ranking of categories (largest to smallest expense)
  const categoryRanking = useMemo(() => {
    const map: Record<
      string,
      { id: string; name: string; color: string; amount: number; count: number }
    > = {}

    filteredTxs
      .filter((t) => t.type === 'despesa')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category)
        const name = cat ? cat.name : 'Outros'
        const color = cat ? cat.color : '#64748b'
        const id = cat ? cat.id : 'unknown'

        if (!map[name]) {
          map[name] = { id, name, color, amount: 0, count: 0 }
        }
        map[name].amount += t.amount
        map[name].count += 1
      })

    const list = Object.values(map).sort((a, b) => b.amount - a.amount)
    const maxAmount = list[0]?.amount || 1
    const totalExpense = totals.expense || 1

    return list.map((item) => ({
      ...item,
      percentage: Math.round((item.amount / totalExpense) * 100),
      relativeBar: Math.round((item.amount / maxAmount) * 100),
    }))
  }, [filteredTxs, categories, totals.expense])

  // Export CSV with UTF-8 BOM for Brazilian Excel
  const handleExportCSV = () => {
    const headers = ['Descrição', 'Categoria', 'Data', 'Tipo', 'Origem', 'Valor (R$)', 'Observação']
    const rows = filteredTxs.map((t) => {
      const cat = categories.find((c) => c.id === t.category)
      const valNumber = (t.amount / 100).toFixed(2).replace('.', ',')
      return [
        `"${t.description.replace(/"/g, '""')}"`,
        `"${(cat?.name || 'Geral').replace(/"/g, '""')}"`,
        formatDate(t.date),
        t.type,
        t.source,
        `"${valNumber}"`,
        `"${(t.note || '').replace(/"/g, '""')}"`,
      ]
    })

    // Prepend UTF-8 BOM (\uFEFF)
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `relatorio_financeiro_${period}_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Relatórios Financeiros
          </h1>
          <p className="text-sm text-slate-500">
            Análise aprofundada de receitas, despesas e distribuição de custos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={period}
            onValueChange={(val: '7days' | '30days' | 'thisMonth' | 'semester' | 'year') =>
              setPeriod(val)
            }
          >
            <SelectTrigger className="w-44 bg-white border-slate-200">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">Mês corrente</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="semester">Último semestre</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Receitas
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(totals.income)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Entradas no período</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Despesas
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(totals.expense)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Custos no período</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Investido
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(totals.investment)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Patrimônio acumulado</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saldo Líquido
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${
                totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(totals.net)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Receitas - Despesas - Investimentos</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Ranking & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Ranking de Gastos por Categoria
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Categorias ordenadas pelo maior volume financeiro
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {categoryRanking.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Sem despesas no período selecionado.
              </div>
            ) : (
              <div className="space-y-3">
                {categoryRanking.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 w-4">{idx + 1}.</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="text-[11px] text-slate-400">({item.count} un)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono w-10 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Relative horizontal bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.relativeBar}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Transactions List for the Period */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Lançamentos do Período
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {filteredTxs.length} transações registradas
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Total: {formatCurrency(filteredTxs.reduce((s, t) => s + t.amount, 0))}
            </Badge>
          </CardHeader>

          <CardContent>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 pr-1">
              {filteredTxs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Nenhuma movimentação neste período.
                </div>
              ) : (
                filteredTxs.map((t) => {
                  const cat = categories.find((c) => c.id === t.category)
                  const isInc = t.type === 'receita'
                  const isExp = t.type === 'despesa'

                  return (
                    <div
                      key={t.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{t.description}</p>
                        <p className="text-[11px] text-slate-400">
                          {cat?.name || 'Geral'} • {formatDate(t.date)}
                        </p>
                      </div>
                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          isInc ? 'text-emerald-600' : isExp ? 'text-red-600' : 'text-indigo-600'
                        }`}
                      >
                        {isInc ? '+' : isExp ? '-' : ''} {formatCurrency(t.amount)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Reports
