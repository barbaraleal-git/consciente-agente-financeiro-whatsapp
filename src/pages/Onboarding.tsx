import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  categoriesService,
  budgetsService,
  categoryCaixinhaLinksService,
  type Category,
} from '@/services/finance'
import {
  formatCurrency,
  getCurrentMonthStr,
  formatMonthName,
  maskCurrencyInput,
  parseCurrencyToCents,
} from '@/lib/formatters'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  PiggyBank,
  Bot,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  CAIXINHA_ICONS,
  CAIXINHA_COLORS,
  renderCaixinhaIcon,
  getCaixinhaIconComponent,
} from '@/lib/caixinhaIcons'
import { WhatsAppHandoff } from '@/components/onboarding/WhatsAppHandoff'

// Flag local (por sessão do navegador) para não repetir a tela de entrega
// ao WhatsApp dentro da mesma sessão. Sem migração: só localStorage.
const ONBOARDING_WHATSAPP_HANDOFF_KEY = 'consciente:onboarding:whatsapp_handoff_shown'

// Suggested default amounts in cents (examples based on practical monthly expenses)
const DEFAULT_AMOUNT_SUGGESTIONS: Record<string, string> = {
  Alimentação: '1.200,00',
  Transporte: '450,00',
  Moradia: '2.000,00',
  Lazer: '400,00',
  Saúde: '300,00',
  Educação: '350,00',
  Compras: '350,00',
  Assinaturas: '120,00',
}

