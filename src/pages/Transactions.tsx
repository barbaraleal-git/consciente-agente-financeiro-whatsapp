import React, { useEffect, useState, useMemo } from 'react'
import {
  transactionsService,
  categoriesService,
  type Transaction,
  type Category,
} from '@/services/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, formatDate, formatDateTime, getSourceLabel } from '@/lib/formatters'
import { renderCaixinhaIcon } from '@/lib/caixinhaIcons'
import { TransactionModal } from '@/components/TransactionModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  Receipt,
  FileSpreadsheet,
  MessageSquare,
  Mic,
  PenLine,
  Bot,
  Clock,
} from 'lucide-react'

export const Transactions: React.FC = () => {
  const { toast } = useToast()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [periodFilter, setPeriodFilter] = useState('thisMonth') // Default: mês corrente (1º dia até hoje)
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'cancelled'>('active') // Default: somente ativas
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const itemsPerPage = 15

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  useRealtime<Transaction>('transactions', () => loadData())

  // Filter and sort logic
  const filteredTransactions = useMemo(() => {
    const now = new Date()

    return transactions
      .filter((t) => {
        // Status filter (Item 27: deletadas NUNCA aparecem na visão do cliente; canceladas aparecem se o filtro permitir)
        const st = t.status || 'active'
        if (st === 'deleted') return false
        if (statusFilter === 'active' && st !== 'active') return false
        if (statusFilter === 'cancelled' && st !== 'cancelled') return false

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase()
          const matchDesc = t.description.toLowerCase().includes(q)
          const matchNote = t.note?.toLowerCase().includes(q)
          if (!matchDesc && !matchNote) return false
        }

        // Category filter
        if (categoryFilter !== 'ALL' && t.category !== categoryFilter) {
          return false
        }

        // Type filter
        if (typeFilter !== 'ALL' && t.type !== typeFilter) {
          return false
        }

        // Period filter
        if (periodFilter === '7days') {
          const d = new Date(t.date)
          const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
          if (diffDays > 7 || diffDays < -1) return false
        } else if (periodFilter === '30days') {
          const d = new Date(t.date)
          const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
          if (diffDays > 30 || diffDays < -1) return false
        } else if (periodFilter === 'thisMonth') {
          const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          if (!t.date.startsWith(ym)) return false
        }

        return true
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime()
        const timeB = new Date(b.date).getTime()
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB
      })
  }, [transactions, search, categoryFilter, typeFilter, periodFilter, statusFilter, sortOrder])

  // Paginated records
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return filteredTransactions.slice(start, start + itemsPerPage)
  }, [filteredTransactions, page])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await transactionsService.delete(deleteId)
      toast({ title: 'Lançamento excluído', description: 'Transação removida com sucesso.' })
      setDeleteId(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o lançamento.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transações</h1>
          <p className="text-sm text-slate-500">
            Gerenciamento detalhado de todos os seus lançamentos financeiros
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedTx(null)
            setModalOpen(true)
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Lançamento
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          {/* Search text */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Buscar por descrição ou nota..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-10 bg-slate-50 border-slate-200"
            />
          </div>

          {/* Category dropdown */}
          <div className="w-full sm:w-44">
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas Categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type dropdown */}
          <div className="w-full sm:w-36">
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Period dropdown */}
          <div className="w-full sm:w-40">
            <Select
              value={periodFilter}
              onValueChange={(val) => {
                setPeriodFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisMonth">Mês corrente</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
                <SelectItem value="ALL">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status dropdown */}
          <div className="w-full sm:w-36">
            <Select
              value={statusFilter}
              onValueChange={(val: 'active' | 'all' | 'cancelled') => {
                setStatusFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Somente Ativos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
                <SelectItem value="all">Todos os Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            title={`Ordenar: ${sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigas'}`}
            className="h-10 w-10 shrink-0 border-slate-200"
          >
            <ArrowUpDown className="w-4 h-4 text-slate-600" />
          </Button>
        </CardContent>
      </Card>

      {/* Transactions Table & Mobile Card View */}
      <Card className="border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-600">Nenhum lançamento encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tente ajustar os filtros ou adicione uma nova transação pelo botão acima.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Origem</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTransactions.map((tx) => {
                      const cat = categories.find((c) => c.id === tx.category)
                      const isExp = tx.type === 'despesa'
                      const isInc = tx.type === 'receita'
                      const isCancelled = tx.status === 'cancelled'
                      const isDeleted = tx.status === 'deleted'

                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isCancelled || isDeleted ? 'opacity-60 bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={
                                    isCancelled || isDeleted ? 'line-through text-slate-500' : ''
                                  }
                                >
                                  {tx.description}
                                </span>
                                {isCancelled && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-semibold"
                                  >
                                    Cancelado
                                  </Badge>
                                )}
                                {isDeleted && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-semibold"
                                  >
                                    Excluído
                                  </Badge>
                                )}
                                {tx.is_retroactive && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 font-medium"
                                    title={`Lançamento retroativo com data original: ${formatDate(tx.date)}`}
                                  >
                                    Retroativo
                                  </Badge>
                                )}
                              </div>
                              {tx.note && (
                                <p className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                                  {tx.note}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs shrink-0"
                                style={{ backgroundColor: cat?.color || '#64748b' }}
                              >
                                {renderCaixinhaIcon(cat?.icon, 'w-3 h-3 text-xs')}
                              </span>
                              <span className="text-slate-700">
                                {cat?.name || 'Não categorizado'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            <div>
                              <span>{formatDate(tx.date)}</span>
                              {tx.is_retroactive && (
                                <span className="block text-[10px] text-amber-600 font-medium">
                                  Data original
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[11px] capitalize ${
                                isInc
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : isExp
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              {tx.source === 'whatsapp_audio' ? (
                                <Mic className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              ) : tx.source === 'whatsapp_text' || tx.source === 'whatsapp' ? (
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : tx.source === 'import' ? (
                                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              ) : tx.source === 'agent' ? (
                                <Bot className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                              ) : (
                                <PenLine className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span>{getSourceLabel(tx.source)}</span>
                            </div>
                            {tx.message_timestamp && (
                              <div
                                className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"
                                title="Data e hora da mensagem original"
                              >
                                <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                                <span>{formatDateTime(tx.message_timestamp)}</span>
                              </div>
                            )}
                          </td>
                          <td
                            className={`py-3.5 px-4 text-right font-bold tabular-nums ${
                              isCancelled || isDeleted
                                ? 'line-through text-slate-400'
                                : isInc
                                  ? 'text-emerald-600'
                                  : isExp
                                    ? 'text-red-600'
                                    : 'text-indigo-600'
                            }`}
                          >
                            {isInc ? '+' : isExp ? '-' : ''} {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!isCancelled && !isDeleted && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedTx(tx)
                                    setModalOpen(true)
                                  }}
                                  className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {!isCancelled && !isDeleted && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteId(tx.id)}
                                  className="h-8 w-8 text-slate-500 hover:text-red-600"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden divide-y divide-slate-100">
                {paginatedTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.category)
                  const isExp = tx.type === 'despesa'
                  const isInc = tx.type === 'receita'
                  const isCancelled = tx.status === 'cancelled'
                  const isDeleted = tx.status === 'deleted'

                  return (
                    <div
                      key={tx.id}
                      className={`p-4 space-y-2 ${
                        isCancelled || isDeleted ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p
                              className={`text-sm font-semibold text-slate-900 ${
                                isCancelled || isDeleted ? 'line-through text-slate-500' : ''
                              }`}
                            >
                              {tx.description}
                            </p>
                            {isCancelled && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-semibold"
                              >
                                Cancelado
                              </Badge>
                            )}
                            {isDeleted && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-semibold"
                              >
                                Excluído
                              </Badge>
                            )}
                            {tx.is_retroactive && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 font-medium"
                                title={`Lançamento retroativo com data original: ${formatDate(tx.date)}`}
                              >
                                Retroativo
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span
                              className="w-4 h-4 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                              style={{ backgroundColor: cat?.color || '#64748b' }}
                            >
                              {renderCaixinhaIcon(cat?.icon, 'w-2.5 h-2.5 text-[10px]')}
                            </span>
                            <span>{cat?.name || 'Geral'}</span>
                            <span>•</span>
                            <span>{formatDate(tx.date)}</span>
                            {tx.is_retroactive && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                (original)
                              </span>
                            )}
                          </div>
                        </div>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isCancelled || isDeleted
                              ? 'line-through text-slate-400'
                              : isInc
                                ? 'text-emerald-600'
                                : isExp
                                  ? 'text-red-600'
                                  : 'text-indigo-600'
                          }`}
                        >
                          {isInc ? '+' : isExp ? '-' : ''} {formatCurrency(tx.amount)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-[10px] gap-1">
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
                            <span className="capitalize">{tx.type}</span> •{' '}
                            <span>{getSourceLabel(tx.source)}</span>
                          </Badge>
                          {tx.message_timestamp && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-0.5">
                              <Clock className="w-2.5 h-2.5 text-slate-300" />
                              <span>Msg: {formatDateTime(tx.message_timestamp)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!isCancelled && !isDeleted && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTx(tx)
                                  setModalOpen(true)
                                }}
                                className="h-7 text-xs text-slate-600"
                              >
                                <Edit2 className="w-3 h-3 mr-1" /> Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(tx.id)}
                                className="h-7 text-xs text-red-600"
                              >
                                <Trash2 className="w-3 h-3 mr-1" /> Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Mostrando {paginatedTransactions.length} de {filteredTransactions.length}{' '}
                  lançamentos
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 px-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span>
                    {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 px-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Modal (New/Edit) */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialTransaction={selectedTx}
        onSuccess={loadData}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.
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

export default Transactions
