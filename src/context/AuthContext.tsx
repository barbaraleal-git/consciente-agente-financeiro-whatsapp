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
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  completeOnboarding: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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

  const register = async (name: string, email: string, pass: string, phone?: string) => {
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
      } catch {
        logout()
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
