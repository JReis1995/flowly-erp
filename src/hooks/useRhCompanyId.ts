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

  const companyId = useMemo(() => {
    if (impersonateActive && impersonateTenantId) return impersonateTenantId
    if (!isPlatform && profileTenantId) return profileTenantId
    if (isPlatform && profileTenantId) return profileTenantId
    if (isPlatform && selectedPlatformTenant.trim()) return selectedPlatformTenant.trim()
    return null
  }, [
    impersonateActive,
    impersonateTenantId,
    isPlatform,
    profileTenantId,
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
