import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() }, { skipAuth: true })
      setSubmitted(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Password recovery is temporarily unavailable. Please try again later.'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-mist px-5 py-10">
    <section className="panel w-full max-w-md p-6 sm:p-8" aria-labelledby="forgot-title">
      <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to login</Link>
      <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white"><img src="/sarec-care-logo.jpg" alt="SAREC Care logo" className="h-10 w-10 rounded-full object-contain" /></span><div><p className="font-bold text-ink">SAREC Care</p><p className="text-xs text-slate-500">Student Grievance &amp; Campus Support Platform</p></div></div>
      <p className="eyebrow">Account recovery</p><h1 id="forgot-title" className="mt-2 text-2xl font-bold text-ink">Forgot Password?</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email address registered to your account. If an eligible account exists, recovery instructions will be processed. The reset link expires in 15 minutes.</p>
      {submitted ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800" role="status">If an eligible account exists for this email address, recovery instructions will be processed. If no email arrives, check your spam folder or contact campus support.</div> : <form className="mt-6 space-y-4" onSubmit={submit}>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <label className="field-label">Registered email address<div className="input-wrap mt-2"><Mail className="input-icon" aria-hidden="true" /><input className="input-control" type="email" autoComplete="email" required maxLength={160} value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>
        <button className="button-primary w-full justify-center" type="submit" disabled={busy}>{busy ? 'Sendingâ€¦' : 'Send reset link'}</button>
      </form>}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-accent hover:underline">Return to login</Link></p>
    </section>
  </main>
}

export default ForgotPassword
