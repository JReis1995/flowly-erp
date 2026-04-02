import { getAdminMetrics } from "./_actions/metrics";
import {
  Users,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Brain,
  Briefcase,
  ArrowUpRight,
  Euro,
  ArrowLeft,
  Home,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const metrics = await getAdminMetrics();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">
            Dashboard Administrativo
          </h1>
          <p className="text-brand-slate mt-2 font-brand-secondary">
            Visão geral do SaaS Flowly - Métricas em tempo real
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-light text-brand-midnight rounded-lg font-brand-secondary font-medium hover:bg-brand-border transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Início
        </a>
      </div>

      {/* MRR Card - Principal */}
      <div className="mb-8">
        <div className="brand-card p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-success/5 rounded-full -ml-24 -mb-24" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-brand-slate text-sm font-brand-secondary mb-1">
                  Receita Corrente Mensal (MRR)
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="font-brand-primary font-bold text-5xl text-brand-midnight">
                    {metrics.mrrTotal.toLocaleString('pt-PT', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </h2>
                  <span className="text-brand-slate">/mês</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
                <Euro className="w-8 h-8 text-brand-primary" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                  metrics.crescimentoMensal >= 0
                    ? 'bg-brand-success/10 text-brand-success'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {metrics.crescimentoMensal >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-brand-primary font-semibold">
                  {metrics.crescimentoMensal > 0 ? '+' : ''}
                  {metrics.crescimentoMensal}%
                </span>
                <span className="text-sm opacity-80">vs mês anterior</span>
              </div>

              <div className="flex items-center gap-2 text-brand-slate">
                <span className="w-2 h-2 bg-brand-success rounded-full" />
                <span className="text-sm">{metrics.contasAtivas} clientes ativos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total de Clientes */}
        <div className="brand-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary mb-1">
                Total de Clientes
              </p>
              <h3 className="font-brand-primary font-bold text-3xl text-brand-midnight">
                {metrics.totalClientes}
              </h3>
            </div>
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-primary" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-brand-success font-medium">
              {metrics.contasAtivas} ativos
            </span>
            <span className="text-brand-slate">•</span>
            <span className="text-brand-slate">
              {metrics.contasInativas} inativos
            </span>
          </div>
        </div>

        {/* Contas Ativas */}
        <div className="brand-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary mb-1">
                Taxa de Ativação
              </p>
              <h3 className="font-brand-primary font-bold text-3xl text-brand-midnight">
                {metrics.totalClientes > 0
                  ? Math.round((metrics.contasAtivas / metrics.totalClientes) * 100)
                  : 0}
                %
              </h3>
            </div>
            <div className="w-12 h-12 bg-brand-success/10 rounded-xl flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-brand-success" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-brand-light rounded-full h-2">
              <div
                className="bg-brand-success h-2 rounded-full transition-all"
                style={{
                  width: `${
                    metrics.totalClientes > 0
                      ? (metrics.contasAtivas / metrics.totalClientes) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Pacotes IA */}
        <div className="brand-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary mb-1">
                Pacotes IA Vendidos
              </p>
              <h3 className="font-brand-primary font-bold text-3xl text-brand-midnight">
                {metrics.pacotesIAVendidos}
              </h3>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-brand-slate">
              {metrics.creditosIADisponiveis.toLocaleString('pt-PT')} créditos disponíveis
            </span>
          </div>
        </div>

        {/* Equipa */}
        <div className="brand-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary mb-1">
                Equipa Flowly
              </p>
              <h3 className="font-brand-primary font-bold text-3xl text-brand-midnight">
                {metrics.totalColaboradores}
              </h3>
            </div>
            <div className="w-12 h-12 bg-brand-midnight/10 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-brand-midnight" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-brand-primary font-medium">
              Gestão interna
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="brand-card p-6">
        <h3 className="font-brand-primary font-bold text-lg text-brand-midnight mb-4">
          Ações Rápidas
        </h3>
        <div className="flex flex-wrap gap-4">
          <a
            href="/central-saas/clientes"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <Users className="w-4 h-4" />
            Gerir Clientes
          </a>
          <a
            href="/central-saas/planos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-success text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-success/90 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Configurar Planos
          </a>
          <a
            href="/central-saas/pacotes-ia"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-brand-secondary font-medium hover:bg-purple-700 transition-colors"
          >
            <Brain className="w-4 h-4" />
            Pacotes IA
          </a>
        </div>
      </div>
    </div>
  );
}
