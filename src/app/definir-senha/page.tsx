'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/utils/supabase-browser'

function DefinirSenhaForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)

  // Supabase redireciona com tokens no fragmento (#access_token=...) — não na query string
  useEffect(() => {
    const hashParams = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
    )
    const access =
      hashParams.get('access_token') || searchParams.get('access_token')
    const refresh =
      hashParams.get('refresh_token') || searchParams.get('refresh_token')

    setAccessToken(access)
    setRefreshToken(refresh)

    if (access && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      )
    }

    if (!access) {
      setError('Link inválido ou expirado. Por favor, solicite um novo link.')
    }
    setIsChecking(false)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validações
    if (password.length < 8) {
      setError('A palavra-passe deve ter pelo menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem')
      return
    }

    if (!accessToken) {
      setError('Link inválido ou expirado')
      return
    }

    if (!supabase) {
      setError('Erro: Supabase não configurado. Contacte o suporte.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // Definir sessão com o access_token do magic link
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })

      if (sessionError) {
        setError('Link expirado ou inválido. Por favor, solicite um novo.')
        setIsLoading(false)
        return
      }

      // Atualizar a palavra-passe do utilizador
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message || 'Erro ao definir palavra-passe')
        setIsLoading(false)
        return
      }

      setSuccess(true)

      // Redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      console.error('[DefinirSenha] Erro:', err)
      setError('Erro ao processar. Tente novamente.')
      setIsLoading(false)
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
              Definir Palavra-passe
            </h1>
            <p className="text-brand-slate mt-2 font-brand-secondary">
              Crie a sua palavra-passe de acesso ao Flowly ERP
            </p>
          </div>

          {isChecking ? (
            <div className="brand-card p-8 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : (
            <div className="brand-card p-8">
              {success ? (
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-brand-midnight font-brand-primary mb-2">
                    Palavra-passe definida com sucesso!
                  </h2>
                  <p className="text-brand-slate font-brand-secondary mb-4">
                    A sua conta está pronta a usar. Redirecionando para a aplicação...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-brand-midnight font-brand-primary mb-2">
                      Nova Palavra-passe
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-brand-slate" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="block w-full pl-10 pr-10 py-2 border border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-brand-slate" />
                        ) : (
                          <Eye className="h-5 w-5 text-brand-slate" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-brand-slate mt-1 font-brand-secondary">
                      Mínimo 8 caracteres
                    </p>
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-brand-midnight font-brand-primary mb-2">
                      Confirmar Palavra-passe
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-brand-slate" />
                      </div>
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="block w-full pl-10 pr-10 py-2 border border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5 text-brand-slate" />
                        ) : (
                          <Eye className="h-5 w-5 text-brand-slate" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-brand-secondary bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !accessToken}
                    className="w-full bg-brand-primary text-white py-2 px-4 rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-brand-primary font-medium transition-colors"
                  >
                    {isLoading ? 'A processar...' : 'Definir Palavra-passe'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Back to Login */}
          {!success && !isChecking && (
            <div className="text-center mt-6">
              <a
                href="/login"
                className="text-brand-slate hover:text-brand-primary text-sm font-brand-secondary transition-colors"
              >
                ← Voltar ao login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Fallback para Suspense
function DefinirSenhaFallback() {
  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  )
}

// Page component com Suspense boundary
export default function DefinirSenhaPage() {
  return (
    <Suspense fallback={<DefinirSenhaFallback />}>
      <DefinirSenhaForm />
    </Suspense>
  )
}
