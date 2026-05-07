"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Workflow,
} from "lucide-react";
import {
  assignLeadOwner,
  completeLeadTask,
  getCrmLeads,
  getCrmOwners,
  moveLeadStage,
  type CrmLeadListItem,
  type ProfileBasic,
} from "../_actions/leads";

type OwnerOption = ProfileBasic;

const stageOptions = [
  { id: "new", label: "Nova" },
  { id: "qualified", label: "Qualificada" },
  { id: "proposal", label: "Proposta" },
  { id: "won", label: "Ganha" },
  { id: "lost", label: "Perdida" },
] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getSlaState(lead: CrmLeadListItem): "ok" | "warning" | "danger" {
  const due = lead.next_task?.due_at ?? lead.next_action_at;
  if (!due) return "warning";

  const diffMs = new Date(due).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return "danger";
  if (diffHours < 24) return "warning";
  return "ok";
}

function ownerLabel(owner: OwnerOption) {
  const shortId = owner.id.slice(0, 8);
  return owner.nome ? `${owner.nome} · ${shortId}` : `Utilizador · ${shortId}`;
}

export default function LeadsCrmPage() {
  const [leads, setLeads] = useState<CrmLeadListItem[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [onlySlaRisk, setOnlySlaRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBaseData() {
    setLoading(true);
    setError(null);

    const [leadsRes, ownersRes] = await Promise.all([getCrmLeads(), getCrmOwners()]);
    if (leadsRes.error) setError(leadsRes.error);
    if (ownersRes.error) setError(ownersRes.error);

    setLeads(leadsRes.data);
    setOwners(ownersRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadBaseData();
  }, []);

  const visibleLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterStage !== "all" && lead.stage_id !== filterStage) return false;
      if (filterOwner !== "all" && (lead.owner_user_id ?? "none") !== filterOwner) return false;
      if (onlySlaRisk) {
        const sla = getSlaState(lead);
        if (sla === "ok") return false;
      }
      return true;
    });
  }, [leads, filterStage, filterOwner, onlySlaRisk]);

  function runAction(action: () => Promise<{ success: boolean; error: string | null | undefined }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      await loadBaseData();
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <Link
          href="/central-saas"
          className="inline-flex items-center gap-2 text-brand-slate hover:text-brand-primary transition-colors mb-4 font-brand-secondary text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Central SaaS
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">CRM de Leads (MVP)</h1>
            <p className="text-brand-slate mt-2 font-brand-secondary">
              Triagem diária com dono, etapa e próxima tarefa para cada lead.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-light rounded-lg">
            <Workflow className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-brand-secondary text-brand-midnight">{visibleLeads.length} leads visíveis</span>
          </div>
        </div>
      </div>

      <div className="brand-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterStage("all")}
            className={`px-3 py-2 rounded-lg text-sm border ${
              filterStage === "all"
                ? "bg-brand-primary text-white border-brand-primary"
                : "bg-white border-brand-border text-brand-midnight"
            }`}
          >
            Todas
          </button>
          {stageOptions.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setFilterStage(stage.id)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                filterStage === stage.id
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "bg-white border-brand-border text-brand-midnight"
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      <div className="brand-card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="px-3 py-2 border border-brand-border rounded-lg bg-white text-sm"
        >
          <option value="all">Todos donos</option>
          <option value="none">Sem dono</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {ownerLabel(owner)}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-brand-midnight">
          <input
            type="checkbox"
            checked={onlySlaRisk}
            onChange={(e) => setOnlySlaRisk(e.target.checked)}
            className="rounded border-brand-border"
          />
          Mostrar só SLA em risco
        </label>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <div className="brand-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-light border-b border-brand-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Lead</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Etapa</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Dono</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Próxima tarefa</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">SLA</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {(loading || pending) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-brand-slate">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-primary" />
                      A carregar dados CRM...
                    </td>
                  </tr>
                )}

                {!loading && !pending && visibleLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-brand-slate">
                      Não existem leads para os filtros atuais.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !pending &&
                  visibleLeads.map((lead) => {
                    const sla = getSlaState(lead);
                    const taskDue = lead.next_task?.due_at ?? lead.next_action_at;
                    return (
                      <tr key={lead.id} className="hover:bg-brand-light/40">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-brand-midnight">{lead.nome}</div>
                          <div className="text-xs text-brand-slate">{lead.email}</div>
                          <div className="text-xs text-brand-slate">{lead.empresa || "Sem empresa"}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <select
                            value={lead.stage_id}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              runAction(() => moveLeadStage(lead.id, e.target.value))
                            }
                            className="px-2 py-1 border border-brand-border rounded-md bg-white text-sm"
                          >
                            {stageOptions.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <select
                            value={lead.owner_user_id ?? "none"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              runAction(() => assignLeadOwner(lead.id, e.target.value === "none" ? null : e.target.value))
                            }
                            className="px-2 py-1 border border-brand-border rounded-md bg-white text-sm"
                          >
                            <option value="none">Sem dono</option>
                            {owners.map((owner) => (
                              <option key={owner.id} value={owner.id}>
                                {ownerLabel(owner)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {lead.next_task ? (
                            <div className="space-y-2">
                              <div className="text-sm text-brand-midnight">{lead.next_task.title}</div>
                              <div className="text-xs text-brand-slate">Prazo: {formatDate(lead.next_task.due_at)}</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runAction(() => completeLeadTask(lead.next_task!.id));
                                }}
                                className="inline-flex items-center gap-1 text-xs text-brand-success hover:underline"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Concluir
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-brand-slate">
                              Sem tarefa pendente.
                              <Link
                                href={`/central-saas/leads/${lead.id}`}
                                className="ml-1 text-brand-primary hover:underline"
                              >
                                Definir no detalhe
                              </Link>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                              sla === "danger"
                                ? "bg-red-100 text-red-700"
                                : sla === "warning"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {sla === "danger" ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : sla === "warning" ? (
                              <Clock3 className="w-3 h-3" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {sla === "danger" ? "Atrasado" : sla === "warning" ? "Hoje/24h" : "OK"}
                          </div>
                          <div className="text-xs text-brand-slate mt-1">{formatDate(taskDue)}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/central-saas/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline"
                          >
                            Abrir
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
