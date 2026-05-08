'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { trackMarketingEvent } from '@/lib/marketing/tracking'
import {
  isValidTelemovelPt,
  sanitizeTelemovel,
  TELEMOVEL_ERRO_FORMATO,
  TELEMOVEL_ERRO_OBRIGATORIO,
} from '@/lib/crm/telemovelPt'

type FormState = {
  nome: string
  email: string
  telemovel: string
  empresa: string
  tipoProjeto: string
  tipoProjetoOutro: string
  objetivoPrincipal: string
  utilizadores: string
  integracoes: string
  integracoesOutra: string
  orcamento: string
  modalidadeManutencao: string
  descricao: string
}

const INITIAL_STATE: FormState = {
  nome: '',
  email: '',
  telemovel: '',
  empresa: '',
  tipoProjeto: 'crm',
  tipoProjetoOutro: '',
  objetivoPrincipal: 'automatizar-processos',
  utilizadores: '1-5',
  integracoes: 'nao-sei',
  integracoesOutra: '',
  orcamento: '',
  modalidadeManutencao: 'nao-decidido',
  descricao: '',
}

/** Garante todas as chaves e strings definidas (evita undefined após HMR ou estado antigo). */
function normalizeFormState(partial: Partial<FormState>): FormState {
  return {
    nome: partial.nome ?? '',
    email: partial.email ?? '',
    telemovel: partial.telemovel ?? '',
    empresa: partial.empresa ?? '',
    tipoProjeto: partial.tipoProjeto ?? INITIAL_STATE.tipoProjeto,
    tipoProjetoOutro: partial.tipoProjetoOutro ?? '',
    objetivoPrincipal: partial.objetivoPrincipal ?? INITIAL_STATE.objetivoPrincipal,
    utilizadores: partial.utilizadores ?? INITIAL_STATE.utilizadores,
    integracoes: partial.integracoes ?? INITIAL_STATE.integracoes,
    integracoesOutra: partial.integracoesOutra ?? '',
    orcamento: partial.orcamento ?? '',
    modalidadeManutencao: partial.modalidadeManutencao ?? INITIAL_STATE.modalidadeManutencao,
    descricao: partial.descricao ?? '',
  }
}

type Option = { value: string; label: string }

const TIPO_PROJETO_OPTIONS: Option[] = [
  { value: 'crm', label: 'CRM' },
  { value: 'app-operacional', label: 'Aplicação operacional' },
  { value: 'gestao-filas', label: 'Gestão de filas/atendimento' },
  { value: 'website-corporativo', label: 'Website corporativo' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'sistema-gestao', label: 'Sistema de gestão' },
  { value: 'automacoes-integracoes', label: 'Automações e integrações' },
  { value: 'outro', label: 'Outro' },
]

const OBJETIVO_OPTIONS: Option[] = [
  { value: 'automatizar-processos', label: 'Automatizar processos' },
  { value: 'aumentar-vendas', label: 'Aumentar vendas' },
  { value: 'reduzir-erros', label: 'Reduzir erros manuais' },
  { value: 'melhorar-atendimento', label: 'Melhorar atendimento ao cliente' },
  { value: 'ganhar-visibilidade-online', label: 'Ganhar visibilidade online' },
]

const UTILIZADORES_OPTIONS: Option[] = [
  { value: '1-5', label: '1 a 5 utilizadores' },
  { value: '6-20', label: '6 a 20 utilizadores' },
  { value: '21-50', label: '21 a 50 utilizadores' },
  { value: '51+', label: 'Mais de 50 utilizadores' },
]

const INTEGRACOES_OPTIONS: Option[] = [
  { value: 'nao-preciso', label: 'Não preciso de integrações' },
  { value: 'nao-sei', label: 'Ainda não sei' },
  { value: 'sim-faturacao', label: 'Com faturação/ERP' },
  { value: 'sim-whatsapp-email', label: 'Com WhatsApp/Email' },
  { value: 'sim-ecommerce', label: 'Com loja online' },
  { value: 'sim-outras', label: 'Outras integrações' },
]

