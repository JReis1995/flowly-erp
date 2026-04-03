'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Building2, Loader2, Eye, Sparkles, Check } from 'lucide-react'
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

// Lista dos 12 módulos disponíveis para demo
const ALL_MODULES = [
  { id: 'logistica', name: 'Logística', icon: '📦' },
  { id: 'condominios', name: 'Condomínios', icon: '🏢' },
  { id: 'frota', name: 'Gestão de Frota', icon: '🚗' },
  { id: 'rh', name: 'Colaboradores', icon: '👥' },
  { id: 'cc', name: 'Conta Corrente', icon: '💳' },
  { id: 'ia', name: 'IA Insight', icon: '🤖' },
  { id: 'fichas_tecnicas', name: 'Fichas Técnicas', icon: '📄' },
  { id: 'importacao', name: 'Importação & Exportação', icon: '🌐' },
  { id: 'acessos', name: 'Acessos', icon: '🔑' },
  { id: 'clientes', name: 'Clientes & Fornecedores', icon: '🤝' },
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  { id: 'central_saas', name: 'Central SaaS', icon: '⚙️' },
]

/**
 * ImpersonateDropdown - Com Demo Mode para Upsell
 * 
 * Permite:
 * 1. Vista Cliente normal - ver como o cliente vê (baseado nos módulos reais)
 * 2. Modo Demo (Vendas) - simular módulos adicionais para demonstração
 */
