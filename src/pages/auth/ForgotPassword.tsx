import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
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
import { Bot, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react'

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return

    setIsLoading(true)
    setError(null)

    try {
      await pb.collection('users').requestPasswordReset(email)
      setSubmitted(true)
    } catch (err: unknown) {
      console.error(err)
      setError('Não foi possível enviar o email de recuperação. Verifique o endereço digitado.')
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Recuperar Senha</h1>
          <p className="text-sm text-indigo-300 font-medium mt-1">
            Consciente - Seu parceiro nas finanças
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Enviaremos as instruções de redefinição para sua caixa de entrada
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md">
          {submitted ? (
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Email enviado!</h2>
              <p className="text-sm text-slate-300">
                Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link seguro
                do <strong>Consciente</strong> para redefinir sua senha em instantes.
              </p>
              <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-500 text-white mt-4">
                <Link to="/login">Voltar ao Login</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-semibold text-white">
                  Esqueci minha senha
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Informe o email associado à sua conta do Consciente
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
                    <Label htmlFor="email" className="text-xs text-slate-300">
                      Email cadastrado
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={isLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="pt-0 flex justify-center border-t border-slate-800/80 py-4">
                <Link
                  to="/login"
                  className="text-sm text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o Login
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default ForgotPassword
