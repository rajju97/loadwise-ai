import { ArrowRight, Check, LockKeyhole } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)

  if (loading) return <div className="global-loader"><span/><p>Validating recovery link…</p></div>

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setUpdated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <Link to="/" className="auth-back">Back to home</Link>
        <div className="auth-brand-copy">
          <Logo />
          <h1>Secure your workspace access.</h1>
          <p>Choose a new password for your LoadWise AI account.</p>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-logo"><Logo /></div>
          <span className="auth-kicker">Password recovery</span>
          <h2>{updated ? 'Password updated' : 'Create a new password'}</h2>
          {!user ? (
            <>
              <p className="auth-subtitle">This recovery link is invalid or has expired. Request a new link from the sign-in page.</p>
              <Link className="button auth-submit" to="/login">Return to sign in <ArrowRight size={17}/></Link>
            </>
          ) : updated ? (
            <>
              <div className="form-notice"><Check size={17}/> Your password was updated successfully.</div>
              <button className="button auth-submit" onClick={() => navigate('/app')}>Continue to workspace <ArrowRight size={17}/></button>
            </>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <label>New password<div className="input-wrap"><LockKeyhole size={18}/><input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters"/></div></label>
              <label>Confirm password<div className="input-wrap"><LockKeyhole size={18}/><input required minLength={8} autoComplete="new-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repeat new password"/></div></label>
              {error && <div className="form-error">{error}</div>}
              <button className="button auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={17}/></button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
