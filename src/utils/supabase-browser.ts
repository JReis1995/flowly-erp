import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function createBrowserClient(): SupabaseClient | null {
  // Lazy initialization - só cria o cliente quando necessário
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Supabase] URL ou Key não definidos - cliente não disponível')
      return null
    }

    browserClient = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
  return browserClient
}
