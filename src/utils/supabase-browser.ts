import { createServerClient, type CookieOptions } from '@supabase/ssr'

export function createBrowserClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined
          const cookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
          return cookie ? cookie.split('=')[1] : undefined
        },
        set(name: string, value: string, options: CookieOptions) {
          if (typeof document === 'undefined') return
          let cookieString = `${name}=${value}`
          if (options.maxAge) {
            cookieString += `; Max-Age=${options.maxAge}`
          }
          if (options.domain) {
            cookieString += `; Domain=${options.domain}`
          }
          cookieString += '; Path=/'
          if (options.secure) {
            cookieString += '; Secure'
          }
          if (options.sameSite) {
            cookieString += `; SameSite=${options.sameSite}`
          }
          document.cookie = cookieString
        },
        remove(name: string, options: CookieOptions) {
          if (typeof document === 'undefined') return
          document.cookie = `${name}=; Max-Age=0; Path=/`
        },
      },
    }
  )
}
