'use client'

import CustosRescisaoView from '@/components/colaboradores/CustosRescisaoView'

export default function ColaboradoresCustosPage() {
  return (
    <div>
      <h2 className="mb-2 font-brand-primary text-lg font-semibold text-brand-midnight sm:text-xl">
        Custos e rescisão
      </h2>
      <p className="mb-6 font-brand-secondary text-sm text-brand-slate">
        Simulação do motor financeiro (TSU, subsídios proporcionais, provisões e salvaguarda de rescisão). Escolha um
        colaborador da sua empresa para pré-preencher dados da ficha ou utilize simulação manual.
      </p>
      <CustosRescisaoView />
    </div>
  )
}
