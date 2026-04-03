'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'

interface UserPermissions {
  // Módulos visíveis (interseção: tenant_modules && user_modules)
  visibleModules: string[]
  // Funcionalidades específicas
  verCreditosIA: boolean
  comprarCreditosIA: boolean
  verDividas: boolean
  gestaoUtilizadores: boolean
  // Loading state
  loading: boolean
  error: string | null
}

interface UseUserPermissionsOptions {
  isDemoMode?: boolean
  demoModules?: string[]
}

/**
 * Hook para permissões em CASCATA:
 * 1. Busca módulos ativos do tenant (nível empresa)
 * 2. Busca restrições do utilizador em tenant_users (nível colaborador)
 * 3. Retorna interseção: só módulos que ambos permitem
 * 
 * DEMO MODE: Quando isDemoMode=true, usa demoModules em vez de buscar à DB
 * 
 * Se colaborador não existir em tenant_users:
 * - Usa todos os módulos do tenant (acesso total por padrão)
 * - Mas sem permissões especiais (créditos, gestão, etc.)
 * 
 * Ideal para: Gestor definir módulos da empresa, depois restringir por colaborador
 */
export function useUserPermissions(options?: UseUserPermissionsOptions): UserPermissions {
  const [visibleModules, setVisibleModules] = useState<string[]>([])
  const [verCreditosIA, setVerCreditosIA] = useState(false)
  const [comprarCreditosIA, setComprarCreditosIA] = useState(false)
  const [verDividas, setVerDividas] = useState(false)
  const [gestaoUtilizadores, setGestaoUtilizadores] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isActive: isImpersonateActive, tenantId: impersonatedTenantId } = useImpersonate()
  
  // DEMO MODE: usar opções passadas ou defaults
  const isDemoMode = options?.isDemoMode ?? false
  const demoModules = options?.demoModules ?? []

  useEffect(() => {
    console.log('[useUserPermissions] Effect triggered - isDemoMode:', isDemoMode, 'demoModules:', demoModules)
    
    async function fetchPermissions() {
      setLoading(true)
      setError(null)

      // DEMO MODE: usar módulos demo diretamente sem buscar à DB
      if (isDemoMode && demoModules.length > 0) {
        console.log('[useUserPermissions] ✅ DEMO MODE ATIVO - usando módulos:', demoModules)
        setVisibleModules(demoModules)
        setVerCreditosIA(true)
        setComprarCreditosIA(false)
        setVerDividas(true)
        setGestaoUtilizadores(true)
        setLoading(false)
        return
      }
      
      console.log('[useUserPermissions] Modo normal - buscando permissões da DB...')

      const client = createBrowserClient()
      if (!client) {
        setError('Cliente Supabase não disponível')
        setLoading(false)
        return
      }

      try {
        // Buscar sessão e tenant do utilizador
        const { data: { session } } = await client.auth.getSession()
        if (!session?.user) {
          setError('Utilizador não autenticado')
          setLoading(false)
          return
        }

        const userId = session.user.id

        // Determinar tenant_id efetivo (impersonate ou real)
        let effectiveTenantId: string | null = impersonatedTenantId

        if (!isImpersonateActive) {
          // Buscar tenant_id do perfil do utilizador
          const { data: profile } = await client
            .from('profiles')
            .select('tenant_id')
            .eq('id', userId)
            .single()

          if (profile?.tenant_id) {
            effectiveTenantId = profile.tenant_id
          } else {
            // Fallback: buscar tenant pelo email
            const { data: tenant } = await client
              .from('tenants')
              .select('id')
              .eq('gestor_email', session.user.email)
              .single()
            
            effectiveTenantId = tenant?.id || null
          }
        }

        if (!effectiveTenantId) {
          setError('Nenhum tenant encontrado')
          setLoading(false)
          return
        }

        console.log('[useUserPermissions] Tenant efetivo:', effectiveTenantId)

        // 1. Buscar MÓDULOS DO TENANT (nível empresa)
        const { data: tenant, error: tenantError } = await client
          .from('tenants')
          .select('modulo_logistica, modulo_condominios, modulo_frota, modulo_rh, modulo_cc, modulo_ia, modulo_fichas_tecnicas, modulo_importacao, modulo_acessos, modulo_clientes, modulo_dashboard, modulo_central_saas')
          .eq('id', effectiveTenantId)
          .single()

        if (tenantError || !tenant) {
          console.error('[useUserPermissions] Erro ao buscar tenant:', tenantError)
          setError('Erro ao buscar permissões do tenant')
          setLoading(false)
          return
        }

        // Converter colunas do tenant para array
        const tenantModules: string[] = []
        if (tenant.modulo_logistica) tenantModules.push('logistica')
        if (tenant.modulo_condominios) tenantModules.push('condominios')
        if (tenant.modulo_frota) tenantModules.push('frota')
        if (tenant.modulo_rh) tenantModules.push('rh')
        if (tenant.modulo_cc) tenantModules.push('cc')
        if (tenant.modulo_ia) tenantModules.push('ia')
        if (tenant.modulo_fichas_tecnicas) tenantModules.push('fichas_tecnicas')
        if (tenant.modulo_importacao) tenantModules.push('importacao')
        if (tenant.modulo_acessos) tenantModules.push('acessos')
        if (tenant.modulo_clientes) tenantModules.push('clientes')
        if (tenant.modulo_dashboard) tenantModules.push('dashboard')
        if (tenant.modulo_central_saas) tenantModules.push('central_saas')

        console.log('[useUserPermissions] Módulos do tenant:', tenantModules)

        // 2. Buscar RESTRIÇÕES DO UTILIZADOR (nível colaborador)
        const { data: userAccess, error: userError } = await client
          .from('tenant_users')
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .eq('user_id', userId)
          .single()

        let finalModules: string[] = []
        let userVerCreditos = false
        let userComprarCreditos = false
        let userVerDividas = false
        let userGestaoUtilizadores = false

        if (userError || !userAccess) {
          // Colaborador NÃO está em tenant_users
          // → Usa TODOS os módulos do tenant (gestor tem acesso total)
          // → Mas SEM permissões especiais por padrão
          console.log('[useUserPermissions] Utilizador não está em tenant_users - usando módulos do tenant')
          finalModules = tenantModules
          userVerCreditos = true  // Gestor vê créditos
          userComprarCreditos = true
          userVerDividas = true
          userGestaoUtilizadores = true
        } else {
          // Colaborador ESTÁ em tenant_users
          // → Interseção: só módulos que ambos (tenant && user) permitem
          console.log('[useUserPermissions] Restrições do utilizador:', userAccess)

          const userModules: string[] = []
          if (userAccess.modulo_logistica && tenant.modulo_logistica) userModules.push('logistica')
          if (userAccess.modulo_condominios && tenant.modulo_condominios) userModules.push('condominios')
          if (userAccess.modulo_frota && tenant.modulo_frota) userModules.push('frota')
          if (userAccess.modulo_rh && tenant.modulo_rh) userModules.push('rh')
          if (userAccess.modulo_cc && tenant.modulo_cc) userModules.push('cc')
          if (userAccess.modulo_ia && tenant.modulo_ia) userModules.push('ia')
          if (userAccess.modulo_fichas_tecnicas && tenant.modulo_fichas_tecnicas) userModules.push('fichas_tecnicas')
          if (userAccess.modulo_importacao && tenant.modulo_importacao) userModules.push('importacao')
          if (userAccess.modulo_acessos && tenant.modulo_acessos) userModules.push('acessos')
          if (userAccess.modulo_clientes && tenant.modulo_clientes) userModules.push('clientes')
          if (userAccess.modulo_dashboard && tenant.modulo_dashboard) userModules.push('dashboard')
          if (userAccess.modulo_central_saas && tenant.modulo_central_saas) userModules.push('central_saas')

          finalModules = userModules
          userVerCreditos = userAccess.ver_creditos_ia ?? false
          userComprarCreditos = userAccess.comprar_creditos_ia ?? false
          userVerDividas = userAccess.ver_dividas ?? false
          userGestaoUtilizadores = userAccess.gestao_utilizadores ?? false
        }

        console.log('[useUserPermissions] Módulos finais:', finalModules)
        console.log('[useUserPermissions] Permissões:', { userVerCreditos, userComprarCreditos, userVerDividas, userGestaoUtilizadores })

        setVisibleModules(finalModules)
        setVerCreditosIA(userVerCreditos)
        setComprarCreditosIA(userComprarCreditos)
        setVerDividas(userVerDividas)
        setGestaoUtilizadores(userGestaoUtilizadores)

      } catch (err) {
        console.error('[useUserPermissions] Erro inesperado:', err)
        setError('Erro ao carregar permissões')
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [isImpersonateActive, impersonatedTenantId, isDemoMode, demoModules])

  return {
    visibleModules,
    verCreditosIA,
    comprarCreditosIA,
    verDividas,
    gestaoUtilizadores,
    loading,
    error
  }
}
