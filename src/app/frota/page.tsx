'use client'

import DashboardLayout from '@/components/DashboardLayout'

export default function Frota() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-brand-primary font-bold text-brand-midnight mb-6">
          Gestão de Frota
        </h1>
        <div className="brand-card p-8">
          <p className="text-brand-slate font-brand-secondary">
            Controlo de veículos e otimização de rotas - Em desenvolvimento
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
