import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, MapPin, Paperclip, Plus, RefreshCw, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import PrivateAttachment from '../components/PrivateAttachment'
import AnnouncementCenter from '../components/AnnouncementCenter'
import api, { getErrorMessage } from '../services/api'
import { clearSession, getStoredUser } from '../utils/auth'

const MAX_FILES = Number(import.meta.env.VITE_UPLOAD_MAX_FILES || 5)
const MAX_BYTES = Number(import.meta.env.VITE_UPLOAD_MAX_FILE_BYTES || 20 * 1024 * 1024)
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
const blank = { title: '', description: '', category: '', categoryId: '', location: '', locationId: '' }
const dateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

function StudentDashboard() {
  const user = getStoredUser()
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 })
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [files, setFiles] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const filesRef = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ limit: '20', page: String(page) })
      if (search.trim()) query.set('search', search.trim())
      const [grievances, categoryResponse, locationResponse, summaryResponse] = await Promise.all([
        api.get(`/api/grievances?${query}`),
        api.get('/api/catalog/categories'),
        api.get('/api/catalog/locations'),
        api.get('/api/grievances/summary'),
      ])
      setRecords(grievances.data.data || [])
      setPagination(grievances.data.pagination || { page: 1, pages: 1, total: 0 })
      setSummary(summaryResponse.data.data || { total: 0, pending: 0, inProgress: 0, resolved: 0 })
      setCategories(categoryResponse.data.data || [])
      setLocations(locationResponse.data.data || [])
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to load your dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { const timer = window.setTimeout(load, 250); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => () => filesRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview)), [])
  useEffect(() => {
    if (!selected?._id) return undefined
    let active = true
    api.get(`/api/grievances/${selected._id}`).then((response) => { if (active) setSelected(response.data.data) }).catch((requestError) => { if (active) setError(getErrorMessage(requestError)) })
    return () => { active = false }
  }, [selected?._id])

  const addFiles = (event) => {
    const next = Array.from(event.target.files || [])
    event.target.value = ''
    const invalid = next.find((file) => !MIME_TYPES.includes(file.type) || file.size > MAX_BYTES)
    if (invalid) { setError(`${invalid.name}: select JPEG, PNG, WebP, MP4, or WebM no larger than ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MiB.`); return }
    if (files.length + next.length > MAX_FILES) { setError(`You can attach up to ${MAX_FILES} files.`); return }
    setError('')
    setFiles((current) => [...current, ...next.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  const removeFile = (index) => setFiles((current) => {
    URL.revokeObjectURL(current[index].preview)
    return current.filter((_file, currentIndex) => currentIndex !== index)
  })

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (form.title.trim().length < 4 || form.description.trim().length < 10 || form.location.trim().length < 2 || !form.category) {
      setError('Complete all grievance fields with a detailed description.')
      return
    }
    setSaving(true)
    setProgress(0)
    try {
      const data = new FormData()
      for (const [key, value] of Object.entries(form)) if (value) data.append(key, value.trim())
      files.forEach(({ file }) => data.append('attachments', file))
      const submission = await api.post('/api/grievances', data, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (event) => { if (event.total) setProgress(Math.round(event.loaded * 100 / event.total)) },
      })
      files.forEach(({ preview }) => URL.revokeObjectURL(preview))
      setFiles([])
      setForm(blank)
      setOpen(false)
      setNotice(`Grievance ${submission.data.data.trackingId} submitted successfully.`)
      await load()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Upload or submission failed. Your selected files are still available to retry.'))
    } finally {
      setSaving(false)
    }
  }

  const logout = () => { clearSession(); window.location.assign('/') }
  const visible = records
  const chooseCatalogValue = (kind, value) => {
    const source = kind === 'category' ? categories : locations
    const item = source.find((entry) => (entry._id || entry.name) === value)
    if (kind === 'category') setForm((current) => ({ ...current, category: item?.name || '', categoryId: item?._id || '' }))
    else setForm((current) => ({ ...current, location: item?.name || '', locationId: item?._id || '' }))
  }

  return <div className="min-h-screen bg-mist">
    <Navbar user={user} onLogout={logout} />
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
      <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Student workspace</p><h1 className="mt-2 text-3xl font-bold text-ink">Welcome, {user?.name || 'student'}</h1><p className="mt-2 text-sm text-slate-500">Track your campus concerns from submission through resolution.</p></div><button className="button-primary" onClick={() => { setError(''); setOpen(true) }}><Plus className="h-4 w-4" /> Submit new grievance</button></section>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />{notice}</p>}
      {error && !open && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</p>}
      <AnnouncementCenter userId={user?.id} />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your grievance totals">{[['Total reports', summary.total], ['Pending', summary.pending], ['In progress', summary.inProgress], ['Resolved', summary.resolved]].map(([label, value]) => <article className="panel p-4" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-ink">{value}</p></article>)}</section>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5"><div><h2 className="font-bold text-ink">Grievance history</h2><p className="text-xs text-slate-500">{pagination.total} reports · private to your account</p></div><div className="flex gap-2"><input className="input-control standalone" aria-label="Search tracking IDs" placeholder="Search tracking ID" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /><button className="button-secondary" onClick={load} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button></div></div>
        {loading ? <LoadingState /> : !visible.length ? <div className="p-12 text-center text-sm text-slate-500">No matching grievances. Submit a report to get started.</div> : <div className="divide-y divide-line">{visible.map((record) => <article key={record._id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-bold text-accent">{record.trackingId || 'Tracking ID pending migration'}</p><h3 className="mt-1 font-semibold text-ink">{record.title}</h3><p className="mt-1 text-xs text-slate-500">{record.category} · {record.location} · Filed {dateTime(record.createdAt)}</p><p className="mt-1 text-xs text-slate-500">Last updated {dateTime(record.statusHistory?.at(-1)?.changedAt || record.updatedAt)}</p></div><div className="flex items-center gap-3"><StatusBadge status={record.status} /><button className="button-secondary" onClick={() => setSelected(record)}><Eye className="h-4 w-4" /> Details</button></div></article>)}</div>}<footer className="flex items-center justify-between border-t border-line p-4 text-sm"><span>Page {pagination.page || page} of {Math.max(1, pagination.pages || 1)}</span><div className="flex gap-2"><button className="button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="button-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer>
      </section>
    </main>

    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-card"><div className="flex justify-between"><div><p className="eyebrow">New report</p><h2 id="create-title" className="mt-1 text-xl font-bold text-ink">Report a campus issue</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close"><X /></button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<form className="mt-4 space-y-3" onSubmit={submit}>
      <label className="field-label">Title<input required className="input-control standalone" value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="field-label">Category<select required className="input-control standalone" value={form.categoryId || form.category} onChange={(event) => chooseCatalogValue('category', event.target.value)}><option value="">Select category</option>{categories.map((item) => <option key={item._id || item.name} value={item._id || item.name}>{item.name}</option>)}</select></label><label className="field-label">Location{locations.length ? <select required className="input-control standalone" value={form.locationId || form.location} onChange={(event) => chooseCatalogValue('location', event.target.value)}><option value="">Select location</option>{locations.map((item) => <option key={item._id || item.name} value={item._id || item.name}>{item.name}</option>)}</select> : <input required className="input-control standalone" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />}</label></div>
      <label className="field-label">Description<textarea required className="input-control standalone min-h-28" maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label className="field-label">Photos or videos (up to {MAX_FILES}, {(MAX_BYTES / 1024 / 1024).toFixed(0)} MiB each)<span className="mt-2 flex items-center gap-2"><Paperclip className="h-4 w-4" /><input type="file" multiple accept={MIME_TYPES.join(',')} onChange={addFiles} disabled={saving} /></span></label>
      <div className="grid grid-cols-2 gap-3">{files.map(({ file, preview }, index) => <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border border-line p-2">{file.type.startsWith('image/') ? <img src={preview} alt={`Preview of ${file.name}`} className="h-28 w-full rounded object-cover" /> : <video src={preview} controls className="h-28 w-full" aria-label={`Preview of ${file.name}`} />}<p className="truncate text-xs">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</p><button type="button" className="absolute right-2 top-2 rounded-full bg-white p-1" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><X className="h-4 w-4" /></button></div>)}</div>
      {saving && <p role="status" className="text-sm text-accent">Uploading {progress}%</p>}<div className="flex justify-end gap-2 pt-3"><button type="button" className="button-secondary" disabled={saving} onClick={() => setOpen(false)}>Cancel</button><button className="button-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</button></div></form></div></div>}

    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6"><div className="flex justify-between"><div><p className="eyebrow">{selected.trackingId}</p><h2 id="detail-title" className="mt-1 text-xl font-bold">{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X /></button></div><p className="mt-3 text-sm text-slate-600">{selected.description}</p><p className="mt-2 text-xs text-slate-500"><MapPin className="mr-1 inline h-3.5 w-3.5" />{selected.category} · {selected.location} · Filed {dateTime(selected.createdAt)}</p><h3 className="mt-5 font-semibold">Status history</h3><ol className="mt-2 space-y-3 border-l-2 border-line pl-4">{(selected.statusHistory || []).map((item, index) => <li key={`${item.changedAt}-${index}`} className="text-sm"><b>{item.newStatus}</b> <time className="text-xs text-slate-500">{dateTime(item.changedAt)}</time><p className="text-xs text-slate-500">{item.actorName || 'Campus team'} ({item.actorRole}){item.comment ? ` · ${item.comment}` : ''}</p></li>)}</ol><h3 className="mt-5 font-semibold">Attachments and resolution evidence</h3><div className="mt-2 grid gap-3 sm:grid-cols-2">{[...(selected.attachments || []), ...(selected.resolution?.evidence || [])].map((attachment) => <PrivateAttachment key={attachment.storageName} grievanceId={selected._id} attachment={attachment} />)}</div><h3 className="mt-5 font-semibold">Progress notes</h3>{(selected.comments || []).map((item, index) => <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm" key={item._id || index}>{item.text}<span className="block text-xs text-slate-500">{item.authorName} · {item.authorRole} · {dateTime(item.createdAt)}</span></p>)}{selected.resolution?.notes && <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm"><b>Resolution:</b> {selected.resolution.notes}{selected.resolution.workPerformed && <p className="mt-2">Work performed: {selected.resolution.workPerformed}</p>}<p className="mt-1 text-xs text-emerald-800">Resolved {dateTime(selected.resolution.resolvedAt)}</p></div>}</div></div>}
  </div>
}

export default StudentDashboard
