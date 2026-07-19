import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  demoMode: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  enterDemo: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const DEMO_KEY = 'loadwise-demo-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
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

    const initialize = async () => {
      try {
        const { data, error } = await client.auth.getSession()
        if (error) throw error
        if (!active) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
      } catch (error) {
        console.error('Unable to restore Supabase session', error)
        if (!active) return
        setSession(null)
        setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void initialize()
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
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
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Use demo mode or add environment variables.')
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      try { localStorage.removeItem(DEMO_KEY) } catch { /* storage may be unavailable */ }
      setDemoMode(false)
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
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw error
    },
    async signOut() {
      try { localStorage.removeItem(DEMO_KEY) } catch { /* storage may be unavailable */ }
      setDemoMode(false)
      if (supabase) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
      setSession(null)
      setUser(null)
    },
    enterDemo() {
      try { localStorage.setItem(DEMO_KEY, '1') } catch { /* storage may be unavailable */ }
      setDemoMode(true)
    },
  }), [user, session, loading, demoMode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export { isSupabaseConfigured }
