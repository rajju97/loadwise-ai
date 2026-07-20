import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  demoMode: boolean
  recoveryMode: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  enterDemo: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const DEMO_KEY = 'loadwise-demo-session'

function clearDemoSession(): void {
  try { localStorage.removeItem(DEMO_KEY) } catch { /* storage may be unavailable */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [demoMode, setDemoMode] = useState(() => {
    try { return localStorage.getItem(DEMO_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    let active = true
    const client = supabase
    if (!client) {
      setLoading(false)
      return
    }

    const applySession = (nextSession: Session | null, event?: AuthChangeEvent) => {
      if (!active) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setRecoveryMode(event === 'PASSWORD_RECOVERY')
      if (nextSession) {
        clearDemoSession()
        setDemoMode(false)
      }
      setLoading(false)
    }

    const initialize = async () => {
      try {
        const { data, error } = await client.auth.getSession()
        if (error) throw error
        applySession(data.session)
      } catch (error) {
        console.error('Unable to restore Supabase session', error)
        if (!active) return
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    }

    void initialize()
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession, event)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    demoMode,
    recoveryMode,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Use demo mode or add environment variables.')
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      clearDemoSession()
      setDemoMode(false)
      setRecoveryMode(false)
    },
    async signUp(name, email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Use demo mode or add environment variables.')
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) throw error
      return Boolean(data.session)
    },
    async resetPassword(email) {
      if (!supabase) throw new Error('Supabase is not configured.')
      const normalizedEmail = email.trim()
      if (!normalizedEmail) throw new Error('Enter your email address first.')
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
    async updatePassword(password) {
      if (!supabase) throw new Error('Supabase is not configured.')
      if (password.length < 8) throw new Error('Password must contain at least 8 characters.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setRecoveryMode(false)
    },
    async signOut() {
      clearDemoSession()
      setDemoMode(false)
      setRecoveryMode(false)
      let signOutError: Error | null = null
      if (supabase) {
        const { error } = await supabase.auth.signOut()
        if (error) signOutError = error
      }
      setSession(null)
      setUser(null)
      if (signOutError) throw signOutError
    },
    enterDemo() {
      try { localStorage.setItem(DEMO_KEY, '1') } catch { /* storage may be unavailable */ }
      setRecoveryMode(false)
      setDemoMode(true)
    },
  }), [user, session, loading, demoMode, recoveryMode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export { isSupabaseConfigured }
