import { useMemo } from 'react'
import { BarChart3, CircleCheck, ClipboardList, Clock3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const defaultCategories = ['IT Hardware', 'Electrical', 'Plumbing', 'Housekeeping']
const statuses = ['Pending', 'In Progress', 'Resolved']
const categoryColors = ['#2161e8', '#7c5ce3', '#0f9f8f', '#e89b2c', '#d45087', '#4299a1']
const statusColors = { Pending: '#ef6475', 'In Progress': '#e3a52f', Resolved: '#2baa7b' }

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return <div className="panel flex items-start justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-ink">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div></div>
}

function Analytics({ grievances = [], summary = null }) {
  const data = useMemo(() => {
    const safeRecords = Array.isArray(grievances) ? grievances : []
    const categories = [...new Set([...defaultCategories, ...(summary?.categoryData || []).map((item) => item.name), ...safeRecords.map((item) => item.category).filter(Boolean)])]
    const categoryCounts = new Map(categories.map((category) => [category, 0]))
    const statusCounts = new Map(statuses.map((status) => [status, 0]))
    safeRecords.forEach((grievance) => {
      if (categoryCounts.has(grievance.category)) categoryCounts.set(grievance.category, categoryCounts.get(grievance.category) + 1)
      const status = grievance.status === 'In-Progress' ? 'In Progress' : grievance.status
      if (statusCounts.has(status)) statusCounts.set(status, statusCounts.get(status) + 1)
    })
    if (summary) {
      const serverCategories = new Map((summary.categoryData || []).map((item) => [item.name, item.value]))
      const serverStatuses = new Map((summary.statusData || []).map((item) => [item.name === 'In-Progress' ? 'In Progress' : item.name, item.value]))
      return {
        categoryData: categories.map((name) => ({ name, value: serverCategories.get(name) || 0 })),
        statusData: statuses.map((name) => ({ name, value: serverStatuses.get(name) || 0 })),
        total: summary.total || 0,
        active: summary.active || 0,
        resolvedRate: summary.resolutionRate || 0,
      }
    }
    const total = safeRecords.length
    const resolved = statusCounts.get('Resolved')
    return {
      categoryData: categories.map((name) => ({ name, value: categoryCounts.get(name) || 0 })),
      statusData: statuses.map((name) => ({ name, value: statusCounts.get(name) || 0 })),
      total,
      active: statusCounts.get('Pending') + statusCounts.get('In Progress'),
      resolvedRate: total ? Math.round((resolved / total) * 100) : 0,
    }
  }, [grievances, summary])

  return <section aria-labelledby="analytics-heading" className="space-y-4"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">At a glance</p><h2 id="analytics-heading" className="mt-1 text-xl font-bold tracking-tight text-ink">Campus operations pulse</h2></div><BarChart3 className="hidden h-5 w-5 text-slate-300 sm:block" aria-hidden="true" /></div>
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Total grievances" value={data.total} detail="All submitted records" icon={ClipboardList} tone="bg-blue-50 text-accent" /><MetricCard label="Active issues" value={data.active} detail="Pending or in progress" icon={Clock3} tone="bg-amber-50 text-amber-600" /><MetricCard label="Resolution rate" value={`${data.resolvedRate}%`} detail="Resolved of total" icon={CircleCheck} tone="bg-emerald-50 text-emerald-600" /></div>
    <div className="grid gap-4 lg:grid-cols-2"><div className="panel p-5"><div className="mb-4"><h3 className="font-semibold text-ink">Category distribution</h3><p className="mt-1 text-xs text-slate-500">Counts across the active and historical categories</p></div><div className="h-64" aria-label="Pie chart showing grievance distribution by category"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.categoryData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={56} outerRadius={82} paddingAngle={3}>{data.categoryData.map((entry, index) => <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} /><Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '11px' }} /></PieChart></ResponsiveContainer></div><p className="sr-only">{data.categoryData.map((item) => `${item.name}: ${item.value}`).join(', ')}</p></div>
      <div className="panel p-5"><div className="mb-4"><h3 className="font-semibold text-ink">Status distribution</h3><p className="mt-1 text-xs text-slate-500">Current workload across the resolution pipeline</p></div><div className="h-64" aria-label="Bar chart showing grievance distribution by status"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.statusData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7edf4" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#68778b' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#68778b' }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#f5f8fc' }} formatter={(value, name) => [value, name]} /><Bar dataKey="value" name="Grievances" radius={[5, 5, 0, 0]}>{data.statusData.map((entry) => <Cell key={entry.name} fill={statusColors[entry.name]} />)}</Bar></BarChart></ResponsiveContainer></div><p className="sr-only">{data.statusData.map((item) => `${item.name}: ${item.value}`).join(', ')}</p></div>
    </div>
  </section>
}

export default Analytics
