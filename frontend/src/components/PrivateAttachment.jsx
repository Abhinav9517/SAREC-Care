import { useEffect, useState } from 'react'
import { AlertCircle, Download, LoaderCircle, Trash2 } from 'lucide-react'
import api, { getErrorMessage } from '../services/api'
import { getStoredUser } from '../utils/auth'

function PrivateAttachment({ grievanceId, attachment, canRemove = false, onRemoved }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [removable, setRemovable] = useState(canRemove)
  const [removed, setRemoved] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    const user = getStoredUser()
    api.get(`/api/grievances/${grievanceId}/attachments/${encodeURIComponent(attachment.storageName)}`, { responseType: 'blob' })
      .then((response) => { objectUrl = URL.createObjectURL(response.data); if (active) setUrl(objectUrl) })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Attachment is unavailable.')) })
    if (user?.role === 'student' && String(attachment.uploader) === user.id) api.get(`/api/grievances/${grievanceId}`).then((response) => { if (active && response.data.data.status === 'Pending') setRemovable(true) }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachment.storageName, attachment.uploader, grievanceId])

  const remove = async () => {
    try { await api.delete(`/api/grievances/${grievanceId}/attachments/${encodeURIComponent(attachment.storageName)}`); setRemoved(true); onRemoved?.(attachment.storageName) }
    catch (requestError) { setError(getErrorMessage(requestError, 'Attachment could not be removed.')) }
  }

  if (removed) return <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">Attachment removed.</p>
  return <article className="overflow-hidden rounded-xl border border-line bg-white p-2">
    {error ? <p className="flex items-center gap-2 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4" />{error}</p> : !url ? <p className="flex items-center gap-2 p-5 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading secure attachment…</p> : attachment.mimeType?.startsWith('image/') ? <img src={url} alt={attachment.originalName || 'Grievance attachment'} className="max-h-64 w-full rounded-lg object-contain" /> : <video src={url} controls preload="metadata" className="max-h-64 w-full rounded-lg" aria-label={attachment.originalName || 'Grievance video attachment'} />}
    <div className="flex items-center justify-between gap-2 px-1 pt-2"><span className="truncate text-xs text-slate-600">{attachment.originalName}</span><div className="flex">{url && <a href={url} download={attachment.originalName} className="rounded-lg p-2 text-accent hover:bg-slate-50" aria-label={`Download ${attachment.originalName}`}><Download className="h-4 w-4" /></a>}{removable && <button type="button" onClick={remove} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={`Remove ${attachment.originalName}`}><Trash2 className="h-4 w-4" /></button>}</div></div>
  </article>
}

export default PrivateAttachment
