'use client'

import DashboardLayout from '@/components/DashboardLayout'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-brand-primary font-bold text-brand-midnight mb-6">
          Dashboard
        </h1>
        <div className="brand-card p-8">
          <p className="text-brand-slate font-brand-secondary">
            Análises e métricas do negócio - Em desenvolvimento
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
