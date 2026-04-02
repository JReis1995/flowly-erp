'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft,
  Plus,
  Brain,
  CheckCircle,
  XCircle,
  Loader2,
  Edit3,
  ExternalLink,
  X,
  Euro,
  Coins,
  ShoppingCart
} from 'lucide-react';
import { 
  PacoteIA, 
  getPacotesIA, 
  createPacoteIA, 
  updatePacoteIA,
  togglePacoteStatus,
  getPacotesStats
} from '../_actions/pacotes';
import { createCheckoutSession } from '../_actions/stripe';

interface PacoteModalData {
  id?: string;
  nome: string;
  creditos: number;
  preco_base: number;
  link_pagamento: string;
  status: 'Ativo' | 'Inativo';
}

const defaultPacoteData: PacoteModalData = {
  nome: '',
  creditos: 100,
  preco_base: 0,
  link_pagamento: '',
  status: 'Ativo',
};

export default function PacotesIAPage() {
  const [pacotes, setPacotes] = useState<PacoteIA[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0 });
  const [showModal, setShowModal] = useState(false);
  const [editingPacote, setEditingPacote] = useState<PacoteIA | null>(null);
  const [modalData, setModalData] = useState<PacoteModalData>(defaultPacoteData);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const fetchPacotes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getPacotesIA();
    if (!error) {
      setPacotes(data);
    }
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const { data } = await getPacotesStats();
    if (data) {
      setStats(data);
    }
  }, []);

  useEffect(() => {
    fetchPacotes();
    fetchStats();
  }, [fetchPacotes, fetchStats]);

  const handleCreate = async () => {
    setActionLoading('create');
    const { success, error } = await createPacoteIA({
      nome: modalData.nome,
      creditos: modalData.creditos,
      preco_base: modalData.preco_base,
      link_pagamento: modalData.link_pagamento || undefined,
      status: modalData.status,
    });
    
    if (success) {
      setShowModal(false);
      setModalData(defaultPacoteData);
      fetchPacotes();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const handleEdit = async () => {
    if (!editingPacote) return;
    
    setActionLoading('edit');
    const { success, error } = await updatePacoteIA(editingPacote.id, {
      nome: modalData.nome,
      creditos: modalData.creditos,
      preco_base: modalData.preco_base,
      link_pagamento: modalData.link_pagamento || undefined,
      status: modalData.status,
    });
    
    if (success) {
      setShowModal(false);
      setEditingPacote(null);
      setModalData(defaultPacoteData);
      fetchPacotes();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const openEditModal = (pacote: PacoteIA) => {
    setEditingPacote(pacote);
    setModalData({
      id: pacote.id,
      nome: pacote.nome,
      creditos: pacote.creditos,
      preco_base: pacote.preco_base,
      link_pagamento: pacote.link_pagamento || '',
      status: pacote.status,
    });
    setShowModal(true);
  };

  const handleBuyNow = async (pacote: PacoteIA, tenantId: string) => {
    setCheckoutLoading(pacote.id);
    
    // Usar o link_pagamento como priceId (deve ser configurado na Stripe)
    const priceId = pacote.link_pagamento;
    
    if (!priceId || !priceId.startsWith('price_')) {
      alert('Este pacote não tem um Price ID do Stripe configurado. Configure no campo "Link de Pagamento".');
      setCheckoutLoading(null);
      return;
    }
    
    const { success, data, error } = await createCheckoutSession(
      pacote.id,
      tenantId,
      priceId,
      'payment'
    );
    
    if (success && data?.url) {
      window.location.href = data.url;
    } else {
      alert(`Erro ao iniciar checkout: ${error}`);
    }
    
    setCheckoutLoading(null);
  };

  const handleToggleStatus = async (pacote: PacoteIA) => {
    setActionLoading(`toggle_${pacote.id}`);
    const { success, error } = await togglePacoteStatus(pacote.id, pacote.status);
    
    if (success) {
      fetchPacotes();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">
            Pacotes de IA
          </h1>
          <p className="text-brand-slate mt-2 font-brand-secondary">
            {stats.total} pacotes • {stats.ativos} ativos • {stats.inativos} inativos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingPacote(null);
              setModalData(defaultPacoteData);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-brand-secondary font-medium hover:bg-purple-700 transition-colors shadow-brand"
          >
            <Plus className="w-5 h-5" />
            Novo Pacote
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
              <p className="text-brand-slate text-sm font-brand-secondary">Total Pacotes</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-midnight">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
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
      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-light border-b border-brand-border">
              <tr>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Nome do Pacote
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Créditos
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Preço Base
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Criado em
                </th>
                <th className="px-4 py-3 text-right font-brand-primary font-semibold text-sm text-brand-midnight">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-brand-slate font-brand-secondary">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-600" />
                    A carregar...
                  </td>
                </tr>
              ) : pacotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-brand-slate font-brand-secondary">
                    <Brain className="w-12 h-12 mx-auto mb-3 text-brand-slate/50" />
                    <p className="text-lg font-medium">Nenhum pacote encontrado</p>
                    <p className="text-sm mt-1">Crie o primeiro pacote de créditos IA</p>
                  </td>
                </tr>
              ) : (
                pacotes.map((pacote) => (
                  <tr key={pacote.id} className="hover:bg-brand-light/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Brain className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-brand-secondary font-medium text-brand-midnight">
                            {pacote.nome}
                          </p>
                          {pacote.link_pagamento && (
                            <a 
                              href={pacote.link_pagamento}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand-primary hover:text-brand-primary/80 font-brand-secondary flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Link de pagamento
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-purple-600" />
                        <span className="font-brand-secondary text-sm text-brand-midnight font-medium">
                          {pacote.creditos.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Euro className="w-4 h-4 text-brand-midnight" />
                        <span className="font-brand-secondary text-sm text-brand-midnight font-medium">
                          {pacote.preco_base.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(pacote)}
                        disabled={actionLoading === `toggle_${pacote.id}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-brand-secondary font-medium transition-colors ${
                          pacote.status === 'Ativo'
                            ? 'bg-brand-success/10 text-brand-success hover:bg-brand-success/20'
                            : 'bg-brand-slate/10 text-brand-slate hover:bg-brand-slate/20'
                        }`}
                      >
                        {actionLoading === `toggle_${pacote.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : pacote.status === 'Ativo' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {pacote.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-brand-secondary text-sm text-brand-midnight">
                        {new Date(pacote.data_criacao).toLocaleDateString('pt-PT')}
                      </p>
                      <p className="text-xs text-brand-slate font-brand-secondary">
                        Mod: {new Date(pacote.ultima_modificacao).toLocaleDateString('pt-PT')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(pacote)}
                        className="p-2 text-brand-slate hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-2xl">
            {/* Header */}
            <div className="border-b border-brand-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  {editingPacote ? <Edit3 className="w-5 h-5 text-purple-600" /> : <Plus className="w-5 h-5 text-purple-600" />}
                </div>
                <div>
                  <h2 className="font-brand-primary font-bold text-xl text-brand-midnight">
                    {editingPacote ? 'Editar Pacote' : 'Novo Pacote'}
                  </h2>
                  <p className="text-sm text-brand-slate font-brand-secondary">
                    {editingPacote ? 'Atualize os dados do pacote' : 'Configure um novo pacote de créditos IA'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPacote(null);
                  setModalData(defaultPacoteData);
                }}
                className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                  Nome do Pacote *
                </label>
                <input
                  type="text"
                  value={modalData.nome}
                  onChange={(e) => setModalData({ ...modalData, nome: e.target.value })}
                  className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-brand-secondary"
                  placeholder="Ex: Pacote Starter"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Quantidade de Créditos *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={modalData.creditos}
                    onChange={(e) => setModalData({ ...modalData, creditos: parseInt(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-brand-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                    Preço Base (€) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={modalData.preco_base}
                    onChange={(e) => setModalData({ ...modalData, preco_base: parseFloat(e.target.value) || 0 })}
                    className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-brand-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                  Link de Pagamento (Stripe, PayPal, etc.)
                </label>
                <input
                  type="url"
                  value={modalData.link_pagamento}
                  onChange={(e) => setModalData({ ...modalData, link_pagamento: e.target.value })}
                  className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-brand-secondary"
                  placeholder="https://..."
                />
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
            <div className="border-t border-brand-border px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPacote(null);
                  setModalData(defaultPacoteData);
                }}
                className="px-4 py-2 text-brand-slate hover:text-brand-midnight font-brand-secondary font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingPacote ? handleEdit : handleCreate}
                disabled={!!actionLoading || !modalData.nome || modalData.creditos <= 0}
                className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg font-brand-secondary font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'create' || actionLoading === 'edit' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingPacote ? 'Guardar Alterações' : 'Criar Pacote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
