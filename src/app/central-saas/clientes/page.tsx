'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Brain,
  Eye,
  Mail,
  UserCog,
  CreditCard,
  Calendar,
  Building2,
  CheckSquare,
  Square,
  X,
  ChevronDown,
  Loader2,
  Shield,
  ArrowLeft,
  Home
} from 'lucide-react';
import Link from 'next/link';
import { 
  Tenant, 
  getTenants, 
  searchTenants, 
  createTenant, 
  updateTenant, 
  bulkUpdateTenants,
  resendWelcomeEmail,
  impersonateTenant,
  getTenantStats
} from '../_actions/tenants';

// Tipos
interface TenantModalData {
  id?: string;
  nome_empresa: string;
  ramo_atividade: string;
  nif: string;
  gestor_nome: string;
  gestor_email: string;
  plano_id: string;
  plano_nome: string;
  desconto_percentual: number;
  desconto_tipo: 'permanente' | 'temporario';
  desconto_validade: string;
  creditos_ia: number;
  modulo_logistica: boolean;
  modulo_condominios: boolean;
  modulo_frota: boolean;
  modulo_rh: boolean;
  modulo_cc: boolean;
  modulo_ia: boolean;
  validade_acesso: string;
}

const defaultTenantData: TenantModalData = {
  nome_empresa: '',
  ramo_atividade: '',
  nif: '',
  gestor_nome: '',
  gestor_email: '',
  plano_id: '',
  plano_nome: 'Basic',
  desconto_percentual: 0,
  desconto_tipo: 'permanente',
  desconto_validade: '',
  creditos_ia: 100,
  modulo_logistica: false,
  modulo_condominios: false,
  modulo_frota: false,
  modulo_rh: false,
  modulo_cc: false,
  modulo_ia: false,
  validade_acesso: '',
};

