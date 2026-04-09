'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, Calculator, CalendarDays, UserPlus, Users } from 'lucide-react'

const tabs = [
  { href: '/colaboradores', label: 'Gestão', icon: Users, match: (p: string) => p === '/colaboradores' },
  {
    href: '/colaboradores/novo',
    label: 'Novo colaborador',
    icon: UserPlus,
    match: (p: string) => p.startsWith('/colaboradores/novo'),
  },
  {
    href: '/colaboradores/escalas',
    label: 'Escalas',
    icon: CalendarDays,
    match: (p: string) => p.startsWith('/colaboradores/escalas'),
  },
  {
    href: '/colaboradores/custos',
    label: 'Custos e rescisão',
    icon: Calculator,
    match: (p: string) => p.startsWith('/colaboradores/custos'),
  },
] as const

export default function ColaboradoresTabs() {
  const pathname = usePathname() ?? ''

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-brand-primary text-2xl font-bold text-brand-midnight sm:text-3xl">
              Recursos humanos
            </h1>
            <p className="font-brand-secondary text-sm text-brand-slate">
              Colaboradores, escalas e simulações no mesmo módulo.
            </p>
          </div>
        </div>
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-xl border border-brand-border bg-brand-white p-1 shadow-sm"
        aria-label="Secções de colaboradores"
      >
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-brand-secondary font-medium transition-colors sm:px-4 ${
                active
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-slate hover:bg-brand-light hover:text-brand-midnight'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
