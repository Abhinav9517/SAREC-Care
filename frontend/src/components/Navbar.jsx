import { LogOut, ShieldCheck } from 'lucide-react'
import Brand from './Brand'

function Navbar({ user, onLogout }) {
  const isAdmin = user?.role === 'admin'
  return <header className="border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8"><Brand compact /><div className="flex items-center gap-3 sm:gap-5"><div className="hidden text-right sm:block"><p className="text-sm font-semibold text-ink">{user?.name}</p><p className="flex items-center justify-end gap-1 text-xs capitalize text-slate-500">{isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}{user?.role}</p></div><button type="button" onClick={onLogout} className="button-secondary gap-2 px-3 py-2 text-xs sm:px-4 sm:text-sm"><LogOut className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span><span className="sm:hidden">Exit</span></button></div></div></header>
}

export default Navbar
