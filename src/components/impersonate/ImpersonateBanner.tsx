'use client'

import { Eye, LogOut } from 'lucide-react'
import { useImpersonate } from '@/stores/impersonateStore'

/**
 * ImpersonateBanner - Sprint 2 UI Component
 * 
 * Barra de aviso amarela que aparece no topo absoluto do ecrã
 * quando o modo Impersonate está ativo.
 * 
 * Design:
 * - Fundo: #FACC15 (Warning Yellow)
 * - Texto: #020617 (Midnight - escuro)
 * - Ícone: Olho
 * - Botão "Sair" para limpar o estado
 */
export function ImpersonateBanner() {
  const { isActive, companyName, deactivateImpersonate } = useImpersonate()

  // Não renderizar nada se não estiver ativo
  if (!isActive) return null

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 shadow-lg"
      style={{ backgroundColor: '#FACC15' }}
    >
      {/* Ícone de olho */}
      <Eye className="w-5 h-5 flex-shrink-0" style={{ color: '#020617' }} />
      
      {/* Mensagem */}
      <span 
        className="font-brand-primary font-semibold text-sm"
        style={{ color: '#020617' }}
      >
        A visualizar como: {companyName}
      </span>
      
      {/* Botão Sair */}
      <button
        onClick={deactivateImpersonate}
        className="flex items-center gap-1.5 px-3 py-1 rounded-md font-brand-secondary font-medium text-sm transition-colors hover:bg-black/10"
        style={{ color: '#020617' }}
      >
        <LogOut className="w-4 h-4" />
        Sair
      </button>
    </div>
  )
}
