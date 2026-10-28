import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bot, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Token de verificação ausente na URL.')
      return
    }

    pb.collection('users')
      .confirmVerification(token)
      .then(() => {
        setSuccess(true)
      })
      .catch((err) => {
        console.error(err)
        setError(
          'Não foi possível verificar o email. O link pode ter expirado ou já foi utilizado.',
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Verificação de Email</h1>
        </div>

        <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-semibold text-white">
              Status da Verificação
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-4 text-center space-y-4">
            {loading && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-300">Validando seu email...</p>
              </div>
            )}

            {!loading && success && (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-semibold text-white">Email verificado com sucesso!</h2>
                <p className="text-sm text-slate-300">
                  Sua conta foi confirmada. Agora você pode acessar o painel financeiro.
                </p>
                <Button
                  asChild
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white mt-4"
                >
                  <Link to="/login">Ir para o Login</Link>
                </Button>
              </>
            )}

            {!loading && error && (
              <>
                <Alert
                  variant="destructive"
                  className="bg-red-950/60 border-red-800 text-red-200 text-left"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-slate-700 text-slate-200 mt-4"
                >
                  <Link to="/login">Voltar ao Login</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default VerifyEmail
