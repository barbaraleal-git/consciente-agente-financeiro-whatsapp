import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface AuthUser extends RecordModel {
  email: string
  name?: string
  avatar?: string
  phone?: string
  onboarding_completed?: boolean
  role?: 'client' | 'admin'
  full_name?: string
  cpf?: string
  birth_date?: string
  subscription_status?: 'trial' | 'active' | 'carencia' | 'bloqueado' | 'cancelado'
  subscription_plan?: 'mensal' | 'anual'
  subscription_expires_at?: string
  carencia_until?: string
  access_until?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<void>
  register: (
    name: string,
    email: string,
    pass: string,
    phone?: string,
    extraFields?: Record<string, unknown>,
  ) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  completeOnboarding: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Um erro de authRefresh só é FATAL para a sessão quando a mensagem do
 * backend fala explicitamente de token/autenticação. 400 genérico (ex.:
 * filtro malformado numa consulta de dados, validação de campo) NÃO é.
 */
function isSessionFatalError(err: unknown, status?: number): boolean {
  if (status === 401) return true
  if (status !== 400) return false
  const body = (err as { response?: unknown })?.response
  let msg = ''
  if (typeof body === 'string') {
    msg = body
  } else if (body && typeof body === 'object') {
    const o = body as { message?: unknown; error?: unknown }
    msg = typeof o.message === 'string' ? o.message : typeof o.error === 'string' ? o.error : ''
  }
  if (!msg) msg = err instanceof Error ? err.message : ''
  return /token|authentication|authorization|expired|invalid session|sessão|credencia/i.test(msg)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(
    (pb.authStore.record as unknown as AuthUser) || null,
  )
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    // Initial sync
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(pb.authStore.record as unknown as AuthUser)
      setToken(pb.authStore.token)
    } else {
      setUser(null)
      setToken(null)
    }
    setIsLoading(false)

    // Listen to store updates
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setToken(token)
      setUser(model as unknown as AuthUser)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const clearLocalCaches = () => {
    try {
      if (typeof window !== 'undefined') {
        // Limpa possíveis chaves legadas de cache em localStorage e sessionStorage
        // sem apagar a chave oficial de auth do pocketbase (pocketbase_auth)
        const keysToPreserve = ['pocketbase_auth']
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key && !keysToPreserve.includes(key)) {
            localStorage.removeItem(key)
          }
        }
        sessionStorage.clear()
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const login = async (email: string, pass: string) => {
    clearLocalCaches()
    const authData = await pb.collection('users').authWithPassword<AuthUser>(email, pass)
    setUser(authData.record)
    setToken(authData.token)
  }

  const register = async (
    name: string,
    email: string,
    pass: string,
    phone?: string,
    extraFields?: Record<string, unknown>,
  ) => {
    // Garante que não haja sessão residual antes de registrar nova conta
    pb.authStore.clear()
    setUser(null)
    setToken(null)
    clearLocalCaches()

    const cleanPhone = phone ? phone.replace(/\D/g, '') : ''

    await pb.collection('users').create({
      email,
      name,
      phone: cleanPhone,
      password: pass,
      passwordConfirm: pass,
      ...(extraFields || {}),
    })
    // Request verification email
    try {
      await pb.collection('users').requestVerification(email)
    } catch (e) {
      console.warn('Email verification request error:', e)
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
    clearLocalCaches()
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      try {
        const updated = await pb.collection('users').authRefresh<AuthUser>()
        setUser(updated.record)
      } catch (err) {
        // Só derruba a sessão quando o servidor diz que o token é
        // definitivamente inválido. Isso é 401 (não autenticado) — ou 400
        // cuja mensagem trate explicitamente de token/autorização.
        // QUALQUER outro erro — 429 (rate limit), 5xx, falha de rede e,
        // em especial, 400 de VALIDAÇÃO DE DADOS em consultas do app —
        // NÃO deslogam: um filtro malformado numa consulta de transações
        // (bug v0.0.181) derrubava a sessão inteira e jogava a dona para
        // /login com "tudo zerado", apesar dos dados intactos na base.
        const status = (err as { status?: number })?.status
        if (isSessionFatalError(err, status)) {
          logout()
          return
        }
        console.warn('authRefresh falhou de forma transitória, tentando novamente:', err)
        // Uma única tentativa com espera curta resolve o 429 do rate limiter.
        await new Promise((resolve) => setTimeout(resolve, 1500))
        try {
          const retry = await pb.collection('users').authRefresh<AuthUser>()
          setUser(retry.record)
        } catch (retryErr) {
          if (isSessionFatalError(retryErr, (retryErr as { status?: number })?.status)) {
            logout()
          } else {
            console.warn('authRefresh transitório persistiu, sessão preservada:', retryErr)
          }
        }
      }
    }
  }

  const completeOnboarding = async () => {
    if (user?.id) {
      const updated = await pb.collection('users').update<AuthUser>(user.id, {
        onboarding_completed: true,
      })
      setUser(updated)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && pb.authStore.isValid,
        login,
        register,
        logout,
        refreshUser,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
