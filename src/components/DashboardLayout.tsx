'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useImpersonate } from '@/stores/impersonateStore'
import { ImpersonateBanner } from '@/components/impersonate/ImpersonateBanner'
import { ImpersonateDropdown } from '@/components/impersonate/ImpersonateDropdown'
import { createBrowserClient } from '@/utils/supabase-browser'
import { 
  Home, 
  Users, 
  Key, 
  Truck, 
  Building, 
  Brain, 
  CreditCard, 
  Settings, 
  BarChart3,
  FileText,
  Calendar,
  Warehouse,
  LogOut,
  User,
  Coins,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Loader2,
  X,
  Eye,
} from 'lucide-react'
import { useUserPermissions } from '@/hooks/useUserPermissions'

interface Module {
  id: string
  name: string
  icon: React.ElementType
  active?: boolean
  path: string
  moduleName?: string // Nome do módulo para feature toggling
  alwaysShow?: boolean // Se true, aparece sempre independentemente de active_modules
}

const modules: Module[] = [
  { id: 'pagina-inicial', name: 'Página Inicial', icon: Home, active: true, path: '/', alwaysShow: true },
  { id: 'central-saas', name: 'Central SaaS', icon: Home, active: true, path: '/central-saas', moduleName: 'central_saas' },
  { id: 'colaboradores', name: 'Colaboradores', icon: Users, active: true, path: '/colaboradores', moduleName: 'rh' },
  { id: 'acessos', name: 'Acessos', icon: Key, active: true, path: '/acessos', moduleName: 'acessos' },
  { id: 'clientes-fornecedores', name: 'Clientes & Fornecedores', icon: Users, active: true, path: '/clientes-fornecedores', moduleName: 'clientes' },
  { id: 'logistica', name: 'Logística', icon: Truck, active: true, path: '/logistica', moduleName: 'logistica' },
  { id: 'frota', name: 'Gestão de Frota', icon: Truck, active: true, path: '/frota', moduleName: 'frota' },
  { id: 'condominios', name: 'Gestão de Condomínios', icon: Building, active: true, path: '/condominios', moduleName: 'condominios' },
  { id: 'fichas-tecnicas', name: 'Fichas Técnicas', icon: FileText, active: true, path: '/fichas-tecnicas', moduleName: 'fichas_tecnicas' },
  { id: 'conta-corrente', name: 'Conta Corrente', icon: CreditCard, active: true, path: '/conta-corrente', moduleName: 'cc' },
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3, active: true, path: '/dashboard', moduleName: 'dashboard' },
  { id: 'ia-insight', name: 'IA Insight', icon: Brain, active: true, path: '/ia-insight', moduleName: 'ia' },
  { id: 'importacao-exportacao', name: 'Importação & Exportação', icon: FileText, active: true, path: '/importacao-exportacao', moduleName: 'importacao' },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { isActive: isImpersonateActive, clearImpersonate, tenantId, isDemoMode, demoModules } = useImpersonate()
  
  // Fetch permissions with cascade logic (tenant → tenant_users)
  // DEMO MODE: quando ativo, usa demoModules em vez de buscar à DB
  const { 
    visibleModules, 
    verCreditosIA, 
    comprarCreditosIA,
    loading: modulesLoading 
  } = useUserPermissions({ 
    isDemoMode, 
    demoModules 
  })
  
  // Função para verificar se um módulo deve ser mostrado
  const shouldShowModule = (module: Module): boolean => {
    // Sempre mostrar se alwaysShow for true (ex: Página Inicial)
    if (module.alwaysShow) return true
    
    // Durante loading, não mostrar módulos controlados (evita flash)
    if (modulesLoading) return false
    
    // Se não tem moduleName, não mostrar
    if (!module.moduleName) return false
    
    // IMPERSONATE: Superadmin vê como cliente - apenas módulos do cliente
    if (isImpersonateActive || isDemoMode) {
      return visibleModules.includes(module.moduleName)
    }
    
    // SUPERADMIN normal (sem impersonate): Ver todos os módulos
    if (userData.role === 'superadmin') return true
    
    // Outros utilizadores: Verificar se está nos módulos visíveis
    return visibleModules.includes(module.moduleName)
  }
  
  const [activeModule, setActiveModule] = useState('pagina-inicial')
  const [showUserModal, setShowUserModal] = useState(false)
  const [showImpersonateDropdown, setShowImpersonateDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const supabaseClient = createBrowserClient()
  const supabase = supabaseClient
  
  // User data state - agora com role real do Supabase
  const [userData, setUserData] = useState(() => {
    // Tentar recuperar role do localStorage (persistência temporária)
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('flowly_user_role') : null
    return {
      name: 'João Silva',
      email: 'joao@flowly.com',
      role: savedRole || 'Utilizador',
      profileImage: null as string | null,
      theme: 'claro' as 'claro' | 'escuro' | 'neutro'
    }
  })
  
  // Guardar role original separadamente - NUNCA muda durante impersonate
  // Isso garante que o dropdown de impersonate continua visível
  const [originalUserRole, setOriginalUserRole] = useState<string>(userData.role)
  
  // Helper para verificar se é superadmin por email (fallback)
  // ⚠️ APENAS emails específicos de admin - NÃO usar domínio genérico
  const isSuperAdminByEmail = (email: string | null): boolean => {
    if (!email) return false
    return email === 'jose.reis@flowly.pt' || 
           email === 'josereis1995@gmail.com' 
  }
  
  // Inicializar originalUserRole do localStorage no mount
  useEffect(() => {
    const savedRole = localStorage.getItem('flowly_user_role')
    if (savedRole && (savedRole === 'superadmin' || savedRole === 'developer')) {
      setOriginalUserRole(savedRole)
    }
  }, [])
  
  // Buscar dados reais do utilizador logado - com retry
  useEffect(() => {
    async function fetchUserData(attempt = 1) {
      const client = createBrowserClient()
      if (!client) return

      try {
        const { data: { session } } = await client.auth.getSession()
        if (!session?.user) return

        // Buscar perfil do utilizador com role
        const { data: profile, error } = await client
          .from('profiles')
          .select('nome, role, avatar_url')
          .eq('id', session.user.id)
          .single()

        if (!error && profile) {
          const userRole = profile.role || 'Utilizador'
          setUserData(prev => ({
            ...prev,
            name: profile.nome || session.user.email?.split('@')[0] || 'Utilizador',
            email: session.user.email || '',
            role: userRole,
            profileImage: profile.avatar_url || null
          }))
          // Guardar role original (só atualiza se não estiver impersonando)
          if (!isImpersonateActive) {
            setOriginalUserRole(userRole)
            localStorage.setItem('flowly_user_role', userRole)
          }
        } else if (attempt < 3) {
          // Retry após 500ms
          console.log(`[Dashboard] Retry fetchUserData (${attempt}/3)...`)
          setTimeout(() => fetchUserData(attempt + 1), 500)
        } else {
          console.warn('[Dashboard] Falha ao buscar profile, usando role existente:', userData.role)
          // Fallback por email para detectar superadmin
          const isAdmin = isSuperAdminByEmail(session.user.email)
          const fallbackRole = isAdmin ? 'superadmin' : 
            ((userData.role === 'superadmin' || userData.role === 'developer') ? userData.role : 'Utilizador')
          
          console.log('[Dashboard] Fallback por email:', session.user.email, '| isAdmin:', isAdmin, '| role:', fallbackRole)
          
          setUserData(prev => ({
            ...prev,
            name: session.user.email?.split('@')[0] || 'Utilizador',
            email: session.user.email || '',
            role: fallbackRole
          }))
          
          // Guardar no localStorage e originalUserRole
          if (!isImpersonateActive) {
            setOriginalUserRole(fallbackRole)
            localStorage.setItem('flowly_user_role', fallbackRole)
          }
        }
      } catch (err) {
        console.error('Erro ao buscar dados do utilizador:', err)
        if (attempt < 3) {
          setTimeout(() => fetchUserData(attempt + 1), 500)
        } else {
          // Fallback: usar dados da sessão + email para verificar superadmin
          const isAdmin = isSuperAdminByEmail(session.user.email)
          const fallbackRole = isAdmin ? 'superadmin' : 'Utilizador'
          
          console.log('[Dashboard] Fallback por email:', session.user.email, '| isAdmin:', isAdmin)
          
          setUserData(prev => ({
            ...prev,
            name: session.user.email?.split('@')[0] || 'Utilizador',
            email: session.user.email || '',
            role: fallbackRole
          }))
          
          // Guardar no localStorage
          if (!isImpersonateActive) {
            setOriginalUserRole(fallbackRole)
            localStorage.setItem('flowly_user_role', fallbackRole)
          }
        }
      }
    }

    fetchUserData()
  }, [])
  
  // Two-step validation state for sensitive data
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [tempData, setTempData] = useState<any>(null)
  const [confirmPassword, setConfirmPassword] = useState('')

  // Credits and purchase state
  const [creditos, setCreditos] = useState(0)
  const [creditosLoading, setCreditosLoading] = useState(true)
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [pacotes, setPacotes] = useState<any[]>([])
  const [pacotesLoading, setPacotesLoading] = useState(false)
  const pacotesFetched = useRef(false)

  // Buscar pacotes reais do Supabase quando abrir modal
  useEffect(() => {
    async function fetchPacotes() {
      const client = createBrowserClient()
      if (!client || !showBuyCreditsModal || pacotesFetched.current) return
      
      pacotesFetched.current = true
      setPacotesLoading(true)
      try {
        const { data, error } = await client
          .from('pacotes_ia')
          .select('*')
          .eq('status', 'Ativo')
          .order('creditos', { ascending: true })

        if (!error && data) {
          setPacotes(data)
        }
      } catch (err) {
        console.error('Erro ao buscar pacotes:', err)
      } finally {
        setPacotesLoading(false)
      }
    }

    fetchPacotes()
  }, [showBuyCreditsModal, supabase])

  // Reset flag quando fecha modal
  useEffect(() => {
    if (!showBuyCreditsModal) {
      pacotesFetched.current = false
    }
  }, [showBuyCreditsModal])

  // Buscar créditos reais do Supabase - AGORA COM IMPERSONATE AWARENESS
  useEffect(() => {
    async function fetchCreditos() {
      const client = createBrowserClient()
      if (!client) return

      try {
        // SPRINT 3: Determinar o tenant_id efetivo (impersonate ou real)
        let effectiveTenantId: string | null = null
        
        if (isImpersonateActive && tenantId) {
          // Modo Impersonate: usar o tenant_id do estado
          effectiveTenantId = tenantId
          console.log('[Dashboard] Modo Impersonate ativo. Tenant:', effectiveTenantId)
        } else {
          // Modo Normal: buscar tenant_id do utilizador logado
          const { data: { session } } = await client.auth.getSession()
          if (!session?.user) return

          const { data: profile } = await client
            .from('profiles')
            .select('tenant_id')
            .eq('id', session.user.id)
            .single()

          if (profile?.tenant_id) {
            effectiveTenantId = profile.tenant_id
          } else {
            // Fallback: buscar pelo email
            const { data: tenant } = await client
              .from('tenants')
              .select('id')
              .eq('gestor_email', session.user.email)
              .single()
            
            if (tenant) {
              effectiveTenantId = tenant.id
            }
          }
        }

        if (!effectiveTenantId) {
          console.warn('[Dashboard] Nenhum tenant_id efetivo encontrado')
          setCreditos(0)
          return
        }

        // Buscar créditos do tenant efetivo
        const { data: tenant, error } = await client
          .from('tenants')
          .select('creditos_ia')
          .eq('id', effectiveTenantId)
          .single()

        if (error) {
          console.error('[Dashboard] Erro ao buscar créditos:', error)
        } else if (tenant) {
          setCreditos(tenant.creditos_ia || 0)
        }
      } catch (error) {
        console.error('[Dashboard] Erro ao buscar créditos:', error)
      } finally {
        setCreditosLoading(false)
      }
    }

    fetchCreditos()

    // Atualizar créditos quando a janela ganhar foco (após compra)
    const handleFocus = () => fetchCreditos()
    window.addEventListener('focus', handleFocus)

    return () => window.removeEventListener('focus', handleFocus)
  }, [isImpersonateActive, tenantId]) // Recarregar quando impersonate mudar

  const handleModuleClick = (module: Module) => {
    if (!module.active) return
    
    setActiveModule(module.id)
    if (module.path !== '#') {
      router.push(module.path)
    }
  }

  const handleLogout = async () => {
    if (!supabase) {
      console.error('Supabase não configurado')
      return
    }

    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Erro ao fazer logout:', error)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  // Função para iniciar compra de créditos
  const handleComprar = async (pacote: any) => {
    if (!supabase) {
      alert('Erro: Supabase não configurado')
      return
    }

    setCheckoutLoading(pacote.id)

    try {
      // Buscar sessão
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        alert('Erro: Utilizador não autenticado')
        return
      }

      console.log('Email do utilizador:', session.user.email)

      // Buscar tenant pelo email do gestor
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, gestor_email')
        .eq('gestor_email', session.user.email)
        .single()

      if (tenantError) {
        console.error('Erro ao buscar tenant:', tenantError)
      }

      console.log('Tenant encontrado:', tenant)

      if (!tenant?.id) {
        alert(`Erro: Tenant não encontrado para o email ${session.user.email}. Verifica se o teu email está registado como gestor de um cliente.`)
        return
      }

      if (!pacote.link_pagamento) {
        alert('Erro: Este pacote não tem um Price ID do Stripe configurado. Contacte o administrador.')
        return
      }

      // Criar sessão de checkout
      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: pacote.link_pagamento,
          tenantId: tenant.id,
          pacoteId: pacote.id,
          mode: 'payment'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar sessão de pagamento')
      }

      const { url } = await response.json()
      
      // Redirecionar para Stripe
      if (url) {
        window.location.href = url
      } else {
        alert('Erro: URL de pagamento não disponível')
      }

    } catch (error: any) {
      console.error('Erro ao iniciar compra:', error)
      alert(`Erro: ${error.message || 'Não foi possível iniciar a compra'}`)
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleProfileUpdate = (field: string, value: any) => {
    // Fields that require 2-step validation
    const sensitiveFields = ['email', 'password']
    
    if (sensitiveFields.includes(field)) {
      setTempData({ field, value })
      setShowPasswordConfirm(true)
    } else {
      // Direct update for non-sensitive fields
      setUserData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const confirmUpdate = () => {
    if (confirmPassword === 'admin123') { // Simulação - na app real seria validação real
      if (tempData) {
        setUserData(prev => ({
          ...prev,
          [tempData.field]: tempData.value
        }))
      }
      setShowPasswordConfirm(false)
      setTempData(null)
      setConfirmPassword('')
    } else {
      alert('Palavra-passe incorreta!')
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        // Direct update for profile image (no validation needed)
        setUserData(prev => ({
          ...prev,
          profileImage: reader.result as string
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <>
      {/* Impersonate Banner - aparece no topo quando ativo */}
      <ImpersonateBanner />
      
      <div className={`min-h-screen bg-brand-light flex ${isImpersonateActive || isDemoMode ? 'pt-10' : ''}`}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-brand-midnight flex flex-col transition-all duration-300 overflow-hidden`}>
        {/* Logo */}
        <div className="p-6 border-b border-brand-slate/20">
          <img 
            src="https://i.postimg.cc/mrcDM13S/flowly-logo.jpg" 
            alt="Flowly Logo" 
            className="h-10 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {/* Loading state for modules */}
          {modulesLoading && (
            <div className="flex items-center justify-center py-4 px-4">
              <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
              <span className="ml-2 text-sm text-brand-slate font-brand-secondary">A carregar módulos...</span>
            </div>
          )}
          
          {/* Debug info when impersonating or demo mode */}
          {(isImpersonateActive || isDemoMode) && (
            <div className={`mb-4 px-4 py-2 rounded-lg ${isDemoMode ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-brand-primary/20'}`}>
              <p className={`text-xs font-brand-secondary font-medium ${isDemoMode ? 'text-orange-700' : 'text-brand-primary'}`}>
                {isDemoMode ? '🔥 Modo Demo Ativo' : 'Modo Impersonate Ativo'}
              </p>
              <p className="text-xs text-brand-slate font-brand-secondary">
                Módulos visíveis: {visibleModules.length > 0 ? visibleModules.join(', ') : 'Nenhum'}
              </p>
              <p className="text-xs text-brand-slate font-brand-secondary">
                Ver Créditos: {verCreditosIA ? 'Sim' : 'Não'} | Comprar: {comprarCreditosIA ? 'Sim' : 'Não'}
              </p>
            </div>
          )}
          
          <ul className="space-y-2">
            {modules.filter(shouldShowModule).map((module) => {
              const Icon = module.icon
              return (
                <li key={module.id}>
                  <button
                    onClick={() => handleModuleClick(module)}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors text-left ${
                      activeModule === module.id
                        ? 'bg-brand-primary text-white'
                        : 'text-brand-slate hover:bg-brand-slate/20 hover:text-white'
                    } ${!module.active ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!module.active}
                  >
                    <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="font-brand-secondary font-medium whitespace-nowrap">
                      {module.name}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-brand-slate/20">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-brand-slate hover:bg-brand-slate/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-brand-secondary font-medium">Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-brand-white border-b border-brand-border px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left - Toggle Menu + User Profile */}
            <div className="flex items-center space-x-4">
              {/* Toggle Sidebar Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
              >
                {sidebarOpen ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>

              {/* User Profile */}
              <button
                onClick={() => setShowUserModal(!showUserModal)}
                className="flex items-center space-x-3 hover:bg-brand-light p-2 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center ring-2 ring-brand-white shadow-brand">
                  {userData.profileImage ? (
                    <img 
                      src={userData.profileImage} 
                      alt="Profile" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-brand-primary font-semibold text-brand-midnight">
                    {userData.name}
                  </div>
                  <div className="text-sm text-brand-slate font-brand-secondary">{userData.role}</div>
                </div>
              </button>
            </div>

            {/* Center - Logo */}
            <div className="flex items-center">
              <img 
                src="https://i.postimg.cc/mrcDM13S/flowly-logo.jpg" 
                alt="Flowly Logo" 
                className="h-8 w-auto"
              />
            </div>

            {/* Right - Credits, Impersonate, Logout */}
            <div className="flex items-center space-x-4">
              {/* AI Credits - Only show if user has permission */}
              {verCreditosIA && (
                <button
                  onClick={() => comprarCreditosIA && setShowBuyCreditsModal(true)}
                  className={`flex items-center space-x-2 bg-brand-light px-3 py-2 rounded-lg transition-colors ${
                    comprarCreditosIA ? 'hover:bg-brand-border cursor-pointer' : 'cursor-default'
                  }`}
                  title={comprarCreditosIA ? "Clique para comprar mais créditos" : "Créditos IA - Consulte o gestor para comprar"}
                >
                  <Coins className="w-5 h-5 text-brand-primary" />
                  <span className="font-brand-secondary font-medium text-brand-midnight">
                    {creditos} créditos
                  </span>
                  {comprarCreditosIA && <Plus className="w-4 h-4 text-brand-success" />}
                </button>
              )}

              {/* Impersonate Dropdown - sempre usa role original, nunca do impersonado */}
              <ImpersonateDropdown userRole={originalUserRole} />

              {/* Logout */}
              <button 
                onClick={handleLogout}
                className="p-2 text-brand-slate hover:text-brand-midnight transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* User Settings Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-brand-white rounded-lg p-6 w-full max-w-md shadow-2xl border border-brand-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-brand-primary font-semibold text-brand-midnight">
                Configurações do Perfil
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-brand-slate hover:text-brand-midnight p-1 hover:bg-brand-light rounded-lg transition-colors"
              >
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Profile Image */}
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-20 h-20 bg-brand-primary rounded-full flex items-center justify-center mx-auto ring-2 ring-brand-white shadow-brand">
                    {userData.profileImage ? (
                      <img 
                        src={userData.profileImage} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-white" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-brand-success rounded-full p-1 cursor-pointer hover:bg-opacity-90 transition-colors shadow-brand">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="w-4 h-4 text-white flex items-center justify-center">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </div>
                  </label>
                </div>
              </div>
              
              {/* Name */}
              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={userData.name}
                  onChange={(e) => handleProfileUpdate('name', e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-white"
                />
              </div>
              
              {/* Email */}
              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => handleProfileUpdate('email', e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-white"
                />
                <p className="text-xs text-brand-slate font-brand-secondary mt-1">
                  Requer confirmação da palavra-passe atual
                </p>
              </div>
              
              {/* Password */}
              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-2">
                  Nova Palavra-passe
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  onChange={(e) => handleProfileUpdate('password', e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-white"
                />
                <p className="text-xs text-brand-slate font-brand-secondary mt-1">
                  Requer confirmação da palavra-passe atual
                </p>
              </div>
              
              {/* Theme */}
              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-2">
                  Tema da Aplicação
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['claro', 'escuro', 'neutro'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => handleProfileUpdate('theme', theme)}
                      className={`px-3 py-2 rounded-lg border transition-colors ${
                        userData.theme === theme
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-brand-white text-brand-midnight border-brand-border hover:border-brand-primary'
                      }`}
                    >
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-brand-slate hover:text-brand-midnight font-brand-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg font-brand-primary font-medium hover:opacity-90"
              >
                Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal */}
      {showPasswordConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-brand-white rounded-lg p-6 w-full max-w-sm shadow-2xl border border-brand-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-brand-primary font-semibold text-brand-midnight">
                Confirmação de Segurança
              </h3>
              <button
                onClick={() => {
                  setShowPasswordConfirm(false)
                  setTempData(null)
                  setConfirmPassword('')
                }}
                className="text-brand-slate hover:text-brand-midnight p-1 hover:bg-brand-light rounded-lg transition-colors"
              >
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
            </div>
            
            <p className="text-brand-slate font-brand-secondary mb-4">
              Para alterar informações sensíveis, por favor confirme a sua palavra-passe atual:
            </p>
            
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Palavra-passe atual"
              className="w-full px-3 py-2 border border-brand-border rounded-lg font-brand-secondary focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-white mb-4"
            />
            
            <div className="text-xs text-brand-slate font-brand-secondary mb-4">
              Demo: Use "admin123" para confirmar
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPasswordConfirm(false)
                  setTempData(null)
                  setConfirmPassword('')
                }}
                className="px-4 py-2 text-brand-slate hover:text-brand-midnight font-brand-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmUpdate}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg font-brand-primary font-medium hover:opacity-90"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Credits Modal */}
      {showBuyCreditsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-brand-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-brand-border">
            {/* Header */}
            <div className="sticky top-0 bg-brand-white border-b border-brand-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="font-brand-primary font-bold text-xl text-brand-midnight">
                    Comprar Créditos IA
                  </h2>
                  <p className="text-sm text-brand-slate font-brand-secondary">
                    {creditosLoading ? 'A carregar...' : `Tens ${creditos} créditos disponíveis`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBuyCreditsModal(false)}
                className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-brand-slate font-brand-secondary mb-6">
                Escolhe um pacote de créditos IA para adquirir. Os créditos serão adicionados à tua conta imediatamente após a confirmação do pagamento.
              </p>

              {/* Loading state */}
              {pacotesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                  <span className="ml-3 text-brand-slate font-brand-secondary">A carregar pacotes...</span>
                </div>
              ) : pacotes.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="w-12 h-12 text-brand-slate mx-auto mb-4" />
                  <p className="text-brand-slate font-brand-secondary">Nenhum pacote disponível de momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {pacotes.map((pacote, index) => {
                    const isPopular = index === 1 // O do meio é o mais popular
                    return (
                      <div 
                        key={pacote.id}
                        className={`relative border-2 rounded-xl p-5 transition-all ${
                          isPopular 
                            ? 'border-brand-primary bg-[#F0FDFA]' 
                            : 'border-brand-border hover:border-brand-primary/50'
                        }`}
                      >
                        {isPopular && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-brand-secondary font-medium px-3 py-1 rounded-full">
                            Mais Popular
                          </span>
                        )}
                        
                        <div className="text-center mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                            isPopular ? 'bg-brand-primary/10' : 'bg-brand-light'
                          }`}>
                            <Brain className={`w-6 h-6 ${isPopular ? 'text-brand-primary' : 'text-brand-slate'}`} />
                          </div>
                          <h3 className="font-brand-primary font-bold text-lg text-brand-midnight">
                            {pacote.nome}
                          </h3>
                        </div>

                        <div className="text-center mb-4">
                          <span className="text-3xl font-brand-primary font-bold text-brand-midnight">
                            €{Number(pacote.preco_base).toFixed(2)}
                          </span>
                        </div>

                        <div className="text-center mb-5">
                          <span className="inline-flex items-center gap-1 text-brand-primary font-brand-secondary font-medium">
                            <Coins className="w-4 h-4" />
                            {pacote.creditos} créditos
                          </span>
                        </div>

                        <button
                          onClick={() => handleComprar(pacote)}
                          disabled={checkoutLoading === pacote.id}
                          className={`w-full py-3 rounded-lg font-brand-secondary font-medium transition-colors flex items-center justify-center gap-2 ${
                            isPopular
                              ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
                              : 'bg-brand-light text-brand-midnight hover:bg-brand-border'
                          }`}
                        >
                          {checkoutLoading === pacote.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShoppingCart className="w-4 h-4" />
                          )}
                          Comprar Agora
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-6 text-center">
                <p className="text-xs text-brand-slate font-brand-secondary">
                  Pagamento processado de forma segura via Stripe. 
                  <a href="/checkout/cancel" className="text-brand-primary hover:underline ml-1">
                    Termos e condições
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
