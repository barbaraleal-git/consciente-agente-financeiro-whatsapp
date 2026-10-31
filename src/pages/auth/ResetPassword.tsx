import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bot, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Token de redefinição não encontrado ou expirado.')
      return
    }
    if (password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await pb.collection('users').confirmPasswordReset(token, password, confirmPassword)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      console.error(err)
      setError('Não foi possível redefinir a senha. O link pode ter expirado.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Redefinir Senha</h1>
          <p className="text-sm text-indigo-300 font-medium mt-1">
            Consciente - Seu parceiro nas finanças
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md">
          {success ? (
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Senha alterada com sucesso!</h2>
              <p className="text-sm text-slate-300">
                Sua senha foi atualizada. Redirecionando para o login em instantes...
              </p>
              <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-500 text-white mt-4">
                <Link to="/login">Ir para o Login</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-semibold text-white">Criar Nova Senha</CardTitle>
                <CardDescription className="text-slate-400">
                  Digite sua nova senha abaixo para restaurar o acesso
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

                {!token && (
                  <Alert className="mb-4 bg-amber-950/60 border-amber-800 text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nenhum token encontrado na URL. Use o link recebido por email.
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs text-slate-300">
                      Nova Senha (mín. 8 caracteres)
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 pr-10"
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
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs text-slate-300">
                      Confirmar Nova Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 pr-10"
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
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !token}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      'Redefinir Senha'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default ResetPassword
