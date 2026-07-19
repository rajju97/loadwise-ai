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
  signOut: () => Promise<void>
  enterDemo: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const DEMO_KEY = 'loadwise-demo-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(localStorage.getItem(DEMO_KEY) === '1')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    demoMode,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Use demo mode or add environment variables.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(name, email, password) {
      if (!supabase) throw new Error('Supabase is not configured. Use demo mode or add environment variables.')
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      if (error) throw error
      return Boolean(data.session)
    },
    async signOut() {
      localStorage.removeItem(DEMO_KEY)
      setDemoMode(false)
      if (supabase) await supabase.auth.signOut()
    },
    enterDemo() {
      localStorage.setItem(DEMO_KEY, '1')
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
