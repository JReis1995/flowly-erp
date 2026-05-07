'use client'

import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import LeadRequestForm from '@/components/marketing/LeadRequestForm'

export default function LeadRequestModal() {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    window.location.href = '/'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-lg font-brand-primary font-semibold hover:opacity-95 transition-opacity"
      >
        Pedir orçamento personalizado
        <ArrowRight className="w-5 h-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-3xl bg-brand-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-brand-border max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-brand-white border-b border-brand-border px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="text-lg sm:text-xl font-brand-primary font-bold text-brand-midnight">
                  Pedido de software personalizado
                </h3>
                <p className="text-sm text-brand-slate font-brand-secondary">
                  Resposta em 24 horas úteis com orientação inicial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-brand-light text-brand-slate hover:text-brand-midnight transition-colors"
                aria-label="Fechar formulário"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <LeadRequestForm onSuccess={handleSuccess} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

