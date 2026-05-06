'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'
import { gestorEmailLookupValues } from '@/lib/rh/manager-company'

/**
 * Resolve o tenant/empresa efetivo para ecrãs de RH (gestor, impersonate ou plataforma com tenant escolhido).
 */
export function useRhCompanyId(selectedPlatformTenant: string = '') {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { isActive: impersonateActive, tenantId: impersonateTenantId } = useImpersonate()

  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [profileTenantId, setProfileTenantId] = useState<string | null>(null)
  /** superadmin/developer sem tenant_id no perfil: empresa via gestor_email ou tenant_users (igual à API de criar colaborador). */
  const [platformFallbackTenantId, setPlatformFallbackTenantId] = useState<string | null>(null)
  /** idle = não aplicável; pending = a resolver; done = tentativa concluída (com ou sem tenant). */
  const [platformFallbackStatus, setPlatformFallbackStatus] = useState<'idle' | 'pending' | 'done'>('idle')
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setProfileRole(null)
      setProfileTenantId(null)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()
    setProfileRole(profile?.role ?? null)
    setProfileTenantId(profile?.tenant_id ?? null)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const isPlatform = profileRole === 'superadmin' || profileRole === 'developer'

  useEffect(() => {
    if (!supabase || !isPlatform || impersonateActive || profileTenantId) {
      setPlatformFallbackTenantId(null)
      setPlatformFallbackStatus('idle')
      return
    }
    if (selectedPlatformTenant.trim()) {
      setPlatformFallbackTenantId(null)
      setPlatformFallbackStatus('idle')
      return
    }
    setPlatformFallbackStatus('pending')
    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      const email = user?.email?.trim()
      if (!user || !email) {
        if (!cancelled) {
          setPlatformFallbackTenantId(null)
          setPlatformFallbackStatus('done')
        }
        return
      }
      const variants = gestorEmailLookupValues(email)
      let foundId: string | null = null
      if (variants.length > 0) {
        const { data: byGestor } = await supabase
          .from('tenants')
          .select('id')
          .in('gestor_email', variants)
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (byGestor?.id) foundId = byGestor.id
      }
      if (!foundId) {
        const { data: tu } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .in('role', ['admin', 'gestor'])
          .limit(1)
          .maybeSingle()
        if (!cancelled && tu?.tenant_id) foundId = tu.tenant_id
      }
      if (!cancelled) {
        setPlatformFallbackTenantId(foundId)
        setPlatformFallbackStatus('done')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, isPlatform, impersonateActive, profileTenantId, selectedPlatformTenant])

  const companyId = useMemo(() => {
    if (impersonateActive && impersonateTenantId) return impersonateTenantId
    if (!isPlatform && profileTenantId) return profileTenantId
    if (isPlatform && profileTenantId) return profileTenantId
    if (isPlatform && selectedPlatformTenant.trim()) return selectedPlatformTenant.trim()
    if (isPlatform && platformFallbackTenantId) return platformFallbackTenantId
    return null
  }, [
    impersonateActive,
    impersonateTenantId,
    isPlatform,
    profileTenantId,
    platformFallbackTenantId,
    selectedPlatformTenant,
  ])

  const needsPlatformFallback =
    Boolean(supabase) &&
    isPlatform &&
    !impersonateActive &&
    !profileTenantId &&
    !selectedPlatformTenant.trim()

  const loadingContext =
    loading || (needsPlatformFallback && platformFallbackStatus !== 'done')

  return {
    supabase,
    companyId,
    isPlatform,
    profileTenantId,
    impersonateActive,
    /** Inclui a resolução da empresa para superadmin/developer sem tenant_id no perfil (evita “Sem empresa” antes do fallback). */
    loading: loadingContext,
    profileLoading: loading,
    refreshProfile,
  }
}
