'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft,
  Plus,
  Users,
  Crown,
  Shield,
  Code,
  Headphones,
  CheckCircle,
  XCircle,
  Loader2,
  Edit3,
  Mail,
  X,
  UserPlus
} from 'lucide-react';
import { 
  StaffMember, 
  getStaffMembers, 
  createStaffMember, 
  updateStaffMember,
  toggleStaffStatus,
  getStaffStats,
  resendStaffInvite
} from '../_actions/staff';

interface StaffModalData {
  id?: string;
  nome: string;
  email: string;
  cargo: 'Owner' | 'Admin' | 'Dev' | 'Support';
  status: 'Ativo' | 'Inativo';
}

const defaultStaffData: StaffModalData = {
  nome: '',
  email: '',
  cargo: 'Dev',
  status: 'Ativo',
};

const cargoIcons = {
  Owner: Crown,
  Admin: Shield,
  Dev: Code,
  Support: Headphones,
};

const cargoColors = {
  Owner: 'bg-amber-100 text-amber-600',
  Admin: 'bg-brand-primary/10 text-brand-primary',
  Dev: 'bg-purple-100 text-purple-600',
  Support: 'bg-brand-success/10 text-brand-success',
};

export default function EquipaPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0, porCargo: {} as Record<string, number> });
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [modalData, setModalData] = useState<StaffModalData>(defaultStaffData);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getStaffMembers();
    if (!error) {
      setStaff(data);
    }
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const { data } = await getStaffStats();
    if (data) {
      setStats(data);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchStats();
  }, [fetchStaff, fetchStats]);

  const handleCreate = async () => {
    setActionLoading('create');
    const { success, error } = await createStaffMember({
      nome: modalData.nome,
      email: modalData.email,
      cargo: modalData.cargo,
      status: modalData.status,
    });
    
    if (success) {
      setShowModal(false);
      setModalData(defaultStaffData);
      fetchStaff();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const handleEdit = async () => {
    if (!editingMember) return;
    
    setActionLoading('edit');
    const { success, error } = await updateStaffMember(editingMember.id, {
      nome: modalData.nome,
      cargo: modalData.cargo,
      status: modalData.status,
    });
    
    if (success) {
      setShowModal(false);
      setEditingMember(null);
      setModalData(defaultStaffData);
      fetchStaff();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const openEditModal = (member: StaffMember) => {
    setEditingMember(member);
    setModalData({
      id: member.id,
      nome: member.nome,
      email: member.email,
      cargo: member.cargo,
      status: member.status,
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (member: StaffMember) => {
    setActionLoading(`toggle_${member.id}`);
    const { success, error } = await toggleStaffStatus(member.id, member.status);
    
    if (success) {
      fetchStaff();
      fetchStats();
    } else {
      alert(`Erro: ${error}`);
    }
    setActionLoading(null);
  };

  const handleResendInvite = async (memberId: string) => {
    setActionLoading(`invite_${memberId}`);
    const { success, error } = await resendStaffInvite(memberId);
    if (success) {
      alert('Convite reenviado com sucesso!');
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
            Equipa Flowly
          </h1>
          <p className="text-brand-slate mt-2 font-brand-secondary">
            {stats.total} membros • {stats.ativos} ativos • {stats.inativos} inativos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingMember(null);
              setModalData(defaultStaffData);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-midnight text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-midnight/90 transition-colors shadow-brand"
          >
            <UserPlus className="w-5 h-5" />
            Novo Membro
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Total</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-midnight">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-brand-midnight/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-brand-midnight" />
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
              <p className="text-brand-slate text-sm font-brand-secondary">Owners/Admins</p>
              <p className="text-2xl font-brand-primary font-bold text-brand-primary">
                {(stats.porCargo.Owner || 0) + (stats.porCargo.Admin || 0)}
              </p>
            </div>
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-primary" />
            </div>
          </div>
        </div>
        <div className="brand-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-slate text-sm font-brand-secondary">Devs</p>
              <p className="text-2xl font-brand-primary font-bold text-purple-600">{stats.porCargo.Dev || 0}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Code className="w-5 h-5 text-purple-600" />
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
                  Membro
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Cargo
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-brand-primary font-semibold text-sm text-brand-midnight">
                  Último Acesso
                </th>
                <th className="px-4 py-3 text-right font-brand-primary font-semibold text-sm text-brand-midnight">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-brand-slate font-brand-secondary">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-midnight" />
                    A carregar...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-brand-slate font-brand-secondary">
                    <Users className="w-12 h-12 mx-auto mb-3 text-brand-slate/50" />
                    <p className="text-lg font-medium">Nenhum membro encontrado</p>
                    <p className="text-sm mt-1">Adicione o primeiro membro à equipa</p>
                  </td>
                </tr>
              ) : (
                staff.map((member) => {
                  const CargoIcon = cargoIcons[member.cargo];
                  return (
                    <tr key={member.id} className="hover:bg-brand-light/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cargoColors[member.cargo]}`}>
                            <CargoIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-brand-secondary font-medium text-brand-midnight">
                              {member.nome}
                            </p>
                            <p className="text-xs text-brand-slate font-brand-secondary">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-brand-secondary font-medium ${cargoColors[member.cargo]}`}>
                          <CargoIcon className="w-3 h-3" />
                          {member.cargo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(member)}
                          disabled={actionLoading === `toggle_${member.id}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-brand-secondary font-medium transition-colors ${
                            member.status === 'Ativo'
                              ? 'bg-brand-success/10 text-brand-success hover:bg-brand-success/20'
                              : 'bg-brand-slate/10 text-brand-slate hover:bg-brand-slate/20'
                          }`}
                        >
                          {actionLoading === `toggle_${member.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : member.status === 'Ativo' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {member.status}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-brand-secondary text-sm text-brand-midnight">
                          {member.last_login 
                            ? new Date(member.last_login).toLocaleDateString('pt-PT')
                            : 'Nunca'
                          }
                        </p>
                        <p className="text-xs text-brand-slate font-brand-secondary">
                          Reg: {new Date(member.created_at).toLocaleDateString('pt-PT')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResendInvite(member.id)}
                            disabled={actionLoading === `invite_${member.id}`}
                            className="p-2 text-brand-slate hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                            title="Reenviar Convite"
                          >
                            {actionLoading === `invite_${member.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Mail className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-2 text-brand-slate hover:text-brand-midnight hover:bg-brand-light rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                <div className="w-10 h-10 bg-brand-midnight/10 rounded-lg flex items-center justify-center">
                  {editingMember ? <Edit3 className="w-5 h-5 text-brand-midnight" /> : <UserPlus className="w-5 h-5 text-brand-midnight" />}
                </div>
                <div>
                  <h2 className="font-brand-primary font-bold text-xl text-brand-midnight">
                    {editingMember ? 'Editar Membro' : 'Novo Membro'}
                  </h2>
                  <p className="text-sm text-brand-slate font-brand-secondary">
                    {editingMember ? 'Atualize os dados do membro' : 'Adicione um novo membro à equipa'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingMember(null);
                  setModalData(defaultStaffData);
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
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={modalData.nome}
                  onChange={(e) => setModalData({ ...modalData, nome: e.target.value })}
                  className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-midnight focus:border-transparent font-brand-secondary"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={modalData.email}
                  onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                  disabled={!!editingMember}
                  className="block w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-midnight focus:border-transparent font-brand-secondary disabled:bg-brand-light disabled:cursor-not-allowed"
                  placeholder="membro@flowly.pt"
                />
                {editingMember && (
                  <p className="text-xs text-brand-slate mt-1 font-brand-secondary">Email não pode ser alterado</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-brand-secondary font-medium text-brand-slate mb-3">
                  Cargo *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Owner', 'Admin', 'Dev', 'Support'] as const).map((cargo) => {
                    const Icon = cargoIcons[cargo];
                    return (
                      <button
                        key={cargo}
                        type="button"
                        onClick={() => setModalData({ ...modalData, cargo })}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-brand-secondary font-medium transition-colors border-2 ${
                          modalData.cargo === cargo
                            ? `border-brand-midnight bg-brand-midnight/5 text-brand-midnight`
                            : 'border-brand-border bg-white text-brand-slate hover:border-brand-midnight/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {cargo}
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
            <div className="border-t border-brand-border px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingMember(null);
                  setModalData(defaultStaffData);
                }}
                className="px-4 py-2 text-brand-slate hover:text-brand-midnight font-brand-secondary font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingMember ? handleEdit : handleCreate}
                disabled={!!actionLoading || !modalData.nome || !modalData.email}
                className="inline-flex items-center gap-2 px-6 py-2 bg-brand-midnight text-white rounded-lg font-brand-secondary font-medium hover:bg-brand-midnight/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'create' || actionLoading === 'edit' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingMember ? 'Guardar Alterações' : 'Adicionar Membro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
