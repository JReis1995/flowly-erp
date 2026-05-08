"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  RotateCcw,
  Trash2,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import {
  assignLeadOwner,
  bulkAssignLeadOwner,
  bulkDeleteLeads,
  bulkMoveLeadStage,
  bulkSendProspectingEmails,
  completeLeadTask,
  createManualLead,
  getCrmLeadPipelineCounts,
  getCrmLeads,
  getCrmOwners,
  moveLeadStage,
  type CrmLeadListItem,
  type CrmPipelineCounts,
  type ProfileBasic,
} from "../_actions/leads";
import { listEmailTemplates, previewEmailTemplateDraft, type CrmEmailTemplateRow } from "../_actions/emailTemplates";
import { LEAD_TIPO_PROJETO_OPTIONS } from "@/lib/crm/leadTipoProjetoOptions";
import { leadOrigemBadge } from "@/lib/crm/leadOrigemBadge";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filterStage, setFilterStage] = useState<string>(searchParams.get("stage") ?? "all");
  const [filterOwner, setFilterOwner] = useState<string>(searchParams.get("owner") ?? "all");
  const [onlySlaRisk, setOnlySlaRisk] = useState(searchParams.get("sla") === "risk");
  const [page, setPage] = useState<number>(Number(searchParams.get("page") ?? "1"));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pipeline, setPipeline] = useState<CrmPipelineCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkStage, setBulkStage] = useState<string>("qualified");
  const [bulkOwner, setBulkOwner] = useState<string>("none");
  const [prospectingTemplates, setProspectingTemplates] = useState<CrmEmailTemplateRow[]>([]);
  const [bulkProspectingTemplate, setBulkProspectingTemplate] = useState<string>("");
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualTelemovel, setManualTelemovel] = useState("");
  const [manualEmpresa, setManualEmpresa] = useState("");
  const [manualTipo, setManualTipo] = useState<string>(LEAD_TIPO_PROJETO_OPTIONS[0]?.value ?? "crm");
  const [manualTipoOutro, setManualTipoOutro] = useState("");
  const [manualDescricao, setManualDescricao] = useState("");
  const [bulkProspectingModalOpen, setBulkProspectingModalOpen] = useState(false);
  const [bulkDraftSubjectTpl, setBulkDraftSubjectTpl] = useState("");
  const [bulkDraftBodyTpl, setBulkDraftBodyTpl] = useState("");
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkPreviewFullPlain, setBulkPreviewFullPlain] = useState("");
  const [bulkPreviewPlainBody, setBulkPreviewPlainBody] = useState("");
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  function updateQuery(next: { stage?: string; owner?: string; sla?: boolean; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const stage = next.stage ?? filterStage;
    const owner = next.owner ?? filterOwner;
    const sla = next.sla ?? onlySlaRisk;
    const nextPage = next.page ?? page;

    if (stage === "all") params.delete("stage");
    else params.set("stage", stage);

    if (owner === "all") params.delete("owner");
    else params.set("owner", owner);

    if (sla) params.set("sla", "risk");
    else params.delete("sla");

    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const loadBaseData = useCallback(async () => {
    setError(null);

    const [leadsRes, ownersRes, pipelineRes, prospectRes] = await Promise.all([
      getCrmLeads({
        stage: filterStage === "all" ? undefined : filterStage,
        ownerUserId: filterOwner === "all" ? undefined : filterOwner,
        onlySlaRisk,
        page,
        pageSize: 20,
      }),
      getCrmOwners(),
      getCrmLeadPipelineCounts(),
      listEmailTemplates("prospeccao"),
    ]);
    if (leadsRes.error) setError(leadsRes.error);
    if (ownersRes.error) setError(ownersRes.error);
    if (pipelineRes.error) setError(pipelineRes.error);
    if (prospectRes.error) setError(prospectRes.error);

    setProspectingTemplates(prospectRes.data);
    setBulkProspectingTemplate((prev) => {
      const ids = new Set(prospectRes.data.map((t) => t.id));
      if (prev && ids.has(prev)) return prev;
      return prospectRes.data[0]?.id ?? "";
    });

    setLeads(leadsRes.data);
    setTotal(leadsRes.total);
    setTotalPages(leadsRes.totalPages);
    setOwners(ownersRes.data);
    setPipeline(pipelineRes.data);
    setLoading(false);
  }, [filterOwner, filterStage, onlySlaRisk, page]);

  useEffect(() => {
    startTransition(() => {
      void loadBaseData();
    });
  }, [loadBaseData]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterStage, filterOwner, onlySlaRisk, page]);

  const visibleLeads = useMemo(() => {
    return leads;
  }, [leads]);

  const allOnPageSelected =
    visibleLeads.length > 0 && visibleLeads.every((l) => selectedIds.has(l.id));
  const someOnPageSelected = visibleLeads.some((l) => selectedIds.has(l.id));

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleLeads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleLeads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  function runBulkStage() {
    const ids = Array.from(selectedIds).slice(0, 100);
    if (ids.length === 0) return;
    startTransition(async () => {
      setError(null);
      const result = await bulkMoveLeadStage(ids, bulkStage);
      if (!result.success) {
        setError(result.error ?? "Não foi possível atualizar as etapas.");
        return;
      }
      setSelectedIds(new Set());
      await loadBaseData();
    });
  }

  function runBulkOwner() {
    const ids = Array.from(selectedIds).slice(0, 100);
    if (ids.length === 0) return;
    startTransition(async () => {
      setError(null);
      const ownerId = bulkOwner === "none" ? null : bulkOwner;
      const result = await bulkAssignLeadOwner(ids, ownerId);
      if (!result.success) {
        setError(result.error ?? "Não foi possível atribuir o dono.");
        return;
      }
      setSelectedIds(new Set());
      await loadBaseData();
    });
  }

  function openBulkProspectingModal() {
    setError(null);
    const tid = bulkProspectingTemplate;
    const t = prospectingTemplates.find((x) => x.id === tid);
    if (!tid || !t) {
      setError("Escolha um modelo de prospecção.");
      return;
    }
    setBulkDraftSubjectTpl(t.subject_template);
    setBulkDraftBodyTpl(t.body_template);
    setBulkPreviewFullPlain("");
    setBulkPreviewPlainBody("");
    setBulkProspectingModalOpen(true);
  }

  function resetBulkDraftFromTemplate() {
    const t = prospectingTemplates.find((x) => x.id === bulkProspectingTemplate);
    if (!t) return;
    setBulkDraftSubjectTpl(t.subject_template);
    setBulkDraftBodyTpl(t.body_template);
    setBulkPreviewFullPlain("");
    setBulkPreviewPlainBody("");
  }

  async function runBulkProspectingPreview() {
    setBulkPreviewLoading(true);
    setError(null);
    const res = await previewEmailTemplateDraft({
      kind: "prospeccao",
      subject_template: bulkDraftSubjectTpl,
      body_template: bulkDraftBodyTpl,
    });
    setBulkPreviewLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setBulkPreviewFullPlain(res.fullPlainText);
    setBulkPreviewPlainBody(res.plainBody);
  }

  function runBulkProspectingSendFromModal() {
    const ids = Array.from(selectedIds).slice(0, 50);
    if (ids.length === 0) return;
    if (!bulkDraftSubjectTpl.trim() || !bulkDraftBodyTpl.trim()) {
      setError("Preencha assunto e corpo do modelo.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await bulkSendProspectingEmails(ids, bulkProspectingTemplate, {
        subject_template: bulkDraftSubjectTpl.trim(),
        body_template: bulkDraftBodyTpl.trim(),
      });
      if (!result.success) {
        setError(result.error ?? "Não foi possível enviar os emails.");
        return;
      }
      setBulkProspectingModalOpen(false);
      setSelectedIds(new Set());
      await loadBaseData();
      if (result.failed > 0) {
        setError(`${result.sent} email(s) enviado(s); ${result.failed} falharam.`);
      }
    });
  }

  function runBulkDelete() {
    const ids = Array.from(selectedIds).slice(0, 100);
    if (ids.length === 0) return;
    const n = ids.length;
    if (
      !window.confirm(
        `Eliminar definitivamente ${n} lead(s)? Tarefas e histórico associados serão removidos. Esta ação não pode ser anulada.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await bulkDeleteLeads(ids);
      if (!result.success) {
        setError(result.error ?? "Não foi possível eliminar as leads.");
        return;
      }
      setSelectedIds(new Set());
      await loadBaseData();
    });
  }

  function submitManualLead() {
    startTransition(async () => {
      setError(null);
      const res = await createManualLead({
        nome: manualNome,
        email: manualEmail,
        telemovel: manualTelemovel,
        empresa: manualEmpresa.trim(),
        tipo_projeto: manualTipo,
        tipo_projeto_outro: manualTipo === "outro" ? manualTipoOutro : null,
        descricao: manualDescricao,
      });
      if (!res.success) {
        setError(res.error ?? "Não foi possível criar a lead.");
        return;
      }
      setShowManualModal(false);
      setManualNome("");
      setManualEmail("");
      setManualTelemovel("");
      setManualEmpresa("");
      setManualTipo(LEAD_TIPO_PROJETO_OPTIONS[0]?.value ?? "crm");
      setManualTipoOutro("");
      setManualDescricao("");
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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-xl">
            <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">CRM de Leads (MVP)</h1>
            <p className="text-brand-slate mt-2 font-brand-secondary">
              Triagem diária com dono, etapa e próxima tarefa. Pedidos do site criam leads automaticamente (etiqueta{" "}
              «Site»); as que registas aqui aparecem como «Prospeção».
            </p>
            <Link
              href="/central-saas/leads/templates"
              className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline mt-3 font-brand-secondary"
            >
              <Mail className="w-4 h-4" />
              Modelos de email (prospecção e follow-up)
            </Link>
          </div>
          <div className="inline-flex flex-col items-end gap-1 px-4 py-2 bg-brand-light rounded-lg text-right">
            <div className="inline-flex items-center gap-2">
              <Workflow className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-brand-secondary text-brand-midnight">
                {visibleLeads.length} nesta página · {total} com filtros atuais
              </span>
            </div>
            {pipeline && (
              <span className="text-xs text-brand-slate max-w-md leading-snug">
                Pipeline global: {pipeline.total} · SLA em risco: {pipeline.slaRiskTotal} · Tarefas pendentes:{" "}
                {pipeline.pendingTasksTotal}
                {stageOptions.map((s) => (
                  <span key={s.id}>
                    {" "}
                    · {s.label}: {pipeline.byStage[s.id]}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="brand-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              setFilterStage("all");
              setPage(1);
              updateQuery({ stage: "all", page: 1 });
            }}
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
              onClick={() => {
                setLoading(true);
                setFilterStage(stage.id);
                setPage(1);
                updateQuery({ stage: stage.id, page: 1 });
              }}
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

      <div className="brand-card p-4 mb-5 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterOwner}
          onChange={(e) => {
            setLoading(true);
            setFilterOwner(e.target.value);
            setPage(1);
            updateQuery({ owner: e.target.value, page: 1 });
          }}
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
            onChange={(e) => {
              setLoading(true);
              setOnlySlaRisk(e.target.checked);
              setPage(1);
              updateQuery({ sla: e.target.checked, page: 1 });
            }}
            className="rounded border-brand-border"
          />
          Mostrar só SLA em risco
        </label>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setShowManualModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-midnight text-white text-sm font-medium hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" />
          Nova lead (prospeção)
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {selectedIds.size > 0 && (
        <div className="brand-card p-4 mb-4 flex flex-wrap items-center gap-3 border-brand-primary/30 bg-brand-primary/5">
          <span className="text-sm font-medium text-brand-midnight">
            {selectedIds.size} na seleção
            {selectedIds.size > 100
              ? " (etapa/dono/delete: só as primeiras 100; email em massa: máx. 50)"
              : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-brand-slate">Etapa</label>
            <select
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value)}
              disabled={pending}
              className="px-2 py-1.5 border border-brand-border rounded-lg bg-white text-sm"
            >
              {stageOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={runBulkStage}
              className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Aplicar etapa
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-l border-brand-border pl-3">
            <label className="text-xs text-brand-slate">Dono</label>
            <select
              value={bulkOwner}
              onChange={(e) => setBulkOwner(e.target.value)}
              disabled={pending}
              className="px-2 py-1.5 border border-brand-border rounded-lg bg-white text-sm min-w-[10rem]"
            >
              <option value="none">Sem dono</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {ownerLabel(owner)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={runBulkOwner}
              className="px-3 py-1.5 rounded-lg bg-brand-midnight text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Atribuir dono
            </button>
          </div>
          <div className="w-full flex flex-wrap items-center gap-2 border-t border-brand-border pt-3 mt-1">
            <Mail className="w-4 h-4 text-brand-primary shrink-0" />
            <span className="text-xs text-brand-slate shrink-0">
              Modelo base (pode editar antes de enviar)
            </span>
            <select
              value={bulkProspectingTemplate}
              onChange={(e) => setBulkProspectingTemplate(e.target.value)}
              disabled={pending || prospectingTemplates.length === 0}
              className="flex-1 min-w-[14rem] px-2 py-1.5 border border-brand-border rounded-lg bg-white text-sm"
            >
              {prospectingTemplates.length === 0 ? (
                <option value="">Sem modelos — configure em Modelos de email</option>
              ) : (
                prospectingTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.area_label ? `${t.area_label}: ` : ""}
                    {t.label}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={pending || !bulkProspectingTemplate}
              onClick={openBulkProspectingModal}
              className="px-3 py-1.5 rounded-lg bg-white border border-brand-primary text-brand-primary text-sm font-medium hover:bg-brand-light disabled:opacity-50"
            >
              Rever e enviar…
            </button>
            <span className="text-xs text-brand-slate">
              Máx. 50 destinatários por envio (primeiras da seleção).
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <button
              type="button"
              disabled={pending}
              onClick={runBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-800 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              Eliminar seleção
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-brand-slate hover:text-brand-midnight underline"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <div className="brand-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-light border-b border-brand-border">
                <tr>
                  <th className="px-2 py-3 w-10">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      disabled={loading || pending || visibleLeads.length === 0}
                      className="rounded border-brand-border"
                      title="Selecionar todas nesta página"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Lead / origem</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Etapa</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Dono</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Próxima tarefa</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">SLA</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-brand-slate">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-primary" />
                      A carregar dados CRM...
                    </td>
                  </tr>
                )}

                {!loading && visibleLeads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-brand-slate">
                      Não existem leads para os filtros atuais.
                    </td>
                  </tr>
                )}

                {!loading &&
                  visibleLeads.map((lead) => {
                    const sla = getSlaState(lead);
                    const taskDue = lead.next_task?.due_at ?? lead.next_action_at;
                    return (
                      <tr key={lead.id} className="hover:bg-brand-light/40">
                        <td className="px-2 py-3 align-top w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleRow(lead.id)}
                            disabled={loading || pending}
                            className="rounded border-brand-border"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-brand-midnight">{lead.nome}</div>
                          <div className="text-xs text-brand-slate">{lead.email}</div>
                          <div className="text-xs text-brand-slate">
                            {lead.telemovel?.trim() ? `Telemóvel: ${lead.telemovel.trim()}` : "Telemóvel: —"}
                          </div>
                          <div className="text-xs text-brand-slate">{lead.empresa || "Sem empresa"}</div>
                          <div className="mt-1.5">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${leadOrigemBadge(lead.origem).className}`}
                            >
                              {leadOrigemBadge(lead.origem).label}
                            </span>
                          </div>
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

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="brand-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-labelledby="manual-lead-title"
          >
            <h2 id="manual-lead-title" className="font-brand-primary font-semibold text-lg text-brand-midnight mb-1">
              Nova lead (prospeção)
            </h2>
            <p className="text-xs text-brand-slate mb-4">
              Regista contactos que identificas na prospecção. Ficam com origem «Prospeção», como as vindas do site com
              «Site».
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-brand-slate mb-1">Nome *</label>
                <input
                  value={manualNome}
                  onChange={(e) => setManualNome(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  placeholder="Nome do contacto"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-slate mb-1">Email *</label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  placeholder="email@empresa.pt"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-slate mb-1">Telemóvel *</label>
                <input
                  inputMode="tel"
                  autoComplete="tel"
                  value={manualTelemovel}
                  onChange={(e) => setManualTelemovel(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  placeholder="912 345 678 ou +351 912 345 678"
                />
                <p className="text-[11px] text-brand-slate mt-1">Número português (9 dígitos), igual ao formulário público.</p>
              </div>
              <div>
                <label className="block text-xs text-brand-slate mb-1">Empresa ou organização *</label>
                <input
                  required
                  minLength={2}
                  value={manualEmpresa}
                  onChange={(e) => setManualEmpresa(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  placeholder="Nome comercial ou equipa"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-slate mb-1">Área / tipo de projeto *</label>
                <select
                  value={manualTipo}
                  onChange={(e) => setManualTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                >
                  {LEAD_TIPO_PROJETO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {manualTipo === "outro" && (
                <div>
                  <label className="block text-xs text-brand-slate mb-1">Especificar «outro» *</label>
                  <input
                    value={manualTipoOutro}
                    onChange={(e) => setManualTipoOutro(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-brand-slate mb-1">Notas / contexto *</label>
                <textarea
                  value={manualDescricao}
                  onChange={(e) => setManualDescricao(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  placeholder="Como surgiu o contacto, interesse referido, próximo passo…"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-lg border border-brand-border text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submitManualLead}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Criar lead
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkProspectingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true">
          <div className="brand-card max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-xl border border-brand-border">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-brand-border bg-brand-light/40">
              <div>
                <p className="text-xs text-brand-slate uppercase tracking-wide">Prospecção em massa</p>
                <h3 className="font-brand-primary font-semibold text-lg text-brand-midnight">Rever e adaptar o email</h3>
                <p className="text-xs text-brand-slate mt-1">
                  Destinatários: {Math.min(50, selectedIds.size)} contacto(s) (primeiros da seleção, máx. 50). O mesmo texto é
                  personalizado por destinatário (nome, empresa, etc.).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkProspectingModalOpen(false)}
                className="p-2 rounded-lg hover:bg-brand-border/60 text-brand-slate shrink-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-brand-midnight">
                Modelo:{" "}
                <span className="font-medium">
                  {prospectingTemplates.find((x) => x.id === bulkProspectingTemplate)?.label ?? "—"}
                </span>
              </p>
              <div>
                <label className="block text-xs text-brand-slate mb-1">Assunto (modelo com variáveis)</label>
                <input
                  value={bulkDraftSubjectTpl}
                  onChange={(e) => setBulkDraftSubjectTpl(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                  placeholder="Flowly | …"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-slate mb-1">
                  Corpo do modelo (sem saudação «Olá …» — é acrescentada no envio)
                </label>
                <textarea
                  value={bulkDraftBodyTpl}
                  onChange={(e) => setBulkDraftBodyTpl(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={bulkPreviewLoading || pending}
                  onClick={() => void runBulkProspectingPreview()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-primary text-brand-primary text-sm font-medium hover:bg-brand-light disabled:opacity-50"
                >
                  {bulkPreviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Pré-visualizar email completo
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={resetBulkDraftFromTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-border text-sm text-brand-midnight hover:bg-brand-light"
                >
                  <RotateCcw className="w-4 h-4" />
                  Repor texto do modelo
                </button>
              </div>
              {(bulkPreviewFullPlain || bulkPreviewPlainBody) && (
                <div className="space-y-3 border-t border-brand-border pt-4">
                  <div>
                    <p className="text-xs font-semibold text-brand-midnight mb-1">Email completo (texto, amostra)</p>
                    <pre className="max-h-52 overflow-y-auto rounded-lg border border-brand-border bg-white p-3 text-sm whitespace-pre-wrap border-l-4 border-l-brand-primary">
                      {bulkPreviewFullPlain}
                    </pre>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-brand-primary font-medium">Ver só corpo com saudação</summary>
                    <pre className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-brand-border bg-brand-light/50 p-3 whitespace-pre-wrap text-xs">
                      {bulkPreviewPlainBody}
                    </pre>
                  </details>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-brand-border flex flex-wrap justify-end gap-2 bg-brand-light/30">
              <button
                type="button"
                disabled={pending}
                onClick={() => setBulkProspectingModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-brand-border text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  pending ||
                  !bulkDraftSubjectTpl.trim() ||
                  !bulkDraftBodyTpl.trim() ||
                  Math.min(50, selectedIds.size) === 0
                }
                onClick={runBulkProspectingSendFromModal}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                Enviar para {Math.min(50, selectedIds.size)} contacto(s)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-brand-slate">
        <span>
          {total} leads no total {totalPages > 0 ? `· página ${page} de ${totalPages}` : ""}
        </span>
        <div className="inline-flex items-center gap-2">
          <button
            disabled={loading || pending || page <= 1}
            onClick={() => {
              setLoading(true);
              const nextPage = Math.max(1, page - 1);
              setPage(nextPage);
              updateQuery({ page: nextPage });
            }}
            className="px-3 py-2 rounded-lg border border-brand-border bg-white disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            disabled={loading || pending || totalPages === 0 || page >= totalPages}
            onClick={() => {
              setLoading(true);
              const nextPage = Math.min(totalPages, page + 1);
              setPage(nextPage);
              updateQuery({ page: nextPage });
            }}
            className="px-3 py-2 rounded-lg border border-brand-border bg-white disabled:opacity-50"
          >
            Seguinte
          </button>
        </div>
      </div>
    </div>
  );
}
