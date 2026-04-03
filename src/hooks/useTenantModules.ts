'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'

interface UseTenantModulesReturn {
  activeModules: string[]
  loading: boolean
  error: string | null
  effectiveTenantId: string | null
}

/**
 * Hook para buscar os módulos ativos do tenant atual
 * 
 * Segurança: Respeita o modo Impersonate - se ativo, usa o tenant_id impersonado
 * 
 * Uso:
 * const { activeModules, loading, error, effectiveTenantId } = useTenantModules()
 * 
 * Retorna um array de strings com os nomes dos módulos ativos, ex: ["condominios", "limpezas"]
 */
export function useTenantModules(): UseTenantModulesReturn {
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estado de impersonate (prioridade máxima)
  const { isActive: isImpersonateActive, tenantId: impersonatedTenantId } = useImpersonate()
  
  // Estado do tenant real do utilizador
  const [userTenantId, setUserTenantId] = useState<string | null>(null)
  
  // Tenant efetivo a usar
  const effectiveTenantId = isImpersonateActive ? impersonatedTenantId : userTenantId

  // Buscar tenant_id real do utilizador logado (se não estiver em impersonate)
  useEffect(() => {
    async function fetchUserTenantId() {
      if (isImpersonateActive) return
      
      const client = createBrowserClient()
      if (!client) return

      try {
        const { data: { session } } = await client.auth.getSession()
        if (!session?.user) return

        // Buscar tenant_id do perfil
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          // Fallback: buscar tenant pelo email
          const { data: tenant } = await client
            .from('tenants')
            .select('id')
            .eq('gestor_email', session.user.email)
            .single()
          
          if (tenant) {
            setUserTenantId(tenant.id)
          }
        } else {
          setUserTenantId(profile?.tenant_id || null)
        }
      } catch (err) {
        console.error('Erro ao buscar tenant_id:', err)
      }
    }

    fetchUserTenantId()
  }, [isImpersonateActive])

  // Buscar módulos ativos do tenant efetivo
  useEffect(() => {
    async function fetchActiveModules() {
      if (!effectiveTenantId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const client = createBrowserClient()
      if (!client) {
        setError('Cliente Supabase não disponível')
        setLoading(false)
        return
      }

      try {
        console.log('[useTenantModules] Buscando módulos para tenant:', effectiveTenantId)
        
        const { data: tenant, error: tenantError } = await client
          .from('tenants')
          .select('modulo_logistica, modulo_condominios, modulo_frota, modulo_rh, modulo_cc, modulo_ia, modulo_fichas_tecnicas, modulo_importacao, modulo_acessos, modulo_clientes, modulo_dashboard, modulo_central_saas')
          .eq('id', effectiveTenantId)
          .single()

        if (tenantError) {
          console.error('[useTenantModules] Erro ao buscar módulos:', tenantError)
          setError(tenantError.message)
          setActiveModules([])
        } else if (tenant) {
          console.log('[useTenantModules] Módulos brutos da DB:', tenant)
          
          // Converter colunas booleanas para array de módulos ativos
          const modulesArray: string[] = []
          
          if (tenant.modulo_logistica) modulesArray.push('logistica')
          if (tenant.modulo_condominios) modulesArray.push('condominios')
          if (tenant.modulo_frota) modulesArray.push('frota')
          if (tenant.modulo_rh) modulesArray.push('rh')
          if (tenant.modulo_cc) modulesArray.push('cc')
          if (tenant.modulo_ia) modulesArray.push('ia')
          if (tenant.modulo_fichas_tecnicas) modulesArray.push('fichas_tecnicas')
          if (tenant.modulo_importacao) modulesArray.push('importacao')
          if (tenant.modulo_acessos) modulesArray.push('acessos')
          if (tenant.modulo_clientes) modulesArray.push('clientes')
          if (tenant.modulo_dashboard) modulesArray.push('dashboard')
          if (tenant.modulo_central_saas) modulesArray.push('central_saas')
          
          console.log('[useTenantModules] Módulos ativos convertidos:', modulesArray)
          setActiveModules(modulesArray)
        } else {
          console.log('[useTenantModules] Nenhum módulo configurado')
          setActiveModules([])
        }
      } catch (err) {
        console.error('[useTenantModules] Erro inesperado:', err)
        setError('Erro ao carregar módulos')
        setActiveModules([])
      } finally {
        setLoading(false)
      }
    }

    fetchActiveModules()
  }, [effectiveTenantId])

  return {
    activeModules,
    loading,
    error,
    effectiveTenantId
  }
}
