'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { UserPlus, Loader2, AlertCircle } from 'lucide-react'
import { useRhCompanyId } from '@/hooks/useRhCompanyId'

type EmployeeRow = {
  id: string
  nome: string
  email: string | null
  cargo: string
  tipo_contrato: string | null
  trabalha_sabado: boolean | null
  trabalha_domingo: boolean | null
}

export default function ColaboradoresGestaoPage() {
  const [selectedPlatformTenant, setSelectedPlatformTenant] = useState('')
  const { supabase, companyId, isPlatform, profileTenantId, impersonateActive, loading: ctxLoading } =
    useRhCompanyId(selectedPlatformTenant)

  const [tenants, setTenants] = useState<{ id: string; nome_empresa: string | null }[]>([])
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !isPlatform || impersonateActive || profileTenantId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nome_empresa')
        .order('nome_empresa')
      if (cancelled || error) return
      setTenants(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, isPlatform, impersonateActive, profileTenantId])

  useEffect(() => {
    if (!supabase || !companyId) {
      setRows([])
      return
    }
    let cancelled = false
    setListLoading(true)
    setListError(null)
    ;(async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome, email, cargo, tipo_contrato, trabalha_sabado, trabalha_domingo')
        .eq('company_id', companyId)
        .order('nome')
      if (cancelled) return
      if (error) {
        setListError(error.message)
        setRows([])
      } else {
        setRows((data as EmployeeRow[]) ?? [])
      }
      setListLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, companyId])

  const inputClass =
    'w-full max-w-md rounded-lg border border-brand-border bg-brand-white px-3 py-2 font-brand-secondary text-brand-midnight focus:border-transparent focus:ring-2 focus:ring-brand-primary'

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-brand-primary text-lg font-semibold text-brand-midnight sm:text-xl">
            Gestão de colaboradores
          </h2>
          <p className="font-brand-secondary text-sm text-brand-slate">
            Lista da empresa atual; criação e convites no separador <strong>Novo colaborador</strong>.
          </p>
        </div>
        <Link
          href="/colaboradores/novo"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 font-brand-primary text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          Novo colaborador
        </Link>
      </div>

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
                {t.nome_empresa ?? t.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {!companyId && !ctxLoading && (
        <div className="brand-card flex items-start gap-2 p-6 text-sm text-brand-slate font-brand-secondary">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
          <div>
            <p className="font-medium text-brand-midnight">Sem empresa definida</p>
            <p className="mt-1">
              Associe um tenant ao seu perfil, use a <strong>visão de cliente</strong> ou selecione uma empresa
              acima.
            </p>
          </div>
        </div>
      )}

      {companyId && (
        <div className="brand-card overflow-hidden p-0">
          {listLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-brand-slate font-brand-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              A carregar colaboradores…
            </div>
          ) : listError ? (
            <div className="flex items-start gap-2 p-6 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              {listError}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center font-brand-secondary text-sm text-brand-slate">
              Nenhum colaborador nesta empresa. Utilize <strong>Novo colaborador</strong> para convidar o primeiro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm font-brand-secondary">
                <thead className="border-b border-brand-border bg-brand-light/60 text-brand-slate">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Cargo</th>
                    <th className="px-4 py-3 font-medium">Contrato</th>
                    <th className="px-4 py-3 font-medium">Fim de semana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-brand-midnight">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-light/40">
                      <td className="px-4 py-3 font-medium">{r.nome}</td>
                      <td className="px-4 py-3 text-brand-slate">{r.email ?? '—'}</td>
                      <td className="px-4 py-3">{r.cargo}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-brand-slate" title={r.tipo_contrato ?? ''}>
                        {r.tipo_contrato ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-slate">
                        Sáb.: {r.trabalha_sabado === false ? 'não' : 'sim'} · Dom.:{' '}
                        {r.trabalha_domingo === false ? 'não' : 'sim'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs font-brand-secondary text-brand-slate">
        A edição detalhada da ficha (alteração) pode ligar-se a cada linha numa próxima iteração.
      </p>
    </div>
  )
}
