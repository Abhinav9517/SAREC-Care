import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import api, { getErrorMessage } from '../services/api'

const sessionKey = (userId, id) => `campus-announcement-dismissed:${userId || 'user'}:${id}`

function AnnouncementCenter({ userId }) {
  const [items, setItems] = useState([])
  const [images, setImages] = useState({})
  const [imageErrors, setImageErrors] = useState({})
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState([])
  const [acknowledging, setAcknowledging] = useState(false)

  useEffect(() => {
    let active = true
    api.get('/api/announcements').then((response) => { if (active) setItems(response.data.data || []) }).catch((requestError) => { if (active) setError(getErrorMessage(requestError)) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const created = []
    Promise.all(items.filter((item) => item.imageAttachment?.storageName).map(async (item) => {
      try {
        const response = await api.get(`/api/announcements/${item._id}/image`, { responseType: 'blob' })
        const url = URL.createObjectURL(response.data)
        created.push(url)
        if (active) setImages((current) => ({ ...current, [item._id]: url }))
      } catch {
        if (active) setImageErrors((current) => ({ ...current, [item._id]: 'Image unavailable; the notice text is still available.' }))
      }
    }))
    return () => { active = false; created.forEach(URL.revokeObjectURL) }
  }, [items])

  const eligible = useMemo(() => items.filter((item) => item.popup && !item.acknowledged && (item.mandatory || (!dismissed.includes(item._id) && !sessionStorage.getItem(sessionKey(userId, item._id))))), [dismissed, items, userId])
  const selected = eligible[0]

  const dismiss = async (acknowledge = false) => {
    if (!selected || acknowledging) return
    if (selected.mandatory && !acknowledge) return
    if (acknowledge) {
      setError('')
      setAcknowledging(true)
      try { await api.post(`/api/announcements/${selected._id}/acknowledge`); setItems((current) => current.map((item) => item._id === selected._id ? { ...item, acknowledged: true } : item)) }
      catch (requestError) { setError(getErrorMessage(requestError)); return }
      finally { setAcknowledging(false) }
    } else sessionStorage.setItem(sessionKey(userId, selected._id), 'seen')
    setDismissed((current) => [...current, selected._id])
  }

  return <section className="panel p-5" aria-labelledby="announcements-title">
    <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-accent" /><h2 id="announcements-title" className="font-bold text-ink">Campus announcements</h2></div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {!items.length ? <p className="mt-3 text-sm text-slate-500">There are no active announcements right now.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{items.map((item) => <article className="rounded-xl border border-line p-4" key={item._id}>{images[item._id] && <img src={images[item._id]} alt="" className="mb-3 max-h-40 w-full rounded-lg object-cover" />}<p className="font-semibold text-ink">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.text}</p>{imageErrors[item._id] && <p role="status" className="mt-2 text-xs text-amber-700">{imageErrors[item._id]}</p>}<p className="mt-2 text-xs text-slate-400">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.startsAt))}</p></article>)}</div>}
    {selected && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4" role="dialog" aria-modal="true" aria-labelledby="announcement-popup-title"><article className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-card"><button type="button" className="icon-button absolute right-4 top-4" onClick={() => dismiss(false)} aria-label="Close announcement" disabled={selected.mandatory || acknowledging}><X className="h-5 w-5" /></button>{images[selected._id] && <img src={images[selected._id]} alt="" className="mb-4 max-h-64 w-full rounded-xl object-cover" />}<p className="eyebrow">Campus notice</p><h2 id="announcement-popup-title" className="mt-2 pr-8 text-xl font-bold text-ink">{selected.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.text}</p>{imageErrors[selected._id] && <p role="status" className="mt-2 text-xs text-amber-700">{imageErrors[selected._id]}</p>}{error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="mt-5 flex justify-end gap-2">{!selected.mandatory && <button className="button-secondary" onClick={() => dismiss(false)} disabled={acknowledging}>Close</button>}<button className="button-primary" onClick={() => dismiss(true)} disabled={acknowledging}><Check className="h-4 w-4" />{acknowledging ? 'Acknowledging…' : selected.mandatory ? 'Acknowledge notice' : 'Got it'}</button></div></article></div>}
  </section>
}

export default AnnouncementCenter
