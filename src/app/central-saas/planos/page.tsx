'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft,
  Plus,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  Edit3,
  X,
  Euro,
  Shield,
  Truck,
  Building,
  Brain,
  Users,
  FileText,
  Package,
  Coins,
  Percent,
  Gift,
  Wrench
} from 'lucide-react';
import { 
  Plano, 
  getPlanos, 
  createPlano, 
  updatePlano,
  togglePlanoStatus,
  getPlanosStats
} from '../_actions/planos';

interface PlanoModalData {
  id?: string;
  nome: string;
  descricao: string;
  modulos: Record<string, boolean>;
  preco_mensal: number;
  preco_anual: number;
  preco_inicial: number;
  desconto_percentual: number;
  desconto_validade: string;
  mensalidades_oferta: number;
  creditos_ia_incluidos: number;
  ordem_display: number;
  status: 'Ativo' | 'Inativo';
}

const defaultPlanoData: PlanoModalData = {
  nome: '',
  descricao: '',
  modulos: {
    logistica: false,
    condominios: false,
    frota: false,
    rh: false,
    cc: false,
    ia: false,
  },
  preco_mensal: 0,
  preco_anual: 0,
  preco_inicial: 0,
  desconto_percentual: 0,
  desconto_validade: '',
  mensalidades_oferta: 0,
  creditos_ia_incluidos: 0,
  ordem_display: 0,
  status: 'Ativo',
};

const modulosDisponiveis = [
  { id: 'logistica', nome: 'Logística', icone: Truck },
  { id: 'condominios', nome: 'Condomínios', icone: Building },
  { id: 'frota', nome: 'Frota', icone: Package },
  { id: 'rh', nome: 'Recursos Humanos', icone: Users },
  { id: 'cc', nome: 'Conta Corrente', icone: FileText },
  { id: 'ia', nome: 'IA Insight', icone: Brain },
];

