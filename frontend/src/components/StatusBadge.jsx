const statusStyles = {
  Pending: 'bg-rose-50 text-rose-700 ring-rose-200',
  'In-Progress': 'bg-amber-50 text-amber-700 ring-amber-200',
  'In Progress': 'bg-amber-50 text-amber-700 ring-amber-200',
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

function StatusBadge({ status }) {
  const style = statusStyles[status] || 'bg-slate-100 text-slate-600 ring-slate-200'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{status || 'Unknown'}</span>
}

export default StatusBadge
