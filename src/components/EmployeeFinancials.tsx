'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

export interface EmployeeFinancialsProps {
  /** Valores iniciais (ex.: da ficha employees) */
  initialBaseSalary?: number
  initialBonuses?: number
  initialMealAllowance?: number
  initialInsuranceValue?: number
  initialContractStart?: string
  employeeLabel?: string
}

export interface CalculateCostsResponse {
  ok: boolean
  error?: string
  detail?: string
  warnings?: string[]
  disclaimer?: string
  tsu?: {
    employerRate: string
    employeeRate: string
    incidenceBase: string
    employerAmount: string
    employeeAmount: string
    totalTsuCharge: string
  }
  subsidies?: {
    referenceMonthly: string
    feriasProportional: string
    natalProportional: string
    monthsCountedInYear: string
    accrualFraction: string
    method: string
  }
  termination?: {
    tenureYears: string
    rawIndemnityDays: string
    cappedIndemnityDays: string
    indemnitySafeguard: string
    capByTwelveMonths: string
    capApplied: string
    model: string
  }
  vacation?: {
    unusedVacationDays: string
    provisionUnusedVacation: string
    assumedUnusedDays: boolean
    dailyVacationValue: string
  }
  medicalExams?: {
    annualBudget: string
    provisionProportional: string
  }
  insuranceEmployerMonthly?: string
  totals?: {
    monthlyEmployerCostEstimate: string
    provisionsTotalEstimate: string
  }
}

