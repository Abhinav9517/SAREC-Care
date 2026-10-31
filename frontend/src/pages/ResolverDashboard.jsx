import { useCallback, useEffect, useState } from 'react'
import { Eye, RefreshCw, Search, UploadCloud, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import LoadingState from '../components/LoadingState'
import PrivateAttachment from '../components/PrivateAttachment'
import AnnouncementCenter from '../components/AnnouncementCenter'
import api, { getErrorMessage } from '../services/api'
import { clearSession, getStoredUser, saveSession } from '../utils/auth'

const dateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const statuses = ['Pending', 'In Progress', 'In-Progress', 'Resolved']
const evidenceTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
const maxFiles = Number(import.meta.env.VITE_UPLOAD_MAX_FILES || 5)
const maxFileBytes = Number(import.meta.env.VITE_UPLOAD_MAX_FILE_BYTES || 20 * 1024 * 1024)

function ResolverDashboard() {
  const user = getStoredUser()
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 })
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [comment, setComment] = useState('')
  const [historyNote, setHistoryNote] = useState('')
  const [resolution, setResolution] = useState({ workPerformed: '', rootCause: '', materials: '', notes: '' })
  const [evidence, setEvidence] = useState([])
  const [passwordRequired, setPasswordRequired] = useState(Boolean(user?.mustChangePassword))
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.trim()) query.set('search', search.trim())
      if (statusFilter !== 'All') query.set('status', statusFilter)
      if (categoryFilter !== 'All') query.set('category', categoryFilter)
      if (locationFilter !== 'All') query.set('location', locationFilter)
      const [response, categoryResponse, locationResponse, summaryResponse] = await Promise.all([api.get(`/api/grievances?${query}`), api.get('/api/catalog/categories'), api.get('/api/catalog/locations'), api.get('/api/grievances/summary')])
      setRecords(response.data.data || [])
      setSummary(summaryResponse.data.data || { total: 0, pending: 0, inProgress: 0, resolved: 0 })
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 })
      setCategories(categoryResponse.data.data || [])
      setLocations(locationResponse.data.data || [])
    }
    catch (requestError) { setError(getErrorMessage(requestError, 'Unable to load the maintenance queue.')) }
    finally { setLoading(false) }
  }, [categoryFilter, locationFilter, page, search, statusFilter])
  useEffect(() => { if (passwordRequired) return undefined; const timer = window.setTimeout(refresh, 250); return () => window.clearTimeout(timer) }, [passwordRequired, refresh])

  const changeTemporaryPassword = async (event) => {
    event.preventDefault(); setError('')
    if (passwords.newPassword.length < 8 || passwords.newPassword !== passwords.confirmation) { setError('Choose a new password of at least 8 characters and confirm it.'); return }
    setBusy('password')
    try {
      const response = await api.post('/api/auth/change-password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })
      saveSession(response.data.token, response.data.user)
      setPasswordRequired(false); setPasswords({ currentPassword: '', newPassword: '', confirmation: '' }); setNotice('Temporary password changed. Your resolver queue is now available.')
    } catch (requestError) { setError(getErrorMessage(requestError)) }
    finally { setBusy('') }
  }

  const details = async (record) => {
    try {
      const result = await api.get(`/api/grievances/${record._id}`)
      setSelected(result.data.data)
      setComment('')
      setHistoryNote('')
      setResolution({ workPerformed: '', rootCause: '', materials: '', notes: result.data.data.resolution?.notes || '' })
      setEvidence([])
    } catch (requestError) { setError(getErrorMessage(requestError, 'Unable to open grievance details.')) }
  }

  const updateStatus = async (nextStatus) => {
    if (!selected || busy) return
    setBusy('status'); setError(''); setNotice('')
    try {
      const body = { status: nextStatus, comment: historyNote }
      if (nextStatus === 'Resolved') body.resolution = resolution
      const response = await api.put(`/api/grievances/${selected._id}`, body)
      setRecords((current) => current.map((item) => item._id === selected._id ? response.data.data : item))
      setSelected(response.data.data)
      setHistoryNote('')
      setNotice(`Status updated to ${nextStatus}.`)
      await refresh()
    } catch (requestError) { setError(getErrorMessage(requestError, 'Status update failed.')) }
    finally { setBusy('') }
  }

  const addComment = async () => {
    if (!selected || !comment.trim() || busy) return
    setBusy('comment'); setError('')
    try {
      await api.post(`/api/grievances/${selected._id}/comments`, { text: comment.trim() })
      setComment('')
      await details(selected)
      setNotice('Progress comment added.')
    } catch (requestError) { setError(getErrorMessage(requestError, 'Comment could not be saved.')) }
    finally { setBusy('') }
  }

  const uploadEvidence = async () => {
    if (!selected || !evidence.length || busy) return
    setBusy('evidence'); setError('')
    try {
      const data = new FormData()
      evidence.forEach((file) => data.append('attachments', file))
      await api.post(`/api/grievances/${selected._id}/resolution-evidence`, data, { headers: { 'Content-Type': undefined } })
      const files = evidence.map((file) => file.name).join(', ')
      setEvidence([])
      await details(selected)
      setNotice(`Resolution evidence uploaded: ${files}`)
    } catch (requestError) { setError(getErrorMessage(requestError, 'Evidence upload failed. You can retry.')) }
    finally { setBusy('') }
  }

  const visible = records
  const categoryNames = [...new Set([...categories.map((record) => record.name), ...records.map((record) => record.category).filter(Boolean)])]
  const locationNames = [...new Set([...locations.map((record) => record.name), ...records.map((record) => record.location).filter(Boolean)])]
  const availableTransitions = selected?.status === 'Pending' ? ['In Progress', 'Resolved'] : ['In Progress', 'In-Progress'].includes(selected?.status) ? ['Resolved'] : []

  return <div className="min-h-screen bg-mist"><Navbar user={user} onLogout={() => { clearSession(); window.location.assign('/') }} /><main className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-8">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Resolver workspace</p><h1 className="mt-2 text-3xl font-bold text-ink">Maintenance queue</h1><p className="mt-2 text-sm text-slate-500">Review reports, add progress notes, and document completed work.</p></div><button className="button-secondary" onClick={refresh} disabled={loading || passwordRequired}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></section>
    {passwordRequired ? <form className="panel mx-auto max-w-xl space-y-4 p-6" onSubmit={changeTemporaryPassword}><p className="eyebrow">Account security</p><h2 className="text-xl font-bold text-ink">Change your temporary password</h2><p className="text-sm text-slate-500">Your administrator issued a temporary password. Set a private password before opening the grievance queue.</p><label className="field-label">Temporary password<input required type="password" className="input-control standalone" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label><label className="field-label">New password<input required minLength={8} type="password" className="input-control standalone" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label><label className="field-label">Confirm new password<input required minLength={8} type="password" className="input-control standalone" value={passwords.confirmation} onChange={(event) => setPasswords({ ...passwords, confirmation: event.target.value })} /></label><button className="button-primary" disabled={busy === 'password'}>{busy === 'password' ? 'Updating…' : 'Change password'}</button></form> : <AnnouncementCenter userId={user?.id} />}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!passwordRequired && <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Campus grievance totals">{[['Queue total', summary.total], ['Pending', summary.pending], ['In progress', summary.inProgress], ['Resolved', summary.resolved]].map(([label, value]) => <article className="panel p-4" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-ink">{value}</p></article>)}</div><div className="panel space-y-4 p-4"><div className="grid gap-2 md:grid-cols-4"><label className="input-wrap md:col-span-2"><Search className="input-icon" aria-hidden="true" /><span className="sr-only">Search grievances</span><input className="input-control" placeholder="Search tracking ID, description, or location" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label><select aria-label="Filter by status" className="input-control standalone" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>{['All', ...statuses].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter by category" className="input-control standalone" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option>All</option>{categoryNames.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter by location" className="input-control standalone" value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); setPage(1) }}><option>All</option>{locationNames.map((value) => <option key={value}>{value}</option>)}</select></div>
      {loading ? <LoadingState /> : !visible.length ? <div className="p-12 text-center text-sm text-slate-500">No grievances match the selected filters.</div> : <div className="divide-y divide-line">{visible.map((record) => <article className="flex flex-wrap items-center justify-between gap-4 py-4" key={record._id}><div><p className="text-xs font-bold text-accent">{record.trackingId}</p><h2 className="mt-1 font-bold text-ink">{record.title}</h2><p className="text-sm text-slate-500">{record.category} · {record.location} · {dateTime(record.createdAt)}</p></div><div className="flex items-center gap-3"><StatusBadge status={record.status} /><button className="button-secondary" onClick={() => details(record)}><Eye className="h-4 w-4" /> Details</button></div></article>)}</div>}<footer className="flex items-center justify-between border-t border-line pt-3 text-sm"><span>{pagination.total} records · page {pagination.page} of {Math.max(1, pagination.pages)}</span><div className="flex gap-2"><button className="button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="button-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer>
    </div></section>}
  </main>

  {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="resolver-detail-title"><section className="max-h-[94vh] w-full max-w-3xl space-y-4 overflow-auto rounded-2xl bg-white p-6 shadow-card"><header className="flex justify-between gap-4"><div><p className="eyebrow">{selected.trackingId}</p><h2 id="resolver-detail-title" className="mt-1 text-xl font-bold text-ink">{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close grievance details"><X /></button></header><p className="text-sm leading-6 text-slate-600">{selected.description}</p><p className="text-xs text-slate-500">{selected.category} · {selected.location} · Submitted {dateTime(selected.createdAt)}</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}<h3 className="font-semibold">Attachments and resolution evidence</h3><div className="grid gap-3 sm:grid-cols-2">{[...(selected.attachments || []), ...(selected.resolution?.evidence || [])].map((attachment) => <PrivateAttachment key={attachment.storageName} grievanceId={selected._id} attachment={attachment} />)}</div>
    <h3 className="font-semibold">Status history</h3><ol className="space-y-3 border-l-2 border-line pl-4">{(selected.statusHistory || []).map((item, index) => <li key={`${item.changedAt}-${index}`} className="text-sm"><b>{item.newStatus}</b> · {dateTime(item.changedAt)}<p className="text-xs text-slate-500">{item.actorName} ({item.actorRole}){item.comment ? ` · ${item.comment}` : ''}</p></li>)}</ol>
    <div><h3 className="font-semibold">Progress comments</h3>{(selected.comments || []).map((item, index) => <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm" key={item._id || index}>{item.text}<span className="block text-xs text-slate-500">{item.authorName} · {item.authorRole} · {dateTime(item.createdAt)}</span></p>)}<div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input-control standalone" maxLength={2000} placeholder="Progress update or delay explanation" value={comment} onChange={(event) => setComment(event.target.value)} /><button className="button-primary shrink-0" onClick={addComment} disabled={!comment.trim() || Boolean(busy)}>{busy === 'comment' ? 'Saving…' : 'Add comment'}</button></div></div>
    <div className="rounded-xl border border-line p-4"><h3 className="font-semibold">Resolution record</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[['workPerformed', 'Work performed'], ['rootCause', 'Root cause'], ['materials', 'Materials used']].map(([key, label]) => <label key={key} className="field-label">{label}<input className="input-control standalone" maxLength={500} value={resolution[key]} onChange={(event) => setResolution((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="field-label sm:col-span-2">Final resolution notes<textarea className="input-control standalone min-h-20" maxLength={2000} value={resolution.notes} onChange={(event) => setResolution((current) => ({ ...current, notes: event.target.value }))} /></label></div><label className="field-label mt-3 block">Evidence photos or videos (up to {maxFiles}, {(maxFileBytes / 1024 / 1024).toFixed(0)} MiB each)<input className="mt-2 block w-full text-sm" type="file" multiple accept={evidenceTypes.join(',')} onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; const bad = files.find((file) => !evidenceTypes.includes(file.type) || file.size > maxFileBytes); if (bad) setError(`${bad.name} is unsupported or larger than ${(maxFileBytes / 1024 / 1024).toFixed(0)} MiB.`); else if ((selected.resolution?.evidence?.length || 0) + files.length > maxFiles) setError(`Choose no more than ${maxFiles} evidence files total.`); else { setError(''); setEvidence(files) } }} /></label>{evidence.length > 0 && <div className="mt-2 flex items-center justify-between gap-3 text-sm"><span>{evidence.map((file) => file.name).join(', ')}</span><button className="button-secondary" onClick={uploadEvidence} disabled={Boolean(busy)}><UploadCloud className="h-4 w-4" />{busy === 'evidence' ? 'Uploading…' : 'Upload evidence'}</button></div>}</div>
    <div><label className="field-label">Status change explanation (optional)<textarea className="input-control standalone mt-2" maxLength={1000} value={historyNote} onChange={(event) => setHistoryNote(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-2">{availableTransitions.map((status) => <button key={status} className={status === 'Resolved' ? 'button-primary' : 'button-secondary'} onClick={() => updateStatus(status)} disabled={Boolean(busy)}>{busy === 'status' ? 'Saving…' : `Mark ${status.toLowerCase()}`}</button>)}</div>{selected.resolution?.resolvedAt && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Resolved {dateTime(selected.resolution.resolvedAt)} by {selected.statusHistory?.at(-1)?.actorName || 'campus team'}{selected.resolution.notes ? ` · ${selected.resolution.notes}` : ''}</p>}</div>
  </section></div>}
  </div>
}

export default ResolverDashboard
