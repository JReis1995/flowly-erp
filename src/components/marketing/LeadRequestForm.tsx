'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { trackMarketingEvent } from '@/lib/marketing/tracking'

type FormState = {
  nome: string
  email: string
  empresa: string
  tipoProjeto: string
  objetivoPrincipal: string
  utilizadores: string
  integracoes: string
  orcamento: string
  modalidadeManutencao: string
  descricao: string
}

const INITIAL_STATE: FormState = {
  nome: '',
  email: '',
  empresa: '',
  tipoProjeto: 'crm-comercial',
  objetivoPrincipal: 'automatizar-processos',
  utilizadores: '1-5',
  integracoes: 'nao-sei',
  orcamento: '',
  modalidadeManutencao: 'nao-decidido',
  descricao: '',
}

type Option = { value: string; label: string }

const TIPO_PROJETO_OPTIONS: Option[] = [
  { value: 'crm-comercial', label: 'CRM comercial' },
  { value: 'app-operacional', label: 'App operacional interna' },
  { value: 'gestao-filas', label: 'Gestão de filas/atendimento' },
  { value: 'website-corporativo', label: 'Website corporativo' },
  { value: 'ecommerce', label: 'E-commerce' },
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
    <fieldset>
      <legend className="block text-sm text-brand-midnight font-brand-secondary mb-2">{label}</legend>
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

export default function LeadRequestForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const startedRef = useRef(false)

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
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    trackMarketingEvent('cta_click_primary', { cta: 'lead_form_submit' })

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Erro ao enviar pedido.')
      }

      trackMarketingEvent('lead_form_submit_success', { leadId: json?.leadId ?? null })
      setSuccess('Pedido enviado com sucesso. Vamos contactar-te em breve.')
      setForm(INITIAL_STATE)
      startedRef.current = false
      return
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Erro inesperado.'
      trackMarketingEvent('lead_form_submit_error', { message })
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <h3 className="text-2xl font-brand-primary font-bold text-brand-midnight">Pede o teu software</h3>
      <p className="text-brand-slate font-brand-secondary">
        Responde a estas perguntas de despiste e devolvemos uma proposta orientada ao teu negócio.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">Empresa (opcional)</span>
          <input
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
      </div>

      <ChoiceGroup
        label="Objetivo principal"
        value={form.objetivoPrincipal}
        options={OBJETIVO_OPTIONS}
        onChange={(value) => updateField('objetivoPrincipal', value)}
      />

      <ChoiceGroup
        label="Quantos utilizadores terá o sistema?"
        value={form.utilizadores}
        options={UTILIZADORES_OPTIONS}
        onChange={(value) => updateField('utilizadores', value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <ChoiceGroup
          label="Precisas de integrações?"
          value={form.integracoes}
          options={INTEGRACOES_OPTIONS}
          onChange={(value) => updateField('integracoes', value)}
        />
        <label className="block">
          <span className="block text-sm text-brand-midnight font-brand-secondary mb-1">Orçamento estimado (opcional)</span>
          <input
            value={form.orcamento}
            onChange={(e) => updateField('orcamento', e.target.value)}
            placeholder="Ex: 3.000€ - 7.500€"
            className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
          />
        </label>
      </div>

      <ChoiceGroup
        label="Modalidade pretendida de manutenção"
        value={form.modalidadeManutencao}
        options={MANUTENCAO_OPTIONS}
        onChange={(value) => updateField('modalidadeManutencao', value)}
      />

      <textarea
        value={form.descricao}
        onChange={(e) => updateField('descricao', e.target.value)}
        placeholder="Contexto adicional (opcional): o que já tentaste e o que queres evitar."
        className="w-full min-h-32 px-3 py-2 border border-brand-border rounded-lg font-brand-secondary text-brand-midnight placeholder:text-brand-slate bg-brand-white"
      />

      <p className="text-xs text-brand-slate font-brand-secondary">
        O prazo e o plano de entrega sao definidos por nos na fase de diagnostico para garantir compromisso realista.
      </p>

      {error ? <p className="text-sm text-red-600 font-brand-secondary">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 font-brand-secondary">{success}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full md:w-auto bg-brand-primary text-white px-6 py-3 rounded-lg font-brand-primary font-semibold disabled:opacity-60"
      >
        {submitting ? 'A enviar...' : 'Quero uma proposta personalizada'}
      </button>
    </form>
  )
}

