'use client'

import { useEffect, useMemo, useState } from 'react'
import ScheduleModule from '@/components/ScheduleModule'
import type { ScheduleCollaborator } from '@/types/scheduling'
import { useRhCompanyId } from '@/hooks/useRhCompanyId'
import { Loader2, AlertCircle } from 'lucide-react'

const DEMO_COLABORADORES: ScheduleCollaborator[] = [
  { id: '11111111-1111-1111-1111-111111111101', nome: 'Ana Costa' },
  { id: '11111111-1111-1111-1111-111111111102', nome: 'Bruno Silva' },
  { id: '11111111-1111-1111-1111-111111111103', nome: 'Carla Mendes' },
]

export default function ColaboradoresEscalasPage() {
  const [selectedPlatformTenant, setSelectedPlatformTenant] = useState('')
  const { supabase, companyId, isPlatform, profileTenantId, impersonateActive, loading: ctxLoading } =
    useRhCompanyId(selectedPlatformTenant)

  const [tenants, setTenants] = useState<{ id: string; nome: string | null }[]>([])
  const [colaboradores, setColaboradores] = useState<ScheduleCollaborator[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)

  useEffect(() => {
    if (!supabase || !isPlatform || impersonateActive || profileTenantId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('tenants').select('id, nome').order('nome')
      if (cancelled || error) return
      setTenants(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, isPlatform, impersonateActive, profileTenantId])

  useEffect(() => {
    if (!supabase || !companyId) {
      setColaboradores(DEMO_COLABORADORES)
      setLoadError(null)
      return
    }
    let cancelled = false
    setLoadingList(true)
    setLoadError(null)
    ;(async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome, trabalha_sabado, trabalha_domingo')
        .eq('company_id', companyId)
        .order('nome')
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setColaboradores(DEMO_COLABORADORES)
      } else if (data && data.length > 0) {
        setColaboradores(
          data.map((r) => ({
            id: r.id,
            nome: r.nome,
            worksSaturday: r.trabalha_sabado !== false,
            worksSunday: r.trabalha_domingo !== false,
          })),
        )
      } else {
        setColaboradores([])
      }
      setLoadingList(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, companyId])

  const inputClass =
    'w-full max-w-md rounded-lg border border-brand-border bg-brand-white px-3 py-2 font-brand-secondary text-brand-midnight focus:border-transparent focus:ring-2 focus:ring-brand-primary'

  const effectiveCompanyId = companyId ?? undefined

  const subtitle = useMemo(() => {
    if (!companyId) return 'Sem tenant resolvido — a usar colaboradores de demonstração no calendário.'
    return 'Colaboradores e regras de fim de semana vêm da base de dados desta empresa.'
  }, [companyId])

  return (
    <div>
      <h2 className="mb-2 font-brand-primary text-lg font-semibold text-brand-midnight sm:text-xl">
        Escalas flexíveis
      </h2>
      <p className="mb-4 font-brand-secondary text-sm text-brand-slate">{subtitle}</p>

      {isPlatform && !impersonateActive && !profileTenantId && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-brand-secondary font-medium text-brand-slate">
            Empresa (plataforma)
          </label>
          <select
            value={selectedPlatformTenant}
            onChange={(e) => setSelectedPlatformTenant(e.target.value)}
            className={inputClass}
          >
            <option value="">— Selecionar empresa —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome ?? t.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {!companyId && !ctxLoading && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 font-brand-secondary">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Selecione empresa ou use visão de cliente para carregar colaboradores reais; até lá, o calendário usa o
          conjunto de demonstração.
        </div>
      )}

      {loadError && (
        <div className="mb-4 text-sm text-red-600 font-brand-secondary">
          Erro ao carregar colaboradores: {loadError}
        </div>
      )}

      {loadingList && companyId ? (
        <div className="flex items-center gap-2 py-8 text-brand-slate font-brand-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          A carregar equipa…
        </div>
      ) : companyId && colaboradores.length === 0 ? (
        <div className="brand-card p-10 text-center font-brand-secondary text-sm text-brand-slate">
          Esta empresa ainda não tem colaboradores. Adicione colaboradores no separador{' '}
          <strong>Novo colaborador</strong> para planear escalas com a equipa real.
        </div>
      ) : (
        <ScheduleModule companyId={effectiveCompanyId} colaboradores={colaboradores} />
      )}
    </div>
  )
}
