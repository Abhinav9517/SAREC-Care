import { LoaderCircle } from 'lucide-react'

function LoadingState({ label = 'Loading your workspace...', compact = false }) {
  return <div className={`flex items-center justify-center gap-3 text-sm text-slate-500 ${compact ? 'py-8' : 'min-h-48'}`} role="status" aria-live="polite"><LoaderCircle className="h-5 w-5 animate-spin text-accent" aria-hidden="true" /><span>{label}</span></div>
}

export default LoadingState
