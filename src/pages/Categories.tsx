import React, { useEffect, useState } from 'react'
import {
  categoriesService,
  transactionsService,
  type Category,
  type Transaction,
} from '@/services/finance'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import {
  BICHINHO_ICONS,
  GERAL_ICONS,
  CAIXINHA_ICONS,
  CAIXINHA_COLORS,
  renderCaixinhaIcon,
  getCaixinhaIconComponent,
} from '@/lib/caixinhaIcons'

const ICON_OPTIONS = CAIXINHA_ICONS
const COLOR_OPTIONS = CAIXINHA_COLORS

function renderCategoryIcon(iconKey: string, className = 'w-5 h-5') {
  return renderCaixinhaIcon(iconKey, `${className} text-base`)
}

export const Categories: React.FC = () => {
  const { toast } = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [type, setType] = useState<'despesa' | 'receita' | 'investimento'>('despesa')
  const [icon, setIcon] = useState('pet-cat')
  const [catIconTab, setCatIconTab] = useState<'bichinho' | 'geral'>('bichinho')
  const [color, setColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [cats, txs] = await Promise.all([
        categoriesService.list(),
        transactionsService.getFullList(),
      ])
      setCategories(cats)
      setTransactions(txs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreate = () => {
    setEditingCategory(null)
    setName('')
    setType('despesa')
    setIcon('utensils')
    setColor('#f59e0b')
    setModalOpen(true)
  }

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat)
    setName(cat.name)
    setType(cat.type)
    setIcon(cat.icon)
    setColor(cat.color)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da categoria.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      if (editingCategory) {
        await categoriesService.update(editingCategory.id, {
          name: name.trim(),
          type,
          icon,
          color,
        })
        toast({ title: 'Categoria atualizada', description: 'Alterações salvas com sucesso.' })
      } else {
        await categoriesService.create({
          name: name.trim(),
          type,
          icon,
          color,
        })
        toast({ title: 'Categoria criada', description: 'Nova categoria adicionada com sucesso.' })
      }
      setModalOpen(false)
      loadData()
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Falha ao salvar a categoria.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCat) return

    // Check if category has active transactions
    const txCount = transactions.filter(
      (t) => (t.status || 'active') === 'active' && t.category === deleteCat.id,
    ).length
    if (txCount > 0) {
      toast({
        title: 'Exclusão impedida',
        description: `Existem ${txCount} transações ativas associadas a esta categoria. Reclassifique-as primeiro.`,
        variant: 'destructive',
      })
      setDeleteCat(null)
      return
    }

    try {
      await categoriesService.delete(deleteCat.id)
      toast({ title: 'Categoria removida', description: 'Categoria excluída com sucesso.' })
      setDeleteCat(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categorias</h1>
          <p className="text-sm text-slate-500">
            Gerencie as categorias de despesas, receitas e aportes financeiros
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Categoria
        </Button>
      </div>

      {/* Grid of Categories Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const currentMonthTxs = transactions.filter(
            (t) => t.category === cat.id && t.date.startsWith(new Date().toISOString().slice(0, 7)),
          )
          const totalMonthlySpent = currentMonthTxs.reduce((sum, t) => sum + t.amount, 0)

          return (
            <Card
              key={cat.id}
              className="border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: cat.color }}
              />
              <CardContent className="p-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                    }}
                  >
                    {renderCategoryIcon(cat.icon, 'w-6 h-6')}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize mt-0.5 border-slate-200"
                    >
                      {cat.type}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-2">
                      {currentMonthTxs.length}{' '}
                      {currentMonthTxs.length === 1 ? 'lançamento' : 'lançamentos'} este mês
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(cat)}
                    className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteCat(cat)}
                    className="h-8 w-8 text-slate-500 hover:text-red-600"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Category Modal (Create / Edit) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              Defina o nome, ícone e cor para identificar seus custos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="catName" className="text-xs font-medium text-slate-700">
                Nome da Categoria *
              </Label>
              <Input
                id="catName"
                placeholder="Ex: Assinaturas, Mercado, Combustível..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Tipo de Lançamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['despesa', 'receita', 'investimento'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 text-xs font-semibold rounded-lg capitalize border transition-all ${
                      type === t
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-700">Figurinha / Ícone</Label>
                <div className="flex gap-1 p-0.5 bg-slate-200/80 rounded-md text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCatIconTab('bichinho')}
                    className={`px-2 py-0.5 rounded transition-all font-medium ${
                      catIconTab === 'bichinho'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🐱 Bichinhos
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatIconTab('geral')}
                    className={`px-2 py-0.5 rounded transition-all font-medium ${
                      catIconTab === 'geral'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✨ Geral
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-7 gap-2 max-h-36 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
                {(catIconTab === 'bichinho' ? BICHINHO_ICONS : GERAL_ICONS).map((opt) => {
                  const isSelected = icon === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIcon(opt.id)}
                      title={opt.label}
                      className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-600/20 scale-105'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
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

            {/* Color Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Cor de Destaque</Label>
              <div className="flex flex-wrap gap-2.5">
                {COLOR_OPTIONS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      color === hex
                        ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110'
                        : 'hover:scale-105'
                    }`}
                  />
                ))}
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
                {saving ? 'Salvando...' : 'Salvar Categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir a categoria <strong>{deleteCat?.name}</strong>? Se houver
              transações vinculadas, a exclusão será bloqueada.
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

export default Categories
