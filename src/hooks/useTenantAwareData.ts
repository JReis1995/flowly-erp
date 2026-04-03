'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'

/**
 * Sprint 3: Tenant-Aware Data Fetching Hook
 * 
 * Este hook garante o isolamento crítico de dados:
 * - Se Impersonate estiver ATIVO: usa o tenant_id do estado Impersonate
 * - Se Impersonate estiver INATIVO: usa o tenant_id do utilizador logado
 * 
 * SEGURANÇA: Este hook É OBRIGATÓRIO para todas as queries tenant-specific
 * no dashboard do cliente. Nunca usar supabase diretamente sem passar por aqui.
 */

interface TenantAwareQueryOptions {
  table: string
  select?: string
  filters?: Record<string, unknown>
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
}

interface UseTenantAwareDataReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  effectiveTenantId: string | null
}

/**
 * Hook principal para queries tenant-aware
 * 
 * Uso:
 * const { data, loading, error, refetch, effectiveTenantId } = useTenantAwareData({
 *   table: 'faturas',
 *   select: '*, cliente:clientes(nome)',
 *   orderBy: { column: 'created_at', ascending: false }
 * })
 */
export function useTenantAwareData<T = Record<string, unknown>>(
  options: TenantAwareQueryOptions
): UseTenantAwareDataReturn<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estado de impersonate (prioridade máxima)
  const { isActive, tenantId: impersonatedTenantId } = useImpersonate()
  
  // Estado do tenant real do utilizador
  const [userTenantId, setUserTenantId] = useState<string | null>(null)
  
  // Tenant efetivo a usar nas queries
  const effectiveTenantId = isActive ? impersonatedTenantId : userTenantId
  
  // Buscar tenant_id real do utilizador logado
  useEffect(() => {
    async function fetchUserTenantId() {
      // Se estamos em modo impersonate, não precisamos do tenant real
      if (isActive) return
      
      const client = createBrowserClient()
      if (!client) {
        setError('Cliente Supabase não disponível')
        setLoading(false)
        return
      }

      try {
        const { data: { session } } = await client.auth.getSession()
        if (!session?.user) {
          setError('Utilizador não autenticado')
          setLoading(false)
          return
        }

        // Buscar tenant_id do perfil
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          // Fallback: buscar tenant pelo email
          const { data: tenant, error: tenantError } = await client
            .from('tenants')
            .select('id')
            .eq('gestor_email', session.user.email)
            .single()
          
          if (tenantError) {
            setError('Não foi possível determinar o tenant do utilizador')
          } else {
            setUserTenantId(tenant.id)
          }
        } else {
          setUserTenantId(profile?.tenant_id || null)
        }
      } catch (err) {
        console.error('Erro ao buscar tenant_id:', err)
        setError('Erro ao determinar tenant')
      }
    }

    fetchUserTenantId()
  }, [isActive])

  // Função de fetch tenant-aware
  const fetchData = useCallback(async () => {
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
      let query = client
        .from(options.table)
        .select(options.select || '*')
        .eq('tenant_id', effectiveTenantId)

      // Aplicar filtros adicionais
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }

      // Aplicar ordenação
      if (options.orderBy) {
        query = query.order(
          options.orderBy.column, 
          { ascending: options.orderBy.ascending ?? false }
        )
      }

      // Aplicar limite
      if (options.limit) {
        query = query.limit(options.limit)
      }

      const { data: result, error: queryError } = await query

      if (queryError) {
        console.error(`[TenantAware] Erro na query ${options.table}:`, queryError)
        setError(queryError.message)
        setData([])
      } else {
        setData(result as T[])
      }
    } catch (err) {
      console.error('[TenantAware] Erro inesperado:', err)
      setError('Erro ao carregar dados')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [effectiveTenantId, options])

  // Executar fetch quando effectiveTenantId mudar
  useEffect(() => {
    if (effectiveTenantId) {
      fetchData()
    }
  }, [effectiveTenantId, fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    effectiveTenantId
  }
}

/**
 * Helper para obter o tenant_id efetivo (impersonate ou real)
 * 
 * Use isto em server actions ou quando precisas apenas do ID sem query
 */
export async function getEffectiveTenantId(
  impersonateState: { isActive: boolean; tenantId: string | null }
): Promise<string | null> {
  // Se impersonate está ativo, retorna o tenant_id impersonado
  if (impersonateState.isActive && impersonateState.tenantId) {
    return impersonateState.tenantId
  }

  // Caso contrário, busca o tenant_id do utilizador logado
  const client = createBrowserClient()
  if (!client) return null

  try {
    const { data: { session } } = await client.auth.getSession()
    if (!session?.user) return null

    const { data: profile } = await client
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single()

    return profile?.tenant_id || null
  } catch {
    return null
  }
}

/**
 * Hook simples que retorna apenas o tenant_id efetivo
 * Útil para quando precisas do ID mas não vais fazer query imediatamente
 */
export function useEffectiveTenantId(): string | null {
  const { isActive, tenantId: impersonatedTenantId } = useImpersonate()
  const [userTenantId, setUserTenantId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserTenantId() {
      if (isActive) return

      const client = createBrowserClient()
      if (!client) return

      try {
        const { data: { session } } = await client.auth.getSession()
        if (!session?.user) return

        const { data: profile } = await client
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single()

        setUserTenantId(profile?.tenant_id || null)
      } catch (err) {
        console.error('Erro ao buscar tenant_id:', err)
      }
    }

    fetchUserTenantId()
  }, [isActive])

  return isActive ? impersonatedTenantId : userTenantId
}
