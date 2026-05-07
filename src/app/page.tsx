import { CheckCircle2, HelpCircle, Layers, MessageCircle, Phone, Sparkles, Workflow } from 'lucide-react'
import LeadRequestModal from '@/components/marketing/LeadRequestModal'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

const SUPERADMIN_EMAILS = ['josereis1995@gmail.com', 'jose.reis@flowly.pt']

async function getLandingContext() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return { isAdmin: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const role = profile?.role ?? null
  const isSuperAdminEmail = SUPERADMIN_EMAILS.includes(session.user.email ?? '')
  const isAdmin = role === 'superadmin' || role === 'developer' || isSuperAdminEmail

  if (!isAdmin) {
    redirect('/colaboradores')
  }

  return { isAdmin }
}

export default async function Home() {
  const { isAdmin } = await getLandingContext()

  const landingContent = (
    <main className="min-h-screen bg-brand-light">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-10">
        <img
          src="https://i.postimg.cc/mrcDM13S/flowly-logo.jpg"
          alt="Flowly"
          className="h-12 w-auto mb-8"
        />

        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-white border border-brand-border text-sm text-brand-slate font-brand-secondary">
          <Sparkles className="w-4 h-4 text-brand-primary" />
          Software personalizado para equipas ambiciosas
        </span>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-brand-primary font-bold text-brand-midnight leading-tight">
              Software e websites personalizados para acelerar vendas e melhorar processos.
            </h1>
            <p className="mt-5 text-lg text-brand-slate font-brand-secondary max-w-2xl">
              Concebemos e desenvolvemos produtos digitais com foco em resultados de negócio.
              Partilha o objetivo e recebe um orçamento com próximos passos em até 2 dias úteis.
            </p>
            <LeadRequestModal />
            <p className="mt-3 text-sm text-brand-slate font-brand-secondary">
              Diagnóstico inicial gratuito, sem compromisso.
            </p>
          </div>

          <div className="brand-card p-6">
            <h2 className="text-xl font-brand-primary font-bold text-brand-midnight mb-4">O que desenvolvemos</h2>
            <ul className="space-y-3">
              {[
                'CRM comercial e operacional adaptado ao teu funil',
                'Aplicações web para equipas e operações internas',
                'Websites profissionais orientados a conversão',
                'Gestão de filas e atendimento com métricas em tempo real',
                'Automatizações de processos e integração entre sistemas',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-brand-slate font-brand-secondary">
                  <CheckCircle2 className="w-5 h-5 text-brand-success mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-2xl sm:text-3xl font-brand-primary font-bold text-brand-midnight mb-6">Resultados que os clientes sentem no dia a dia</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="brand-card p-5">
            <p className="text-3xl font-brand-primary font-bold text-brand-primary">-38%</p>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Redução média do tempo gasto em tarefas operacionais repetitivas.
            </p>
          </div>
          <div className="brand-card p-5">
            <p className="text-3xl font-brand-primary font-bold text-brand-success">+27%</p>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Aumento de leads qualificadas após otimização do processo comercial.
            </p>
          </div>
          <div className="brand-card p-5">
            <p className="text-3xl font-brand-primary font-bold text-brand-midnight">-42%</p>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Menos erros manuais com integração entre equipas, dados e operações.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            'Entrega por milestones',
            'Arquitetura escalável',
            'Suporte evolutivo',
            'Foco em conversão',
          ].map((trust) => (
            <div
              key={trust}
              className="bg-brand-white border border-brand-border rounded-lg px-4 py-2 text-sm text-brand-midnight font-brand-secondary text-center"
            >
              {trust}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="brand-card p-5">
            <Layers className="w-8 h-8 text-brand-primary mb-3" />
            <h3 className="font-brand-primary font-bold text-brand-midnight">Arquitetura sólida</h3>
            <p className="text-brand-slate font-brand-secondary mt-1">
              Soluções pensadas para crescer e aumentar a performance.
            </p>
          </div>
          <div className="brand-card p-5">
            <Workflow className="w-8 h-8 text-brand-success mb-3" />
            <h3 className="font-brand-primary font-bold text-brand-midnight">Processo claro</h3>
            <p className="text-brand-slate font-brand-secondary mt-1">
              Reunião inicial, proposta, entrega por etapas e suporte contínuo.
            </p>
          </div>
          <div className="brand-card p-5">
            <Sparkles className="w-8 h-8 text-brand-warning mb-3" />
            <h3 className="font-brand-primary font-bold text-brand-midnight">Execução rápida</h3>
            <p className="text-brand-slate font-brand-secondary mt-1">
              Priorização orientada ao impacto no negócio e a resultados no curto prazo.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-2xl sm:text-3xl font-brand-primary font-bold text-brand-midnight mb-6">Como trabalhamos</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            ['01', 'Reunião inicial', 'Percebemos o teu contexto, objetivos e prioridades de negócio.'],
            ['02', 'Plano de trabalho', 'Definimos a solução, o âmbito e a entrega por fases.'],
            ['03', 'Implementação', 'Desenvolvimento com validações curtas para manter controlo e qualidade.'],
            ['04', 'Acompanhamento', 'Melhorias contínuas orientadas por resultados e uso real.'],
          ].map(([step, title, desc]) => (
            <div key={step} className="brand-card p-5">
              <p className="text-xs font-brand-primary font-bold text-brand-primary">{step}</p>
              <h3 className="mt-2 text-lg font-brand-primary font-bold text-brand-midnight">{title}</h3>
              <p className="mt-2 text-sm text-brand-slate font-brand-secondary">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="bg-gradient-to-r from-brand-midnight to-[#0f172a] rounded-2xl p-6 sm:p-8 md:p-10 text-white">
          <p className="text-sm uppercase tracking-wide text-white/70 font-brand-secondary">Estúdio Flowly</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-brand-primary font-bold max-w-3xl">
            Da ideia ao produto digital com estratégia, design e engenharia no mesmo fluxo.
          </h2>
          <p className="mt-3 text-white/80 font-brand-secondary max-w-2xl">
            Desenvolvemos software e websites focados em crescimento, operação e experiência do cliente.
          </p>
          <div className="mt-6">
            <LeadRequestModal />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-2xl sm:text-3xl font-brand-primary font-bold text-brand-midnight mb-6">Perguntas frequentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="brand-card p-5">
            <h3 className="font-brand-primary font-semibold text-brand-midnight">Fazem só software ou também websites?</h3>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Fazemos os dois. Desenvolvemos websites orientados a conversão e software interno sob medida.
            </p>
          </div>
          <div className="brand-card p-5">
            <h3 className="font-brand-primary font-semibold text-brand-midnight">Quanto tempo demora um projeto?</h3>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              O prazo é definido por nós após diagnóstico técnico para garantir compromisso realista de entrega.
            </p>
          </div>
          <div className="brand-card p-5">
            <h3 className="font-brand-primary font-semibold text-brand-midnight">Como funciona o orçamento?</h3>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Enviamos orçamento com fases, entregáveis e prioridade de implementação. Sem custos escondidos.
            </p>
          </div>
          <div className="brand-card p-5">
            <h3 className="font-brand-primary font-semibold text-brand-midnight">Podem integrar com sistemas existentes?</h3>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Sim. Integramos com ERP, faturação, e-commerce, email, WhatsApp e outras APIs.
            </p>
          </div>
          <div className="brand-card p-5">
            <h3 className="font-brand-primary font-semibold text-brand-midnight">Há manutenção após entrega?</h3>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Sim, com opção de suporte pontual ou avença mensal de evolução contínua.
            </p>
          </div>
          <div className="brand-card p-5">
            <h3 className="font-brand-primary font-semibold text-brand-midnight">O código e a solução ficam do cliente?</h3>
            <p className="mt-2 text-sm text-brand-slate font-brand-secondary">
              Depende do acordo inicial. Esse ponto fica sempre definido de forma transparente na proposta e no arranque do projeto.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="bg-gradient-to-r from-[#0b1220] to-[#0f172a] rounded-2xl border border-white/10 p-6 sm:p-8 md:p-10 text-white">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60 font-brand-secondary">
                Contactos e Credenciais
              </p>
              <h3 className="mt-2 text-3xl font-brand-primary font-bold">
                Suporte premium para decisões técnicas críticas.
              </h3>
              <p className="mt-3 text-white/75 font-brand-secondary max-w-xl">
                Acompanhamos cada projeto com padrões de qualidade, segurança e governança operacional desde o primeiro diagnóstico.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  'Processo auditável por etapas',
                  'Arquitetura e segurança pensadas de raiz',
                  'Acordo de tempos de resposta por projeto',
                ].map((badge) => (
                  <span
                    key={badge}
                    className="px-3 py-1.5 rounded-full text-xs font-brand-secondary bg-white/10 border border-white/15 text-white/90"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <a href="mailto:geral@flowly.pt" className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/15 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70 font-brand-secondary">Geral</p>
                    <p className="font-brand-primary font-semibold">geral@flowly.pt</p>
                  </div>
                </div>
              </a>

              <a href="mailto:comercial@flowly.pt" className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/15 rounded-lg">
                    <HelpCircle className="h-5 w-5 text-green-300" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70 font-brand-secondary">Comercial</p>
                    <p className="font-brand-primary font-semibold">comercial@flowly.pt</p>
                  </div>
                </div>
              </a>

              <a href="tel:+351927140717" className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/15 rounded-lg">
                    <Phone className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70 font-brand-secondary">Telefone</p>
                    <p className="font-brand-primary font-semibold">927 140 717</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  )

  if (isAdmin) {
    return <DashboardLayout>{landingContent}</DashboardLayout>
  }

  return landingContent
}
