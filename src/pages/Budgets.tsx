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
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BarChart2,
  Sparkles,
  Layers,
} from 'lucide-react'
import {
  BICHINHO_ICONS,
  EMOJI_ICONS,
  GERAL_ICONS,
  CAIXINHA_ICONS,
  CAIXINHA_COLORS,
  renderCaixinhaIcon,
  getCaixinhaIconComponent,
} from '@/lib/caixinhaIcons'
import { getBudgetSpent, isTransactionInBudget } from '@/lib/caixinhaMatcher'

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
  const [creationMode, setCreationMode] = useState<'existing' | 'custom'>('custom')
  const [catId, setCatId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customIcon, setCustomIcon] = useState('pet-cat')
  const [iconTab, setIconTab] = useState<'geral' | 'emoji' | 'bichinho'>('bichinho')
  const [customColor, setCustomColor] = useState('#ec4899')
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

  // Calculate budget statistics for the selected month (somente transações ativas com match unificado)
  const budgetStats = useMemo(() => {
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.category)
      const spent = getBudgetSpent(b, transactions, categories, budgets)

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
    setCreationMode('custom')
    setCustomName('')
    setCustomIcon('pet-cat')
    setIconTab('bichinho')
    setCustomColor('#ec4899')
    setCatId(expenseCats[0]?.id || '')
    setAmountStr('')
    setMonthInput(selectedMonth)
    setModalOpen(true)
  }

  const handleOpenEdit = (b: Budget) => {
    setEditingBudget(b)
    setCreationMode('existing')
    setCatId(b.category)

    const cat = categories.find((c) => c.id === b.category)
    const initialName = cat?.name || ''
    const initialIcon = cat?.icon || 'pet-cat'
    const initialColor = cat?.color || '#ec4899'

    setCustomName(initialName)
    setCustomIcon(initialIcon)
    setCustomColor(initialColor)

    // Ajusta a aba inicial de acordo com o ícone atual da caixinha
    if (initialIcon.startsWith('pet-') || BICHINHO_ICONS.some((opt) => opt.id === initialIcon)) {
      setIconTab('bichinho')
    } else if (
      initialIcon.startsWith('emoji:') ||
      EMOJI_ICONS.some((opt) => opt.id === initialIcon)
    ) {
      setIconTab('emoji')
    } else {
      setIconTab('geral')
    }

    setAmountStr(
      (b.amount / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
    setMonthInput(b.month)
    setModalOpen(true)
  }

  // Ao trocar de categoria durante edição ou criação por categoria existente, sincroniza nome, ícone e cor
  const handleCategoryChange = (newCatId: string) => {
    setCatId(newCatId)
    const matched = categories.find((c) => c.id === newCatId)
    if (matched) {
      setCustomName(matched.name)
      setCustomIcon(matched.icon || 'pet-cat')
      setCustomColor(matched.color || '#ec4899')
      if (
        matched.icon?.startsWith('pet-') ||
        BICHINHO_ICONS.some((opt) => opt.id === matched.icon)
      ) {
        setIconTab('bichinho')
      } else if (
        matched.icon?.startsWith('emoji:') ||
        EMOJI_ICONS.some((opt) => opt.id === matched.icon)
      ) {
        setIconTab('emoji')
      } else {
        setIconTab('geral')
      }
    }
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
    setSaving(true)
    try {
      let finalCategoryId = catId

      // If creating a brand new custom caixinha with own name & icon
      if (!editingBudget && creationMode === 'custom') {
        const trimmedName = customName.trim()
        if (!trimmedName) {
          toast({
            title: 'Nome obrigatório',
            description: 'Informe o nome da sua caixinha (ex: Viagem a Paris).',
            variant: 'destructive',
          })
          setSaving(false)
          return
        }

        // Create new category in PocketBase
        const createdCat = await categoriesService.create({
          name: trimmedName,
          type: 'despesa',
          icon: customIcon,
          color: customColor,
        })
        finalCategoryId = createdCat.id
      } else {
        if (!finalCategoryId) {
          toast({
            title: 'Categoria obrigatória',
            description: 'Selecione uma categoria.',
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
      }

      if (editingBudget) {
        // Atualiza a categoria vinculada (nome, ícone, cor)
        const trimmedName = customName.trim()
        if (finalCategoryId) {
          const catUpdatePayload: { name?: string; icon?: string; color?: string } = {
            icon: customIcon,
            color: customColor,
          }
          if (trimmedName) {
            catUpdatePayload.name = trimmedName
          }
          await categoriesService.update(finalCategoryId, catUpdatePayload)
        }

        // Atualiza o budget (teto e mês)
        await budgetsService.update(editingBudget.id, {
          category: finalCategoryId,
          amount: cents,
          month: monthInput,
        })
        toast({
          title: 'Caixinha atualizada com sucesso! ✨',
          description: 'Ícone, nome, cor e teto salvos com sucesso.',
        })
      } else {
        await budgetsService.create({
          category: finalCategoryId,
          amount: cents,
          month: monthInput,
        })
        toast({
          title: 'Caixinha criada com sucesso! 🎯',
          description: 'Seu teto de gastos foi configurado.',
        })
      }
      setModalOpen(false)
      await loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a caixinha. Verifique os dados.',
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
      toast({ title: 'Caixinha excluída', description: 'Teto removido com sucesso.' })
      setDeleteBudget(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Falha ao remover a caixinha.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Caixinhas & Metas</h1>
          </div>
          <p className="text-sm text-slate-500">
            Acompanhe o consumo e os tetos de cada caixinha de despesas
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
            Nova Caixinha
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total nas Caixinhas ({formatMonthName(selectedMonth)})
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
              {formatCurrency(totalDefined)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Soma de todos os limites mensais</p>
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
              Restante nas Caixinhas
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
            Comparativo Teto vs. Realizado ({formatMonthName(selectedMonth)})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Comparação de cada caixinha entre o teto planejado e o gasto real
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {budgetStats.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhuma caixinha cadastrada para este mês.{' '}
              <button
                onClick={handleOpenCreate}
                className="text-indigo-600 hover:underline font-medium"
              >
                Clique aqui para definir um teto.
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {budgetStats.map((item) => {
                return (
                  <div
                    key={item.budget.id}
                    className="space-y-1.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs text-sm"
                          style={{ backgroundColor: item.category?.color || '#64748b' }}
                        >
                          {renderCaixinhaIcon(item.category?.icon, 'w-4 h-4')}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">
                            {item.category?.name || 'Categoria'}
                          </span>
                        </div>
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

                    {/* Lançamentos vinculados a esta caixinha */}
                    {(() => {
                      const matchedTxs = transactions
                        .filter((t) => isTransactionInBudget(t, item.budget, categories, budgets))
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                      if (matchedTxs.length === 0) return null

                      return (
                        <div className="pt-2 border-t border-slate-100/80 space-y-1.5 mt-2 bg-slate-50/50 p-2 rounded-lg">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Lançamentos vinculados ({matchedTxs.length})</span>
                            <span className="text-slate-500 font-bold">
                              {formatCurrency(item.spentAmount)}
                            </span>
                          </p>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                            {matchedTxs.map((tx) => (
                              <div
                                key={tx.id}
                                className="text-xs flex items-center justify-between py-1 px-1.5 rounded bg-white border border-slate-100 text-slate-700 hover:bg-slate-50"
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="font-medium truncate block text-slate-900">
                                    {tx.description}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {formatDate(tx.date)}
                                    {tx.note ? ` • ${tx.note}` : ''}
                                  </span>
                                </div>
                                <span className="font-semibold tabular-nums shrink-0 text-slate-900 text-xs">
                                  {formatCurrency(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Editar Caixinha' : 'Nova Caixinha'}</DialogTitle>
            <DialogDescription>
              Defina o teto mensal para organizar seus custos nesta caixinha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Toggle Mode: Create brand new custom caixinha vs use existing category */}
            {!editingBudget && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCreationMode('custom')}
                  className={`py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    creationMode === 'custom'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                  Nome Personalizado
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode('existing')}
                  className={`py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    creationMode === 'existing'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Categoria Existente
                </button>
              </div>
            )}

            {/* Modo edição: permite trocar a categoria vinculada E customizar nome, ícone (3 abas) e cor */}
            {editingBudget ? (
              <div className="space-y-3.5">
                {/* Seletor de Categoria da Caixinha */}
                <div className="space-y-1.5">
                  <Label htmlFor="bCat" className="text-xs font-medium text-slate-700">
                    Categoria da Caixinha *
                  </Label>
                  <Select value={catId} onValueChange={handleCategoryChange}>
                    <SelectTrigger id="bCat" className="bg-white">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => {
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                                style={{ backgroundColor: c.color }}
                              >
                                {renderCaixinhaIcon(c.icon, 'w-3 h-3 text-xs')}
                              </span>
                              <span>{c.name}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Box de Personalização de Nome, Figurinha/Ícone e Cor */}
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                  {/* Nome da Caixinha */}
                  <div className="space-y-1.5">
                    <Label htmlFor="editCatName" className="text-xs font-medium text-slate-700">
                      Nome da Caixinha *
                    </Label>
                    <Input
                      id="editCatName"
                      placeholder="Ex: Alimentação - VA, Viagem a Paris, Pet..."
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="bg-white"
                      required
                    />
                  </div>

                  {/* Seletor de Figurinha / Ícone com 3 abas */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium text-slate-700">
                          Figurinha / Ícone
                        </Label>
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                          style={{ backgroundColor: customColor }}
                        >
                          {renderCaixinhaIcon(customIcon, 'w-3 h-3 text-xs')}
                        </span>
                      </div>
                      <div className="flex gap-1 p-0.5 bg-slate-200/80 rounded-md text-[11px]">
                        <button
                          type="button"
                          onClick={() => setIconTab('geral')}
                          className={`px-2 py-0.5 rounded transition-all font-medium ${
                            iconTab === 'geral'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Ícones
                        </button>
                        <button
                          type="button"
                          onClick={() => setIconTab('emoji')}
                          className={`px-2 py-0.5 rounded transition-all font-medium ${
                            iconTab === 'emoji'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Emojis
                        </button>
                        <button
                          type="button"
                          onClick={() => setIconTab('bichinho')}
                          className={`px-2 py-0.5 rounded transition-all font-medium ${
                            iconTab === 'bichinho'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🐱 Bichinhos
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2 bg-white rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                      {(iconTab === 'bichinho'
                        ? BICHINHO_ICONS
                        : iconTab === 'emoji'
                          ? EMOJI_ICONS
                          : GERAL_ICONS
                      ).map((opt) => {
                        const isSelected = customIcon === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setCustomIcon(opt.id)}
                            title={opt.label}
                            className={`p-1.5 rounded-lg flex items-center justify-center text-base transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/30 scale-105'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {opt.emoji ? (
                              <span className="text-lg leading-none">{opt.emoji}</span>
                            ) : opt.icon ? (
                              <opt.icon className="w-4 h-4" />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Seletor de Cor */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Cor da Caixinha</Label>
                    <div className="flex flex-wrap gap-2">
                      {CAIXINHA_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setCustomColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            customColor === hex
                              ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110'
                              : 'hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : creationMode === 'custom' ? (
              /* Criação: Modo customizado com nome, ícone (3 abas) e cor */
              <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="space-y-1.5">
                  <Label htmlFor="customCatName" className="text-xs font-medium text-slate-700">
                    Nome da Caixinha *
                  </Label>
                  <Input
                    id="customCatName"
                    placeholder="Ex: Viagem a Paris, Casamento, Reforma..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-white"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Dê um nome livre para sua meta de gastos ou viagem.
                  </p>
                </div>

                {/* Icon picker com 3 abas: Ícones, Emojis e Bichinhos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium text-slate-700">
                        Figurinha / Ícone
                      </Label>
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: customColor }}
                      >
                        {renderCaixinhaIcon(customIcon, 'w-3 h-3 text-xs')}
                      </span>
                    </div>
                    <div className="flex gap-1 p-0.5 bg-slate-200/80 rounded-md text-[11px]">
                      <button
                        type="button"
                        onClick={() => setIconTab('geral')}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${
                          iconTab === 'geral'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ícones
                      </button>
                      <button
                        type="button"
                        onClick={() => setIconTab('emoji')}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${
                          iconTab === 'emoji'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Emojis
                      </button>
                      <button
                        type="button"
                        onClick={() => setIconTab('bichinho')}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${
                          iconTab === 'bichinho'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🐱 Bichinhos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2 bg-white rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                    {(iconTab === 'bichinho'
                      ? BICHINHO_ICONS
                      : iconTab === 'emoji'
                        ? EMOJI_ICONS
                        : GERAL_ICONS
                    ).map((opt) => {
                      const isSelected = customIcon === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCustomIcon(opt.id)}
                          title={opt.label}
                          className={`p-1.5 rounded-lg flex items-center justify-center text-base transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/30 scale-105'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {opt.emoji ? (
                            <span className="text-lg leading-none">{opt.emoji}</span>
                          ) : opt.icon ? (
                            <opt.icon className="w-4 h-4" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Color picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {CAIXINHA_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setCustomColor(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          customColor === hex
                            ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110'
                            : 'hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Criação: Seleção de categoria existente */
              <div className="space-y-1.5">
                <Label htmlFor="bCat" className="text-xs font-medium text-slate-700">
                  Categoria da Caixinha *
                </Label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger id="bCat">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => {
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                              style={{ backgroundColor: c.color }}
                            >
                              {renderCaixinhaIcon(c.icon, 'w-3 h-3 text-xs')}
                            </span>
                            <span>{c.name}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bVal" className="text-xs font-medium text-slate-700">
                  Teto da Caixinha (R$) *
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
                {saving ? 'Salvando...' : 'Salvar Caixinha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteBudget} onOpenChange={(o) => !o && setDeleteBudget(null)}>
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Caixinha</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o teto desta caixinha? As transações já registradas não serão afetadas.
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
