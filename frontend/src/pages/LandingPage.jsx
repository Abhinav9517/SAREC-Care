import { ArrowRight, BellRing, ClipboardCheck, Eye, LockKeyhole, MessageSquareText } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'

const features = [
  { icon: MessageSquareText, title: 'Easy grievance submission', text: 'Share an issue with a clear description, campus location, category, and supporting files.' },
  { icon: Eye, title: 'Transparent tracking', text: 'Follow status changes and official progress notes from submission to resolution.' },
  { icon: LockKeyhole, title: 'Secure student accounts', text: 'Private reports and attachments are available only to authorized users.' },
  { icon: BellRing, title: 'Campus announcements', text: 'Read important notices shared through the platform.' },
  { icon: ClipboardCheck, title: 'Accountable resolution', text: 'Campus teams can record updates, resolution details, and supporting evidence.' },
]

function LandingPage() {
  return <div className="min-h-screen bg-mist text-ink">
    <header className="border-b border-line bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8" aria-label="Main navigation">
        <a href="#home" aria-label="SAREC Care home"><Brand /></a>
        <div className="flex items-center gap-3"><a className="hidden text-sm font-semibold text-slate-600 hover:text-ink sm:inline" href="#how-it-works">How it works</a><Link className="button-secondary" to="/login">Log in</Link><Link className="button-primary" to="/login?mode=register">Get started <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
      </nav>
    </header>
    <main id="home">
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.15fr_0.85fr] md:py-24">
        <div><p className="eyebrow">Student Grievance &amp; Campus Support Platform</p><h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl lg:text-6xl">Your Campus. Your Voice. Our Responsibility.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-slate-600">SAREC Care gives students a clear way to report campus concerns, follow progress, and stay informed as issues move toward resolution.</p><div className="mt-8 flex flex-wrap gap-3"><Link className="button-primary px-5 py-3" to="/login">Log in to SAREC Care <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link><Link className="button-secondary px-5 py-3" to="/login?mode=register">Create a student account</Link></div><p className="mt-5 text-xs text-slate-500">An independent student-developed project. Not yet officially adopted by the college.</p></div>
        <div className="panel flex flex-col items-center bg-white p-8 text-center sm:p-10"><div className="rounded-full bg-navy p-2 shadow-soft"><img src="/sarec-care-logo.jpg" alt="SAREC Care student support logo" className="h-44 w-44 rounded-full object-contain sm:h-56 sm:w-56" /></div><p className="mt-6 text-sm font-semibold text-navy">Samrat Ashok Rajkiya Engineering College Care</p><p className="mt-2 text-sm text-slate-500">Mirzapur</p></div>
      </section>
      <section id="how-it-works" className="border-y border-line bg-white py-16 sm:py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="eyebrow">A clear path forward</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-navy">How the grievance process works</h2><p className="mt-3 text-sm leading-6 text-slate-600">Every report gets an identifiable place in the process, so students can see what happens next.</p></div><ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['01', 'Submit a grievance', 'Describe the concern and select its category and campus location.'], ['02', 'Receive a tracking ID', 'Keep the reference ID to find the report in your account.'], ['03', 'Track progress', 'Review status changes and updates from the campus team.'], ['04', 'Get a resolution', 'See the resolution notes and evidence when the case is completed.']].map(([number, title, text]) => <li key={number} className="rounded-2xl border border-line bg-mist p-5"><span className="text-xs font-bold tracking-widest text-accent">{number}</span><h3 className="mt-4 font-bold text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></li>)}</ol></div></section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"><div className="max-w-2xl"><p className="eyebrow">Designed for campus support</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-navy">A more understandable way to ask for help</h2></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article className="panel p-5" key={title}><span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-accent"><Icon className="h-5 w-5" aria-hidden="true" /></span><h3 className="mt-4 font-bold text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div><div className="mt-10 rounded-2xl bg-navy p-7 text-white sm:flex sm:items-center sm:justify-between sm:p-9"><div><h2 className="text-xl font-bold">Have a campus concern to report?</h2><p className="mt-2 text-sm text-slate-300">Sign in to submit a report and follow its progress.</p></div><Link className="button-primary mt-5 bg-white text-navy hover:bg-slate-100 sm:mt-0" to="/login">Continue to SAREC Care <ArrowRight className="h-4 w-4" /></Link></div></section>
    </main>
    <footer className="border-t border-line bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><Brand compact /><p className="mt-2 text-xs text-slate-500">Samrat Ashok Rajkiya Engineering College · Mirzapur</p></div><p className="max-w-xl text-xs leading-5 text-slate-500">SAREC Care is an independent student-developed project and is not yet officially adopted or endorsed by the college.</p></div></footer>
  </div>
}

export default LandingPage