export const Onboarding: React.FC = () => {
  const { user, completeOnboarding } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const currentMonth = getCurrentMonthStr()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Categories available for selection (expense type)
  const [availableCategories, setAvailableCategories] = useState<Category[]>([])

  // Step 1: Selected category IDs
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([])

  // Step 2: Amounts per category ID (string formatted as masked currency)
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  // Custom Caixinha Creator state (inline in onboarding)
  const [isCreatingCustom, setIsCreatingCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customIcon, setCustomIcon] = useState('plane')
  const [customColor, setCustomColor] = useState('#ec4899')
  const [customInitialCap, setCustomInitialCap] = useState('1.500,00')
  const [creatingLoading, setCreatingLoading] = useState(false)
  // Tela final "Entrega ao WhatsApp" (mostrada uma vez por sessão)
  const [showWhatsAppHandoff, setShowWhatsAppHandoff] = useState(false)

  useEffect(() => {
    const initCategories = async () => {
      try {
        const cats = await categoriesService.ensureDefaultCategories()
        const expenseCats = cats.filter((c) => c.type === 'despesa')
        setAvailableCategories(expenseCats)

        // Pre-select top 4 friendly common categories
        const preselectedNames = ['Alimentação', 'Transporte', 'Moradia', 'Lazer']
        const preselected = expenseCats.filter((c) => preselectedNames.includes(c.name))
        const ids =
          preselected.length > 0
            ? preselected.map((c) => c.id)
            : expenseCats.slice(0, 4).map((c) => c.id)
        setSelectedCatIds(ids)

        // Pre-fill initial suggested amounts
        const initialAmounts: Record<string, string> = {}
        expenseCats.forEach((c) => {
          initialAmounts[c.id] = DEFAULT_AMOUNT_SUGGESTIONS[c.name] || '300,00'
        })
        setAmounts(initialAmounts)
      } catch (err) {
        console.error('Erro ao carregar categorias do onboarding:', err)
      } finally {
        setLoading(false)
      }
    }

    initCategories()
  }, [])

  const toggleCategory = (id: string) => {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleAmountChange = (catId: string, val: string) => {
    const masked = maskCurrencyInput(val)
    setAmounts((prev) => ({ ...prev, [catId]: masked }))
  }

  const handleApplySuggestion = (catId: string, suggested: string) => {
    setAmounts((prev) => ({ ...prev, [catId]: suggested }))
  }

  // Create a brand new custom Caixinha right inside onboarding
  const handleCreateCustomCaixinha = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customName.trim()
    if (!trimmed) {
      toast({
        title: 'Nome obrigatório',
        description: 'Dê um nome para a sua nova caixinha (ex: Viagem a Paris).',
        variant: 'destructive',
      })
      return
    }

    setCreatingLoading(true)
    try {
      const created = await categoriesService.create({
        name: trimmed,
        type: 'despesa',
        icon: customIcon,
        color: customColor,
      })

      // Add to available categories and auto-select
      setAvailableCategories((prev) => [...prev, created])
      setSelectedCatIds((prev) => [...prev, created.id])

      // Initialize default budget suggestion
      const cleanCap = customInitialCap.trim() ? customInitialCap : '1.000,00'
      setAmounts((prev) => ({ ...prev, [created.id]: cleanCap }))

      // Reset form
      setCustomName('')
      setCustomIcon('plane')
      setCustomColor('#ec4899')
      setIsCreatingCustom(false)

      toast({
        title: `Caixinha "${trimmed}" criada!`,
        description: 'Adicionamos aos seus planos para este mês. 🎯',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao criar caixinha',
        description: 'Não foi possível cadastrar a caixinha personalizada.',
        variant: 'destructive',
      })
    } finally {
      setCreatingLoading(false)
    }
  }

  // Next from Step 1 to Step 2
  const handleProceedToStep2 = () => {
    if (selectedCatIds.length === 0) {
      toast({
        title: 'Escolha ao menos uma caixinha',
        description: 'Selecione as categorias que você deseja acompanhar.',
        variant: 'destructive',
      })
      return
    }
    setStep(2)
  }

  // Next from Step 2 to Step 3 (Save budgets to database)
  const handleProceedToStep3 = async () => {
    // Check if at least one selected category has a valid amount
    const invalidAmounts = selectedCatIds.filter((catId) => {
      const cents = parseCurrencyToCents(amounts[catId] || '0')
      return cents <= 0
    })

    if (invalidAmounts.length > 0) {
      toast({
        title: 'Verifique os valores',
        description: 'Defina um teto mensal válido para cada caixinha selecionada.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      // Find existing budgets for current month to update or create
      const existingBudgets = await budgetsService.list(currentMonth)

      for (const catId of selectedCatIds) {
        const cents = parseCurrencyToCents(amounts[catId] || '0')
        const targetCategory = availableCategories.find((c) => c.id === catId)
        const targetName = targetCategory?.name || 'Caixinha'
        const existing = existingBudgets.find((b) => b.category === catId || b.name === targetName)

        if (existing) {
          await budgetsService.update(existing.id, {
            name: existing.name || targetName,
            icon: existing.icon || targetCategory?.icon || 'wallet',
            color: existing.color || targetCategory?.color || '#0284c7',
            amount: cents,
            month: currentMonth,
          })
        } else {
          const newBudget = await budgetsService.create({
            name: targetName,
            icon: targetCategory?.icon || 'wallet',
            color: targetCategory?.color || '#0284c7',
            amount: cents,
            month: currentMonth,
          })
          // Cria vínculo automático para a categoria no novo modelo autônomo
          if (newBudget?.id && targetCategory?.name) {
            await categoryCaixinhaLinksService
              .create({
                budget: newBudget.id,
                category_name: targetCategory.name,
                category: targetCategory.id,
                active: true,
              })
              .catch(() => null)
          }
        }
      }

      setStep(3)
    } catch (err) {
      console.error('Erro ao salvar caixinhas:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os tetos das caixinhas. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Finish onboarding: marca bandeira de sessão e entrega ao WhatsApp
  const finishOnboarding = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
      toast({
        title: 'Configuração concluída!',
        description:
          'Tudo pronto. O Consciente está pronto para te ajudar como seu parceiro nas finanças!',
      })
      localStorage.setItem(ONBOARDING_WHATSAPP_HANDOFF_KEY, '1')
      setShowWhatsAppHandoff(true)
    } catch (err) {
      console.error(err)
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = finishOnboarding

  // Fim da entrega ao WhatsApp: navega para o Dashboard.
  const handleHandoffDone = () => {
    setShowWhatsAppHandoff(false)
    navigate('/')
  }

  // Skip onboarding entirely — também passa pela entrega ao WhatsApp,
  // pois o cliente novo precisa descobrir o canal principal mesmo pulando.
  const handleSkip = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
      localStorage.setItem(ONBOARDING_WHATSAPP_HANDOFF_KEY, '1')
      setShowWhatsAppHandoff(true)
    } catch {
      /* intentionally ignored */
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  const selectedCategoriesList = availableCategories.filter((c) => selectedCatIds.includes(c.id))

  const totalMonthlyCap = selectedCategoriesList.reduce((acc, cat) => {
    return acc + parseCurrencyToCents(amounts[cat.id] || '0')
  }, 0)

  const firstName = user?.name ? user.name.split(' ')[0] : 'você'

  // Tela de celebração + entrega ao WhatsApp (passo final, uma vez por sessão)
  if (showWhatsAppHandoff) {
    return <WhatsAppHandoff onDone={handleHandoffDone} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E4A5A] via-[#173F4D] to-[#1E4A5A] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-2xl my-auto">
        {/* Brand & Progress Bar */}
        <div className="mb-6 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs font-medium">
            <PiggyBank className="w-4 h-4 text-brand-gold" />
            <span>Configuração Inicial das Caixinhas</span>
          </div>

          {/* Stepper visual dots */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= 1 ? 'w-8 bg-brand-gold' : 'w-2 bg-slate-700'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= 2 ? 'w-8 bg-brand-gold' : 'w-2 bg-slate-700'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= 3 ? 'w-8 bg-brand-gold' : 'w-2 bg-slate-700'
              }`}
            />
          </div>
        </div>

        {/* Main Card */}
        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
                <p className="text-sm">Preparando suas caixinhas...</p>
              </div>
            ) : (
              <>
                {/* ================= PASSO 1: BOAS-VINDAS & CATEGORIAS ================= */}
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Conversational Bubble */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-gold text-[#1E4A5A] flex items-center justify-center shrink-0 shadow-lg shadow-brand-gold/30 mt-1">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl rounded-tl-sm text-sm text-slate-200 leading-relaxed shadow-sm">
                        <p className="font-semibold text-white">
                          Oi, {firstName}! Vamos montar suas caixinhas juntas? 😊
                        </p>
                        <p className="text-slate-300 text-xs sm:text-sm">
                          As <strong>caixinhas</strong> são a forma mais simples de manter o
                          controle dos seus custos. Escolha abaixo quais áreas do seu dia a dia você
                          gostaria de acompanhar este mês:
                        </p>
                      </div>
                    </div>

                    {/* Category Selection Grid */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                        <span>Escolha ou crie suas caixinhas para este mês:</span>
                        <span className="text-brand-gold font-medium">
                          {selectedCatIds.length} selecionada(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {availableCategories.map((cat) => {
                          const IconComp = getCaixinhaIconComponent(cat.icon)
                          const isSelected = selectedCatIds.includes(cat.id)

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategory(cat.id)}
                              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 relative group ${
                                isSelected
                                  ? 'bg-brand-petrol/40 border-brand-gold shadow-md shadow-black/40 text-white'
                                  : 'bg-slate-800/40 border-slate-750 border-slate-700/50 hover:bg-slate-800 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                                  style={{ backgroundColor: cat.color }}
                                >
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                                    isSelected
                                      ? 'bg-brand-petrol border-brand-gold text-white'
                                      : 'border-slate-600 bg-slate-800/60 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              </div>
                              <span className="text-xs font-semibold leading-tight truncate">
                                {cat.name}
                              </span>
                            </button>
                          )
                        })}

                        {/* Button to toggle inline creation card */}
                        {!isCreatingCustom && (
                          <button
                            type="button"
                            onClick={() => setIsCreatingCustom(true)}
                            className="p-3 rounded-xl border border-dashed border-brand-gold/40 hover:border-brand-gold hover:bg-brand-petrol/30 text-brand-gold hover:text-white transition-all flex flex-col justify-between items-start gap-2 text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-brand-gold/20 border border-brand-gold/30 text-brand-gold flex items-center justify-center group-hover:scale-105 transition-transform">
                              <Plus className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold block leading-tight text-white">
                                + Criar Caixinha
                              </span>
                              <span className="text-[10px] text-brand-gold/70 block mt-0.5">
                                Ex: Viagem a Paris
                              </span>
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Inline Custom Caixinha Creator Card */}
                      {isCreatingCustom && (
                        <div className="p-4 rounded-2xl bg-brand-petrol/30 border border-brand-gold/40 text-slate-200 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-brand-gold" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                Nova Caixinha Personalizada
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsCreatingCustom(false)}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              Cancelar
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-slate-300">
                                Nome da caixinha *
                              </label>
                              <Input
                                placeholder="Ex: Viagem a Paris, Casamento, Reforma..."
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className="h-9 bg-slate-900 border-slate-700 text-white text-xs placeholder:text-slate-500 focus-visible:ring-brand-petrol"
                                autoFocus
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-slate-300">
                                Sugestão de teto mensal (R$)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-[11px] font-semibold text-slate-400">
                                  R$
                                </span>
                                <Input
                                  value={customInitialCap}
                                  onChange={(e) =>
                                    setCustomInitialCap(maskCurrencyInput(e.target.value))
                                  }
                                  placeholder="1.500,00"
                                  className="h-9 pl-8 bg-slate-900 border-slate-700 text-white text-xs font-semibold tabular-nums focus-visible:ring-brand-petrol"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Icon selection row */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-slate-300">
                              Escolha o ícone
                            </label>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800">
                              {CAIXINHA_ICONS.slice(0, 14).map((iconOpt) => {
                                const Icon = iconOpt.icon
                                const isSelected = customIcon === iconOpt.id
                                return (
                                  <button
                                    key={iconOpt.id}
                                    type="button"
                                    onClick={() => setCustomIcon(iconOpt.id)}
                                    title={iconOpt.label}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                      isSelected
                                        ? 'bg-brand-petrol text-white ring-2 ring-brand-gold'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Color selection row */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">Cor:</span>
                              <div className="flex gap-1.5">
                                {CAIXINHA_COLORS.slice(0, 8).map((hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => setCustomColor(hex)}
                                    style={{ backgroundColor: hex }}
                                    className={`w-5 h-5 rounded-full transition-transform ${
                                      customColor === hex
                                        ? 'ring-2 ring-white scale-110'
                                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <Button
                              type="button"
                              onClick={handleCreateCustomCaixinha}
                              disabled={creatingLoading || !customName.trim()}
                              size="sm"
                              className="bg-brand-petrol hover:bg-brand-petrol-dark text-white text-xs h-8 px-4 shadow"
                            >
                              {creatingLoading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  Criando...
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5 mr-1.5" />
                                  Adicionar Caixinha
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 1 Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSkip}
                        disabled={saving}
                        className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 w-full sm:w-auto"
                      >
                        Pular e configurar depois
                      </Button>

                      <Button
                        type="button"
                        onClick={handleProceedToStep2}
                        className="bg-brand-petrol hover:bg-brand-petrol-dark text-white font-medium shadow-md shadow-brand-petrol/30 w-full sm:w-auto px-6 text-sm"
                      >
                        Continuar para os tetos
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ================= PASSO 2: TETO DE CADA CAIXINHA ================= */}
                {step === 2 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Conversational Bubble */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-gold text-[#1E4A5A] flex items-center justify-center shrink-0 shadow-lg shadow-brand-gold/30 mt-1">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl rounded-tl-sm text-sm text-slate-200 leading-relaxed shadow-sm">
                        <p className="font-semibold text-white">
                          Ótimo! Agora vamos definir o limite de cada caixinha 🎯
                        </p>
                        <p className="text-slate-300 text-xs sm:text-sm">
                          Quanto você pretende gastar no mês em cada uma? Deixei valores sugeridos
                          de exemplo para te inspirar — sinta-se à vontade para ajustar como quiser!
                        </p>
                      </div>
                    </div>

                    {/* Amounts Input List */}
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {selectedCategoriesList.map((cat) => {
                        const IconComp = getCaixinhaIconComponent(cat.icon)
                        const currentVal = amounts[cat.id] || ''
                        const suggestion = DEFAULT_AMOUNT_SUGGESTIONS[cat.name]

                        return (
                          <div
                            key={cat.id}
                            className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: cat.color }}
                              >
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-semibold text-white">{cat.name}</h4>
                                  {!DEFAULT_AMOUNT_SUGGESTIONS[cat.name] && (
                                    <span className="text-[10px] bg-brand-terracotta/20 text-brand-terracotta px-1.5 py-0.2 rounded border border-brand-terracotta/30 font-medium">
                                      Personalizada
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {suggestion
                                    ? `Exemplo comum: R$ ${suggestion}/mês`
                                    : 'Teto mensal definido por você'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {suggestion && suggestion !== currentVal && (
                                <button
                                  type="button"
                                  onClick={() => handleApplySuggestion(cat.id, suggestion)}
                                  className="text-[11px] text-brand-gold hover:brightness-110 hover:underline px-2 py-1 rounded bg-brand-petrol/40 border border-brand-gold/30"
                                  title="Aplicar valor sugerido"
                                >
                                  Usar R$ {suggestion}
                                </button>
                              )}

                              <div className="relative w-36">
                                <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">
                                  R$
                                </span>
                                <Input
                                  value={currentVal}
                                  onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                                  placeholder="0,00"
                                  className="pl-9 h-9 bg-slate-900 border-slate-700 text-white font-semibold text-sm tabular-nums text-right focus-visible:ring-brand-petrol"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Summary bar */}
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Total planejado nas caixinhas ({formatMonthName(currentMonth)}):
                      </span>
                      <span className="text-sm font-bold text-brand-gold tabular-nums">
                        {formatCurrency(totalMonthlyCap)}
                      </span>
                    </div>

                    {/* Step 2 Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(1)}
                        disabled={saving}
                        className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 w-full sm:w-auto"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        Voltar para categorias
                      </Button>

                      <Button
                        type="button"
                        onClick={handleProceedToStep3}
                        disabled={saving}
                        className="bg-brand-petrol hover:bg-brand-petrol-dark text-white font-medium shadow-md shadow-brand-petrol/30 w-full sm:w-auto px-6 text-sm"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Salvando caixinhas...
                          </>
                        ) : (
                          <>
                            Confirmar caixinhas
                            <ArrowRight className="w-4 h-4 ml-1.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* ================= PASSO 3: CONFIRMAÇÃO ACOLHEDORA ================= */}
                {step === 3 && (
                  <div className="space-y-6 text-center animate-in fade-in duration-300 py-2">
                    {/* Success icon badge */}
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/30">
                      <PiggyBank className="w-8 h-8" />
                    </div>

                    {/* Friendly conversational feedback */}
                    <div className="space-y-2 max-w-lg mx-auto">
                      <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        Suas caixinhas estão prontas! 🎉
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Perfeito, {firstName}! A partir de agora, cada despesa que você enviar no
                        WhatsApp ou registrar por aqui será somada automaticamente na sua caixinha
                        correspondente.
                      </p>
                      <p className="text-xs text-emerald-400 font-medium">
                        💡 Vou te avisar com carinho quando alguma caixinha estiver enchendo (ao
                        atingir 80% e 90% do teto).
                      </p>
                    </div>

                    {/* Quick review summary card */}
                    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left max-w-lg mx-auto space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-700/60 pb-2">
                        <span className="font-semibold text-slate-300">
                          {selectedCategoriesList.length} caixinhas ativas
                        </span>
                        <span className="text-brand-gold font-bold tabular-nums">
                          Teto total: {formatCurrency(totalMonthlyCap)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {selectedCategoriesList.map((cat) => (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between gap-1 p-1.5 rounded bg-slate-900/40 text-[11px]"
                          >
                            <span className="truncate text-slate-300">{cat.name}</span>
                            <span className="font-semibold text-white shrink-0">
                              R$ {amounts[cat.id]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step 3 Action */}
                    <div className="pt-4 flex flex-col items-center gap-3">
                      <Button
                        type="button"
                        onClick={handleFinish}
                        disabled={saving}
                        className="bg-brand-petrol hover:bg-brand-petrol-dark text-white font-medium shadow-lg shadow-brand-petrol/30 px-8 py-2.5 text-base w-full sm:w-auto"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Finalizando...
                          </>
                        ) : (
                          <>
                            Começar agora
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                      <span className="text-[11px] text-slate-400">
                        Você pode refazer ou editar essas caixinhas quando quiser em Minha Conta.
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Onboarding
