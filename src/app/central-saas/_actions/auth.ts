import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLOWED_ROLES = ['superadmin', 'developer']

// Emails de teste que sempre têm acesso superadmin (para desenvolvimento)
const SUPERADMIN_EMAILS = [
  'josereis1995@gmail.com',
  'jose.reis@flowly.pt'
]

export async function checkAdminAccess() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          return (await cookieStore).get(name)?.value
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          (await cookieStore).set({ name, value, ...options })
        },
        remove: async (name: string, options: CookieOptions) => {
          (await cookieStore).set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { allowed: false, error: 'Não autenticado', user: null }
  }

  // Verificar se é email de superadmin de teste
  if (SUPERADMIN_EMAILS.includes(user.email || '')) {
    return { 
      allowed: true, 
      error: null, 
      user: { 
        email: user.email, 
        nome: user.user_metadata?.nome || user.email, 
        role: 'superadmin' 
      } 
    }
  }

  // Tentar buscar perfil da tabela profiles
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email, nome')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError)
      return { 
        allowed: false, 
        error: `Tabela 'profiles' não encontrada ou erro de base de dados: ${profileError.message}. Contacte o administrador.`, 
        user: null 
      }
    }

    if (!profile) {
      return { 
        allowed: false, 
        error: 'Perfil não encontrado. O utilizador existe mas não tem perfil associado.', 
        user: null 
      }
    }

    if (!ALLOWED_ROLES.includes(profile.role)) {
      return { 
        allowed: false, 
        error: `Acesso negado. Role '${profile.role}' não tem permissão. Roles permitidas: ${ALLOWED_ROLES.join(', ')}`, 
        user: null 
      }
    }

    return { allowed: true, error: null, user: profile }
  } catch (error) {
    console.error('Erro inesperado:', error)
    return { 
      allowed: false, 
      error: `Erro ao verificar acesso: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 
      user: null 
    }
  }
}
