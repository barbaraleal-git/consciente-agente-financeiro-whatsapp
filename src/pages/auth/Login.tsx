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
import { Loader2, AlertCircle, ArrowRight, Eye } from 'lucide-react' // eslint-disable-line -- Eye/Closed usados abaixo
import { EyeClosedIcon } from '@/components/icons/EyeClosedIcon'
import { BrandLogoCard } from '@/components/brand/BrandLogo'

export const Login: React.FC = () => {
  const { login, isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Real-time field validation errors
  const [emailTouched, setEmailTouched] = useState(false)
  const [passTouched, setPassTouched] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPassValid = password.length >= 8

  // Se o usuário já está autenticado neste navegador, permite continuar ou sair
  const handleContinueAsActiveUser = () => {
    navigate('/')
  }

  const handleSwitchAccount = () => {
    logout()
    setEmail('')
    setPassword('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailTouched(true)
    setPassTouched(true)

    if (!isEmailValid || !isPassValid) return

    setIsLoading(true)
    setError(null)

    try {
      await login(email, password)
      navigate('/')
    } catch (err: unknown) {
      console.error(err)
      setError('Credenciais inválidas. Verifique seu email e senha e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-cream via-[#FDFBF5] to-brand-cream p-4">
      <div className="w-full max-w-md">
        {/* Header brand — logo completo oficial (balão+sol, nome e tagline) */}
        <div className="flex justify-center mb-8 animate-in zoom-in duration-300">
          <BrandLogoCard title="Consciente — Seu Parceiro nas Finanças" />
        </div>
        <p className="text-center text-xs text-slate-500 -mt-4 mb-8">
          Controle inteligente de custos e caixinhas em tempo real
        </p>

        {isAuthenticated && user && (
          <div className="mb-4 p-4 rounded-xl border border-brand-petrol/30 bg-brand-petrol/5 backdrop-blur-md text-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Sessão já conectada neste navegador:</p>
                <p className="text-sm font-semibold text-brand-petrol-dark truncate">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSwitchAccount}
                  className="border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs h-8"
                >
                  Sair / Trocar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleContinueAsActiveUser}
                  className="bg-brand-petrol hover:bg-brand-petrol-dark text-white text-xs h-8"
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        )}

        <Card className="border-brand-cream bg-white/95 text-slate-800 shadow-2xl backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-brand-petrol-dark">
              Bem-vindo de volta
            </CardTitle>
            <CardDescription className="text-slate-500">
              Acesse sua conta para continuar gerenciando seus custos
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={`bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-brand-petrol ${
                    emailTouched && !isEmailValid ? 'border-red-500' : ''
                  }`}
                  disabled={isLoading}
                />
                {emailTouched && !isEmailValid && (
                  <p className="text-xs text-red-400">Formato de email inválido</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-slate-300">
                    Senha
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-petrol hover:text-brand-petrol-dark hover:underline transition-colors"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPassTouched(true)}
                    className={`bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-brand-petrol pr-10 ${
                      passTouched && !isPassValid ? 'border-red-500' : ''
                    }`}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-petrol rounded-r-md flex items-center justify-center"
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
                {passTouched && !isPassValid && (
                  <p className="text-xs text-red-400">A senha deve ter no mínimo 8 caracteres</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-petrol hover:bg-brand-petrol-dark text-white font-medium shadow-md shadow-brand-petrol/30 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar no Painel
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-0 flex justify-center border-t border-brand-cream py-4">
            <p className="text-sm text-slate-500">
              Não tem conta?{' '}
              <Link
                to="/register"
                className="font-medium text-brand-petrol hover:text-brand-petrol-dark underline underline-offset-4"
              >
                Cadastre-se gratuitamente
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default Login
