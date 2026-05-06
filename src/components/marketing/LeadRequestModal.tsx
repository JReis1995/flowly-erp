'use client'

import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import LeadRequestForm from '@/components/marketing/LeadRequestForm'

export default function LeadRequestModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-lg font-brand-primary font-semibold hover:opacity-95 transition-opacity"
      >
        Pedir proposta personalizada
        <ArrowRight className="w-5 h-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-brand-white rounded-2xl shadow-2xl border border-brand-border max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-brand-white border-b border-brand-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="text-xl font-brand-primary font-bold text-brand-midnight">
                  Pedido de software personalizado
                </h3>
                <p className="text-sm text-brand-slate font-brand-secondary">
                  Resposta em at 24h uteis com orientacao inicial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-brand-light text-brand-slate hover:text-brand-midnight transition-colors"
                aria-label="Fechar formulario"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <LeadRequestForm />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

