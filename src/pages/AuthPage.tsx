import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, User } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { isSupabaseConfigured, useAuth } from '../context/AuthContext'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, demoMode, loading, signIn, signUp, resetPassword, enterDemo } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isRegister = mode === 'register'

  if (loading) return <div className="global-loader"><span/><p>Checking your session…</p></div>
  if (user || demoMode) return <Navigate to="/app" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (isRegister) {
        const signedIn = await signUp(name, email, password)
        if (!signedIn) {
          setNotice('Check your email to confirm the account, then sign in to open your workspace.')
          return
        }
      } else {
        await signIn(email, password)
      }
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  async function requestPasswordReset() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await resetPassword(email)
      setNotice('Password reset instructions were sent to your email address.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send password reset instructions')
    } finally {
      setBusy(false)
    }
  }

  function startDemo() {
    enterDemo()
    navigate('/app')
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <Link to="/" className="auth-back"><ArrowLeft size={17} /> Back to home</Link>
        <div className="auth-brand-copy">
          <Logo />
          <h1>{isRegister ? 'Make every vehicle work harder.' : 'Welcome back to smarter loading.'}</h1>
          <p>Plan balanced, space-efficient loads with a constraint-aware 3D optimizer your operations team can actually use.</p>
          <div className="auth-benefits">
            <span><Check /> Interactive 3D load plans</span>
            <span><Check /> Vehicle and product library</span>
            <span><Check /> Utilization and balance reporting</span>
          </div>
        </div>
        <div className="auth-quote">“The best logistics tools make a complex decision feel obvious.”</div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-logo"><Logo /></div>
          <span className="auth-kicker">{isRegister ? 'Create your account' : 'Sign in to your workspace'}</span>
          <h2>{isRegister ? 'Start optimizing loads' : 'Good to see you again'}</h2>
          <p className="auth-subtitle">{isRegister ? 'Set up your logistics workspace in less than a minute.' : 'Enter your details to continue to your dashboard.'}</p>
          <form onSubmit={submit} className="auth-form">
            {isRegister && <label>Full name<div className="input-wrap"><User size={18} /><input required value={name} onChange={e => setName(e.target.value)} placeholder="Rajveer Singh" /></div></label>}
            <label>Work email<div className="input-wrap"><Mail size={18} /><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></div></label>
            <label>Password<div className="input-wrap"><LockKeyhole size={18} /><input required minLength={8} autoComplete={isRegister ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {!isRegister && <div className="form-row"><span /><button type="button" className="text-button" disabled={busy} onClick={requestPasswordReset}>Forgot password?</button></div>}
            {error && <div className="form-error">{error}</div>}
            {notice && <div className="form-notice">{notice}</div>}
            <button className="button auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
          </form>
          <div className="divider"><span>or</span></div>
          <button type="button" className="button button-outline auth-submit" onClick={startDemo}>Explore demo workspace</button>
          {!isSupabaseConfigured && <p className="config-note">Demo mode is available. Add Supabase environment variables to enable real accounts.</p>}
          <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to LoadWise AI?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create account'}</Link></p>
        </div>
      </div>
    </div>
  )
}
