'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import EmployeeFinancials from '@/components/EmployeeFinancials'
import { useRhCompanyId } from '@/hooks/useRhCompanyId'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'
import { AlertCircle, Loader2 } from 'lucide-react'

type EmployeeRow = {
  id: string
  nome: string
  vencimento_base: number | null
  base_salary: number | null
  subsidio_alimentacao: number | null
  meal_allowance: number | null
  insurance_value: number | null
  contract_start_date: string | null
  data_admissao: string
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  const s = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10)
}

export default function CustosRescisaoView() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { isActive: impersonateActive, tenantId: impersonateTenantId } = useImpersonate()
  const [platformTenant, setPlatformTenant] = useState('')
  const { companyId, loading: companyLoading, isPlatform, profileTenantId } =
    useRhCompanyId(platformTenant)

  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [tenants, setTenants] = useState<{ id: string; nome: string | null }[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user || cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (!cancelled) setProfileRole(profile?.role ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const isPlatformUser = profileRole === 'superadmin' || profileRole === 'developer'

  useEffect(() => {
    if (!supabase || !isPlatformUser || impersonateActive) return
    if (profileTenantId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('tenants').select('id, nome').order('nome')
      if (cancelled || error) return
      setTenants(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, isPlatformUser, impersonateActive, profileTenantId])

  const loadEmployees = useCallback(async () => {
    if (!supabase || !companyId) {
      setEmployees([])
      return
    }
    setListLoading(true)
    setListError(null)
    const { data, error } = await supabase
      .from('employees')
      .select(
        'id, nome, vencimento_base, base_salary, subsidio_alimentacao, meal_allowance, insurance_value, contract_start_date, data_admissao',
      )
      .eq('company_id', companyId)
      .is('data_saida', null)
      .order('nome')

    setListLoading(false)
    if (error) {
      setListError(error.message || 'Não foi possível carregar colaboradores.')
      setEmployees([])
      return
    }
    setEmployees((data as EmployeeRow[]) ?? [])
  }, [supabase, companyId])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

  const selected = useMemo(
    () => (selectedId ? employees.find((e) => e.id === selectedId) : undefined),
    [employees, selectedId],
  )

  const financialInitials = useMemo(() => {
    if (!selected) {
      return {
        key: 'manual' as const,
        label: undefined as string | undefined,
        base: undefined as number | undefined,
        meal: undefined as number | undefined,
        insurance: undefined as number | undefined,
        contract: undefined as string | undefined,
      }
    }
    const base = selected.base_salary ?? selected.vencimento_base ?? undefined
    const meal = selected.meal_allowance ?? selected.subsidio_alimentacao ?? undefined
    const insurance = selected.insurance_value ?? undefined
    const contract = toDateInput(selected.contract_start_date ?? selected.data_admissao)
    return {
      key: selected.id,
      label: selected.nome,
      base: base != null ? Number(base) : undefined,
      meal: meal != null ? Number(meal) : undefined,
      insurance: insurance != null ? Number(insurance) : undefined,
      contract,
    }
  }, [selected])

  const showPlatformPicker =
    isPlatformUser && !impersonateActive && !profileTenantId

  if (companyLoading && !companyId) {
    return (
      <div className="flex items-center gap-2 py-12 text-brand-slate">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        <span className="font-brand-secondary text-sm">A carregar contexto da empresa…</span>
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-brand-secondary">
        {showPlatformPicker ? (
          <>
            <p className="mb-3">Selecione a empresa para listar colaboradores e simular custos.</p>
            <select
              value={platformTenant}
              onChange={(e) => {
                setPlatformTenant(e.target.value)
                setSelectedId('')
              }}
              className="w-full max-w-md rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-midnight"
            >
              <option value="">— Empresa —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome ?? t.id}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p>Não foi possível determinar a empresa (tenant). Confirme o seu perfil ou contacte o administrador.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {impersonateActive && impersonateTenantId && (
        <p className="rounded-lg bg-brand-primary/10 px-3 py-2 text-sm font-brand-secondary text-brand-midnight">
          A simular no contexto da empresa em modo <strong>visão de cliente</strong>.
        </p>
      )}

      {showPlatformPicker && (
        <div>
          <label className="mb-2 block text-sm font-medium text-brand-slate">Empresa (tenant)</label>
          <select
            value={platformTenant}
            onChange={(e) => {
              setPlatformTenant(e.target.value)
              setSelectedId('')
            }}
            className="w-full max-w-md rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-midnight"
          >
            <option value="">— Selecionar —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome ?? t.id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-brand border border-brand-border bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-brand-slate">Colaborador</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={listLoading}
            className="w-full flex-1 rounded-lg border border-brand-border px-3 py-2 text-brand-midnight sm:max-w-xl"
          >
            <option value="">Simulação manual (sem colaborador)</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSelectedId('')}
            className="shrink-0 rounded-lg border border-brand-border px-3 py-2 text-sm font-medium text-brand-midnight hover:bg-brand-light"
          >
            Limpar seleção
          </button>
        </div>
        {listLoading ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-brand-slate">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar lista…
          </p>
        ) : null}
        {listError ? (
          <div className="mt-2 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {listError}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-brand-slate">
          Colaboradores sem data de saída. Escolha um para pré-preencher o simulador ou use simulação manual.
        </p>
      </div>

      <div className="brand-card p-6 md:p-8">
        <EmployeeFinancials
          key={financialInitials.key}
          employeeLabel={financialInitials.label}
          initialBaseSalary={financialInitials.base}
          initialMealAllowance={financialInitials.meal}
          initialInsuranceValue={financialInitials.insurance}
          initialContractStart={financialInitials.contract}
        />
      </div>
    </div>
  )
}
