import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ClipboardList, Filter, MapPin, RefreshCw, Search, UserRound, Eye, Settings2, UploadCloud, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Analytics from '../components/Analytics'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import LoadingState from '../components/LoadingState'
import PrivateAttachment from '../components/PrivateAttachment'
import api, { getErrorMessage } from '../services/api'
import { clearSession, getStoredUser } from '../utils/auth'

const statuses = ['All statuses', 'Pending', 'In Progress', 'In-Progress', 'Resolved']
const evidenceTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
const maxEvidenceFiles = Number(import.meta.env.VITE_UPLOAD_MAX_FILES || 5)
const maxEvidenceBytes = Number(import.meta.env.VITE_UPLOAD_MAX_FILE_BYTES || 20 * 1024 * 1024)
const dateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

function AdminDashboard() {
  const user = getStoredUser()
  const [grievances, setGrievances] = useState([])
  const [summary, setSummary] = useState(null)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [status, setStatus] = useState('All statuses')
  const [selected, setSelected] = useState(null)
  const [comment, setComment] = useState('')
  const [statusExplanation, setStatusExplanation] = useState('')
  const [resolution, setResolution] = useState({ workPerformed: '', rootCause: '', materials: '', notes: '' })
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [evidenceProgress, setEvidenceProgress] = useState(0)

  const fetchGrievances = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.trim()) query.set('search', search.trim())
      if (category !== 'All categories') query.set('category', category)
      if (status !== 'All statuses') query.set('status', status)
      const [response, summaryResponse, catalogResponse] = await Promise.all([api.get(`/api/grievances?${query}`), api.get('/api/grievances/summary'), api.get('/api/admin/categories')])
      setGrievances(response.data.data || [])
      setPagination(response.data.pagination)
      setSummary(summaryResponse.data.data)
      setCategoryOptions((catalogResponse.data.data || []).map((item) => item.name))
    }
    catch (requestError) { setError(getErrorMessage(requestError, 'We could not load the admin queue.')) }
    finally { setLoading(false); setRefreshing(false) }
  }, [category, page, search, status])
  useEffect(() => { const timer = window.setTimeout(() => fetchGrievances(), 250); return () => window.clearTimeout(timer) }, [fetchGrievances])
  useEffect(() => {
    if (!selected?._id) return undefined
    let active = true
    api.get(`/api/grievances/${selected._id}`).then((response) => {
      if (!active) return
      setSelected(response.data.data)
      setResolution({ workPerformed: response.data.data.resolution?.workPerformed || '', rootCause: response.data.data.resolution?.rootCause || '', materials: response.data.data.resolution?.materials || '', notes: response.data.data.resolution?.notes || '' })
      setComment('')
      setStatusExplanation('')
      setEvidenceFiles([])
      setEvidenceProgress(0)
      setError('')
    }).catch((requestError) => { if (active) setError(getErrorMessage(requestError)) })
    return () => { active = false }
  }, [selected?._id])

  const filteredGrievances = useMemo(() => {
    const query = search.trim().toLowerCase()
    return grievances.filter((grievance) => {
      const reporter = typeof grievance.reportedBy === 'object' ? grievance.reportedBy : {}
      const matchesSearch = !query || [grievance.trackingId, grievance.title, grievance.description, grievance.location, reporter.name, reporter.email, reporter.username].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesSearch && (category === 'All categories' || grievance.category === category) && (status === 'All statuses' || grievance.status === status)
    })
  }, [category, grievances, search, status])
  const categories = [...new Set([...categoryOptions, ...grievances.map((item) => item.category).filter(Boolean)])]
  const logout = () => { clearSession(); window.location.assign('/') }

  const updateStatus = async (nextStatus) => {
    if (!selected || busy) return
    setBusy('status'); setError(''); setFeedback('')
    try {
      const body = { status: nextStatus, comment: statusExplanation }
      if (nextStatus === 'Resolved') body.resolution = resolution
      const response = await api.put(`/api/grievances/${selected._id}`, body)
      setSelected(response.data.data)
      setGrievances((current) => current.map((item) => item._id === selected._id ? response.data.data : item))
      setFeedback(`Updated ${response.data.data.trackingId} to ${nextStatus}.`)
      setStatusExplanation('')
      await fetchGrievances(true)
    } catch (requestError) { setError(getErrorMessage(requestError, 'The status could not be updated.')) }
    finally { setBusy('') }
  }

  const addComment = async () => {
    if (!selected || !comment.trim() || busy) return
    setBusy('comment'); setError('')
    try {
      await api.post(`/api/grievances/${selected._id}/comments`, { text: comment.trim() })
      setComment('')
      const response = await api.get(`/api/grievances/${selected._id}`)
      setSelected(response.data.data)
      setFeedback('Comment added to the grievance timeline.')
    } catch (requestError) { setError(getErrorMessage(requestError, 'The comment could not be saved.')) }
    finally { setBusy('') }
  }

  const uploadResolutionEvidence = async () => {
    if (!selected || !evidenceFiles.length || busy) return
    setBusy('evidence'); setError(''); setFeedback(''); setEvidenceProgress(0)
    try {
      const data = new FormData()
      evidenceFiles.forEach((file) => data.append('attachments', file))
      await api.post(`/api/grievances/${selected._id}/resolution-evidence`, data, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (event) => { if (event.total) setEvidenceProgress(Math.round(event.loaded * 100 / event.total)) },
      })
      const response = await api.get(`/api/grievances/${selected._id}`)
      setSelected(response.data.data)
      setGrievances((current) => current.map((item) => item._id === selected._id ? response.data.data : item))
      setEvidenceFiles([])
      setFeedback(`Resolution evidence saved for ${selected.trackingId}.`)
    } catch (requestError) { setError(getErrorMessage(requestError, 'Evidence upload failed. The selected files remain available to retry.')) }
    finally { setBusy('') }
  }

  const chooseEvidence = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    const invalid = selectedFiles.find((file) => !evidenceTypes.includes(file.type) || file.size > maxEvidenceBytes)
    if (invalid) { setError(`${invalid.name} is unsupported or larger than ${(maxEvidenceBytes / 1024 / 1024).toFixed(0)} MiB.`); return }
    if ((selected.resolution?.evidence?.length || 0) + selectedFiles.length > maxEvidenceFiles) { setError(`A grievance can contain up to ${maxEvidenceFiles} resolution evidence files.`); return }
    setError(''); setEvidenceFiles(selectedFiles)
  }

  const transitions = selected?.status === 'Pending' ? ['In Progress', 'Resolved'] : ['In Progress', 'In-Progress'].includes(selected?.status) ? ['Resolved'] : []

  return <div className="min-h-screen bg-mist"><Navbar user={user} onLogout={logout} /><main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 lg:py-10">
    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">Operations console</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Campus grievance overview</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">See the complete queue, review reports, and keep issues moving through resolution.</p></div><div className="flex flex-wrap gap-2"><Link className="button-secondary" to="/admin/manage"><Settings2 className="h-4 w-4" /> Administration</Link><button type="button" className="button-secondary gap-2" onClick={() => fetchGrievances(true)} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh queue</button></div></section>
    {feedback && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{feedback}</div>}{error && <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</div>}
    {loading ? <div className="panel"><LoadingState label="Loading the campus grievance queue…" /></div> : <Analytics grievances={grievances} summary={summary} />}
    <section className="panel overflow-hidden"><div className="border-b border-line px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">Resolution queue</p><h2 className="mt-1 text-xl font-bold tracking-tight text-ink">All reported grievances</h2><p className="mt-1 text-xs text-slate-500">Showing {filteredGrievances.length} of {pagination.total} records</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="input-wrap sm:min-w-64"><Search className="input-icon" aria-hidden="true" /><span className="sr-only">Search grievances</span><input className="input-control" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search tracking ID, report, or person" /></label><label className="sr-only" htmlFor="category-filter">Filter by category</label><select id="category-filter" className="input-control standalone sm:w-44" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><label className="sr-only" htmlFor="status-filter">Filter by status</label><select id="status-filter" className="input-control standalone sm:w-36" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div></div></div>
    {loading ? <LoadingState /> : filteredGrievances.length === 0 ? <div className="flex flex-col items-center px-6 py-16 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Filter className="h-6 w-6" aria-hidden="true" /></div><h3 className="mt-5 font-semibold text-ink">No matching grievances</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Try clearing a filter or changing the search phrase to see more of the queue.</p></div> : <div className="divide-y divide-line">{filteredGrievances.map((grievance) => { const reporter = typeof grievance.reportedBy === 'object' ? grievance.reportedBy : {}; return <article key={grievance._id} className="p-5 sm:p-6"><div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={grievance.status} /><span className="text-xs font-semibold text-accent">{grievance.trackingId}</span><span className="text-xs text-slate-400">{dateTime(grievance.createdAt)}</span></div><h3 className="mt-3 text-lg font-bold text-ink">{grievance.title}</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{grievance.description}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />{grievance.category}</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{grievance.location}</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" aria-hidden="true" />{reporter.name || 'Unknown reporter'} · {reporter.email || 'No email'}</span></div></div><button type="button" className="button-secondary shrink-0" onClick={() => setSelected(grievance)}><Eye className="h-4 w-4" /> Details and history</button></div></article> })}</div>}<footer className="flex items-center justify-between border-t border-line p-4 text-sm"><span>{pagination.total} results · page {pagination.page} of {Math.max(1, pagination.pages)}</span><div className="flex gap-2"><button className="button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="button-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer></section>
  </main>
  {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title"><section className="max-h-[94vh] w-full max-w-3xl space-y-4 overflow-auto rounded-2xl bg-white p-6 shadow-card"><header className="flex justify-between gap-4"><div><p className="eyebrow">{selected.trackingId}</p><h2 id="admin-detail-title" className="mt-1 text-xl font-bold">{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close grievance details"><X /></button></header><p className="text-sm leading-6 text-slate-600">{selected.description}</p><p className="text-xs text-slate-500">{selected.category} · {selected.location} · Reported {dateTime(selected.createdAt)}</p><h3 className="font-semibold">Attachments and resolution evidence</h3><div className="grid gap-3 sm:grid-cols-2">{[...(selected.attachments || []), ...(selected.resolution?.evidence || [])].map((attachment) => <PrivateAttachment key={attachment.storageName} grievanceId={selected._id} attachment={attachment} />)}</div><h3 className="font-semibold">Status history</h3><ol className="space-y-3 border-l-2 border-line pl-4">{(selected.statusHistory || []).map((item, index) => <li className="text-sm" key={`${item.changedAt}-${index}`}><b>{item.newStatus}</b> · {dateTime(item.changedAt)}<p className="text-xs text-slate-500">{item.actorName} ({item.actorRole}){item.comment ? ` · ${item.comment}` : ''}</p></li>)}</ol><div><h3 className="font-semibold">Comments</h3>{(selected.comments || []).map((item, index) => <p key={item._id || index} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">{item.text}<span className="block text-xs text-slate-500">{item.authorName} · {item.authorRole} · {dateTime(item.createdAt)}</span></p>)}<div className="mt-3 flex gap-2"><input className="input-control standalone" maxLength={2000} placeholder="Delay explanation or progress update" value={comment} onChange={(event) => setComment(event.target.value)} /><button className="button-primary shrink-0" onClick={addComment} disabled={!comment.trim() || Boolean(busy)}>{busy === 'comment' ? 'Saving…' : 'Add comment'}</button></div></div><div className="rounded-xl border border-line p-4"><h3 className="font-semibold">Resolution details</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[['workPerformed', 'Work performed'], ['rootCause', 'Root cause'], ['materials', 'Materials used']].map(([key, label]) => <label className="field-label" key={key}>{label}<input className="input-control standalone" maxLength={500} value={resolution[key]} onChange={(event) => setResolution((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="field-label sm:col-span-2">Final notes<textarea className="input-control standalone" maxLength={2000} value={resolution.notes} onChange={(event) => setResolution((current) => ({ ...current, notes: event.target.value }))} /></label></div><label className="field-label mt-4 block">Add resolution evidence (up to {maxEvidenceFiles}, {(maxEvidenceBytes / 1024 / 1024).toFixed(0)} MiB each)<input aria-label="Add resolution evidence" className="mt-2 block w-full text-sm" type="file" multiple accept={evidenceTypes.join(String.fromCharCode(44))} onChange={chooseEvidence} disabled={Boolean(busy)} /></label>{evidenceFiles.length > 0 && <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{evidenceFiles.map((file) => file.name).join(String.fromCharCode(44, 32))}</p><button type="button" className="button-secondary" onClick={uploadResolutionEvidence} disabled={Boolean(busy)}><UploadCloud className="h-4 w-4" />{busy === "evidence" ? `Uploading ${evidenceProgress}%` : "Upload evidence"}</button></div>}</div>{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<label className="field-label">Status change explanation<textarea className="input-control standalone mt-2" maxLength={1000} value={statusExplanation} onChange={(event) => setStatusExplanation(event.target.value)} /></label><div className="flex flex-wrap gap-2">{transitions.map((nextStatus) => <button key={nextStatus} className={nextStatus === 'Resolved' ? 'button-primary' : 'button-secondary'} onClick={() => updateStatus(nextStatus)} disabled={Boolean(busy)}>{busy === 'status' ? 'Saving…' : `Mark ${nextStatus.toLowerCase()}`}</button>)}</div>{selected.resolution?.resolvedAt && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Resolved {dateTime(selected.resolution.resolvedAt)} by {selected.statusHistory?.at(-1)?.actorName || 'campus team'}{selected.resolution.notes ? ` · ${selected.resolution.notes}` : ''}</p>}</section></div>}
  </div>
}

export default AdminDashboard
