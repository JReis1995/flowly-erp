import { create } from 'zustand'

/**
 * Impersonate Store - Sprint 1 Foundation
 * 
 * Este store gere o estado de "Visão de Cliente" (Impersonate) para a equipa Flowly.
 * 
 * REGRA CRÍTICA DE SEGURANÇA:
 * - O estado vive APENAS na memória (não usa LocalStorage, Cookies ou SessionStorage)
 * - Ao fazer refresh (F5), o estado desaparece completamente
 * - Apenas utilizadores com role 'superadmin' ou 'developer' podem ativar o modo Impersonate
 */

export interface ImpersonateState {
  // Dados do tenant sendo visualizado
  tenant_id: string | null
  nome_da_empresa: string | null
  
  // Estado
  isActive: boolean
  
  // Ações
  activateImpersonate: (tenantId: string, companyName: string, userRole: string) => { success: boolean; error?: string }
  deactivateImpersonate: () => void
  clearImpersonate: () => void
}

// Lista de roles permitidos para ativar Impersonate
const ALLOWED_IMPERSONATE_ROLES = ['superadmin', 'developer']

export const useImpersonateStore = create<ImpersonateState>((set, get) => ({
  // Estado inicial - tudo vazio
  tenant_id: null,
  nome_da_empresa: null,
  isActive: false,

  /**
   * Ativa o modo Impersonate
   * 
   * @param tenantId - ID do tenant (empresa) a visualizar
   * @param companyName - Nome da empresa
   * @param userRole - Role do utilizador logado (deve ser 'superadmin' ou 'developer')
   * @returns Object com success=true se ativado, ou success=false com error
   */
  activateImpersonate: (tenantId: string, companyName: string, userRole: string) => {
    // Verificação de segurança: apenas superadmin/developer pode ativar
    if (!ALLOWED_IMPERSONATE_ROLES.includes(userRole)) {
      return {
        success: false,
        error: `Acesso negado. Apenas utilizadores com role '${ALLOWED_IMPERSONATE_ROLES.join("' ou '")}' podem ativar o modo Impersonate.`
      }
    }

    // Validação dos dados
    if (!tenantId || !tenantId.trim()) {
      return {
        success: false,
        error: 'Tenant ID é obrigatório.'
      }
    }

    if (!companyName || !companyName.trim()) {
      return {
        success: false,
        error: 'Nome da empresa é obrigatório.'
      }
    }

    // Ativar o estado
    set({
      tenant_id: tenantId,
      nome_da_empresa: companyName,
      isActive: true
    })

    console.log('[Impersonate] Modo ativado para:', companyName, `(ID: ${tenantId})`)
    
    return { success: true }
  },

  /**
   * Desativa o modo Impersonate (volta à visão normal)
   */
  deactivateImpersonate: () => {
    const wasActive = get().isActive
    
    set({
      tenant_id: null,
      nome_da_empresa: null,
      isActive: false
    })

    if (wasActive) {
      console.log('[Impersonate] Modo desativado.')
    }
  },

  /**
   * Limpa completamente o estado (útil para logout ou reset)
   */
  clearImpersonate: () => {
    set({
      tenant_id: null,
      nome_da_empresa: null,
      isActive: false
    })
    
    console.log('[Impersonate] Estado limpo.')
  }
}))

/**
 * Hook de conveniência para aceder ao estado de Impersonate
 * 
 * Uso:
 * const { isActive, tenant_id, nome_da_empresa, activateImpersonate, deactivateImpersonate } = useImpersonate()
 */
export const useImpersonate = () => {
  const store = useImpersonateStore()
  
  return {
    // Estado
    isActive: store.isActive,
    tenantId: store.tenant_id,
    companyName: store.nome_da_empresa,
    
    // Ações
    activateImpersonate: store.activateImpersonate,
    deactivateImpersonate: store.deactivateImpersonate,
    clearImpersonate: store.clearImpersonate
  }
}

/**
 * Helper para verificar se um utilizador pode ativar Impersonate
 * 
 * @param role - Role do utilizador
 * @returns true se pode impersonate
 */
export const canImpersonate = (role: string | null | undefined): boolean => {
  if (!role) return false
  return ALLOWED_IMPERSONATE_ROLES.includes(role)
}
