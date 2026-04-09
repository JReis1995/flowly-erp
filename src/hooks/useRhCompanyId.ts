'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@/utils/supabase-browser'
import { useImpersonate } from '@/stores/impersonateStore'

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
      return
    }
    if (selectedPlatformTenant.trim()) {
      setPlatformFallbackTenantId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      const email = user?.email?.trim()
      if (!user || !email || cancelled) {
        if (!cancelled) setPlatformFallbackTenantId(null)
        return
      }
      const { data: byGestor } = await supabase
        .from('tenants')
        .select('id')
        .eq('gestor_email', email)
        .maybeSingle()
      if (cancelled) return
      if (byGestor?.id) {
        setPlatformFallbackTenantId(byGestor.id)
        return
      }
      const { data: tu } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .in('role', ['admin', 'gestor'])
        .limit(1)
        .maybeSingle()
      if (!cancelled) setPlatformFallbackTenantId(tu?.tenant_id ?? null)
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

  return {
    supabase,
    companyId,
    isPlatform,
    profileTenantId,
    impersonateActive,
    loading,
    refreshProfile,
  }
}
