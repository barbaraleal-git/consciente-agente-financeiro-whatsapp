import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { categoriesService, budgetsService, type Category } from '@/services/finance'
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
  Utensils,
  Car,
  Home,
  HeartPulse,
  Gamepad,
  Book,
  ShoppingBag,
  Film,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  PiggyBank,
  Bot,
  HelpCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react'

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

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'utensils':
      return Utensils
    case 'car':
      return Car
    case 'home':
      return Home
    case 'heart-pulse':
      return HeartPulse
    case 'gamepad':
      return Gamepad
    case 'book':
      return Book
    case 'shopping-bag':
      return ShoppingBag
    case 'film':
      return Film
    default:
      return PiggyBank
  }
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
        const existing = existingBudgets.find((b) => b.category === catId)

        if (existing) {
          await budgetsService.update(existing.id, {
            amount: cents,
            month: currentMonth,
          })
        } else {
          await budgetsService.create({
            category: catId,
            amount: cents,
            month: currentMonth,
          })
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

  // Finish onboarding and redirect to dashboard
  const handleFinish = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
      toast({
        title: 'Caixinhas configuradas!',
        description: 'Tudo pronto. O Agente Financeiro está pronto para te ajudar!',
      })
      navigate('/')
    } catch (err) {
      console.error(err)
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  // Skip onboarding entirely
  const handleSkip = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
    } catch {
      /* intentionally ignored */
    }
    navigate('/')
  }

  const selectedCategoriesList = availableCategories.filter((c) => selectedCatIds.includes(c.id))

  const totalMonthlyCap = selectedCategoriesList.reduce((acc, cat) => {
    return acc + parseCurrencyToCents(amounts[cat.id] || '0')
  }, 0)

  const firstName = user?.name ? user.name.split(' ')[0] : 'você'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-2xl my-auto">
        {/* Brand & Progress Bar */}
        <div className="mb-6 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-medium">
            <PiggyBank className="w-4 h-4 text-indigo-400" />
            <span>Configuração Inicial das Caixinhas</span>
          </div>

          {/* Stepper visual dots */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= 1 ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-700'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= 2 ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-700'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= 3 ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-700'
              }`}
            />
          </div>
        </div>

        {/* Main Card */}
        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="text-sm">Preparando suas caixinhas...</p>
              </div>
            ) : (
              <>
                {/* ================= PASSO 1: BOAS-VINDAS & CATEGORIAS ================= */}
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Conversational Bubble */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30 mt-1">
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                        <span>Selecione as caixinhas que fazem sentido para você:</span>
                        <span className="text-indigo-400 font-medium">
                          {selectedCatIds.length} selecionada(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {availableCategories.map((cat) => {
                          const IconComp = getCategoryIcon(cat.icon)
                          const isSelected = selectedCatIds.includes(cat.id)

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategory(cat.id)}
                              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 relative group ${
                                isSelected
                                  ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-950/40 text-white'
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
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'border-slate-600 bg-slate-800/60 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              </div>
                              <span className="text-xs font-semibold leading-tight">
                                {cat.name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
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
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 w-full sm:w-auto px-6 text-sm"
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
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30 mt-1">
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
                        const IconComp = getCategoryIcon(cat.icon)
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
                                <h4 className="text-xs font-semibold text-white">{cat.name}</h4>
                                <span className="text-[11px] text-slate-400">
                                  {suggestion
                                    ? `Exemplo comum: R$ ${suggestion}/mês`
                                    : 'Teto mensal'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {suggestion && suggestion !== currentVal && (
                                <button
                                  type="button"
                                  onClick={() => handleApplySuggestion(cat.id, suggestion)}
                                  className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline px-2 py-1 rounded bg-indigo-950/40 border border-indigo-900/60"
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
                                  className="pl-9 h-9 bg-slate-900 border-slate-700 text-white font-semibold text-sm tabular-nums text-right focus-visible:ring-indigo-500"
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
                      <span className="text-sm font-bold text-indigo-400 tabular-nums">
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
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 w-full sm:w-auto px-6 text-sm"
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
                        <span className="text-indigo-400 font-bold tabular-nums">
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
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 px-8 py-2.5 text-base w-full sm:w-auto"
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
                        Você pode refazer ou editar essas caixinhas quando quiser na aba de Ajustes.
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
