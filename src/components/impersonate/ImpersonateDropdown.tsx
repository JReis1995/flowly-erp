'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Building2, Loader2 } from 'lucide-react'
import { useImpersonate, canImpersonate } from '@/stores/impersonateStore'
import { getTenants } from '@/app/central-saas/_actions/tenants'

interface Tenant {
  id: string
  nome_empresa: string
  status: string
}

interface ImpersonateDropdownProps {
  userRole: string | null
}

/**
 * ImpersonateDropdown - Sprint 2 UI Component
 * 
 * Dropdown real que carrega a lista de clientes/tenants da base de dados.
 * Ao clicar numa empresa, ativa o estado Impersonate e redireciona.
 * 
 * Regras:
 * - Apenas aparece se o utilizador tiver permissão (superadmin/developer)
 * - Carrega tenants reais do Supabase
 * - Filtra apenas tenants ativos
 */
export function ImpersonateDropdown({ userRole }: ImpersonateDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { isActive, activateImpersonate, companyName } = useImpersonate()

  // Verificar se pode usar impersonate
  const canUseImpersonate = canImpersonate(userRole)

  // Carregar tenants quando abrir o dropdown
  const loadTenants = useCallback(async () => {
    if (!canUseImpersonate) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await getTenants('ativo')
      
      if (error) {
        setError(error)
      } else {
        setTenants(data || [])
      }
    } catch (err) {
      setError('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [canUseImpersonate])

  // Abrir dropdown e carregar dados
  const handleToggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    
    if (newState && tenants.length === 0 && !loading) {
      loadTenants()
    }
  }

  // Ativar impersonate e redirecionar
  const handleTenantClick = (tenant: Tenant) => {
    if (!userRole) return
    
    const result = activateImpersonate(tenant.id, tenant.nome_empresa, userRole)
    
    if (result.success) {
      setIsOpen(false)
      // Redirecionar para o dashboard do cliente
      router.push('/dashboard')
    } else {
      setError(result.error || 'Erro ao ativar modo visualização')
    }
  }

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Não renderizar se não tiver permissão
  if (!canUseImpersonate) return null

  // Label do botão muda quando ativo
  const buttonLabel = isActive ? companyName : 'Ver como Cliente'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
          isActive 
            ? 'bg-[#FACC15]/20 border border-[#FACC15]' 
            : 'bg-brand-light hover:bg-brand-border'
        }`}
      >
        <Building2 className={`w-4 h-4 ${isActive ? 'text-[#020617]' : 'text-brand-primary'}`} />
        <span className={`font-brand-secondary text-sm truncate max-w-[150px] ${isActive ? 'text-[#020617] font-medium' : 'text-brand-midnight'}`}>
          {buttonLabel}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${isActive ? 'text-[#020617]' : 'text-brand-slate'}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-brand-white rounded-lg shadow-brand border border-brand-border z-50 max-h-[400px] overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-brand-border bg-brand-light/50">
            <span className="font-brand-primary font-semibold text-sm text-brand-midnight">
              Selecionar Empresa
            </span>
            <p className="text-xs text-brand-slate font-brand-secondary mt-0.5">
              Visualizar como cliente
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
              <span className="ml-2 text-sm text-brand-slate font-brand-secondary">
                A carregar...
              </span>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="px-4 py-4 text-center">
              <p className="text-sm text-red-600 font-brand-secondary">{error}</p>
              <button
                onClick={loadTenants}
                className="mt-2 text-xs text-brand-primary hover:underline font-brand-secondary"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && tenants.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Building2 className="w-8 h-8 text-brand-slate mx-auto mb-2" />
              <p className="text-sm text-brand-slate font-brand-secondary">
                Nenhum cliente ativo encontrado
              </p>
            </div>
          )}

          {/* Tenant List */}
          {!loading && !error && tenants.length > 0 && (
            <div className="p-2">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantClick(tenant)}
                  className="w-full text-left px-3 py-2.5 text-sm text-brand-midnight hover:bg-brand-light rounded-lg font-brand-secondary transition-colors flex items-center justify-between group"
                >
                  <span className="truncate flex-1">{tenant.nome_empresa}</span>
                  <span className="text-xs text-brand-slate opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
