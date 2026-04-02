'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../src/utils/supabase'
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
  X
} from 'lucide-react'

interface Module {
  id: string
  name: string
  icon: React.ElementType
  active?: boolean
  path: string
}

const modules: Module[] = [
  { id: 'pagina-inicial', name: 'Página Inicial', icon: Home, active: true, path: '/' },
  { id: 'central-saas', name: 'Central SaaS', icon: Home, active: true, path: '/central-saas' },
  { id: 'colaboradores', name: 'Colaboradores', icon: Users, active: true, path: '/colaboradores' },
  { id: 'acessos', name: 'Acessos', icon: Key, active: true, path: '/acessos' },
  { id: 'clientes-fornecedores', name: 'Clientes & Fornecedores', icon: Users, active: true, path: '/clientes-fornecedores' },
  { id: 'logistica', name: 'Logística', icon: Truck, active: true, path: '/logistica' },
  { id: 'frota', name: 'Gestão de Frota', icon: Truck, active: true, path: '/frota' },
  { id: 'condominios', name: 'Gestão de Condomínios', icon: Building, active: true, path: '#' },
  { id: 'fichas-tecnicas', name: 'Fichas Técnicas', icon: FileText, active: true, path: '#' },
  { id: 'conta-corrente', name: 'Conta Corrente', icon: CreditCard, active: true, path: '#' },
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3, active: true, path: '/dashboard' },
  { id: 'ia-insight', name: 'IA Insight', icon: Brain, active: true, path: '/ia-insight' },
  { id: 'importacao-exportacao', name: 'Importação & Exportação', icon: FileText, active: true, path: '#' },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const [activeModule, setActiveModule] = useState('pagina-inicial')
  const [showUserModal, setShowUserModal] = useState(false)
  const [creditos, setCreditos] = useState(250)
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false)
  const [pacotesIA, setPacotesIA] = useState<any[]>([])
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [showImpersonateDropdown, setShowImpersonateDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // User data state
  const [userData, setUserData] = useState({
    name: 'João Silva',
    email: 'joao@flowly.com',
    role: 'Administrador',
    profileImage: null as string | null,
    theme: 'claro' as 'claro' | 'escuro' | 'neutro'
  })
  
  // Two-step validation state for sensitive data
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [tempData, setTempData] = useState<any>(null)
  const [confirmPassword, setConfirmPassword] = useState('')

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
    <div className="min-h-screen bg-brand-light flex">
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
          <ul className="space-y-2">
            {modules.map((module) => {
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
              {/* AI Credits - Clickable */}
              <button
                onClick={() => setShowBuyCreditsModal(true)}
                className="flex items-center space-x-2 bg-brand-light px-3 py-2 rounded-lg hover:bg-brand-border transition-colors"
                title="Clique para comprar mais créditos"
              >
                <Coins className="w-5 h-5 text-brand-primary" />
                <span className="font-brand-secondary font-medium text-brand-midnight">
                  {creditos} créditos
                </span>
                <Plus className="w-4 h-4 text-brand-success" />
              </button>

              {/* Impersonate Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowImpersonateDropdown(!showImpersonateDropdown)}
                  className="flex items-center space-x-2 bg-brand-light px-3 py-2 rounded-lg hover:bg-brand-border transition-colors"
                >
                  <span className="font-brand-secondary text-brand-midnight">Admin</span>
                  <ChevronDown className="w-4 h-4 text-brand-slate" />
                </button>

                {showImpersonateDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-brand-white rounded-lg shadow-brand border border-brand-border z-50">
                    <div className="p-2">
                      <button className="w-full text-left px-3 py-2 text-sm text-brand-midnight hover:bg-brand-light rounded font-brand-secondary">
                        João Silva
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm text-brand-midnight hover:bg-brand-light rounded font-brand-secondary">
                        Maria Santos
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm text-brand-midnight hover:bg-brand-light rounded font-brand-secondary">
                        Pedro Costa
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
                    Tens {creditos} créditos disponíveis
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

              {/* Mock Packages - In production, fetch from API */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'starter', nome: 'Starter', creditos: 100, preco: 9.99, popular: false },
                  { id: 'pro', nome: 'Pro', creditos: 500, preco: 39.99, popular: true },
                  { id: 'enterprise', nome: 'Enterprise', creditos: 2000, preco: 149.99, popular: false },
                ].map((pacote) => (
                  <div 
                    key={pacote.id}
                    className={`relative border-2 rounded-xl p-5 transition-all ${
                      pacote.popular 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-brand-border hover:border-purple-300'
                    }`}
                  >
                    {pacote.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-brand-secondary font-medium px-3 py-1 rounded-full">
                        Mais Popular
                      </span>
                    )}
                    
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Brain className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="font-brand-primary font-bold text-lg text-brand-midnight">
                        {pacote.nome}
                      </h3>
                    </div>

                    <div className="text-center mb-4">
                      <span className="text-3xl font-brand-primary font-bold text-brand-midnight">
                        €{pacote.preco.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-center mb-5">
                      <span className="inline-flex items-center gap-1 text-brand-primary font-brand-secondary font-medium">
                        <Coins className="w-4 h-4" />
                        {pacote.creditos} créditos
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        // In production, call Stripe checkout
                        window.open('/central-saas/pacotes-ia', '_blank')
                      }}
                      disabled={checkoutLoading === pacote.id}
                      className={`w-full py-3 rounded-lg font-brand-secondary font-medium transition-colors flex items-center justify-center gap-2 ${
                        pacote.popular
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
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
                ))}
              </div>

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
  )
}
