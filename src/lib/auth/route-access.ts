export const INTERNAL_ROUTES = ['/central-saas'] as const

export const CLIENT_ROUTES = [
  '/acessos',
  '/clientes-fornecedores',
  '/colaboradores',
  '/dashboard',
  '/escalas',
  '/frota',
  '/ia-insight',
  '/logistica',
] as const

export const PUBLIC_ROUTES = [
  '/',
  '/definir-senha',
  '/login',
  '/checkout/cancel',
  '/checkout/success',
] as const

export const INTERNAL_ALLOWED_ROLES = ['superadmin', 'developer'] as const

function matchesRoute(pathname: string, routes: readonly string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export function isPublicRoute(pathname: string) {
  return matchesRoute(pathname, PUBLIC_ROUTES)
}

export function isInternalRoute(pathname: string) {
  return matchesRoute(pathname, INTERNAL_ROUTES)
}

export function isClientRoute(pathname: string) {
  return matchesRoute(pathname, CLIENT_ROUTES)
}

