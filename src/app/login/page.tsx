'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Phone, MessageCircle, HelpCircle } from 'lucide-react'
import { createBrowserClient } from '@/utils/supabase-browser'

// Componente que usa useSearchParams - precisa de Suspense boundary
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/'
  const supabase = createBrowserClient()

  // Verificar se já está autenticado
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push(nextUrl)
      }
    }
    checkAuth()
  }, [router, nextUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Login] Submit iniciado', { email })
    setIsLoading(true)
    setError('')

    if (!supabase) {
      console.error('[Login] Supabase não configurado')
      setError('Erro de configuração. Supabase não inicializado.')
      setIsLoading(false)
      return
    }

    console.log('[Login] A chamar signInWithPassword...')
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('[Login] Resposta:', { data, error })

      if (error) {
        console.error('[Login] Erro Supabase:', error)
        setError(`Erro: ${error.message}`)
      } else if (data?.user) {
      // Forçar refresh da sessão para garantir que cookies estão definidos
        console.log('[Login] A aguardar sincronização de cookies...')
        
        // Aguardar um tick para garantir que cookies foram definidos
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Verificar se sessão está realmente disponível
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[Login] Sessão após login:', { hasSession: !!session })
        
        console.log('[Login] Sucesso! Redirecionar para:', nextUrl)
        // Usar router.refresh() primeiro para atualizar o estado do servidor, depois redirect
        router.refresh()
        // Pequeno delay para garantir que o middleware recebe os cookies atualizados
        setTimeout(() => {
          window.location.href = nextUrl
        }, 50)
      } else {
        setError('Resposta inesperada do servidor.')
      }
    } catch (err) {
      console.error('[Login] Catch error:', err)
      setError(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    } finally {
      setIsLoading(false)
      console.log('[Login] Submit terminado')
    }
  }

  return (
    <div className="min-h-screen bg-brand-light flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="https://i.postimg.cc/mrcDM13S/flowly-logo.jpg"
              alt="Flowly ERP"
              className="mx-auto h-16 w-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-brand-midnight font-brand-primary">
              Bem-vindo ao Flowly ERP
            </h1>
            <p className="text-brand-slate mt-2 font-brand-secondary">
              Faça login para aceder à sua conta
            </p>
          </div>

          {/* Login Card */}
          <div className="brand-card p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-brand-midnight font-brand-primary mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-brand-slate" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-brand-midnight font-brand-primary mb-2">
                  Palavra-passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-brand-slate" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-red-500 text-sm font-brand-secondary">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-brand-primary font-medium transition-colors"
              >
                {isLoading ? 'A entrar...' : 'Entrar'}
              </button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <a
                  href="/recuperar-password"
                  className="text-brand-slate hover:text-brand-primary text-sm font-brand-secondary transition-colors"
                >
                  Esqueci-me da palavra-passe
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Contact Section */}
      <div className="bg-white border-t border-brand-border py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-brand-midnight font-brand-primary mb-2">
              Suporte Flowly
            </h3>
            <p className="text-brand-slate font-brand-secondary">
              Estamos aqui para ajudar. Contacte-nos através dos seguintes canais:
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            {/* General Contact */}
            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <h4 className="font-semibold text-brand-midnight font-brand-primary mb-1">Geral</h4>
              <p className="text-brand-slate font-brand-secondary text-sm">geral@flowly.pt</p>
            </div>

            {/* Commercial Contact */}
            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                  <HelpCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h4 className="font-semibold text-brand-midnight font-brand-primary mb-1">Comercial</h4>
              <p className="text-brand-slate font-brand-secondary text-sm">comercial@flowly.pt</p>
            </div>

            {/* Phone Contact */}
            <div className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                  <Phone className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <h4 className="font-semibold text-brand-midnight font-brand-primary mb-1">Telefone</h4>
              <p className="text-brand-slate font-brand-secondary text-sm">927 140 717</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Fallback para Suspense
function LoginFallback() {
  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <div className="text-brand-slate font-brand-secondary">A carregar...</div>
    </div>
  )
}

// Page component com Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
