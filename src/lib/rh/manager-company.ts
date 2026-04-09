import type { SupabaseClient } from '@supabase/supabase-js'

export type ProfileRow = {
  tenant_id: string | null
  role: string | null
}

export function isPlatformRhRole(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'developer'
}

/** Resolve o tenant/empresa onde o utilizador atua como gestor (não inclui bypass de plataforma). */
export async function resolveManagerCompanyId(
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined,
  profile: ProfileRow | null
): Promise<string | null> {
  if (profile?.role === 'gestor' && profile.tenant_id) {
    return profile.tenant_id
  }
  if (email) {
    const { data: t } = await supabase
      .from('tenants')
      .select('id')
      .eq('gestor_email', email)
      .maybeSingle()
    if (t?.id) return t.id
  }
  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .in('role', ['admin', 'gestor'])
    .limit(1)
    .maybeSingle()
  if (tu?.tenant_id) return tu.tenant_id
  return profile?.tenant_id ?? null
}

export async function userManagesCompany(
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined,
  companyId: string,
  profile: ProfileRow | null
): Promise<boolean> {
  if (isPlatformRhRole(profile?.role)) {
    return true
  }
  if (profile?.role === 'gestor' && profile.tenant_id === companyId) {
    return true
  }
  if (email) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', companyId)
      .eq('gestor_email', email)
      .maybeSingle()
    if (tenant?.id) return true
  }
  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('tenant_id', companyId)
    .eq('user_id', userId)
    .in('role', ['admin', 'gestor'])
    .limit(1)
    .maybeSingle()
  return Boolean(tu?.tenant_id)
}