const eur = (value: string | undefined) => {
  if (value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function EmployeeFinancials({
  initialBaseSalary,
  initialBonuses,
  initialMealAllowance,
  initialInsuranceValue,
  initialContractStart,
  employeeLabel,
}: EmployeeFinancialsProps) {
  const [baseSalary, setBaseSalary] = useState(
    initialBaseSalary != null ? String(initialBaseSalary) : '',
  )
  const [bonuses, setBonuses] = useState(
    initialBonuses != null ? String(initialBonuses) : '',
  )
  const [mealAllowance, setMealAllowance] = useState(
    initialMealAllowance != null ? String(initialMealAllowance) : '',
  )
  const [insuranceValue, setInsuranceValue] = useState(
    initialInsuranceValue != null ? String(initialInsuranceValue) : '',
  )
  const [contractStart, setContractStart] = useState(
    initialContractStart ?? new Date().toISOString().slice(0, 10),
  )
  const [referenceDate, setReferenceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [unusedVacationDays, setUnusedVacationDays] = useState('')
  const [medicalAnnual, setMedicalAnnual] = useState('50')
  const [includeMealInTsu, setIncludeMealInTsu] = useState(false)

  /** Referência estável — evita novo objeto a cada render (que rebentava o debounce e gerava pedidos em loop). */
  const inputPayload = useMemo(
    () => ({
      baseSalary,
      bonuses,
      mealAllowance,
      insuranceValue,
      contractStart,
      referenceDate,
      unusedVacationDays,
      medicalAnnual,
      includeMealInTsu,
    }),
    [
      baseSalary,
      bonuses,
      mealAllowance,
      insuranceValue,
      contractStart,
      referenceDate,
      unusedVacationDays,
      medicalAnnual,
      includeMealInTsu,
    ],
  )

  const debouncedPayload = useDebounced(inputPayload, 380)

  const [result, setResult] = useState<CalculateCostsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [invokeError, setInvokeError] = useState<string | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)

  const runCalc = useCallback(async () => {
    fetchAbortRef.current?.abort()

    const rawBase = debouncedPayload.baseSalary.trim()
    if (rawBase === '') {
      setLoading(false)
      setResult(null)
      setInvokeError(null)
      return
    }

    const base = Number(rawBase.replace(',', '.'))
    if (!Number.isFinite(base)) {
      setLoading(false)
      setResult(null)
      setInvokeError(null)
      return
    }

    const ac = new AbortController()
    fetchAbortRef.current = ac

    setLoading(true)
    setInvokeError(null)

    const body: Record<string, unknown> = {
      base_salary: base,
      bonuses: Number(debouncedPayload.bonuses.replace(',', '.')) || 0,
      meal_allowance: Number(debouncedPayload.mealAllowance.replace(',', '.')) || 0,
      insurance_value: Number(debouncedPayload.insuranceValue.replace(',', '.')) || 0,
      contract_start_date: debouncedPayload.contractStart,
      reference_date: debouncedPayload.referenceDate,
      include_meal_in_tsu: debouncedPayload.includeMealInTsu,
      medical_exam_annual_cost: Number(debouncedPayload.medicalAnnual.replace(',', '.')) || 50,
    }
    const uvd = debouncedPayload.unusedVacationDays.trim()
    if (uvd !== '') {
      const n = Number(uvd.replace(',', '.'))
      if (Number.isFinite(n) && n >= 0) body.unused_vacation_days = n
    }

    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/calculate-employee-costs`
        : '/api/calculate-employee-costs'

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: ac.signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setLoading(false)
      setInvokeError('Falha de rede ao contactar o servidor.')
      setResult(null)
      return
    }

    const responseText = await res.text()
    let data: CalculateCostsResponse | null = null
    try {
      data = responseText ? (JSON.parse(responseText) as CalculateCostsResponse) : null
    } catch {
      setLoading(false)
      const snippet = responseText.slice(0, 120).replace(/\s+/g, ' ')
      setInvokeError(
        `Resposta não-JSON (HTTP ${res.status}). ${snippet ? `Início: ${snippet}` : 'Corpo vazio.'}`,
      )
      if (process.env.NODE_ENV === 'development') {
        console.error('[EmployeeFinancials] calculate-employee-costs', res.status, responseText.slice(0, 500))
      }
      setResult(null)
      return
    }

    setLoading(false)

    if (!res.ok) {
      const hint404 =
        res.status === 404
          ? ' Rota /api/calculate-employee-costs não encontrada: confirme src/app/api/calculate-employee-costs/route.ts e reinicie o servidor de desenvolvimento.'
          : ''
      setInvokeError((data?.error || `Erro HTTP ${res.status}.`) + hint404)
      setResult(data?.ok === false ? data : null)
      if (process.env.NODE_ENV === 'development') {
        console.error('[EmployeeFinancials] API erro', res.status, data)
      }
      return
    }

    if (!data) {
      setInvokeError('Resposta vazia do servidor.')
      setResult(null)
      return
    }

    if (!data.ok) {
      setInvokeError(data.error || 'Cálculo rejeitado.')
      setResult(data)
      return
    }

    setResult(data)
    setInvokeError(null)
  }, [debouncedPayload])

  useEffect(() => {
    void runCalc()
    return () => {
      fetchAbortRef.current?.abort()
    }
  }, [runCalc])

  const rowClass =
    'flex justify-between items-baseline gap-4 py-2 border-b border-brand-border/80 text-sm'

  return (
    <div className="font-brand-secondary">
      {employeeLabel ? (
        <p className="text-sm text-brand-slate mb-4">
          Colaborador:{' '}
          <span className="font-medium text-brand-midnight">{employeeLabel}</span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Inputs */}
        <div className="rounded-brand border border-brand-border bg-white p-6 shadow-brand">
          <div className="mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-brand-primary" />
            <h2 className="font-brand-primary text-lg font-semibold text-brand-midnight">
              Parâmetros de cálculo
            </h2>
          </div>
          <p className="mb-5 text-xs text-brand-slate">
            Valores mensais em EUR. A data de referência define o ponto temporal das provisões
            (por defeito: hoje).
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Salário base (mensal)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
                placeholder="0,00"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Prémios / variáveis (mensal)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={bonuses}
                onChange={(e) => setBonuses(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
                placeholder="0"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Subsídio de refeição (mensal)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={mealAllowance}
                onChange={(e) => setMealAllowance(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
                placeholder="0"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-midnight">
              <input
                type="checkbox"
                checked={includeMealInTsu}
                onChange={(e) => setIncludeMealInTsu(e.target.checked)}
                className="h-4 w-4 rounded border-brand-border text-brand-primary"
              />
              Incluir refeição na base TSU (conservador; em PT há isenção até limite legal)
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Seguro (custo empregador, mensal)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={insuranceValue}
                onChange={(e) => setInsuranceValue(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
                placeholder="0"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Início do contrato
              </span>
              <input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Data de referência
              </span>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Dias férias não gozadas (opcional)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={unusedVacationDays}
                onChange={(e) => setUnusedVacationDays(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
                placeholder="Auto se vazio"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-slate">
                Orçamento anual exames médicos (EUR)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={medicalAnnual}
                onChange={(e) => setMedicalAnnual(e.target.value)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-brand-midnight outline-none ring-brand-primary/30 focus:ring-2"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void runCalc()}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-midnight px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-midnight/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recalcular agora
          </button>
        </div>

        {/* Resultados */}
        <div className="rounded-brand border border-brand-border bg-slate-50/80 p-6 shadow-brand">
          <h2 className="font-brand-primary text-lg font-semibold text-brand-midnight">
            Custos e provisões
          </h2>
          <p className="mt-1 text-xs text-brand-slate">
            Atualização em tempo quase real ao alterar os parâmetros.
          </p>

          {invokeError ? (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{invokeError}</span>
            </div>
          ) : null}

          {loading && !result ? (
            <div className="mt-10 flex justify-center text-brand-slate">
              <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            </div>
          ) : null}

          {result?.ok && result.tsu && result.totals ? (
            <div className="mt-5">
              <div className="mb-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-brand-border/60">
                <p className="text-xs font-medium uppercase text-brand-slate">TSU (estimativa)</p>
                <p className="mt-1 text-xs text-brand-slate">
                  Taxas: empregador {Number(result.tsu.employerRate) * 100}% · empregado{' '}
                  {Number(result.tsu.employeeRate) * 100}% sobre{' '}
                  {eur(result.tsu.incidenceBase)}
                </p>
                <div className={rowClass}>
                  <span>TSU empregador</span>
                  <span className="font-semibold tabular-nums text-brand-midnight">
                    {eur(result.tsu.employerAmount)}
                  </span>
                </div>
                <div className={rowClass}>
                  <span>TSU empregado (retido)</span>
                  <span className="font-semibold tabular-nums text-brand-midnight">
                    {eur(result.tsu.employeeAmount)}
                  </span>
                </div>
                <div className={rowClass + ' border-0 font-medium'}>
                  <span>Total encargo TSU</span>
                  <span className="tabular-nums text-brand-primary">
                    {eur(result.tsu.totalTsuCharge)}
                  </span>
                </div>
              </div>

              {result.subsidies ? (
                <div className="mb-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-brand-border/60">
                  <p className="text-xs font-medium uppercase text-brand-slate">
                    Subsídios proporcionais (ano civil)
                  </p>
                  <p className="mt-1 text-xs text-brand-slate">{result.subsidies.method}</p>
                  <div className={rowClass}>
                    <span>Subsídio férias</span>
                    <span className="font-semibold tabular-nums">
                      {eur(result.subsidies.feriasProportional)}
                    </span>
                  </div>
                  <div className={rowClass + ' border-0'}>
                    <span>Subsídio Natal</span>
                    <span className="font-semibold tabular-nums">
                      {eur(result.subsidies.natalProportional)}
                    </span>
                  </div>
                </div>
              ) : null}

              {result.termination ? (
                <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50/50 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase text-brand-slate">
                    Salvaguarda rescisão (indemnização — modelo simplificado)
                  </p>
                  <p className="mt-1 text-xs text-brand-slate">{result.termination.model}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-brand-midnight">
                    {eur(result.termination.indemnitySafeguard)}
                  </p>
                  <p className="mt-1 text-xs text-brand-slate">
                    Antiguidade: {result.termination.tenureYears} anos · Dias (bruto / teto):{' '}
                    {result.termination.rawIndemnityDays} / {result.termination.cappedIndemnityDays}{' '}
                    · Tecto 12× mensais: {eur(result.termination.capByTwelveMonths)}
                  </p>
                </div>
              ) : null}

              {result.vacation ? (
                <div className="mb-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-brand-border/60">
                  <p className="text-xs font-medium uppercase text-brand-slate">
                    Férias não gozadas
                  </p>
                  {result.vacation.assumedUnusedDays ? (
                    <p className="mt-1 text-xs text-amber-700">Dias estimados automaticamente.</p>
                  ) : null}
                  <div className={rowClass}>
                    <span>Dias considerados</span>
                    <span className="tabular-nums">{result.vacation.unusedVacationDays}</span>
                  </div>
                  <div className={rowClass + ' border-0'}>
                    <span>Provisão</span>
                    <span className="font-semibold tabular-nums">
                      {eur(result.vacation.provisionUnusedVacation)}
                    </span>
                  </div>
                </div>
              ) : null}

              {result.medicalExams ? (
                <div className="mb-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-brand-border/60">
                  <p className="text-xs font-medium uppercase text-brand-slate">Exames médicos</p>
                  <div className={rowClass}>
                    <span>Provisão proporcional</span>
                    <span className="font-semibold tabular-nums">
                      {eur(result.medicalExams.provisionProportional)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg bg-brand-midnight p-4 text-white">
                <div className={rowClass + ' border-white/20 text-white'}>
                  <span>Custo mensal empregador (estim.)</span>
                  <span className="text-lg font-bold tabular-nums text-brand-primary">
                    {eur(result.totals.monthlyEmployerCostEstimate)}
                  </span>
                </div>
                <div className={rowClass + ' border-0 text-white'}>
                  <span>Total provisões (agregado indicativo)</span>
                  <span className="text-lg font-bold tabular-nums">
                    {eur(result.totals.provisionsTotalEstimate)}
                  </span>
                </div>
              </div>

              {result.warnings && result.warnings.length > 0 ? (
                <ul className="mt-4 space-y-1 text-xs text-amber-800">
                  {result.warnings.map((w) => (
                    <li key={w} className="flex gap-1">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}

              {result.disclaimer ? (
                <p className="mt-4 text-[10px] leading-relaxed text-brand-slate">
                  {result.disclaimer}
                </p>
              ) : null}
            </div>
          ) : null}

          {!loading && !result?.ok && !invokeError ? (
            <p className="mt-8 text-sm text-brand-slate">
              Introduza um salário base válido para ver os resultados.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
