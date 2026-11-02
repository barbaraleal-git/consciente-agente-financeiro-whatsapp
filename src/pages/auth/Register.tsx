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
    password: false,
    confirm: false,
  })

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPassValid = password.length >= 8
  const isConfirmValid = password === confirmPassword && confirmPassword.length > 0
  const isNameValid = name.trim().length >= 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true, confirm: true })

    if (!isNameValid || !isEmailValid || !isPassValid || !isConfirmValid) return

    setIsLoading(true)
    setError(null)

    try {
      await register(name, email, password, phone)
      setSuccess(true)
    } catch (err: unknown) {
      console.error(err)
      setError('Erro ao criar conta. Este email já pode estar cadastrado.')
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
