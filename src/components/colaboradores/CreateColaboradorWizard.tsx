'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'
import { MODALIDADES_CONTRATO_PT, TIPOS_CONTRATO_BASE_PT } from '@/lib/rh/contract-types'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  FileUp,
  Loader2,
  UserPlus,
} from 'lucide-react'

const STEPS = [
  { id: 1, label: 'Identidade e contrato' },
  { id: 2, label: 'Condições financeiras' },
  { id: 3, label: 'Documentos' },
] as const

type FormState = {
  nome: string
  nif: string
  niss: string
  email: string
  telemovel: string
  tipoContrato: string
  dataInicio: string
  cargo: string
  trabalhaSabado: boolean
  trabalhaDomingo: boolean
  vencimentoBase: string
  subsidioAlimentacao: string
  subsidioAlimentacaoTipo: 'cartao' | 'dinheiro'
  valorSeguroAcidentes: string
  contratoTeletrabalho: boolean
  contratoTempoParcial: boolean
  contratoModalidadeOutra: string
}

const initialForm: FormState = {
  nome: '',
  nif: '',
  niss: '',
  email: '',
  telemovel: '',
  tipoContrato: 'sem_termo',
  dataInicio: '',
  cargo: '',
  trabalhaSabado: true,
  trabalhaDomingo: true,
  vencimentoBase: '',
  subsidioAlimentacao: '',
  subsidioAlimentacaoTipo: 'cartao',
  valorSeguroAcidentes: '',
  contratoTeletrabalho: false,
  contratoTempoParcial: false,
  contratoModalidadeOutra: '',
}

function sanitizePathSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'ficheiro'
}

