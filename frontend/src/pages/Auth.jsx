import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { saveSession } from '../utils/auth'


const initialForm = { name: '', username: '', email: '', password: '', confirmation: '' }

function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(() => searchParams.get('mode') === 'register' ? 'register' : 'login')
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isRegister = mode === 'register'

  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const switchMode = (nextMode) => { setMode(nextMode); setForm(initialForm); setError(''); setSuccess('') }
  const validate = () => {
    if (isRegister && form.name.trim().length < 2) return 'Please enter your full name.'
    if (!/^[a-z0-9._-]{3,30}$/i.test(form.username.trim())) return 'Username must be 3â€“30 letters, numbers, dots, underscores, or hyphens.'
    if (isRegister && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Please enter a valid email address.'
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(form.password)) return 'Password must be 8â€“72 characters and include upper-case, lower-case, and numeric characters.'
    if (isRegister && form.password !== form.confirmation) return 'Passwords do not match.'
    return ''
  }

  const submit = async (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setIsSubmitting(true); setError(''); setSuccess('')
    try {
      if (isRegister) {
        await api.post('/api/auth/register', { name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password })
        setMode('login')
        setForm({ ...initialForm, username: form.username.trim() })
        setSuccess('Your student account is ready. Sign in to continue.')
      } else {
        const response = await api.post('/api/auth/login', { username: form.username.trim(), password: form.password })
        saveSession(response.data.token, response.data.user)
        navigate(`/${response.data.user.role}`, { replace: true })
      }
    } catch (requestError) { setError(getErrorMessage(requestError, 'Unable to complete authentication.')) }
    finally { setIsSubmitting(false) }
  }

  return <main className="min-h-screen bg-mist lg:grid lg:grid-cols-[1.05fr_0.95fr]">
    <section className="relative hidden overflow-hidden bg-navy px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20"><div className="absolute -right-20 top-16 h-72 w-72 rounded-full border border-white/10" /><div className="absolute -right-4 top-32 h-44 w-44 rounded-full border border-white/10" /><div className="relative flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><img src="/sarec-care-logo.jpg" alt="SAREC Care logo" className="h-10 w-10 rounded-full object-contain" /></div><div><p className="font-bold tracking-tight">SAREC Care</p><p className="text-xs text-slate-300">Student Grievance &amp; Campus Support Platform</p></div></div><div className="relative max-w-xl py-12"><p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Your Campus. Your Voice. Our Responsibility.</p><h1 className="max-w-lg text-5xl font-bold leading-[1.08] tracking-[-0.04em]">Make campus issues visible, actionable, and resolved.</h1><p className="mt-6 max-w-md text-base leading-7 text-slate-300">Samrat Ashok Rajkiya Engineering College Care — a student grievance and campus support platform.</p><div className="mt-10 grid max-w-md grid-cols-2 gap-3 text-sm text-slate-200"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mb-4 h-5 w-5 text-blue-300" /><p className="font-semibold">Role-aware access</p><p className="mt-1 text-xs leading-5 text-slate-400">Private student records and protected admin workflows.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ArrowRight className="mb-4 h-5 w-5 text-blue-300" /><p className="font-semibold">Clear ownership</p><p className="mt-1 text-xs leading-5 text-slate-400">Track status from first report through resolution.</p></div></div></div><p className="relative text-xs text-slate-500">Built for better campus operations Â· 2026</p></section>
    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-md"><div className="mb-8 flex items-center gap-3 lg:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><img src="/sarec-care-logo.jpg" alt="SAREC Care logo" className="h-10 w-10 rounded-full object-contain" /></div><div><p className="font-bold tracking-tight text-ink">SAREC Care</p><p className="text-xs text-slate-500">Student Grievance &amp; Campus Support Platform</p></div></div><div className="mb-8"><p className="eyebrow">Welcome back</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">{isRegister ? 'Create your student account' : 'Sign in to your workspace'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isRegister ? 'Start reporting campus issues with a secure student account.' : 'Use your campus username to continue.'}</p></div>
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode"><button type="button" onClick={() => switchMode('login')} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${!isRegister ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`} role="tab" aria-selected={!isRegister}>Sign in</button><button type="button" onClick={() => switchMode('register')} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${isRegister ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`} role="tab" aria-selected={isRegister}>Register</button></div>
      {success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{success}</div>}{error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div>}
      <form className="space-y-4" onSubmit={submit} noValidate>
        {isRegister && <label className="field-label">Full name<div className="input-wrap"><UserRound className="input-icon" aria-hidden="true" /><input className="input-control" name="name" value={form.name} onChange={updateForm} placeholder="Asha Student" autoComplete="name" /></div></label>}
        <label className="field-label">Username<div className="input-wrap"><UserRound className="input-icon" aria-hidden="true" /><input className="input-control" name="username" value={form.username} onChange={updateForm} placeholder="asha.student" autoComplete="username" /></div></label>
        {isRegister && <label className="field-label">Email address<div className="input-wrap"><Mail className="input-icon" aria-hidden="true" /><input className="input-control" name="email" type="email" value={form.email} onChange={updateForm} placeholder="you@campus.edu" autoComplete="email" /></div></label>}
        <label className="field-label">Password<div className="input-wrap"><LockKeyhole className="input-icon" aria-hidden="true" /><input className="input-control pr-12" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={updateForm} placeholder="At least 8 characters" autoComplete={isRegister ? 'new-password' : 'current-password'} /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
        {isRegister && <label className="field-label">Confirm password<div className="input-wrap"><LockKeyhole className="input-icon" aria-hidden="true" /><input className="input-control" name="confirmation" type={showPassword ? 'text' : 'password'} value={form.confirmation} onChange={updateForm} placeholder="Repeat your password" autoComplete="new-password" /></div></label>}
        <button className="button-primary mt-2 w-full justify-center py-3" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please waitâ€¦' : isRegister ? 'Create student account' : 'Sign in'} {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}</button>
      </form>{!isRegister && <p className="mt-4 text-right text-sm"><Link className="font-semibold text-accent hover:underline" to="/forgot-password">Forgot Password?</Link></p>}<p className="mt-7 text-center text-xs leading-5 text-slate-400">Administrator and resolver accounts are provisioned by authorized campus administrators. Public registration creates student accounts only.</p></div></section>
  </main>
}

export default Auth