export default function PlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0 });
  const [showModal, setShowModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [modalData, setModalData] = useState<PlanoModalData>(defaultPlanoData);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPlanos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getPlanos();
    if (!error) {
      setPlanos(data);
    }
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const stats = await getPlanosStats();
    if (!stats.error) {
      setStats({ total: stats.total, ativos: stats.ativos, inativos: stats.inativos });
    }
  }, []);

  useEffect(() => {
    fetchPlanos();
    fetchStats();
  }, [fetchPlanos, fetchStats]);

  const handleCreate = async () => {
    setActionLoading('create');
    const { success, error } = await createPlano({
      nome: modalData.nome,
      descricao: modalData.descricao || undefined,
      modulos: modalData.modulos,
      preco_mensal: modalData.preco_mensal,
      preco_anual: modalData.preco_anual,
      preco_inicial: modalData.preco_inicial,
      desconto_percentual: modalData.desconto_percentual,
      desconto_validade: modalData.desconto_validade || undefined,
      mensalidades_oferta: modalData.mensalidades_oferta,
      creditos_ia_incluidos: modalData.creditos_ia_incluidos,
      ordem_display: modalData.ordem_display,
      status: modalData.status,
    });
    
    if (success) {
      setShowModal(false);
      setModalData(defaultPlanoData);
      fetchPlanos();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const handleEdit = async () => {
    if (!editingPlano) return;
    
    setActionLoading('edit');
    const { success, error } = await updatePlano(editingPlano.id, {
      nome: modalData.nome,
      descricao: modalData.descricao || undefined,
      modulos: modalData.modulos,
      preco_mensal: modalData.preco_mensal,
      preco_anual: modalData.preco_anual,
      preco_inicial: modalData.preco_inicial,
      desconto_percentual: modalData.desconto_percentual,
      desconto_validade: modalData.desconto_validade || undefined,
      mensalidades_oferta: modalData.mensalidades_oferta,
      creditos_ia_incluidos: modalData.creditos_ia_incluidos,
      ordem_display: modalData.ordem_display,
      status: modalData.status,
    });
    
    if (success) {
      setShowModal(false);
      setEditingPlano(null);
      setModalData(defaultPlanoData);
      fetchPlanos();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const openEditModal = (plano: Plano) => {
    setEditingPlano(plano);
    setModalData({
      id: plano.id,
      nome: plano.nome,
      descricao: plano.descricao || '',
      modulos: plano.modulos,
      preco_mensal: plano.preco_mensal,
      preco_anual: plano.preco_anual,
      preco_inicial: plano.preco_inicial || 0,
      desconto_percentual: plano.desconto_percentual || 0,
      desconto_validade: plano.desconto_validade || '',
      mensalidades_oferta: plano.mensalidades_oferta || 0,
      creditos_ia_incluidos: plano.creditos_ia_incluidos || 0,
      ordem_display: plano.ordem_display,
      status: plano.status,
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (plano: Plano) => {
    setActionLoading(`toggle_${plano.id}`);
    const { success, error } = await togglePlanoStatus(plano.id, plano.status);
    
    if (success) {
      fetchPlanos();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const toggleModulo = (moduloId: string) => {
    setModalData({
      ...modalData,
      modulos: {
        ...modalData.modulos,
        [moduloId]: !modalData.modulos[moduloId],
      },
    });
  };

  const getModulosAtivos = (modulos: Record<string, boolean>) => {
    return Object.entries(modulos).filter(([_, ativo]) => ativo).map(([id]) => id);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">
            Planos e Preços
          </h1>
          <p className="text-brand-slate mt-2 font-brand-secondary">
            {stats.total} planos • {stats.ativos} ativos • {stats.inativos} inativos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingPlano(null);
              setModalData(defaultPlanoData);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-success text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-success/90 transition-colors shadow-brand"
          >
            <Plus className="w-5 h-5" />
            Novo Plano
          </button>
          <a
            href="/central-saas"
            className="inline-flex items-center gap-2 px-4 py-3 bg-brand-light text-brand-midnight rounded-lg font-brand-secondary font-medium hover:bg-brand-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Início
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Total Planos</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-midnight">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-brand-success/10 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-brand-success" />
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Ativos</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-success">{stats.ativos}</p>
            </div>
            <div className="w-10 h-10 bg-brand-success/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-brand-success" />
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Inativos</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-slate">{stats.inativos}</p>
            </div>
            <div className="w-10 h-10 bg-brand-slate/10 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-brand-slate" />
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-success mb-2" />
            <p className="text-brand-slate font-brand-secondary">A carregar...</p>
          </div>
        ) : planos.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="w-12 h-12 text-brand-slate/50 mb-3" />
            <p className="text-lg font-medium text-brand-midnight">Nenhum plano encontrado</p>
            <p className="text-sm text-brand-slate">Crie o primeiro plano de subscrição</p>
          </div>
        ) : (
          planos.map((plano) => (
            <div key={plano.id} className="brand-card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-brand-primary font-bold text-xl text-brand-midnight">{plano.nome}</h3>
                  {plano.descricao && (
                    <p className="text-sm text-brand-slate font-brand-secondary mt-1">{plano.descricao}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleStatus(plano)}
                  disabled={actionLoading === `toggle_${plano.id}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-brand-secondary font-medium transition-colors ${
                    plano.status === 'Ativo'
                      ? 'bg-brand-success/10 text-brand-success hover:bg-brand-success/20'
                      : 'bg-brand-slate/10 text-brand-slate hover:bg-brand-slate/20'
                  }`}
                >
                  {actionLoading === `toggle_${plano.id}` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : plano.status === 'Ativo' ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {plano.status}
                </button>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-brand-primary font-bold text-brand-midnight">
                    €{plano.preco_mensal.toFixed(2)}
                  </span>
                  <span className="text-brand-slate font-brand-secondary">/mês</span>
                </div>
                <p className="text-sm text-brand-slate font-brand-secondary">
                  ou €{plano.preco_anual.toFixed(2)}/ano
                </p>
                {plano.preco_inicial > 0 && (
                  <p className="text-xs text-brand-primary font-brand-secondary mt-1">
                    + €{plano.preco_inicial.toFixed(2)} setup
                  </p>
                )}
                {(plano.desconto_percentual > 0 || plano.mensalidades_oferta > 0 || plano.creditos_ia_incluidos > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {plano.desconto_percentual > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded font-brand-secondary">
                        <Percent className="w-3 h-3" />
                        -{plano.desconto_percentual}%
                      </span>
                    )}
                    {plano.mensalidades_oferta > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded font-brand-secondary">
                        <Gift className="w-3 h-3" />
                        {plano.mensalidades_oferta} meses grátis
                      </span>
                    )}
                    {plano.creditos_ia_incluidos > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded font-brand-secondary">
                        <Brain className="w-3 h-3" />
                        {plano.creditos_ia_incluidos} créditos IA
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <p className="text-xs text-brand-slate font-brand-secondary mb-2">Módulos incluídos:</p>
                <div className="flex flex-wrap gap-1">
                  {getModulosAtivos(plano.modulos).length === 0 ? (
                    <span className="text-xs text-brand-slate/70">Nenhum módulo</span>
                  ) : (
                    getModulosAtivos(plano.modulos).map((modId) => {
                      const mod = modulosDisponiveis.find(m => m.id === modId);
                      return mod ? (
                        <span key={modId} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-success/10 text-brand-success text-xs rounded font-brand-secondary">
                          <mod.icone className="w-3 h-3" />
                          {mod.nome}
                        </span>
                      ) : null;
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                <span className="text-xs text-brand-slate font-brand-secondary">
                  Ordem: {plano.ordem_display}
                </span>
                <button
                  onClick={() => openEditModal(plano)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-brand-secondary font-medium text-brand-success hover:bg-brand-success/10 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Editar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-brand-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-success/10 rounded-lg flex items-center justify-center">
                  {editingPlano ? <Edit3 className="w-5 h-5 text-brand-success" /> : <Plus className="w-5 h-5 text-brand-success" />}
                </div>
                <div>
                  <h2 className="font-brand-primary font-bold text-xl text-brand-midnight">
                    {editingPlano ? 'Editar Plano' : 'Novo Plano'}
                  </h2>
                  <p className="text-sm text-brand-slate font-brand-secondary">
                    {editingPlano ? 'Atualize as configurações do plano' : 'Configure um novo plano de subscrição'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPlano(null);
                  setModalData(defaultPlanoData);
                }}
                className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Nome do Plano *
                  </label>
                  <input
                    type="text"
                    value={modalData.nome}
                    onChange={(e) => setModalData({ ...modalData, nome: e.target.value })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                    placeholder="Ex: Pro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalData.ordem_display}
                    onChange={(e) => setModalData({ ...modalData, ordem_display: parseInt(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                  Descrição
                </label>
                <textarea
                  value={modalData.descricao}
                  onChange={(e) => setModalData({ ...modalData, descricao: e.target.value })}
                  className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary resize-none"
                  rows={2}
                  placeholder="Breve descrição do plano..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Preço Mensal (€) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={modalData.preco_mensal}
                    onChange={(e) => setModalData({ ...modalData, preco_mensal: parseFloat(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Preço Anual (€) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={modalData.preco_anual}
                    onChange={(e) => setModalData({ ...modalData, preco_anual: parseFloat(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    <Wrench className="w-3 h-3 inline mr-1" />
                    Preço Inicial/Setup (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={modalData.preco_inicial}
                    onChange={(e) => setModalData({ ...modalData, preco_inicial: parseFloat(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                    placeholder="Instalação/Formação"
                  />
                </div>
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    <Coins className="w-3 h-3 inline mr-1" />
                    Créditos IA Incluídos
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalData.creditos_ia_incluidos}
                    onChange={(e) => setModalData({ ...modalData, creditos_ia_incluidos: parseInt(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    <Percent className="w-3 h-3 inline mr-1" />
                    Desconto (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={modalData.desconto_percentual}
                    onChange={(e) => setModalData({ ...modalData, desconto_percentual: parseFloat(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Validade Desconto
                  </label>
                  <input
                    type="date"
                    value={modalData.desconto_validade}
                    onChange={(e) => setModalData({ ...modalData, desconto_validade: e.target.value })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    <Gift className="w-3 h-3 inline mr-1" />
                    Mensalidades Oferta
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalData.mensalidades_oferta}
                    onChange={(e) => setModalData({ ...modalData, mensalidades_oferta: parseInt(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-success focus:border-transparent font-brand-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-3">
                  Módulos Incluídos
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {modulosDisponiveis.map((modulo) => {
                    const Icon = modulo.icone;
                    const ativo = modalData.modulos[modulo.id];
                    return (
                      <button
                        key={modulo.id}
                        type="button"
                        onClick={() => toggleModulo(modulo.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          ativo
                            ? 'border-brand-success bg-brand-success/5 text-brand-success'
                            : 'border-brand-border bg-white text-brand-slate hover:border-brand-success/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${ativo ? 'text-brand-success' : 'text-brand-slate'}`} />
                        <span className="font-brand-secondary text-sm font-medium">{modulo.nome}</span>
                        {ativo && <CheckCircle className="w-4 h-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-3">
                  Status
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setModalData({ ...modalData, status: 'Ativo' })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-brand-secondary font-medium transition-colors ${
                      modalData.status === 'Ativo'
                        ? 'bg-brand-success/10 text-brand-success border-2 border-brand-success'
                        : 'bg-brand-light text-brand-slate border-2 border-transparent'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalData({ ...modalData, status: 'Inativo' })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-brand-secondary font-medium transition-colors ${
                      modalData.status === 'Inativo'
                        ? 'bg-brand-slate/10 text-brand-slate border-2 border-brand-slate'
                        : 'bg-brand-light text-brand-slate border-2 border-transparent'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Inativo
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-brand-border px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPlano(null);
                  setModalData(defaultPlanoData);
                }}
                className="px-4 py-2 text-brand-slate hover:text-brand-midnight font-brand-secondary font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingPlano ? handleEdit : handleCreate}
                disabled={!!actionLoading || !modalData.nome}
                className="inline-flex items-center gap-2 px-6 py-2 bg-brand-success text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'create' || actionLoading === 'edit' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingPlano ? 'Guardar Alterações' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
