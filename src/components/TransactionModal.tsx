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

  // Atualiza automaticamente o budgetId quando há exatamente 1 caixinha candidata e não estamos editando com outra escolha
  useEffect(() => {
    if (type !== 'despesa') {
      setBudgetId('')
      return
    }
    // Se estivermos editando uma transação existente, preserva o budgetId já gravado se o usuário não trocou a categoria
    if (
      initialTransaction &&
      initialTransaction.budget &&
      initialTransaction.category === categoryId
    ) {
      setBudgetId(initialTransaction.budget)
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
  }, [candidateBudgets, type, categoryId, initialTransaction])

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
          budget: type === 'despesa' ? budgetId || null : null,
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
                  ? 'bg-brand-petrol text-white shadow-sm'
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
                  ? 'bg-brand-gold text-[#1E4A5A] shadow-sm'
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

          {/* Seção de Caixinha Efetiva (Remanejamento / Escolha): para despesas, permite escolher em qual caixinha alocar */}
          {type === 'despesa' && (
            <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="budget-select"
                  className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"
                >
                  {candidateBudgets.length > 1 ? (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-petrol" />
                  )}
                  Caixinha do Gasto {candidateBudgets.length > 1 && '*'}
                </Label>
                {candidateBudgets.length > 1 ? (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.5 rounded">
                    Obrigatório
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-normal">Remanejável</span>
                )}
              </div>

              {candidateBudgets.length > 1 ? (
                <p className="text-[11px] text-amber-800">
                  Esta categoria está vinculada a {candidateBudgets.length} caixinhas. Escolha em
                  qual delas esse gasto deve ser registrado:
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Você pode remanejar este gasto para qualquer caixinha ativa do mês ou usar a
                  vinculação automática da categoria.
                </p>
              )}

              <Select
                value={budgetId || '__none__'}
                onValueChange={(val) => setBudgetId(val === '__none__' ? '' : val)}
              >
                <SelectTrigger
                  id="budget-select"
                  className={`w-full bg-white ${
                    candidateBudgets.length > 1 && !budgetId
                      ? 'border-amber-400 focus:ring-amber-400'
                      : 'border-slate-200'
                  }`}
                >
                  <SelectValue placeholder="Selecione a caixinha..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Opção sem caixinha fixa / automática quando não for obrigatório ter caixinha vinculada múltipla */}
                  {candidateBudgets.length <= 1 && (
                    <SelectItem value="__none__">
                      <span className="text-slate-500 italic text-xs">
                        Automático / Sem caixinha fixa
                      </span>
                    </SelectItem>
                  )}

                  {/* Grupo de Caixinhas Candidatas Vinculadas (se houver) */}
                  {candidateBudgets.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Caixinhas Vinculadas à Categoria
                      </div>
                      {candidateBudgets.map((b) => {
                        const bCat = b.category
                          ? categories.find((c) => c.id === b.category) || b.expand?.category
                          : b.expand?.category
                        const bName = b.name || bCat?.name || 'Caixinha'
                        const bIcon = b.icon || bCat?.icon || 'wallet'
                        const bColor = b.color || bCat?.color || '#0284c7'
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                                style={{ backgroundColor: bColor }}
                              >
                                {renderCaixinhaIcon(bIcon, 'w-3 h-3 text-xs')}
                              </span>
                              <span className="font-medium text-slate-900">{bName}</span>
                              <span className="text-[10px] text-brand-petrol font-semibold bg-brand-petrol/10 px-1 py-0.2 rounded ml-auto">
                                Vinculada
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </>
                  )}

                  {/* Demais Caixinhas Ativas do Usuário para remanejamento livre */}
                  {(() => {
                    const candidateIds = new Set(candidateBudgets.map((b) => b.id))
                    const otherBudgets = budgets.filter((b) => !candidateIds.has(b.id))
                    if (otherBudgets.length === 0) return null

                    return (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 border-t border-slate-100">
                          Outras Caixinhas Disponíveis
                        </div>
                        {otherBudgets.map((b) => {
                          const bCat = b.category
                            ? categories.find((c) => c.id === b.category) || b.expand?.category
                            : b.expand?.category
                          const bName = b.name || bCat?.name || 'Caixinha'
                          const bIcon = b.icon || bCat?.icon || 'wallet'
                          const bColor = b.color || bCat?.color || '#64748b'
                          return (
                            <SelectItem key={b.id} value={b.id}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                                  style={{ backgroundColor: bColor }}
                                >
                                  {renderCaixinhaIcon(bIcon, 'w-3 h-3 text-xs')}
                                </span>
                                <span className="text-slate-800">{bName}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </>
                    )
                  })()}
                </SelectContent>
              </Select>
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
                  ? 'bg-brand-terracotta hover:brightness-95 text-white disabled:opacity-60'
                  : type === 'receita'
                    ? 'bg-brand-petrol hover:bg-brand-petrol-dark text-white'
                    : 'bg-brand-gold hover:brightness-95 text-[#1E4A5A]'
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
