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
  type Category,
  type Transaction,
} from '@/services/finance'
import { parseCurrencyToCents, maskCurrencyInput } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
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
  const [loading, setLoading] = useState(false)

  const [description, setDescription] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState<'despesa' | 'receita' | 'investimento'>('despesa')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      categoriesService.list().then((cats) => {
        setCategories(cats)
        if (!initialTransaction && cats.length > 0 && !categoryId) {
          const first = cats.find((c) => c.type === type) || cats[0]
          setCategoryId(first.id)
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
        setType(initialTransaction.type)
        setNote(initialTransaction.note || '')
      } else {
        setDescription('')
        setAmountInput('')
        setDate(new Date().toISOString().slice(0, 10))
        setNote('')
        setType('despesa')
      }
    }
  }, [open, initialTransaction])

  // Filter categories matching selected type
  const availableCategories = categories.filter((c) => c.type === type)

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

    setLoading(true)
    try {
      if (initialTransaction) {
        await transactionsService.update(initialTransaction.id, {
          description: description.trim(),
          amount: cents,
          date,
          category: categoryId,
          type,
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
              disabled={loading}
              className={
                type === 'despesa'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
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
