import { useLayoutEffect, useState } from 'react'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { clearSession } from '../utils/auth'
import { validateResetPassword } from '../utils/passwordRecovery'

function ResetPassword() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [token] = useState(() => searchParams.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useLayoutEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!token) { setError('This reset link is invalid or expired. Request a new password reset link.'); return }
    const validationError = validateResetPassword(password, confirmation)
    if (validationError) { setError(validationError); return }
    setBusy(true)
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: password }, { skipAuth: true })
      clearSession()
      setPassword('')
      setConfirmation('')
      setSuccess(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'This reset link is invalid or expired. Request a new password reset link.'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-mist px-5 py-10">
    <section className="panel w-full max-w-md p-6 sm:p-8" aria-labelledby="reset-title">
      <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to login</Link>
      <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white"><img src="/sarec-care-logo.jpg" alt="SAREC Care logo" className="h-10 w-10 rounded-full object-contain" /></span><div><p className="font-bold text-ink">SAREC Care</p><p className="text-xs text-slate-500">Student Grievance &amp; Campus Support Platform</p></div></div>
      <p className="eyebrow">Account recovery</p><h1 id="reset-title" className="mt-2 text-2xl font-bold text-ink">Set a new password</h1>
      {success ? <div className="mt-5 space-y-4"><p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">Your password has been reset. Sign in again with your new password.</p><Link className="button-primary w-full justify-center" to="/login">Go to login</Link></div> : <form className="mt-5 space-y-4" onSubmit={submit}>
        <p className="text-sm leading-6 text-slate-500">Choose a new password for your account. Youâ€™ll need to sign in again after it is changed.</p>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <label className="field-label">New password<div className="input-wrap mt-2"><LockKeyhole className="input-icon" aria-hidden="true" /><input className="input-control" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
        <label className="field-label">Confirm new password<div className="input-wrap mt-2"><LockKeyhole className="input-icon" aria-hidden="true" /><input className="input-control" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div></label>
        <button className="button-primary w-full justify-center" type="submit" disabled={busy}>{busy ? 'Resettingâ€¦' : 'Reset password'}</button>
      </form>}
    </section>
  </main>
}

export default ResetPassword