// Componente principal
export default function ClientesPage() {
  // Estados
  const [activeTab, setActiveTab] = useState<'ativos' | 'suspensos'>('ativos');
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [modalData, setModalData] = useState<TenantModalData>(defaultTenantData);
  const [stats, setStats] = useState({ total: 0, ativos: 0, suspensos: 0, trial: 0, creditosTotais: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  // Buscar dados
  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const status = activeTab === 'ativos' ? 'ativo' : 'suspenso';
    const { data, error } = await getTenants(status);
    if (!error) {
      setTenants(data);
    }
    setLoading(false);
  }, [activeTab]);

  const fetchStats = useCallback(async () => {
    const stats = await getTenantStats();
    if (!stats.error) {
      setStats(stats);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
    fetchStats();
  }, [fetchTenants, fetchStats]);

  // Pesquisa
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length >= 2) {
      setLoading(true);
      const { data } = await searchTenants(term);
      setTenants(data);
      setLoading(false);
    } else if (term === '') {
      fetchTenants();
    }
  };

  // Selecao de tenants
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedTenants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTenants(newSelected);
  };

  const toggleAll = () => {
    if (selectedTenants.size === tenants.length) {
      setSelectedTenants(new Set());
    } else {
      setSelectedTenants(new Set(tenants.map(t => t.id)));
    }
  };

  // Acoes em massa
  const handleBulkAction = async (action: 'activate' | 'suspend' | 'add_credits') => {
    if (selectedTenants.size === 0) return;
    
    setActionLoading(action);
    const ids = Array.from(selectedTenants);
    
    let value: string | number | undefined;
    if (action === 'add_credits') {
      const credits = prompt('Quantos creditos adicionar?', '100');
      if (!credits) {
        setActionLoading(null);
        return;
      }
      value = parseInt(credits);
    }
    
    const { success, error } = await bulkUpdateTenants(ids, action, value);
    
    if (success) {
      setSelectedTenants(new Set());
      fetchTenants();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  // Criar tenant
  const handleCreate = async () => {
    setActionLoading('create');
    const { success, error } = await createTenant({
      nome_empresa: modalData.nome_empresa,
      ramo_atividade: modalData.ramo_atividade || undefined,
      nif: modalData.nif || undefined,
      gestor_nome: modalData.gestor_nome,
      gestor_email: modalData.gestor_email,
      plano_nome: modalData.plano_nome,
      desconto_percentual: modalData.desconto_percentual,
      desconto_tipo: modalData.desconto_tipo,
      desconto_validade: modalData.desconto_validade || undefined,
      creditos_ia: modalData.creditos_ia,
      modulo_logistica: modalData.modulo_logistica,
      modulo_condominios: modalData.modulo_condominios,
      modulo_frota: modalData.modulo_frota,
      modulo_rh: modalData.modulo_rh,
      modulo_cc: modalData.modulo_cc,
      modulo_ia: modalData.modulo_ia,
      validade_acesso: modalData.validade_acesso || undefined,
    });
    
    if (success) {
      setShowCreateModal(false);
      setModalData(defaultTenantData);
      fetchTenants();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  // Editar tenant
  const handleEdit = async () => {
    if (!editingTenant) return;
    
    setActionLoading('edit');
    const { success, error } = await updateTenant(editingTenant.id, {
      nome_empresa: modalData.nome_empresa,
      ramo_atividade: modalData.ramo_atividade || undefined,
      nif: modalData.nif || undefined,
      gestor_nome: modalData.gestor_nome,
      gestor_email: modalData.gestor_email,
      plano_nome: modalData.plano_nome,
      desconto_percentual: modalData.desconto_percentual,
      desconto_tipo: modalData.desconto_tipo,
      desconto_validade: modalData.desconto_validade || undefined,
      creditos_ia: modalData.creditos_ia,
      modulo_logistica: modalData.modulo_logistica,
      modulo_condominios: modalData.modulo_condominios,
      modulo_frota: modalData.modulo_frota,
      modulo_rh: modalData.modulo_rh,
      modulo_cc: modalData.modulo_cc,
      modulo_ia: modalData.modulo_ia,
      validade_acesso: modalData.validade_acesso || undefined,
    });
    
    if (success) {
      setShowEditModal(false);
      setEditingTenant(null);
      setModalData(defaultTenantData);
      fetchTenants();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  // Abrir modal de edicao
  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setModalData({
      id: tenant.id,
      nome_empresa: tenant.nome_empresa,
      ramo_atividade: tenant.ramo_atividade || '',
      nif: tenant.nif || '',
      gestor_nome: tenant.gestor_nome,
      gestor_email: tenant.gestor_email,
      plano_id: tenant.plano_id || '',
      plano_nome: tenant.plano_nome,
      desconto_percentual: tenant.desconto_percentual,
      desconto_tipo: tenant.desconto_tipo || 'permanente',
      desconto_validade: tenant.desconto_validade || '',
      creditos_ia: tenant.creditos_ia,
      modulo_logistica: tenant.modulo_logistica,
      modulo_condominios: tenant.modulo_condominios,
      modulo_frota: tenant.modulo_frota,
      modulo_rh: tenant.modulo_rh,
      modulo_cc: tenant.modulo_cc,
      modulo_ia: tenant.modulo_ia,
      validade_acesso: tenant.validade_acesso || '',
    });
    setShowEditModal(true);
  };

  // Reenviar email
  const handleResendEmail = async (tenantId: string) => {
    setActionLoading(`email_${tenantId}`);
    const { success, error } = await resendWelcomeEmail(tenantId);
    if (success) {
      alert('Email reenviado com sucesso!');
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  // Impersonate
  const handleImpersonate = async (tenantId: string) => {
    setActionLoading(`impersonate_${tenantId}`);
    const { success, redirectUrl, error } = await impersonateTenant(tenantId);
    if (success && redirectUrl) {
      window.open(redirectUrl, '_blank');
    } else {
      setToast({ message: `Erro: ${error}`, type: 'error' });
      setTimeout(() => setToast({ message: '', type: null }), 3000);
    }
    setActionLoading(null);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 transition-all ${
          toast.type === 'success' 
            ? 'bg-brand-success text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span className="font-brand-secondary font-medium">{toast.message}</span>
          <button 
            onClick={() => setToast({ message: '', type: null })}
            className="ml-2 hover:opacity-80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header com botão voltar */}
      <div className="mb-8">
        <Link 
          href="/central-saas"
          className="inline-flex items-center gap-2 text-brand-slate hover:text-brand-primary transition-colors mb-4 font-brand-secondary text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Central SaaS
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">
              Gestao de Clientes
            </h1>
            <p className="text-brand-slate mt-2 font-brand-secondary">
              {stats.total} clientes no sistema • {stats.ativos} ativos • {stats.suspensos} suspensos
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-primary/90 transition-colors shadow-brand"
          >
            <Plus className="w-5 h-5" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Total Clientes</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-midnight">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-brand-primary" />
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
              <p className="text-brand-slate text-sm font-brand-secondary">Suspensos</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-warning">{stats.suspensos}</p>
            </div>
            <div className="w-10 h-10 bg-brand-warning/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-brand-warning" />
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Creditos IA Totais</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-primary">{stats.creditosTotais.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-brand-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-brand-border">
        <button
          onClick={() => setActiveTab('ativos')}
          className={`px-4 py-3 font-brand-secondary font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'ativos'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-brand-slate hover:text-brand-midnight'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Ativos ({stats.ativos})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('suspensos')}
          className={`px-4 py-3 font-brand-secondary font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'suspensos'
              ? 'border-brand-warning text-brand-warning'
              : 'border-transparent text-brand-slate hover:text-brand-midnight'
          }`}
        >
          <span className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Suspensos ({stats.suspensos})
          </span>
        </button>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-brand-slate" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Pesquisar por Nome, Email ou NIF..."
            className="block w-full pl-10 pr-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary bg-white"
          />
        </div>

        {selectedTenants.size > 0 && (
          <div className="flex items-center gap-2 bg-brand-light px-4 py-2 rounded-lg">
            <span className="text-sm text-brand-slate font-brand-secondary">
              {selectedTenants.size} selecionado(s)
            </span>
            <div className="h-4 w-px bg-brand-border mx-2" />
            {activeTab === 'suspensos' && (
              <button
                onClick={() => handleBulkAction('activate')}
                disabled={!!actionLoading}
                className="text-sm text-brand-success hover:text-brand-success/80 font-brand-secondary font-medium"
              >
                Ativar
              </button>
            )}
            {activeTab === 'ativos' && (
              <button
                onClick={() => handleBulkAction('suspend')}
                disabled={!!actionLoading}
                className="text-sm text-brand-warning hover:text-brand-warning/80 font-brand-secondary font-medium"
              >
                Suspender
              </button>
            )}
            <button
              onClick={() => handleBulkAction('add_credits')}
              disabled={!!actionLoading}
              className="text-sm text-brand-primary hover:text-brand-primary/80 font-brand-secondary font-medium"
            >
              + Creditos
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-light border-b border-brand-border">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <button
                    onClick={toggleAll}
                    className="text-brand-slate hover:text-brand-primary transition-colors"
                  >
                    {selectedTenants.size === tenants.length && tenants.length > 0 ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Gestor
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Plano
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Creditos IA
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Modulos
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Registo
                </th>
                <th className="px-4 py-3 text-right font-brand-primary font-semibold text-sm text-brand-midnight">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-brand-slate font-brand-secondary">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                    A carregar...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-brand-slate font-brand-secondary">
                    <Users className="w-12 h-12 mx-auto mb-3 text-brand-slate/50" />
                    <p className="text-lg font-medium">Nenhum cliente encontrado</p>
                    <p className="text-sm mt-1">Tente ajustar os filtros ou criar um novo cliente</p>
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-brand-light/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelection(tenant.id)}
                        className="text-brand-slate hover:text-brand-primary transition-colors"
                      >
                        {selectedTenants.has(tenant.id) ? (
                          <CheckSquare className="w-5 h-5 text-brand-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <p className="font-brand-secondary font-medium text-brand-midnight">
                            {tenant.nome_empresa}
                          </p>
                          {tenant.nif && (
                            <p className="text-xs text-brand-slate font-brand-secondary">
                              NIF: {tenant.nif}
                            </p>
                          )}
                          {tenant.alerta_divida && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded font-brand-secondary">
                              <AlertTriangle className="w-3 h-3" />
                              Divida
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-brand-secondary text-sm text-brand-midnight">{tenant.gestor_nome}</p>
                        <p className="text-xs text-brand-slate font-brand-secondary">{tenant.gestor_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-brand-secondary font-medium rounded ${
                        tenant.plano_nome === 'Pro' 
                          ? 'bg-brand-success/10 text-brand-success' 
                          : 'bg-brand-primary/10 text-brand-primary'
                      }`}>
                        {tenant.plano_nome}
                      </span>
                      {tenant.desconto_percentual > 0 && (
                        <p className="text-xs text-brand-success mt-1 font-brand-secondary">
                          -{tenant.desconto_percentual}%
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-brand-primary" />
                        <span className="font-brand-secondary text-sm text-brand-midnight">
                          {tenant.creditos_ia.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tenant.modulo_logistica && (
                          <span className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-xs rounded font-brand-secondary">LOG</span>
                        )}
                        {tenant.modulo_frota && (
                          <span className="px-1.5 py-0.5 bg-brand-success/10 text-brand-success text-xs rounded font-brand-secondary">FROTA</span>
                        )}
                        {tenant.modulo_rh && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded font-brand-secondary">RH</span>
                        )}
                        {tenant.modulo_ia && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 text-xs rounded font-brand-secondary">IA</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-brand-secondary text-sm text-brand-midnight">
                          {new Date(tenant.data_registo).toLocaleDateString('pt-PT')}
                        </p>
                        {tenant.validade_acesso && (
                          <p className="text-xs text-brand-slate font-brand-secondary">
                            Ate {new Date(tenant.validade_acesso).toLocaleDateString('pt-PT')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleImpersonate(tenant.id)}
                          disabled={actionLoading === `impersonate_${tenant.id}`}
                          className="p-2 text-brand-slate hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                          title="Impersonate"
                        >
                          {actionLoading === `impersonate_${tenant.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserCog className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleResendEmail(tenant.id)}
                          disabled={actionLoading === `email_${tenant.id}`}
                          className="p-2 text-brand-slate hover:text-brand-success hover:bg-brand-success/10 rounded-lg transition-colors"
                          title="Reenviar Email"
                        >
                          {actionLoading === `email_${tenant.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(tenant)}
                          className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-brand-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                  {showEditModal ? <Eye className="w-5 h-5 text-brand-primary" /> : <Plus className="w-5 h-5 text-brand-primary" />}
                </div>
                <div>
                  <h2 className="font-brand-primary font-bold text-xl text-brand-midnight">
                    {showEditModal ? 'Editar Cliente' : 'Novo Cliente'}
                  </h2>
                  <p className="text-sm text-brand-slate font-brand-secondary">
                    {showEditModal ? 'Atualize os dados do cliente' : 'Preencha os dados para criar um novo cliente'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingTenant(null);
                  setModalData(defaultTenantData);
                }}
                className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alerta de Divida (apenas em edicao) */}
            {showEditModal && editingTenant?.alerta_divida && (
              <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-brand-secondary font-medium text-red-700">Alerta de Divida</p>
                  <p className="text-sm text-red-600 font-brand-secondary">
                    {editingTenant.alerta_divida_mensagem || 'Este cliente possui dividas pendentes que precisam de atencao.'}
                  </p>
                  <p className="text-sm text-red-700 font-brand-secondary font-medium mt-1">
                    Valor: €{editingTenant.divida_acumulada?.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Secao: Dados da Empresa */}
              <div>
                <h3 className="font-brand-primary font-semibold text-brand-midnight mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-primary" />
                  Dados da Empresa
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Nome da Empresa *
                    </label>
                    <input
                      type="text"
                      value={modalData.nome_empresa}
                      onChange={(e) => setModalData({ ...modalData, nome_empresa: e.target.value })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                      placeholder="Ex: Flowly Lda"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Ramo de Atividade
                    </label>
                    <select
                      value={modalData.ramo_atividade}
                      onChange={(e) => setModalData({ ...modalData, ramo_atividade: e.target.value })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary bg-white"
                    >
                      <option value="">Selecione...</option>
                      <option value="Tecnologia">Tecnologia</option>
                      <option value="Comercio">Comércio</option>
                      <option value="Industria">Indústria</option>
                      <option value="Servicos">Serviços</option>
                      <option value="Construcao">Construção</option>
                      <option value="Restauracao">Restauração</option>
                      <option value="Transportes">Transportes</option>
                      <option value="Saude">Saúde</option>
                      <option value="Educacao">Educação</option>
                      <option value="Agricultura">Agricultura</option>
                      <option value="Imobiliario">Imobiliário</option>
                      <option value="Consultoria">Consultoria</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Logistica">Logística</option>
                      <option value="Energia">Energia</option>
                      <option value="Turismo">Turismo</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Juridico">Jurídico</option>
                      <option value="Condominios">Condomínios</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      NIF
                    </label>
                    <input
                      type="text"
                      value={modalData.nif}
                      onChange={(e) => setModalData({ ...modalData, nif: e.target.value })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                      placeholder="5########"
                    />
                  </div>
                </div>
              </div>

              {/* Secao: Dados do Gestor */}
              <div>
                <h3 className="font-brand-primary font-semibold text-brand-midnight mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-primary" />
                  Dados do Gestor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Nome do Gestor *
                    </label>
                    <input
                      type="text"
                      value={modalData.gestor_nome}
                      onChange={(e) => setModalData({ ...modalData, gestor_nome: e.target.value })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                      placeholder="Ex: Joao Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Email do Gestor *
                    </label>
                    <input
                      type="email"
                      value={modalData.gestor_email}
                      onChange={(e) => setModalData({ ...modalData, gestor_email: e.target.value })}
                      disabled={showEditModal}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary disabled:bg-brand-light disabled:cursor-not-allowed"
                      placeholder="gestor@empresa.pt"
                    />
                    {showEditModal && (
                      <p className="text-xs text-brand-slate mt-1 font-brand-secondary">Email nao pode ser alterado</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Secao: Plano e Descontos */}
              <div>
                <h3 className="font-brand-primary font-semibold text-brand-midnight mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-brand-primary" />
                  Plano e Descontos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Plano
                    </label>
                    <select
                      value={modalData.plano_nome}
                      onChange={(e) => setModalData({ ...modalData, plano_nome: e.target.value })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary bg-white"
                    >
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Desconto (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={modalData.desconto_percentual}
                      onChange={(e) => setModalData({ ...modalData, desconto_percentual: parseFloat(e.target.value) || 0 })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Tipo de Desconto
                    </label>
                    <select
                      value={modalData.desconto_tipo}
                      onChange={(e) => setModalData({ ...modalData, desconto_tipo: e.target.value as 'permanente' | 'temporario' })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary bg-white"
                    >
                      <option value="permanente">Permanente</option>
                      <option value="temporario">Temporario</option>
                    </select>
                  </div>
                  {modalData.desconto_tipo === 'temporario' && (
                    <div>
                      <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                        Validade do Desconto
                      </label>
                      <input
                        type="date"
                        value={modalData.desconto_validade}
                        onChange={(e) => setModalData({ ...modalData, desconto_validade: e.target.value })}
                        className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Validade do Acesso
                    </label>
                    <input
                      type="date"
                      value={modalData.validade_acesso}
                      onChange={(e) => setModalData({ ...modalData, validade_acesso: e.target.value })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                    />
                  </div>
                </div>
              </div>

              {/* Secao: Creditos IA */}
              <div>
                <h3 className="font-brand-primary font-semibold text-brand-midnight mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-brand-primary" />
                  Creditos IA
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                      Creditos Iniciais
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={modalData.creditos_ia}
                      onChange={(e) => setModalData({ ...modalData, creditos_ia: parseInt(e.target.value) || 0 })}
                      className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent font-brand-secondary"
                    />
                  </div>
                </div>
              </div>

              {/* Secao: Modulos Ativos */}
              <div>
                <h3 className="font-brand-primary font-semibold text-brand-midnight mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-brand-primary" />
                  Modulos Visiveis
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-3 border border-brand-border rounded-lg cursor-pointer hover:bg-brand-light transition-colors">
                    <input
                      type="checkbox"
                      checked={modalData.modulo_logistica}
                      onChange={(e) => setModalData({ ...modalData, modulo_logistica: e.target.checked })}
                      className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                    />
                    <span className="font-brand-secondary text-sm text-brand-midnight">Logistica</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-brand-border rounded-lg cursor-pointer hover:bg-brand-light transition-colors">
                    <input
                      type="checkbox"
                      checked={modalData.modulo_frota}
                      onChange={(e) => setModalData({ ...modalData, modulo_frota: e.target.checked })}
                      className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                    />
                    <span className="font-brand-secondary text-sm text-brand-midnight">Frota</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-brand-border rounded-lg cursor-pointer hover:bg-brand-light transition-colors">
                    <input
                      type="checkbox"
                      checked={modalData.modulo_condominios}
                      onChange={(e) => setModalData({ ...modalData, modulo_condominios: e.target.checked })}
                      className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                    />
                    <span className="font-brand-secondary text-sm text-brand-midnight">Condominios</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-brand-border rounded-lg cursor-pointer hover:bg-brand-light transition-colors">
                    <input
                      type="checkbox"
                      checked={modalData.modulo_rh}
                      onChange={(e) => setModalData({ ...modalData, modulo_rh: e.target.checked })}
                      className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                    />
                    <span className="font-brand-secondary text-sm text-brand-midnight">Recursos Humanos</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-brand-border rounded-lg cursor-pointer hover:bg-brand-light transition-colors">
                    <input
                      type="checkbox"
                      checked={modalData.modulo_cc}
                      onChange={(e) => setModalData({ ...modalData, modulo_cc: e.target.checked })}
                      className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                    />
                    <span className="font-brand-secondary text-sm text-brand-midnight">Conta Corrente</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-brand-border rounded-lg cursor-pointer hover:bg-brand-light transition-colors">
                    <input
                      type="checkbox"
                      checked={modalData.modulo_ia}
                      onChange={(e) => setModalData({ ...modalData, modulo_ia: e.target.checked })}
                      className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                    />
                    <span className="font-brand-secondary text-sm text-brand-midnight">IA Insight</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-brand-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {showEditModal && (
                  <>
                    <button
                      onClick={() => handleResendEmail(editingTenant!.id)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-brand-border text-brand-slate rounded-lg font-brand-secondary font-medium hover:bg-brand-light transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Reenviar Email
                    </button>
                    <button
                      onClick={() => handleImpersonate(editingTenant!.id)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-brand-border text-brand-primary rounded-lg font-brand-secondary font-medium hover:bg-brand-primary/10 transition-colors"
                    >
                      <UserCog className="w-4 h-4" />
                      Impersonate
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setEditingTenant(null);
                    setModalData(defaultTenantData);
                  }}
                  className="px-4 py-2 text-brand-slate hover:text-brand-midnight font-brand-secondary font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={showEditModal ? handleEdit : handleCreate}
                  disabled={!!actionLoading || !modalData.nome_empresa || !modalData.gestor_nome || !modalData.gestor_email}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'create' || actionLoading === 'edit' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {showEditModal ? 'Guardar Alteracoes' : 'Criar Cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
