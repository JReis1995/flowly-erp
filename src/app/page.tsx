'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/utils/supabase-browser'
import DashboardLayout from '@/components/DashboardLayout'
import { Coins, Mail, Phone, ArrowRight, Star, Zap, Shield, TrendingUp } from 'lucide-react'

interface Empresa {
  id: string
  nome: string
  modulo_logistica_ativo: boolean
  modulo_condominios_ativo: boolean
}

export default function Home() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    const fetchEmpresas = async () => {
      if (!supabase) {
        console.error('Supabase não configurado')
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('*')
        
        if (error) {
          console.error('Erro ao buscar empresas:', error)
        } else {
          setEmpresas(data || [])
        }
      } catch (error) {
        console.error('Erro:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEmpresas()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-brand-slate">Carregando...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Hero Section - Resumo */}
        <div className="text-center mb-12 py-12">
          <div className="mb-8">
            <h1 className="text-5xl font-brand-primary font-bold text-brand-midnight mb-6">
              Transforme o seu negócio com o
              <span className="text-brand-primary"> Flowly ERP</span>
            </h1>
            <p className="text-xl text-brand-slate font-brand-secondary max-w-3xl mx-auto leading-relaxed">
              A plataforma inteligente que revoluciona a gestão empresarial. 
              Junte-se a mais de 1.000 empresas que já aumentaram a sua produtividade em 73% 
              e reduziram custos operacionais em 45%.
            </p>
          </div>

          {/* Stats Virais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="brand-card p-6 text-center">
              <div className="text-4xl font-brand-primary font-bold text-brand-primary mb-2">73%</div>
              <div className="text-brand-slate font-brand-secondary">Aumento de Produtividade</div>
              <div className="flex justify-center mt-2">
                <TrendingUp className="w-5 h-5 text-brand-success" />
              </div>
            </div>
            <div className="brand-card p-6 text-center">
              <div className="text-4xl font-brand-primary font-bold text-brand-success mb-2">45%</div>
              <div className="text-brand-slate font-brand-secondary">Redução de Custos</div>
              <div className="flex justify-center mt-2">
                <Zap className="w-5 h-5 text-brand-primary" />
              </div>
            </div>
            <div className="brand-card p-6 text-center">
              <div className="text-4xl font-brand-primary font-bold text-brand-midnight mb-2">1000+</div>
              <div className="text-brand-slate font-brand-secondary">Empresas Satisfeitas</div>
              <div className="flex justify-center mt-2">
                <Star className="w-5 h-5 text-brand-warning" />
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Banner */}
        <div className="mb-12">
          <div className="bg-gradient-to-r from-brand-primary to-brand-success rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-3xl font-brand-primary font-bold mb-3">
                  Desbloqueie o Poder Completo do Flowly ERP
                </h2>
                <p className="text-lg mb-6 opacity-90 font-brand-secondary">
                  Actualize para o plano PRO e aceda a todos os módulos, IA avançada, suporte prioritário 
                  e recursos exclusivos que transformarão o seu negócio.
                </p>
                <div className="flex items-center space-x-4">
                  <button className="bg-white text-brand-primary px-6 py-3 rounded-lg font-brand-primary font-semibold hover:bg-brand-light transition-colors flex items-center">
                    Fazer Upgrade Agora
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                  <span className="text-2xl font-bold">€29/mês</span>
                </div>
              </div>
              
              <div className="hidden lg:block ml-8">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6">
                  <Shield className="w-16 h-16 mb-3" />
                  <div className="text-sm font-brand-secondary">30 dias</div>
                  <div className="text-lg font-brand-primary font-bold">Garantia</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modules Preview */}
        <div className="mb-12">
          <h2 className="text-3xl font-brand-primary font-bold text-brand-midnight mb-8 text-center">
            Tudo o que precisa num só lugar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="brand-card p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center mb-4">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-brand-primary font-bold text-brand-midnight mb-2">Gestão Financeira</h3>
              <p className="text-brand-slate font-brand-secondary">Controlo total das suas finanças com relatórios em tempo real</p>
            </div>
            
            <div className="brand-card p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-brand-success rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-brand-primary font-bold text-brand-midnight mb-2">IA Insights</h3>
              <p className="text-brand-slate font-brand-secondary">Análise inteligente para decisões estratégicas</p>
            </div>
            
            <div className="brand-card p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-brand-midnight rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-brand-primary font-bold text-brand-midnight mb-2">Segurança Máxima</h3>
              <p className="text-brand-slate font-brand-secondary">Dados protegidos com encriptação de nível bancário</p>
            </div>
          </div>
        </div>

        {/* Footer Contact */}
        <footer className="border-t border-brand-border pt-12 pb-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-brand-primary font-bold text-brand-midnight mb-4">
              Estamos aqui para ajudar
            </h3>
            <p className="text-brand-slate font-brand-secondary mb-8">
              A nossa equipa de especialistas está disponível para suportar o seu crescimento
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
              <a 
                href="mailto:geral@flowly.pt" 
                className="flex items-center space-x-3 text-brand-primary hover:text-brand-midnight transition-colors group"
              >
                <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center group-hover:bg-brand-midnight transition-colors">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-brand-primary font-semibold text-brand-midnight">geral@flowly.pt</div>
                  <div className="text-sm text-brand-slate font-brand-secondary">Suporte Geral</div>
                </div>
              </a>
              
              <a 
                href="mailto:comercial@flowly.pt" 
                className="flex items-center space-x-3 text-brand-success hover:text-brand-midnight transition-colors group"
              >
                <div className="w-12 h-12 bg-brand-success rounded-lg flex items-center justify-center group-hover:bg-brand-midnight transition-colors">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-brand-primary font-semibold text-brand-midnight">comercial@flowly.pt</div>
                  <div className="text-sm text-brand-slate font-brand-secondary">Equipas Comerciais</div>
                </div>
              </a>
              
              <a 
                href="tel:+351927140717" 
                className="flex items-center space-x-3 text-brand-warning hover:text-brand-midnight transition-colors group"
              >
                <div className="w-12 h-12 bg-brand-warning rounded-lg flex items-center justify-center group-hover:bg-brand-midnight transition-colors">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-brand-primary font-semibold text-brand-midnight">927 140 717</div>
                  <div className="text-sm text-brand-slate font-brand-secondary">Chamada Urgente</div>
                </div>
              </a>
            </div>
          </div>
          
          <div className="text-center text-brand-slate font-brand-secondary text-sm">
            <p>© 2024 Flowly ERP. Todos os direitos reservados. | Feito com ❤️ em Portugal</p>
          </div>
        </footer>
      </div>
    </DashboardLayout>
  )
}