export function ImpersonateDropdown({ userRole }: ImpersonateDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'client' | 'demo'>('client')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { 
    isActive, 
    activateImpersonate, 
    companyName, 
    tenantId,
    isDemoMode,
    demoModules,
    setDemoMode,
    toggleDemoModule,
    setDemoModules,
    deactivateImpersonate
  } = useImpersonate()

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

  // Ativar impersonate (modo cliente normal)
  const handleTenantClick = (tenant: Tenant) => {
    if (!userRole) return
    
    // Desativar demo mode ao selecionar cliente
    if (isDemoMode) {
      setDemoMode(false)
    }
    
    const result = activateImpersonate(tenant.id, tenant.nome_empresa, userRole)
    
    if (result.success) {
      setIsOpen(false)
      setActiveTab('client')
      // Redirecionar para o dashboard do cliente
      router.push('/dashboard')
    } else {
      setError(result.error || 'Erro ao ativar modo visualização')
    }
  }

  // Ativar modo demo
  const handleActivateDemo = () => {
    if (!isActive) {
      setError('Primeiro seleciona um cliente para impersonar')
      return
    }
    
    setDemoMode(true)
    // Se não tem módulos selecionados, selecionar todos por padrão
    if (demoModules.length === 0) {
      setDemoModules(ALL_MODULES.map(m => m.id))
    }
    setIsOpen(false)
    router.push('/dashboard')
  }

  // Desativar tudo
  const handleDeactivateAll = () => {
    setDemoMode(false)
    deactivateImpersonate()
    setIsOpen(false)
    router.push('/dashboard')
  }

  // Selecionar/deselecionar todos os módulos
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setDemoModules(ALL_MODULES.map(m => m.id))
    } else {
      setDemoModules([])
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

  // Sincronizar tab ativo com estado
  useEffect(() => {
    if (isDemoMode) {
      setActiveTab('demo')
    } else if (isActive) {
      setActiveTab('client')
    }
  }, [isDemoMode, isActive])

  // Não renderizar se não tiver permissão
  if (!canUseImpersonate) return null

  // Label e estilo do botão baseado no estado
  const getButtonConfig = () => {
    if (isDemoMode) {
      return {
        label: 'Modo Demo - Vendas',
        icon: Sparkles,
        bgColor: 'bg-orange-100 border border-orange-300',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-600'
      }
    }
    if (isActive) {
      return {
        label: companyName || 'Ver como Cliente',
        icon: Eye,
        bgColor: 'bg-[#FACC15]/20 border border-[#FACC15]',
        textColor: 'text-[#020617]',
        iconColor: 'text-[#020617]'
      }
    }
    return {
      label: 'Ver como Cliente',
      icon: Building2,
      bgColor: 'bg-brand-light hover:bg-brand-border',
      textColor: 'text-brand-midnight',
      iconColor: 'text-brand-primary'
    }
  }

  const buttonConfig = getButtonConfig()
  const ButtonIcon = buttonConfig.icon

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${buttonConfig.bgColor}`}
      >
        <ButtonIcon className={`w-4 h-4 ${buttonConfig.iconColor}`} />
        <span className={`font-brand-secondary text-sm truncate max-w-[150px] ${buttonConfig.textColor} ${isActive || isDemoMode ? 'font-medium' : ''}`}>
          {buttonConfig.label}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${buttonConfig.iconColor}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-brand-white rounded-lg shadow-brand border border-brand-border z-50 max-h-[500px] overflow-y-auto">
          {/* Tabs */}
          <div className="flex border-b border-brand-border">
            <button
              onClick={() => setActiveTab('client')}
              className={`flex-1 px-4 py-3 text-sm font-brand-secondary font-medium transition-colors ${
                activeTab === 'client'
                  ? 'bg-brand-light text-brand-primary border-b-2 border-brand-primary'
                  : 'text-brand-slate hover:bg-brand-light/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                Vista Cliente
              </div>
            </button>
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex-1 px-4 py-3 text-sm font-brand-secondary font-medium transition-colors ${
                activeTab === 'demo'
                  ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                  : 'text-brand-slate hover:bg-brand-light/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Modo Demo
              </div>
            </button>
          </div>

          {/* Tab Content: Vista Cliente */}
          {activeTab === 'client' && (
            <div>
              {/* Header */}
              <div className="px-4 py-3 border-b border-brand-border bg-brand-light/50">
                <span className="font-brand-primary font-semibold text-sm text-brand-midnight">
                  Selecionar Empresa
                </span>
                <p className="text-xs text-brand-slate font-brand-secondary mt-0.5">
                  Visualizar como o cliente vê o sistema
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
                <div className="p-2 max-h-64 overflow-y-auto">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantClick(tenant)}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg font-brand-secondary transition-colors flex items-center justify-between group ${
                        tenantId === tenant.id && !isDemoMode
                          ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30'
                          : 'text-brand-midnight hover:bg-brand-light'
                      }`}
                    >
                      <span className="truncate flex-1">{tenant.nome_empresa}</span>
                      {tenantId === tenant.id && !isDemoMode && (
                        <Check className="w-4 h-4 text-brand-primary" />
                      )}
                      <span className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                        tenantId === tenant.id && !isDemoMode ? 'text-brand-primary' : 'text-brand-slate'
                      }`}>
                        Ver →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Status */}
              {isActive && !isDemoMode && (
                <div className="px-4 py-2 bg-[#FACC15]/10 border-t border-[#FACC15]/30">
                  <p className="text-xs text-brand-midnight font-brand-secondary text-center">
                    Vista Cliente ativa: <strong>{companyName}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Modo Demo */}
          {activeTab === 'demo' && (
            <div>
              {/* Header */}
              <div className="px-4 py-3 border-b border-orange-200 bg-orange-50">
                <span className="font-brand-primary font-semibold text-sm text-orange-800">
                  Modo Demonstração
                </span>
                <p className="text-xs text-orange-600 font-brand-secondary mt-0.5">
                  Simular módulos adicionais para upsell
                </p>
              </div>

              {/* Info */}
              {!isActive && (
                <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
                  <p className="text-xs text-yellow-800 font-brand-secondary">
                    ⚠️ Primeiro seleciona um cliente na tab "Vista Cliente"
                  </p>
                </div>
              )}

              {/* Select All */}
              {isActive && (
                <div className="px-4 py-2 border-b border-brand-border">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={demoModules.length === ALL_MODULES.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm font-brand-secondary text-brand-midnight">
                      Selecionar todos ({demoModules.length}/{ALL_MODULES.length})
                    </span>
                  </label>
                </div>
              )}

              {/* Module List */}
              {isActive && (
                <div className="p-2 max-h-64 overflow-y-auto">
                  {ALL_MODULES.map((module) => {
                    const isChecked = demoModules.includes(module.id)
                    return (
                      <label
                        key={module.id}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-orange-50' : 'hover:bg-brand-light'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDemoModule(module.id)}
                          className="w-4 h-4 rounded border-brand-border text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-lg">{module.icon}</span>
                        <span className={`text-sm font-brand-secondary flex-1 ${
                          isChecked ? 'text-orange-800 font-medium' : 'text-brand-midnight'
                        }`}>
                          {module.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="p-3 border-t border-brand-border space-y-2">
                {isActive && !isDemoMode && (
                  <button
                    onClick={handleActivateDemo}
                    className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-brand-secondary font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ativar Modo Demo
                  </button>
                )}
                
                {isDemoMode && (
                  <button
                    onClick={() => setDemoMode(false)}
                    className="w-full py-2 px-4 bg-brand-midnight hover:bg-brand-midnight/90 text-white rounded-lg font-brand-secondary font-medium transition-colors"
                  >
                    Voltar à Vista Cliente
                  </button>
                )}
                
                {(isActive || isDemoMode) && (
                  <button
                    onClick={handleDeactivateAll}
                    className="w-full py-2 px-4 border border-brand-border hover:bg-brand-light text-brand-slate rounded-lg font-brand-secondary transition-colors"
                  >
                    Sair de Todos os Modos
                  </button>
                )}
              </div>

              {/* Status */}
              {isDemoMode && (
                <div className="px-4 py-2 bg-orange-100 border-t border-orange-200">
                  <p className="text-xs text-orange-800 font-brand-secondary text-center">
                    Demo ativa: {demoModules.length} módulos visíveis
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
