import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import LoadingState from './LoadingState'
import api, { getErrorMessage } from '../services/api'

const sections = ['Categories', 'Locations', 'Announcements', 'User directory', 'Resolvers', 'System records']
const emptyForm = { name: '', description: '' }
const emptyNotice = { title: '', text: '', startsAt: '', expiresAt: '', published: false, popup: true, mandatory: false }
const localDate = (date) => date ? new Date(new Date(date).getTime() - new Date(date).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
const formatDate = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—'

function AdminManagement() {
  const [section, setSection] = useState(sections[0])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [noticeForm, setNoticeForm] = useState(emptyNotice)
  const [image, setImage] = useState(null)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [stats, setStats] = useState(null)
  const [recordSubject, setRecordSubject] = useState(null)
  const [subjectRecords, setSubjectRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  const endpoint = section === 'Categories' ? '/api/admin/categories' : section === 'Locations' ? '/api/admin/locations' : section === 'Announcements' ? '/api/admin/announcements' : section === 'System records' ? '/api/admin/audit-logs' : '/api/admin/users'
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (['User directory', 'Resolvers'].includes(section)) {
        const query = new URLSearchParams({ page: String(page), limit: '15' })
        if (search.trim()) query.set('search', search.trim())
        if (section === 'Resolvers') query.set('role', 'resolver')
        else if (role) query.set('role', role)
        if (active) query.set('active', active)
        const [response, statResponse] = await Promise.all([api.get(`${endpoint}?${query}`), api.get('/api/admin/users/stats')])
        setItems(response.data.data || []); setPagination(response.data.pagination); setStats(statResponse.data.data)
      } else if (section === 'System records') {
        const response = await api.get(`${endpoint}?page=${page}&limit=15`)
        setItems(response.data.data || []); setPagination(response.data.pagination)
      } else {
        const response = await api.get(endpoint)
        setItems(response.data.data || []); setPagination({ page: 1, pages: 1, total: response.data.data?.length || 0 })
      }
    } catch (requestError) { setError(getErrorMessage(requestError, 'Unable to load this administration view.')) }
    finally { setLoading(false) }
  }, [active, endpoint, page, role, search, section])

  useEffect(() => { const timer = window.setTimeout(refresh, 200); return () => window.clearTimeout(timer) }, [refresh])
  const resetForms = () => { setForm(emptyForm); setNoticeForm(emptyNotice); setImage(null); setEditingId('') }
  const changeSection = (name) => { setSection(name); setPage(1); setSearch(''); setRole(''); setActive(''); resetForms(); setError(''); setNotice('') }

  const saveCatalog = async (event) => {
    event.preventDefault(); setError(''); setNotice('')
    try {
      const url = section === 'Categories' ? '/api/admin/categories' : '/api/admin/locations'
      if (editingId) await api.patch(`${url}/${editingId}`, form)
      else await api.post(url, form)
      resetForms(); setNotice(editingId ? 'Catalog entry updated.' : 'Catalog entry created.'); await refresh()
    } catch (requestError) { setError(getErrorMessage(requestError)) }
  }

  const saveAnnouncement = async (event) => {
    event.preventDefault(); setError(''); setNotice('')
    try {
      const endpointUrl = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements'
      if (image) {
        const data = new FormData()
        Object.entries(noticeForm).forEach(([key, value]) => data.append(key, String(value)))
        if (noticeForm.startsAt) data.set('startsAt', new Date(noticeForm.startsAt).toISOString())
        if (noticeForm.expiresAt) data.set('expiresAt', new Date(noticeForm.expiresAt).toISOString())
        data.append('image', image)
        await api[editingId ? 'patch' : 'post'](endpointUrl, data, { headers: { 'Content-Type': undefined } })
      } else {
        const body = { ...noticeForm, startsAt: noticeForm.startsAt ? new Date(noticeForm.startsAt).toISOString() : new Date().toISOString(), expiresAt: noticeForm.expiresAt ? new Date(noticeForm.expiresAt).toISOString() : null }
        await api[editingId ? 'patch' : 'post'](endpointUrl, body)
      }
      resetForms(); setNotice(editingId ? 'Announcement updated.' : 'Announcement created.'); await refresh()
    } catch (requestError) { setError(getErrorMessage(requestError)) }
  }

  const editCatalog = (item) => { setEditingId(item._id); setForm({ name: item.name, description: item.description || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const toggleCatalog = async (item) => { try { await api.patch(`${endpoint}/${item._id}`, { active: !item.active }); setNotice(`${item.name} ${item.active ? 'deactivated' : 'activated'}.`); await refresh() } catch (requestError) { setError(getErrorMessage(requestError)) } }
  const deleteCatalog = async (item) => { if (!window.confirm(`Delete “${item.name}”?`)) return; try { await api.delete(`${endpoint}/${item._id}`); setNotice('Catalog entry deleted.'); await refresh() } catch (requestError) { setError(getErrorMessage(requestError)) } }

  const editAnnouncement = (item) => {
    setEditingId(item._id)
    setNoticeForm({ title: item.title, text: item.text, startsAt: localDate(item.startsAt), expiresAt: localDate(item.expiresAt), published: item.published, popup: item.popup, mandatory: item.mandatory })
    setImage(null); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const setAnnouncementFlag = (key, value) => setNoticeForm((current) => ({ ...current, [key]: value }))
  const togglePublished = async (item) => { try { await api.patch(`/api/admin/announcements/${item._id}`, { published: !item.published }); setNotice(`Announcement ${item.published ? 'unpublished' : 'published'}.`); await refresh() } catch (requestError) { setError(getErrorMessage(requestError)) } }
  const deleteAnnouncement = async (item) => { if (!window.confirm(`Delete announcement “${item.title}”? This cannot be undone.`)) return; try { await api.delete(`/api/admin/announcements/${item._id}`); setNotice('Announcement deleted.'); await refresh() } catch (requestError) { setError(getErrorMessage(requestError)) } }
  const toggleAccount = async (item) => { if (item.active && !window.confirm(`Deactivate ${item.username}? They will immediately lose API access.`)) return; try { await api.patch(`/api/admin/users/${item._id}/active`, { active: !item.active }); setNotice(`${item.username} ${item.active ? 'deactivated' : 'activated'}.`); await refresh() } catch (requestError) { setError(getErrorMessage(requestError)) } }
  const inspectRecords = async (item) => {
    setRecordSubject(item); setRecordsLoading(true); setSubjectRecords([])
    try { const response = await api.get(`/api/admin/users/${item._id}/grievances?limit=100`); setSubjectRecords(response.data.data || []) }
    catch (requestError) { setError(getErrorMessage(requestError)) }
    finally { setRecordsLoading(false) }
  }
  const editResolver = async (item) => {
    const name = window.prompt('Resolver name', item.name)
    if (!name || name === item.name) return
    const email = window.prompt('Resolver email', item.email)
    if (!email) return
    try { await api.patch(`/api/admin/resolvers/${item._id}`, { name, email }); setNotice('Resolver profile updated.'); await refresh() } catch (requestError) { setError(getErrorMessage(requestError)) }
  }
  const startAnnouncementEdit = (item) => editAnnouncement(item)

  return <section className="panel space-y-5 p-5 sm:p-6"><div><p className="eyebrow">Administration</p><h2 className="mt-1 text-2xl font-bold text-ink">Campus management</h2><p className="mt-1 text-sm text-slate-500">Manage campus records, announcements, staff access, and audit history.</p></div>
    <nav className="flex flex-wrap gap-2" aria-label="Administration sections">{sections.map((name) => <button key={name} type="button" className={section === name ? 'button-primary' : 'button-secondary'} onClick={() => changeSection(name)}>{name}</button>)}</nav>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

    {['Categories', 'Locations'].includes(section) && <><form onSubmit={saveCatalog} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]"><label className="sr-only" htmlFor="catalog-name">Name</label><input id="catalog-name" required minLength={2} maxLength={120} className="input-control standalone" placeholder={`${section.slice(0, -1)} name`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><label className="sr-only" htmlFor="catalog-description">Description</label><input id="catalog-description" maxLength={500} className="input-control standalone" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button className="button-primary"><Plus className="h-4 w-4" />{editingId ? 'Save' : 'Add'}</button>{editingId && <button type="button" className="button-secondary" onClick={resetForms}>Cancel</button>}</form><div className="divide-y divide-line">{loading ? <p className="py-6 text-sm text-slate-500">Loading catalog…</p> : items.length ? items.map((item) => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><b className="text-ink">{item.name}</b><p className="text-xs text-slate-500">{item.description || 'No description'} · {item.active ? 'Active' : 'Inactive'}</p></div><div className="flex gap-2"><button className="button-secondary" onClick={() => editCatalog(item)}><Pencil className="h-4 w-4" />Edit</button><button className="button-secondary" onClick={() => toggleCatalog(item)}>{item.active ? 'Deactivate' : 'Activate'}</button><button className="button-secondary" onClick={() => deleteCatalog(item)} aria-label={`Delete ${item.name}`}><Trash2 className="h-4 w-4" /></button></div></article>) : <p className="py-8 text-sm text-slate-500">No records yet.</p>}</div></>}

    {section === 'Announcements' && <><form onSubmit={saveAnnouncement} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-2"><h3 className="font-semibold md:col-span-2">{editingId ? 'Edit announcement' : 'Create announcement'}</h3><label className="field-label">Title<input required maxLength={120} className="input-control standalone" value={noticeForm.title} onChange={(event) => setAnnouncementFlag('title', event.target.value)} /></label><label className="field-label">Image (optional)<input className="mt-2 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label><label className="field-label md:col-span-2">Notice text<textarea required maxLength={4000} className="input-control standalone min-h-28" value={noticeForm.text} onChange={(event) => setAnnouncementFlag('text', event.target.value)} /></label><label className="field-label">Starts at<input type="datetime-local" className="input-control standalone" value={noticeForm.startsAt} onChange={(event) => setAnnouncementFlag('startsAt', event.target.value)} /></label><label className="field-label">Expires at (optional)<input type="datetime-local" className="input-control standalone" value={noticeForm.expiresAt} onChange={(event) => setAnnouncementFlag('expiresAt', event.target.value)} /></label><div className="flex flex-wrap gap-x-5 gap-y-2 md:col-span-2">{[['published', 'Published'], ['popup', 'Show popup'], ['mandatory', 'Require acknowledgement']].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noticeForm[key]} onChange={(event) => setAnnouncementFlag(key, event.target.checked)} />{label}</label>)}</div><div className="flex gap-2 md:col-span-2"><button className="button-primary"><Check className="h-4 w-4" />{editingId ? 'Save changes' : 'Create announcement'}</button>{editingId && <button type="button" className="button-secondary" onClick={resetForms}>Cancel edit</button>}</div></form><div className="divide-y divide-line">{loading ? <p className="py-6 text-sm text-slate-500">Loading announcements…</p> : items.map((item) => <article key={item._id} className="flex flex-wrap justify-between gap-3 py-4"><div className="max-w-3xl"><b>{item.title}</b><p className="whitespace-pre-wrap text-sm text-slate-600">{item.text}</p><p className="mt-1 text-xs text-slate-500">{item.published ? 'Published' : 'Unpublished'} · {new Date(item.startsAt).toLocaleString()} · expires {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : 'never'} · {item.popup ? 'popup' : 'dashboard only'}{item.mandatory ? ' · acknowledgement required' : ''}</p></div><div className="flex gap-2"><button className="button-secondary" onClick={() => togglePublished(item)}>{item.published ? 'Unpublish' : 'Publish'}</button><button className="button-secondary" onClick={() => startAnnouncementEdit(item)}><Pencil className="h-4 w-4" />Edit</button><button className="button-secondary" onClick={() => deleteAnnouncement(item)}><Trash2 className="h-4 w-4" />Delete</button></div></article>)}</div></>}

    {['User directory', 'Resolvers'].includes(section) && <><div className="grid gap-3 sm:grid-cols-3">{stats && ['student', 'resolver', 'admin'].map((key) => <article key={key} className="rounded-xl border border-line p-3"><p className="text-xs capitalize text-slate-500">{key}s</p><p className="mt-1 font-semibold text-ink">{stats[key].active} active · {stats[key].inactive} inactive</p></article>)}</div>{section === 'Resolvers' && <ResolverCreate onCreated={async () => { setNotice('Resolver account provisioned. Share the initial password through a secure channel.'); await refresh() }} onError={setError} />}<div className="grid gap-2 sm:grid-cols-[1fr_12rem_12rem]"><input className="input-control standalone" placeholder="Search username or name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /><select className="input-control standalone" value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }} disabled={section === 'Resolvers'}><option value="">All roles</option><option value="student">Student</option><option value="admin">Administrator</option><option value="resolver">Resolver</option></select><select className="input-control standalone" value={active} onChange={(event) => { setActive(event.target.value); setPage(1) }}><option value="">All account states</option><option value="true">Active</option><option value="false">Inactive</option></select></div><div className="overflow-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase text-slate-500"><th className="p-2">User ID</th><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Grievances</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan="9" className="p-5"><LoadingState label="Loading users…" /></td></tr> : items.map((item) => <tr key={item._id} className="border-b border-line"><td className="p-2 font-mono text-xs">{item._id}</td><td>{item.username}</td><td>{item.name}</td><td>{item.email}</td><td className="capitalize">{item.role}</td><td>{formatDate(item.createdAt)}</td><td>{item.grievanceCount ?? '—'}</td><td>{item.active ? 'Active' : 'Inactive'}</td><td><div className="flex gap-2"><button className="button-secondary" onClick={() => inspectRecords(item)}>View records</button>{item.role === 'resolver' && <button className="button-secondary" onClick={() => editResolver(item)}><Pencil className="h-4 w-4" />Edit</button>}{item.role !== 'admin' && <button className="button-secondary" onClick={() => toggleAccount(item)}>{item.active ? 'Deactivate' : 'Activate'}</button>}</div></td></tr>)}</tbody></table>{!loading && items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No matching users.</p>}</div><div className="flex items-center justify-between border-t border-line pt-3 text-sm"><span>{pagination.total || 0} records · page {pagination.page || page} of {Math.max(1, pagination.pages || 1)}</span><div className="flex gap-2"><button className="button-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Previous</button><button className="button-secondary" disabled={page >= (pagination.pages || 1)} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="h-4 w-4" /></button></div></div></>}

    {section === 'System records' && <div className="overflow-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase text-slate-500"><th className="p-2">Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Record type</th><th>Record ID</th></tr></thead><tbody>{items.map((item) => <tr key={item._id} className="border-b border-line"><td className="p-2">{formatDate(item.createdAt)}</td><td>{item.actorName || 'System'}</td><td>{item.actorRole}</td><td>{item.action}</td><td>{item.targetType}</td><td className="font-mono text-xs">{item.targetId}</td></tr>)}</tbody></table><div className="flex justify-end gap-2 pt-3"><button className="button-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" />Previous</button><button className="button-secondary" disabled={page >= (pagination.pages || 1)} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="h-4 w-4" /></button></div></div>}
    <button className="button-secondary" onClick={refresh} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh this view</button>
    {recordSubject && <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-3" role="dialog" aria-modal="true" aria-labelledby="user-records-title"><section className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6"><header className="flex justify-between"><div><p className="eyebrow">{recordSubject.username}</p><h3 id="user-records-title" className="text-xl font-bold">{recordSubject.role === 'resolver' ? 'Handled grievances' : 'Submitted grievances'}</h3></div><button className="button-secondary" onClick={() => setRecordSubject(null)}>Close</button></header>{recordsLoading ? <LoadingState label="Loading associated records…" /> : !subjectRecords.length ? <p className="py-8 text-sm text-slate-500">No grievances are associated with this account.</p> : <div className="mt-4 divide-y divide-line">{subjectRecords.map((record) => <article key={record._id} className="py-3"><p className="text-xs font-bold text-accent">{record.trackingId}</p><p className="mt-1 font-semibold">{record.title}</p><p className="text-xs text-slate-500">{record.category} · {record.location} · {record.status} · {formatDate(record.createdAt)}</p></article>)}</div>}</section></div>}
  </section>
}

function ResolverCreate({ onCreated, onError }) {
  const [fields, setFields] = useState({ username: '', name: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setSaving(true)
    try { await api.post('/api/admin/resolvers', fields); setFields({ username: '', name: '', email: '', password: '' }); await onCreated() }
    catch (requestError) { onError(getErrorMessage(requestError)) }
    finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="grid gap-2 rounded-xl border border-line p-4 sm:grid-cols-2"><h3 className="font-semibold sm:col-span-2">Provision a resolver account</h3><input required minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" className="input-control standalone" placeholder="Username" value={fields.username} onChange={(event) => setFields({ ...fields, username: event.target.value })} /><input required minLength={2} maxLength={80} className="input-control standalone" placeholder="Name" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} /><input required type="email" className="input-control standalone" placeholder="Email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} /><input required type="password" minLength={8} className="input-control standalone" placeholder="Temporary password" value={fields.password} onChange={(event) => setFields({ ...fields, password: event.target.value })} /><button className="button-primary sm:col-span-2" disabled={saving}>{saving ? 'Provisioning…' : 'Create resolver'}</button><p className="text-xs text-slate-500 sm:col-span-2">The resolver must replace the temporary password after their first sign-in.</p></form>
}

export default AdminManagement
