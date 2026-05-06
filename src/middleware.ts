import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { INTERNAL_ALLOWED_ROLES, isClientRoute, isInternalRoute, isPublicRoute } from '@/lib/auth/route-access'

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
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Rotas públicas não exigem autenticação.
  if (isPublicRoute(pathname)) {
    return response
  }

  const isInternal = isInternalRoute(pathname)
  const isClient = isClientRoute(pathname)

  // Não interferir em rotas que ainda não foram classificadas.
  if (!isInternal && !isClient) {
    return response
  }

  const supabase = createMiddlewareClient(request, response)

  if (!supabase) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Rotas de cliente exigem apenas sessão válida.
  if (!isInternal) {
    return response
  }

  // Verificar se é email de superadmin de teste
  if (SUPERADMIN_EMAILS.includes(user.email || '')) {
    return response
  }

  // Rotas internas exigem role de superadmin/developer
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !INTERNAL_ALLOWED_ROLES.includes(profile.role as (typeof INTERNAL_ALLOWED_ROLES)[number])) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