const MANUTENCAO_OPTIONS: Option[] = [
  { value: 'nao-decidido', label: 'Ainda não decidido' },
  { value: 'sem-manutencao', label: 'Sem avença mensal' },
  { value: 'avenca-basica', label: 'Avença mensal básica' },
  { value: 'avenca-evolutiva', label: 'Avença com evolução contínua' },
]

function getOptionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label || value
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="bg-brand-white border border-brand-border rounded-xl p-4">
      <legend className="block text-sm text-brand-midnight font-brand-secondary mb-3 px-1">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`px-3 py-2 rounded-lg border text-sm font-brand-secondary transition-colors ${
                selected
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-brand-white text-brand-midnight border-brand-border hover:bg-brand-light'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

type LeadRequestFormProps = {
  onSuccess?: () => void
}

export default function LeadRequestForm({ onSuccess }: LeadRequestFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const [confirmReviewed, setConfirmReviewed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const startedRef = useRef(false)
  const isOutroProjeto = form.tipoProjeto === 'outro'
  const isOutrasIntegracoes = form.integracoes === 'sim-outras'

  useEffect(() => {
    trackMarketingEvent('landing_view', { page: 'home' })
  }, [])

  const onFirstInteraction = () => {
    if (startedRef.current) return
    startedRef.current = true
    trackMarketingEvent('lead_form_start')
  }

  const updateField = (field: keyof FormState, value: string) => {
    onFirstInteraction()
    setForm((prev) => normalizeFormState({ ...prev, [field]: value }))
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    trackMarketingEvent('cta_click_primary', { cta: 'lead_form_submit' })

    const payload = normalizeFormState(form)
    const telemovelNorm = sanitizeTelemovel(payload.telemovel)
    if (!telemovelNorm) {
      setError(TELEMOVEL_ERRO_OBRIGATORIO)
      setSubmitting(false)
      return
    }
    if (!isValidTelemovelPt(telemovelNorm)) {
      setError(TELEMOVEL_ERRO_FORMATO)
      setSubmitting(false)
      return
    }

    if (payload.tipoProjeto === 'outro' && payload.tipoProjetoOutro.trim().length < 3) {
      setError('Indica qual é o tipo de projeto pretendido.')
      setSubmitting(false)
      return
    }

    if (payload.integracoes === 'sim-outras' && payload.integracoesOutra.trim().length < 3) {
      setError('Indica quais as integrações pretendidas.')
      setSubmitting(false)
      return
    }

    if (payload.descricao.trim().length < 10) {
      setError('Descreve o teu pedido com pelo menos 10 caracteres nas observações.')
      setSubmitting(false)
      return
    }

    if (payload.empresa.trim().length < 2) {
      setError('Indica o nome da empresa ou organização.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, telemovel: telemovelNorm }),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Erro ao enviar pedido.')
      }

      trackMarketingEvent('lead_form_submit_success', { leadId: json?.leadId ?? null })
      setSuccess('Pedido enviado com sucesso. Vamos contactar-te em breve.')
      setForm(INITIAL_STATE)
      setConfirmReviewed(false)
      startedRef.current = false
      if (onSuccess) {
        setTimeout(() => onSuccess(), 500)
      } else {
        setTimeout(() => {
          window.location.href = '/'
        }, 800)
      }
      return
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Erro inesperado.'
      trackMarketingEvent('lead_form_submit_error', { message })
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const canGoToStepTwo =
    (form.nome ?? '').trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.email ?? '').trim()) &&
    isValidTelemovelPt(sanitizeTelemovel(form.telemovel ?? '')) &&
    (form.empresa ?? '').trim().length >= 2

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <h3 className="text-xl sm:text-2xl font-brand-primary font-bold text-brand-midnight">Pede o teu software</h3>
      <p className="text-brand-slate font-brand-secondary">
        Responde a estas perguntas iniciais e enviamos uma proposta ajustada ao teu negócio.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-brand-border overflow-hidden">
          <div
            className={`h-full bg-brand-primary transition-all ${step === 1 ? 'w-1/2' : 'w-full'}`}
          />
        </div>
        <span className="text-xs text-brand-slate font-brand-secondary">Passo {step} de 2</span>
      </div>

      {step === 1 ? (
        <>
          <p className="text-sm text-brand-slate font-brand-secondary">
            Passo 1: dados essenciais para prepararmos o contacto inicial.
          </p>

          <div className="bg-brand-white border border-brand-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">Nome</span>
              <input
                required
                value={form.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                placeholder="O teu nome"
                className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="nome@empresa.com"
                className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">Telemóvel</span>
              <input
                required
                inputMode="tel"
                autoComplete="tel"
                value={form.telemovel}
                onChange={(e) => updateField('telemovel', e.target.value)}
                placeholder="Ex.: 912 345 678 ou +351 912 345 678"
                className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
              />
              <span className="block text-xs text-brand-slate mt-1 font-brand-secondary">
                Número português (9 dígitos). Obrigatório para te contactarmos.
              </span>
            </label>
          </div>

          <div className="bg-brand-white border border-brand-border rounded-xl p-4 grid grid-cols-1 gap-4">
            <label className="block">
              <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">Empresa ou organização</span>
              <input
                required
                minLength={2}
                value={form.empresa}
                onChange={(e) => updateField('empresa', e.target.value)}
                placeholder="Nome da empresa"
                className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
              />
            </label>
            <ChoiceGroup
              label="Que tipo de projeto precisas?"
              value={form.tipoProjeto}
              options={TIPO_PROJETO_OPTIONS}
              onChange={(value) => updateField('tipoProjeto', value)}
            />

            {isOutroProjeto ? (
              <label className="block">
                <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">
                  Indica qual é o tipo de projeto
                </span>
                <input
                  required={isOutroProjeto}
                  value={form.tipoProjetoOutro}
                  onChange={(e) => updateField('tipoProjetoOutro', e.target.value)}
                  placeholder="Ex.: Portal de clientes, app mobile, plataforma interna..."
                  className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
                />
              </label>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canGoToStepTwo}
              className="w-full sm:w-auto bg-brand-primary text-white px-5 py-2.5 rounded-lg font-brand-primary font-semibold disabled:opacity-50"
            >
              Seguinte
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-4">
            <p className="text-sm text-brand-slate font-brand-secondary">
              Passo 2: ajuda-nos a preparar um orçamento mais ajustado.
            </p>

            <ChoiceGroup
              label="1) Qual é o objetivo principal?"
              value={form.objetivoPrincipal}
              options={OBJETIVO_OPTIONS}
              onChange={(value) => updateField('objetivoPrincipal', value)}
            />

            <ChoiceGroup
              label="2) Quantos utilizadores terá o sistema?"
              value={form.utilizadores}
              options={UTILIZADORES_OPTIONS}
              onChange={(value) => updateField('utilizadores', value)}
            />

            <ChoiceGroup
              label="3) Precisas de integrações?"
              value={form.integracoes}
              options={INTEGRACOES_OPTIONS}
              onChange={(value) => updateField('integracoes', value)}
            />

            {isOutrasIntegracoes ? (
              <label className="block bg-brand-white border border-brand-border rounded-xl p-4">
                <span className="block text-sm text-brand-midnight font-brand-secondary mb-2">
                  3.1) Quais integrações pretendes?
                </span>
                <input
                  required={isOutrasIntegracoes}
                  value={form.integracoesOutra}
                  onChange={(e) => updateField('integracoesOutra', e.target.value)}
                  placeholder="Ex.: Primavera, PHC, Stripe, API interna..."
                  className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
                />
              </label>
            ) : null}

            <label className="block bg-brand-white border border-brand-border rounded-xl p-4">
              <span className="block text-sm text-brand-midnight font-brand-secondary mb-2">4) Orçamento estimado (opcional)</span>
              <input
                value={form.orcamento}
                onChange={(e) => updateField('orcamento', e.target.value)}
                placeholder="Ex.: 3.000€ - 7.500€"
                className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
              />
            </label>

            <ChoiceGroup
              label="5) Qual a modalidade pretendida de manutenção?"
              value={form.modalidadeManutencao}
              options={MANUTENCAO_OPTIONS}
              onChange={(value) => updateField('modalidadeManutencao', value)}
            />

            <label className="block bg-brand-white border border-brand-border rounded-xl p-4">
              <span className="block text-sm text-brand-midnight font-brand-secondary mb-2">
                6) Observações / contexto do pedido (obrigatório, mín. 10 caracteres)
              </span>
              <textarea
                value={form.descricao}
                onChange={(e) => updateField('descricao', e.target.value)}
                placeholder={
                  isOutroProjeto
                    ? 'Descreve de forma breve o projeto que pretendes.'
                    : 'Partilha o que já tentaste, o que precisas e o que queres evitar.'
                }
                required
                minLength={10}
                className="w-full min-h-28 px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
              />
            </label>

            <div className="bg-brand-light border border-brand-border rounded-xl p-4">
              <p className="text-sm font-brand-primary font-semibold text-brand-midnight mb-2">
                Confirmação do pedido
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-brand-slate font-brand-secondary">
                <p>
                  <strong className="text-brand-midnight">Telemóvel:</strong> {sanitizeTelemovel(form.telemovel) || '—'}
                </p>
                <p>
                  <strong className="text-brand-midnight">Projeto:</strong>{' '}
                  {isOutroProjeto
                    ? `Outro - ${form.tipoProjetoOutro || 'Não indicado'}`
                    : getOptionLabel(TIPO_PROJETO_OPTIONS, form.tipoProjeto)}
                </p>
                <p><strong className="text-brand-midnight">Objetivo:</strong> {getOptionLabel(OBJETIVO_OPTIONS, form.objetivoPrincipal)}</p>
                <p><strong className="text-brand-midnight">Utilizadores:</strong> {getOptionLabel(UTILIZADORES_OPTIONS, form.utilizadores)}</p>
                <p>
                  <strong className="text-brand-midnight">Integrações:</strong>{' '}
                  {isOutrasIntegracoes
                    ? `Outras - ${form.integracoesOutra || 'Não indicado'}`
                    : getOptionLabel(INTEGRACOES_OPTIONS, form.integracoes)}
                </p>
                <p><strong className="text-brand-midnight">Manutenção:</strong> {getOptionLabel(MANUTENCAO_OPTIONS, form.modalidadeManutencao)}</p>
                <p><strong className="text-brand-midnight">Orçamento:</strong> {form.orcamento || 'Não indicado'}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-brand-slate font-brand-secondary">
            O prazo e o plano de entrega são definidos por nós na fase de diagnóstico para garantir um compromisso realista.
          </p>

          {error ? <p className="text-sm text-red-600 font-brand-secondary">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700 font-brand-secondary">{success}</p> : null}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto border border-brand-border bg-brand-white text-brand-midnight px-5 py-2.5 rounded-lg font-brand-secondary"
            >
              Voltar
            </button>
            <div className="w-full sm:w-auto">
              <label className="flex items-start gap-2 mb-3 text-xs text-brand-slate font-brand-secondary">
                <input
                  type="checkbox"
                  checked={confirmReviewed}
                  onChange={(e) => setConfirmReviewed(e.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que os dados do pedido estão corretos.
              </label>
              <button
                type="submit"
                disabled={submitting || !confirmReviewed}
                className="w-full sm:w-auto bg-brand-primary text-white px-6 py-3 rounded-lg font-brand-primary font-semibold disabled:opacity-60"
              >
                {submitting ? 'A enviar...' : 'Quero receber o meu orçamento'}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  )
}

