import React, { useEffect, useState, useMemo } from 'react'
import {
  budgetsService,
  categoriesService,
  transactionsService,
  type Budget,
  type Category,
  type Transaction,
} from '@/services/finance'
import { useRealtime } from '@/hooks/use-realtime'
import {
  formatCurrency,
  getCurrentMonthStr,
  formatMonthName,
  parseCurrencyToCents,
  maskCurrencyInput,
} from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Edit2,
  Trash2,
  Target,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BarChart2,
} from 'lucide-react'

export const Budgets: React.FC = () => {
  const { toast } = useToast()
  const currentMonth = getCurrentMonthStr()

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deleteBudget, setDeleteBudget] = useState<Budget | null>(null)

  // Form Fields
  const [catId, setCatId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [monthInput, setMonthInput] = useState(currentMonth)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [bList, cList, txList] = await Promise.all([
        budgetsService.list(selectedMonth),
        categoriesService.list(),
        transactionsService.getFullList(),
      ])
      setBudgets(bList)
      setCategories(cList)
      setTransactions(txList)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  useRealtime<Budget>('budgets', () => loadData())
  useRealtime<Transaction>('transactions', () => loadData())

  // Calculate budget statistics for the selected month
  const budgetStats = useMemo(() => {
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.category)
      const spent = transactions
        .filter(
          (t) => t.category === b.category && t.date.startsWith(b.month) && t.type === 'despesa',
        )
        .reduce((sum, t) => sum + t.amount, 0)

      const remaining = Math.max(0, b.amount - spent)
      const percentage = Math.round((spent / (b.amount || 1)) * 100)

      return {
        budget: b,
        category: cat,
        budgetAmount: b.amount,
        spentAmount: spent,
        remainingAmount: remaining,
        percentage,
      }
    })
  }, [budgets, categories, transactions])

  const totalDefined = budgetStats.reduce((sum, s) => sum + s.budgetAmount, 0)
  const totalSpent = budgetStats.reduce((sum, s) => sum + s.spentAmount, 0)
  const totalRemaining = Math.max(0, totalDefined - totalSpent)

  const handleOpenCreate = () => {
    setEditingBudget(null)
    const expenseCats = categories.filter((c) => c.type === 'despesa')
    setCatId(expenseCats[0]?.id || '')
    setAmountStr('')
    setMonthInput(selectedMonth)
    setModalOpen(true)
  }

  const handleOpenEdit = (b: Budget) => {
    setEditingBudget(b)
    setCatId(b.category)
    setAmountStr(
      (b.amount / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
    setMonthInput(b.month)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = parseCurrencyToCents(amountStr)
    if (cents <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }
    if (!catId) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      if (editingBudget) {
        await budgetsService.update(editingBudget.id, {
          category: catId,
          amount: cents,
          month: monthInput,
        })
        toast({ title: 'Orçamento atualizado', description: 'Meta atualizada com sucesso.' })
      } else {
        await budgetsService.create({
          category: catId,
          amount: cents,
          month: monthInput,
        })
        toast({
          title: 'Orçamento definido',
          description: 'Meta de controle cadastrada com sucesso.',
        })
      }
      setModalOpen(false)
      loadData()
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o orçamento.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteBudget) return
    try {
      await budgetsService.delete(deleteBudget.id)
      toast({ title: 'Orçamento excluído', description: 'Meta removida com sucesso.' })
      setDeleteBudget(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Falha ao remover o orçamento.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orçamentos & Metas</h1>
          <p className="text-sm text-slate-500">
            Acompanhe o consumo dos seus limites de despesas por categoria
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40 bg-white border-slate-200 text-xs sm:text-sm"
          />
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Orçamento Total ({formatMonthName(selectedMonth)})
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
              {formatCurrency(totalDefined)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Limite mensal estipulado</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Utilizado
            </div>
            <div className="text-2xl font-bold text-red-600 mt-2 tabular-nums">
              {formatCurrency(totalSpent)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {totalDefined > 0
                ? `${Math.round((totalSpent / totalDefined) * 100)}% consumido`
                : 'Sem teto fixado'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saldo Restante
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2 tabular-nums">
              {formatCurrency(totalRemaining)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Disponível para gastar</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Bar Chart */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            Comparativo Orçado vs. Realizado ({formatMonthName(selectedMonth)})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Comparação lado a lado do limite definido e o gasto real
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {budgetStats.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhum orçamento cadastrado para este mês.{' '}
              <button
                onClick={handleOpenCreate}
                className="text-indigo-600 hover:underline font-medium"
              >
                Clique aqui para definir um teto.
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {budgetStats.map((item) => (
                <div key={item.budget.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.category?.color || '#64748b' }}
                      />
                      <span className="font-semibold text-slate-900">
                        {item.category?.name || 'Categoria'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <span className="text-slate-500">
                        Gasto:{' '}
                        <strong className="text-slate-900 tabular-nums">
                          {formatCurrency(item.spentAmount)}
                        </strong>{' '}
                        de {formatCurrency(item.budgetAmount)}
                      </span>
                      <span
                        className={`font-bold tabular-nums text-xs px-2 py-0.5 rounded-full ${
                          item.percentage >= 90
                            ? 'bg-red-100 text-red-700'
                            : item.percentage >= 70
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar with dynamic color */}
                  <Progress
                    value={Math.min(item.percentage, 100)}
                    className={`h-2.5 ${
                      item.percentage >= 90
                        ? '[&>div]:bg-red-500'
                        : item.percentage >= 70
                          ? '[&>div]:bg-amber-500'
                          : '[&>div]:bg-emerald-500'
                    }`}
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>
                      Restam:{' '}
                      <strong className="text-slate-600">
                        {formatCurrency(item.remainingAmount)}
                      </strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(item.budget)}
                        className="text-indigo-600 hover:underline"
                      >
                        Editar
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => setDeleteBudget(item.budget)}
                        className="text-red-500 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
            <DialogDescription>
              Defina o valor mensal máximo para controlar seus custos por categoria.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="bCat" className="text-xs font-medium text-slate-700">
                Categoria de Despesa *
              </Label>
              <Select value={catId} onValueChange={setCatId}>
                <SelectTrigger id="bCat">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bVal" className="text-xs font-medium text-slate-700">
                  Valor Limite (R$) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">
                    R$
                  </span>
                  <Input
                    id="bVal"
                    placeholder="0,00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(maskCurrencyInput(e.target.value))}
                    className="pl-9 font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bMonth" className="text-xs font-medium text-slate-700">
                  Mês de Referência *
                </Label>
                <Input
                  id="bMonth"
                  type="month"
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {saving ? 'Salvando...' : 'Salvar Orçamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteBudget} onOpenChange={(o) => !o && setDeleteBudget(null)}>
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover este teto orçamentário? As transações já registradas não serão
              afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Budgets
