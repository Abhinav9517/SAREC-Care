function Brand({ compact = false, inverse = false }) {
  return <div className="flex min-w-0 items-center gap-3">
    <img className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} shrink-0 rounded-full object-contain`} src="/sarec-care-logo.jpg" alt="SAREC Care logo" />
    <div className="min-w-0">
      <p className={`truncate font-bold tracking-tight ${inverse ? 'text-white' : 'text-ink'}`}>SAREC Care</p>
      {!compact && <p className={`hidden text-xs sm:block ${inverse ? 'text-slate-300' : 'text-slate-500'}`}>Student Grievance &amp; Campus Support</p>}
    </div>
  </div>
}

export default Brand
