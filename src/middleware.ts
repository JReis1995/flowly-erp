import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ALLOWED_ROLES = ['superadmin', 'developer']

// Emails de teste que sempre têm acesso superadmin (para desenvolvimento)
const SUPERADMIN_EMAILS = [
  'josereis1995@gmail.com',
  'jose.reis@flowly.pt'
]

// Lazy initialization do cliente Supabase
function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Middleware] Supabase URL ou Key não definidos')
    return null
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Proteger rotas /central-saas
  if (request.nextUrl.pathname.startsWith('/central-saas')) {
    const supabase = createMiddlewareClient(request, response)

    if (!supabase) {
      // Se Supabase não configurado, redirecionar para login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      // Redirecionar para login com URL de destino
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }

    // Verificar se é email de superadmin de teste
    if (SUPERADMIN_EMAILS.includes(user.email || '')) {
      return response // Permitir acesso
    }

    // Verificar role do utilizador na tabela profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/central-saas/:path*'],
}
