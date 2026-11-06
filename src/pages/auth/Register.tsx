import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bot, Loader2, AlertCircle, CheckCircle2, ArrowRight, Eye } from 'lucide-react'
import { EyeClosedIcon } from '@/components/icons/EyeClosedIcon'

export const Register: React.FC = () => {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptRecurring, setAcceptRecurring] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    cpf: false,
    birthDate: false,
    password: false,
    confirm: false,
    terms: false,
    recurring: false,
  })

  // Validação de CPF com dígitos verificadores
  const validateCpf = (str: string): boolean => {
    const clean = str.replace(/\D/g, '')
    if (clean.length !== 11) return false
    if (/^(\d)\1{10}$/.test(clean)) return false
    let sum = 0
    let rest = 0
    for (let i = 1; i <= 9; i++) sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i)
    rest = (sum * 10) % 11
    if (rest === 10 || rest === 11) rest = 0
    if (rest !== parseInt(clean.substring(9, 10), 10)) return false
    sum = 0
    for (let i = 1; i <= 10; i++) sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i)
    rest = (sum * 10) % 11
    if (rest === 10 || rest === 11) rest = 0
    if (rest !== parseInt(clean.substring(10, 11), 10)) return false
    return true
  }

  // Validação de Maioridade 18+
  const validateAge18 = (dateStr: string): boolean => {
    if (!dateStr) return false
    const parts = dateStr.split('-')
    if (parts.length !== 3) return false
    const birth = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    )
    if (isNaN(birth.getTime())) return false
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age >= 18
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPassValid = password.length >= 8
  const isConfirmValid = password === confirmPassword && confirmPassword.length > 0
  const isNameValid = name.trim().length >= 2
  const isCpfValid = validateCpf(cpf)
  const isAgeValid = validateAge18(birthDate)
  const isTermsValid = acceptTerms
  const isRecurringValid = acceptRecurring

  const formatCpfInput = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 11)
    if (clean.length <= 3) return clean
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`
  }

  const formatCepInput = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 8)
    if (clean.length <= 5) return clean
    return `${clean.slice(0, 5)}-${clean.slice(5)}`
  }

  const handleCepBlur = async () => {
    const clean = zipCode.replace(/\D/g, '')
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
        const data = await res.json()
        if (!data.erro) {
          if (data.logradouro) setStreet(data.logradouro)
          if (data.bairro) setNeighborhood(data.bairro)
          if (data.localidade) setCity(data.localidade)
          if (data.uf) setState(data.uf)
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({
      name: true,
      email: true,
      cpf: true,
      birthDate: true,
      password: true,
      confirm: true,
      terms: true,
      recurring: true,
    })

    if (!isNameValid || !isEmailValid || !isPassValid || !isConfirmValid) return
    if (!isCpfValid) {
      setError('CPF inválido. Verifique os 11 dígitos.')
      return
    }
    if (!isAgeValid) {
      setError('Você deve ter pelo menos 18 anos completos para se cadastrar.')
      return
    }
    if (!isTermsValid) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
      return
    }
    if (!isRecurringValid) {
      setError('Você precisa confirmar o consentimento de cobrança recorrente.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const nowIso = new Date().toISOString()
      const cleanCpf = cpf.replace(/\D/g, '')
      await register(name, email, password, phone, {
        full_name: name.trim(),
        cpf: cleanCpf,
        birth_date: birthDate,
        zip_code: zipCode.replace(/\D/g, ''),
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        terms_accepted_at: nowIso,
        recurring_consent_accepted_at: nowIso,
        subscription_status: 'trial',
      })
      setSuccess(true)
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('cpf')) {
        setError('Este CPF já está cadastrado em outra conta.')
      } else {
        setError('Erro ao criar conta. Este email ou CPF já pode estar cadastrado.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Header brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Criar Conta no Consciente
          </h1>
          <p className="text-sm text-indigo-300 font-medium mt-1">
            Consciente - Seu parceiro nas finanças
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Controle de custos diários e caixinhas direto pelo WhatsApp e Web
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md">
          {success ? (
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Conta criada com sucesso!</h2>
              <p className="text-sm text-slate-300">
                Enviamos um link de confirmação do <strong>Consciente</strong> para o email{' '}
                <strong>{email}</strong>. Você já pode fazer login na plataforma.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white mt-4"
              >
                Ir para o Login
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-semibold text-white">Cadastre-se</CardTitle>
                <CardDescription className="text-slate-400">
                  Preencha os campos para iniciar seu controle financeiro
                </CardDescription>
              </CardHeader>

              <CardContent>
                {error && (
                  <Alert
                    variant="destructive"
                    className="mb-4 bg-red-950/60 border-red-800 text-red-200"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-slate-300">
                      Nome completo
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                      className={`bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 ${
                        touched.name && !isNameValid ? 'border-red-500' : ''
                      }`}
                      disabled={isLoading}
                    />
                    {touched.name && !isNameValid && (
                      <p className="text-xs text-red-400">Informe ao menos 2 caracteres</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-slate-300">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                      className={`bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 ${
                        touched.email && !isEmailValid ? 'border-red-500' : ''
                      }`}
                      disabled={isLoading}
                    />
                    {touched.email && !isEmailValid && (
                      <p className="text-xs text-red-400">Formato de email inválido</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="phone" className="text-xs text-slate-300">
                        WhatsApp (com DDD)
                      </Label>
                      <span className="text-[11px] text-indigo-300 font-normal">Recomendado</span>
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 94998-9868"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={isLoading}
                    />
                    <p className="text-[11px] text-slate-400">
                      O número que você usa para enviar gastos ao Consciente no WhatsApp
                    </p>
                  </div>

                  {/* CPF e Data de Nascimento (Validação 18+) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf" className="text-xs text-slate-300">
                        CPF (obrigatório)
                      </Label>
                      <Input
                        id="cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                        onBlur={() => setTouched((p) => ({ ...p, cpf: true }))}
                        className={`bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 ${
                          touched.cpf && !isCpfValid ? 'border-red-500' : ''
                        }`}
                        disabled={isLoading}
                      />
                      {touched.cpf && !isCpfValid && (
                        <p className="text-xs text-red-400">CPF inválido (11 dígitos válidos)</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="birthDate" className="text-xs text-slate-300">
                        Nascimento (18+ anos)
                      </Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        onBlur={() => setTouched((p) => ({ ...p, birthDate: true }))}
                        className={`bg-slate-800/80 border-slate-700 text-white ${
                          touched.birthDate && !isAgeValid ? 'border-red-500' : ''
                        }`}
                        disabled={isLoading}
                      />
                      {touched.birthDate && !isAgeValid && (
                        <p className="text-xs text-red-400">Necessário ter 18+ anos</p>
                      )}
                    </div>
                  </div>

                  {/* Endereço completo */}
                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <p className="text-xs font-semibold text-slate-300">Endereço de cobrança</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <Input
                          id="zipCode"
                          type="text"
                          placeholder="CEP"
                          value={zipCode}
                          onChange={(e) => setZipCode(formatCepInput(e.target.value))}
                          onBlur={handleCepBlur}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          id="street"
                          type="text"
                          placeholder="Rua / Logradouro"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          id="number"
                          type="text"
                          placeholder="Número"
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          id="complement"
                          type="text"
                          placeholder="Complemento (Apto, bloco)"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          id="neighborhood"
                          type="text"
                          placeholder="Bairro"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Input
                          id="city"
                          type="text"
                          placeholder="Cidade"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Input
                          id="state"
                          type="text"
                          placeholder="UF"
                          maxLength={2}
                          value={state}
                          onChange={(e) => setState(e.target.value.toUpperCase())}
                          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs uppercase"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs text-slate-300">
                      Senha (mínimo 8 caracteres)
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                        className={`bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 pr-10 ${
                          touched.password && !isPassValid ? 'border-red-500' : ''
                        }`}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-r-md flex items-center justify-center"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <EyeClosedIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {touched.password && !isPassValid && (
                      <p className="text-xs text-red-400">Mínimo de 8 caracteres</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs text-slate-300">
                      Confirmar Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
                        className={`bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 pr-10 ${
                          touched.confirm && !isConfirmValid ? 'border-red-500' : ''
                        }`}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-r-md flex items-center justify-center"
                        tabIndex={-1}
                        aria-label={
                          showConfirmPassword
                            ? 'Ocultar confirmação de senha'
                            : 'Mostrar confirmação de senha'
                        }
                      >
                        {showConfirmPassword ? (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <EyeClosedIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {touched.confirm && !isConfirmValid && (
                      <p className="text-xs text-red-400">As senhas não coincidem</p>
                    )}
                  </div>

                  {/* Aceites com data/hora obrigatórios */}
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                        disabled={isLoading}
                      />
                      <span>
                        Li e concordo com os <strong className="text-white">Termos de Uso</strong> e
                        a <strong className="text-white">Política de Privacidade</strong> do
                        Consciente.
                      </span>
                    </label>
                    {touched.terms && !isTermsValid && (
                      <p className="text-xs text-red-400">Aceite dos termos é obrigatório</p>
                    )}

                    <label className="flex items-start gap-2 cursor-pointer text-xs text-amber-200/90 bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                      <input
                        type="checkbox"
                        checked={acceptRecurring}
                        onChange={(e) => setAcceptRecurring(e.target.checked)}
                        className="mt-0.5 rounded border-amber-600/50 bg-slate-800 text-amber-500 focus:ring-amber-500"
                        disabled={isLoading}
                      />
                      <span>
                        <strong className="text-amber-300">
                          Consentimento de cobrança recorrente:
                        </strong>{' '}
                        Concordo com a renovação automática da assinatura mensal ou anual ao fim de
                        cada período, no valor contratado, podendo cancelar a qualquer momento sem
                        burocracia com 1 clique.
                      </span>
                    </label>
                    {touched.recurring && !isRecurringValid && (
                      <p className="text-xs text-red-400">Consentimento expresso é obrigatório</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="pt-0 flex justify-center border-t border-slate-800/80 py-4">
                <p className="text-sm text-slate-400">
                  Já tem conta?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                  >
                    Entrar
                  </Link>
                </p>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default Register
