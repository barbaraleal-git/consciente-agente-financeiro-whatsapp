import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  categoriesService,
  transactionsService,
  budgetsService,
  categoryCaixinhaLinksService,
  type Category,
  type Transaction,
  type Budget,
  type CategoryCaixinhaLink,
} from '@/services/finance'
import { parseCurrencyToCents, maskCurrencyInput } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getCaixinhaIconComponent, renderCaixinhaIcon } from '@/lib/caixinhaIcons'

interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialTransaction?: Transaction | null
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialTransaction,
}) => {
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [links, setLinks] = useState<CategoryCaixinhaLink[]>([])
  const [loading, setLoading] = useState(false)

  const [description, setDescription] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState('')
  const [budgetId, setBudgetId] = useState<string>('')
  const [type, setType] = useState<'despesa' | 'receita' | 'investimento'>('despesa')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      Promise.all([
        categoriesService.list(),
        budgetsService.list(),
        categoryCaixinhaLinksService.listByUser().catch(() => []),
      ]).then(([cats, bgs, lks]) => {
        setCategories(cats)
        setBudgets(bgs)
        setLinks(lks)

        if (!initialTransaction && cats.length > 0 && !categoryId) {
          const first = cats.find((c) => c.type === type) || cats[0]
          if (first) {
            setCategoryId(first.id)
          }
        }
      })

      if (initialTransaction) {
        setDescription(initialTransaction.description)
        setAmountInput(
          (initialTransaction.amount / 100).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
        setDate(initialTransaction.date.slice(0, 10))
        setCategoryId(initialTransaction.category)
        setBudgetId(initialTransaction.budget || '')
        setType(initialTransaction.type)
        setNote(initialTransaction.note || '')
      } else {
        setDescription('')
        setAmountInput('')
        setDate(new Date().toISOString().slice(0, 10))
        setNote('')
        setBudgetId('')
        setType('despesa')
      }
    }
  }, [open, initialTransaction])

  // Filter categories matching selected type
  const availableCategories = categories.filter((c) => c.type === type)

  // Identifica caixinhas candidatas vinculadas à categoria atual
  const selectedCategory = categories.find((c) => c.id === categoryId)
  const normSelectedCatName = (selectedCategory?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  const candidateBudgets = React.useMemo(() => {
    if (type !== 'despesa' || !categoryId) return []
    // Links ativos
    const activeLinks = links.filter((l) => l.active !== false)
    if (activeLinks.length === 0) return []

    const matchedBudgetIds = new Set<string>()
    for (const link of activeLinks) {
      const linkCatName = (link.category_name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

      if (
        (link.category_id && link.category_id === categoryId) ||
        (linkCatName &&
          normSelectedCatName &&
          (linkCatName === normSelectedCatName ||
            linkCatName.includes(normSelectedCatName) ||
            normSelectedCatName.includes(linkCatName)))
      ) {
        if (link.budget) {
          matchedBudgetIds.add(link.budget)
        }
      }
    }

    if (matchedBudgetIds.size === 0) return []
    return budgets.filter((b) => matchedBudgetIds.has(b.id))
  }, [type, categoryId, links, normSelectedCatName, budgets])

  // Atualiza automaticamente o budgetId quando há exatamente 1 caixinha candidata
  useEffect(() => {
    if (type !== 'despesa') {
      setBudgetId('')
      return
    }
    if (candidateBudgets.length === 1) {
      setBudgetId(candidateBudgets[0].id)
    } else if (candidateBudgets.length > 1) {
      // Se tiver mais de uma, só mantém se a atual estiver entre as candidatas
      if (!candidateBudgets.some((b) => b.id === budgetId)) {
        setBudgetId('')
      }
    } else {
      // Sem vínculos parametrizados
      if (!initialTransaction?.budget) {
        setBudgetId('')
      }
    }
  }, [candidateBudgets, type, initialTransaction])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCurrencyInput(e.target.value)
    setAmountInput(masked)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a descrição do lançamento.',
        variant: 'destructive',
      })
      return
    }
    const cents = parseCurrencyToCents(amountInput)
    if (cents <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'O valor deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }
    if (!categoryId) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria.',
        variant: 'destructive',
      })
      return
    }

    // Validação estrita: se a categoria tiver múltiplas caixinhas candidatas, a seleção é obrigatória!
    if (type === 'despesa' && candidateBudgets.length > 1 && !budgetId) {
      toast({
        title: 'Caixinha obrigatória',
        description:
          'Esta categoria está vinculada a várias caixinhas. Selecione em qual caixinha registrar o gasto.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (initialTransaction) {
        await transactionsService.update(initialTransaction.id, {
          description: description.trim(),
          amount: cents,
          date,
          category: categoryId,
          type,
          budget: budgetId || undefined,
          note: note.trim() || undefined,
        })
        toast({ title: 'Lançamento atualizado', description: 'Alterações salvas com sucesso.' })
      } else {
        await transactionsService.create({
          description: description.trim(),
          amount: cents,
          date,
          category: categoryId,
          type,
          source: 'manual',
          status: 'active',
          budget: budgetId || undefined,
          message_timestamp: new Date().toISOString(),
          note: note.trim() || undefined,
        })
        toast({
          title: 'Lançamento registrado',
          description: 'Nova transação adicionada com sucesso.',
        })
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível registrar o lançamento.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {initialTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {initialTransaction
              ? 'Atualize os detalhes da transação selecionada.'
              : 'Registre uma despesa, receita ou aporte financeiro.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Segmented type control */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setType('despesa')
                const first = categories.find((c) => c.type === 'despesa')
                if (first) setCategoryId(first.id)
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                type === 'despesa'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                setType('receita')
                const first = categories.find((c) => c.type === 'receita')
                if (first) setCategoryId(first.id)
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                type === 'receita'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => {
                setType('investimento')
                const first = categories.find((c) => c.type === 'investimento')
                if (first) setCategoryId(first.id)
              }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                type === 'investimento'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Investimento
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-xs font-medium text-slate-700">
              Descrição *
            </Label>
            <Input
              id="desc"
              placeholder="Ex: Supermercado, Aluguel, Almoço..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="val" className="text-xs font-medium text-slate-700">
                Valor (R$) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">
                  R$
                </span>
                <Input
                  id="val"
                  type="text"
                  placeholder="0,00"
                  value={amountInput}
                  onChange={handleAmountChange}
                  className="pl-9 font-semibold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs font-medium text-slate-700">
                Data *
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat" className="text-xs font-medium text-slate-700">
              Categoria *
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="cat" className="w-full">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => {
                  return (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                          style={{ backgroundColor: cat.color }}
                        >
                          {renderCaixinhaIcon(cat.icon, 'w-3 h-3 text-xs')}
                        </span>
                        <span>{cat.name}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Seção de Caixinha Vinculada: Obrigatória quando >1 candidatas, automática se única */}
          {type === 'despesa' && candidateBudgets.length > 1 && (
            <div className="space-y-1.5 p-3 rounded-lg border border-amber-200 bg-amber-50/70">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="budget-select"
                  className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Selecione a Caixinha *
                </Label>
                <span className="text-[10px] text-amber-700 font-medium">Obrigatório</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Esta categoria está vinculada a {candidateBudgets.length} caixinhas. Escolha em qual
                delas esse gasto deve entrar:
              </p>
              <Select value={budgetId} onValueChange={setBudgetId}>
                <SelectTrigger id="budget-select" className="w-full bg-white border-amber-300">
                  <SelectValue placeholder="Escolha a caixinha deste gasto..." />
                </SelectTrigger>
                <SelectContent>
                  {candidateBudgets.map((b) => {
                    const bCat = categories.find((c) => c.id === b.category) || b.expand?.category
                    const bName = bCat?.name || 'Caixinha'
                    const bIcon = bCat?.icon || 'wallet'
                    const bColor = bCat?.color || '#0284c7'
                    return (
                      <SelectItem key={b.id} value={b.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: bColor }}
                          >
                            {renderCaixinhaIcon(bIcon, 'w-3 h-3 text-xs')}
                          </span>
                          <span className="font-medium">{bName}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'despesa' && candidateBudgets.length === 1 && (
            <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <span className="font-medium">Caixinha vinculada: </span>
                {(() => {
                  const b = candidateBudgets[0]
                  const bCat = categories.find((c) => c.id === b.category) || b.expand?.category
                  return (
                    <span className="font-semibold text-emerald-950">
                      {bCat?.name || 'Caixinha'}
                    </span>
                  )
                })()}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-xs font-medium text-slate-700">
              Observações (opcional)
            </Label>
            <Input
              id="note"
              placeholder="Detalhes adicionais, forma de pagamento..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || (type === 'despesa' && candidateBudgets.length > 1 && !budgetId)}
              className={
                type === 'despesa'
                  ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300'
                  : type === 'receita'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : type === 'despesa' && candidateBudgets.length > 1 && !budgetId ? (
                'Selecione a caixinha para salvar'
              ) : (
                'Salvar Lançamento'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