export default function CreateColaboradorWizard() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { isActive: impersonateActive, tenantId: impersonateTenantId } = useImpersonate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(initialForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [fileCc, setFileCc] = useState<File | null>(null)
  const [fileContrato, setFileContrato] = useState<File | null>(null)

  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [profileTenantId, setProfileTenantId] = useState<string | null>(null)
  const [tenants, setTenants] = useState<{ id: string; nome_empresa: string | null }[]>([])
  const [selectedPlatformTenant, setSelectedPlatformTenant] = useState('')

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  /** Só preenchido quando a API devolve `devInitialPassword` (modo dev sem convite por email). */
  const [devInitialPassword, setDevInitialPassword] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)

  const isPlatform = profileRole === 'superadmin' || profileRole === 'developer'

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return
      if (profile) {
        setProfileRole(profile.role ?? null)
        setProfileTenantId(profile.tenant_id ?? null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase || !isPlatform || impersonateActive) return
    if (profileTenantId) return
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

  const resolvedCompanyId = useMemo(() => {
    if (impersonateActive && impersonateTenantId) return impersonateTenantId
    if (!isPlatform && profileTenantId) return profileTenantId
    if (isPlatform && profileTenantId) return profileTenantId
    if (isPlatform && selectedPlatformTenant) return selectedPlatformTenant
    return null
  }, [
    impersonateActive,
    impersonateTenantId,
    isPlatform,
    profileTenantId,
    selectedPlatformTenant,
  ])

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  const validateStep1 = useCallback((): boolean => {
    const err: Record<string, string> = {}
    if (form.nome.trim().length < 2) err.nome = 'Nome completo obrigatório.'
    const nif = form.nif.replace(/\D/g, '')
    if (nif.length !== 9) err.nif = 'NIF com 9 dígitos.'
    if (form.niss.replace(/\s/g, '').length < 4) err.niss = 'NISS inválido.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) err.email = 'Email inválido.'
    if (!form.dataInicio) err.dataInicio = 'Data de início obrigatória.'
    if (!form.cargo.trim()) err.cargo = 'Cargo obrigatório.'
    // Superadmin/developer sem tenant_id: a API infere empresa (gestor_email / tenant_users); dropdown de tenant é opcional.
    setFieldErrors(err)
    return Object.keys(err).length === 0
  }, [form, isPlatform, impersonateActive, profileTenantId, selectedPlatformTenant])

  const validateStep2 = useCallback((): boolean => {
    const err: Record<string, string> = {}
    const vb = Number(form.vencimentoBase.replace(',', '.'))
    const sa = Number(form.subsidioAlimentacao.replace(',', '.'))
    const ins = Number(form.valorSeguroAcidentes.replace(',', '.'))
    if (!Number.isFinite(vb) || vb < 0) err.vencimentoBase = 'Valor inválido.'
    if (!Number.isFinite(sa) || sa < 0) err.subsidioAlimentacao = 'Valor inválido.'
    if (!Number.isFinite(ins) || ins < 0) err.valorSeguroAcidentes = 'Valor inválido.'
    setFieldErrors(err)
    return Object.keys(err).length === 0
  }, [form])

  const goNext = () => {
    setSubmitError(null)
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => Math.min(3, s + 1))
  }

  const goBack = () => {
    setSubmitError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  const handleSubmit = async () => {
    if (!validateStep2()) {
      setStep(2)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    setDevInitialPassword(null)
    setUploadProgress(null)

    const vencimentoBase = Number(form.vencimentoBase.replace(',', '.'))
    const subsidioAlimentacao = Number(form.subsidioAlimentacao.replace(',', '.'))
    const valorSeguroAcidentes = Number(form.valorSeguroAcidentes.replace(',', '.'))

    try {
      const payload = {
        companyId: resolvedCompanyId,
        nome: form.nome.trim(),
        nif: form.nif,
        niss: form.niss.replace(/\s/g, ''),
        email: form.email.trim(),
        telemovel: form.telemovel.trim(),
        tipoContrato: form.tipoContrato,
        dataInicio: form.dataInicio,
        cargo: form.cargo.trim(),
        vencimentoBase,
        subsidioAlimentacao,
        subsidioAlimentacaoTipo: form.subsidioAlimentacaoTipo,
        valorSeguroAcidentes,
        trabalhaSabado: form.trabalhaSabado,
        trabalhaDomingo: form.trabalhaDomingo,
        contratoTeletrabalho: form.contratoTeletrabalho,
        contratoTempoParcial: form.contratoTempoParcial,
        contratoModalidadeOutra: form.contratoModalidadeOutra.trim() || undefined,
      }

      const res = await fetch('/api/colaboradores/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const base =
          typeof data.error === 'string' ? data.error : 'Não foi possível criar o colaborador.'
        const detail = typeof (data as { detail?: string }).detail === 'string' ? (data as { detail: string }).detail : ''
        setSubmitError(
          process.env.NODE_ENV === 'development' && detail ? `${base} — ${detail}` : base,
        )
        setSubmitting(false)
        return
      }

      const employeeId = data.employeeId as string
      const companyId = data.companyId as string
      const pwd =
        typeof (data as { devInitialPassword?: string }).devInitialPassword === 'string'
          ? (data as { devInitialPassword: string }).devInitialPassword
          : null
      setDevInitialPassword(pwd)

      setSubmitSuccess(
        typeof data.message === 'string'
          ? data.message
          : 'Colaborador criado. Convite enviado por email.'
      )

      if (supabase && employeeId && companyId && (fileCc || fileContrato)) {
        const base = `${companyId}/${employeeId}`
        if (fileCc) {
          setUploadProgress('A enviar cartão de cidadão…')
          const path = `${base}/cartao_cidadao_${sanitizePathSegment(fileCc.name)}`
          const { error: upCc } = await supabase.storage.from('contracts').upload(path, fileCc, {
            upsert: true,
          })
          if (upCc) {
            setSubmitSuccess((prev) => `${prev} Documentos: o cartão não foi enviado (${upCc.message}).`)
          }
        }
        if (fileContrato) {
          setUploadProgress('A enviar contrato…')
          const path = `${base}/contrato_${sanitizePathSegment(fileContrato.name)}`
          const { error: upCt } = await supabase.storage.from('contracts').upload(path, fileContrato, {
            upsert: true,
          })
          if (upCt) {
            setSubmitSuccess((prev) => `${prev} Documentos: o contrato não foi enviado (${upCt.message}).`)
          }
        }
        setUploadProgress(null)
      }

      setForm(initialForm)
      setFileCc(null)
      setFileContrato(null)
      setStep(1)
    } catch (e) {
      console.error(e)
      setSubmitError('Erro de rede ou servidor.')
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-brand-border bg-brand-white px-3 py-2 font-brand-secondary text-brand-midnight focus:border-transparent focus:ring-2 focus:ring-brand-primary'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/colaboradores"
            className="mb-1 inline-flex items-center gap-1 text-sm font-brand-secondary text-brand-slate hover:text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à gestão
          </Link>
          <h2 className="font-brand-primary text-xl font-bold text-brand-midnight sm:text-2xl">
            Novo colaborador
          </h2>
          <p className="mt-1 font-brand-secondary text-sm text-brand-slate">
            Convite por email com link seguro para definir palavra-passe.
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
          <UserPlus className="h-5 w-5" />
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-brand-primary font-semibold ${
                    step > s.id
                      ? 'bg-brand-success text-white'
                      : step === s.id
                        ? 'bg-brand-primary text-white'
                        : 'bg-brand-border text-brand-slate'
                  }`}
                >
                  {step > s.id ? <Check className="h-5 w-5" /> : s.id}
                </div>
                <span
                  className={`hidden text-xs font-brand-secondary sm:block ${
                    step === s.id ? 'font-semibold text-brand-midnight' : 'text-brand-slate'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded ${step > s.id ? 'bg-brand-success' : 'bg-brand-border'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="brand-card p-6 md:p-8">
        {impersonateActive && impersonateTenantId && (
          <p className="mb-4 rounded-lg bg-brand-primary/10 px-3 py-2 text-sm font-brand-secondary text-brand-midnight">
            A criar colaborador no contexto da empresa em modo <strong>visão de cliente</strong>.
          </p>
        )}

        {isPlatform && !impersonateActive && !profileTenantId && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-brand-secondary font-medium text-brand-slate">
              Empresa (tenant){' '}
              <span className="font-normal text-brand-slate/80">— opcional se o seu email for o de gestor da empresa ou estiver em tenant_users</span>
            </label>
            <select
              value={selectedPlatformTenant}
              onChange={(e) => setSelectedPlatformTenant(e.target.value)}
              className={inputClass}
            >
              <option value="">— Usar empresa associada à conta —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome_empresa ?? t.id}
                </option>
              ))}
            </select>
            {fieldErrors.company && (
              <p className="mt-1 text-sm text-red-600 font-brand-secondary">{fieldErrors.company}</p>
            )}
          </div>
        )}

        {submitError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 font-brand-secondary">
            {submitSuccess}
          </div>
        )}

        {devInitialPassword && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 font-brand-secondary">
            <p className="mb-2 font-medium">Palavra-passe inicial (ambiente de desenvolvimento)</p>
            <p className="mb-2 text-amber-900/90">
              Não foi enviado email. Entregue esta palavra-passe ao colaborador de forma segura; não voltará a ser mostrada.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block flex-1 break-all rounded border border-amber-200 bg-white px-2 py-1.5 text-xs text-brand-midnight">
                {devInitialPassword}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(devInitialPassword)
                  } catch {
                    /* ignorar — utilizador pode copiar manualmente */
                  }
                }}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-brand-primary text-lg font-semibold text-brand-midnight">
              Identidade e dados contratuais
            </h2>
            <div>
              <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                Nome completo
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setField('nome', e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
              {fieldErrors.nome && <p className="mt-1 text-sm text-red-600">{fieldErrors.nome}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">NIF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.nif}
                  onChange={(e) => setField('nif', e.target.value)}
                  className={inputClass}
                  placeholder="9 dígitos"
                />
                {fieldErrors.nif && <p className="mt-1 text-sm text-red-600">{fieldErrors.nif}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">NISS</label>
                <input
                  type="text"
                  value={form.niss}
                  onChange={(e) => setField('niss', e.target.value)}
                  className={inputClass}
                />
                {fieldErrors.niss && <p className="mt-1 text-sm text-red-600">{fieldErrors.niss}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
                {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                  Telemóvel
                </label>
                <input
                  type="tel"
                  value={form.telemovel}
                  onChange={(e) => setField('telemovel', e.target.value)}
                  className={inputClass}
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="border-t border-brand-border pt-4">
              <p className="mb-3 text-sm font-brand-secondary text-brand-slate">Contrato</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                    Tipo de contrato (Código do Trabalho e figuras usuais)
                  </label>
                  <select
                    value={form.tipoContrato}
                    onChange={(e) => setField('tipoContrato', e.target.value)}
                    className={inputClass}
                  >
                    {TIPOS_CONTRATO_BASE_PT.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs font-brand-secondary text-brand-slate">
                    Escolha primeiro o tipo base. As modalidades (teletrabalho, tempo parcial) marcam-se abaixo e
                    coexistem com esse tipo.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-brand-secondary font-medium text-brand-slate">
                    Modalidades (opcional)
                  </p>
                  <div className="space-y-3 rounded-lg border border-brand-border bg-brand-light/40 p-4">
                    {MODALIDADES_CONTRATO_PT.map((m) => (
                      <label
                        key={m.key}
                        className="flex cursor-pointer items-start gap-3 font-brand-secondary text-sm text-brand-midnight"
                      >
                        <input
                          type="checkbox"
                          checked={
                            m.key === 'teletrabalho'
                              ? form.contratoTeletrabalho
                              : form.contratoTempoParcial
                          }
                          onChange={(e) =>
                            m.key === 'teletrabalho'
                              ? setField('contratoTeletrabalho', e.target.checked)
                              : setField('contratoTempoParcial', e.target.checked)
                          }
                          className="mt-1 rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                        />
                        <span>
                          <span className="font-medium">{m.label}</span>
                          <span className="mt-0.5 block text-xs text-brand-slate">{m.hint}</span>
                        </span>
                      </label>
                    ))}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-brand-slate">
                        Outra modalidade / notas (opcional)
                      </label>
                      <textarea
                        value={form.contratoModalidadeOutra}
                        onChange={(e) => setField('contratoModalidadeOutra', e.target.value)}
                        rows={2}
                        className={inputClass}
                        placeholder="Ex.: trabalho híbrido 3+2, horário concentrado, etc."
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                    Data de início
                  </label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={(e) => setField('dataInicio', e.target.value)}
                    className={inputClass}
                  />
                  {fieldErrors.dataInicio && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.dataInicio}</p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">Cargo</label>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={(e) => setField('cargo', e.target.value)}
                  className={inputClass}
                />
                {fieldErrors.cargo && <p className="mt-1 text-sm text-red-600">{fieldErrors.cargo}</p>}
              </div>
              <div className="mt-4 rounded-lg border border-brand-border bg-brand-light/50 p-4">
                <p className="mb-1 text-sm font-brand-secondary font-medium text-brand-midnight">
                  Escalas — fim de semana
                </p>
                <p className="mb-3 text-xs font-brand-secondary text-brand-slate">
                  Utilizado pelo motor de escalas: se desmarcar, não serão atribuídos turnos nesse dia.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  <label className="flex cursor-pointer items-center gap-2 font-brand-secondary text-sm text-brand-midnight">
                    <input
                      type="checkbox"
                      checked={form.trabalhaSabado}
                      onChange={(e) => setField('trabalhaSabado', e.target.checked)}
                      className="rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                    />
                    Disponível ao sábado
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 font-brand-secondary text-sm text-brand-midnight">
                    <input
                      type="checkbox"
                      checked={form.trabalhaDomingo}
                      onChange={(e) => setField('trabalhaDomingo', e.target.checked)}
                      className="rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                    />
                    Disponível ao domingo
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-brand-primary text-lg font-semibold text-brand-midnight">
              Condições financeiras
            </h2>
            <div>
              <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                Vencimento base (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.vencimentoBase}
                onChange={(e) => setField('vencimentoBase', e.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
              {fieldErrors.vencimentoBase && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.vencimentoBase}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                Subsídio de alimentação (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.subsidioAlimentacao}
                onChange={(e) => setField('subsidioAlimentacao', e.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
              {fieldErrors.subsidioAlimentacao && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.subsidioAlimentacao}</p>
              )}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-brand-secondary font-medium text-brand-slate">
                Modalidade do subsídio
              </legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 font-brand-secondary text-sm text-brand-midnight">
                  <input
                    type="radio"
                    name="subtipo"
                    checked={form.subsidioAlimentacaoTipo === 'cartao'}
                    onChange={() => setField('subsidioAlimentacaoTipo', 'cartao')}
                    className="text-brand-primary focus:ring-brand-primary"
                  />
                  Cartão refeição
                </label>
                <label className="flex cursor-pointer items-center gap-2 font-brand-secondary text-sm text-brand-midnight">
                  <input
                    type="radio"
                    name="subtipo"
                    checked={form.subsidioAlimentacaoTipo === 'dinheiro'}
                    onChange={() => setField('subsidioAlimentacaoTipo', 'dinheiro')}
                    className="text-brand-primary focus:ring-brand-primary"
                  />
                  Dinheiro
                </label>
              </div>
            </fieldset>
            <div>
              <label className="mb-1 block text-sm font-brand-secondary font-medium text-brand-slate">
                Valor seguro acidentes de trabalho (€ / mês)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.valorSeguroAcidentes}
                onChange={(e) => setField('valorSeguroAcidentes', e.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
              {fieldErrors.valorSeguroAcidentes && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.valorSeguroAcidentes}</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-brand-primary text-lg font-semibold text-brand-midnight">
              Documentos iniciais
            </h2>
            <p className="text-sm font-brand-secondary text-brand-slate">
              Opcional neste momento. Os ficheiros são guardados em{' '}
              <code className="rounded bg-brand-light px-1 text-xs">contracts</code> na pasta{' '}
              <code className="rounded bg-brand-light px-1 text-xs">{'{empresa}/{colaborador}/'}</code> após criar o
              registo.
            </p>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-brand-secondary font-medium text-brand-slate">
                <FileUp className="h-4 w-4" />
                Cartão de cidadão (PDF ou imagem)
              </label>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setFileCc(e.target.files?.[0] ?? null)}
                className="block w-full text-sm font-brand-secondary text-brand-slate file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary file:px-3 file:py-2 file:text-white"
              />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-brand-secondary font-medium text-brand-slate">
                <FileUp className="h-4 w-4" />
                Contrato assinado (PDF)
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFileContrato(e.target.files?.[0] ?? null)}
                className="block w-full text-sm font-brand-secondary text-brand-slate file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary file:px-3 file:py-2 file:text-white"
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1 || submitting}
            className="rounded-lg border border-brand-border px-4 py-2 font-brand-secondary text-sm font-medium text-brand-midnight hover:bg-brand-light disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="flex items-center gap-2">
            {uploadProgress && (
              <span className="flex items-center gap-1 text-sm text-brand-slate font-brand-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploadProgress}
              </span>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-5 py-2 font-brand-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Seguinte
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || (isPlatform && !resolvedCompanyId)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-midnight px-5 py-2 font-brand-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A processar…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Criar colaborador
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
