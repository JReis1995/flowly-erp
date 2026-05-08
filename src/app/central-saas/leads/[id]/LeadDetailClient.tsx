"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  History,
  Inbox,
  Loader2,
  Mail,
  Phone,
  Plus,
  Send,
  Trash2,
  UserCircle2,
  Workflow,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import { leadOrigemBadge } from "@/lib/crm/leadOrigemBadge";
import {
  assignLeadOwner,
  completeLeadTask,
  createLeadTask,
  deleteLead,
  moveLeadStage,
  sendLeadEmail,
  updateLeadHandoffNotes,
  type CrmLeadRow,
  type CrmLeadTask,
  type CrmTimelineItem,
  type LeadHandoffNotes,
  type ProfileBasic,
} from "../../_actions/leads";
import {
  applyFollowUpTemplateToLead,
  listEmailTemplates,
  type CrmEmailTemplateRow,
} from "../../_actions/emailTemplates";

function emailPayloadBody(payload: Record<string, unknown>): string | null {
  const b = payload.body ?? payload.message ?? payload.text;
  if (typeof b === "string" && b.length > 0) return b;
  return null;
}

type Props = {
  lead: CrmLeadRow;
  owner: ProfileBasic | null;
  owners: ProfileBasic[];
  tasks: CrmLeadTask[];
  timeline: CrmTimelineItem[];
  replyToAddress: string;
};

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
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ownerLabel(owner: ProfileBasic) {
  return `${owner.nome || "Utilizador"} · ${owner.id.slice(0, 8)}`;
}

function timelineText(eventType: string, payload: Record<string, unknown>) {
  switch (eventType) {
    case "lead_created":
      return payload.manual === true ? "Lead criada manualmente no CRM." : "Lead registada.";
    case "owner_changed":
      return "Dono atualizado.";
    case "stage_changed":
      return `Etapa alterada para ${String(payload.stage_id ?? "desconhecida")}.`;
    case "task_created":
      return `Tarefa criada: ${String(payload.title ?? "sem título")}.`;
    case "task_done":
      return `Tarefa concluída: ${String(payload.title ?? "sem título")}.`;
    case "email_sent": {
      const sub = String(payload.subject ?? "sem assunto");
      const to = payload.to != null ? String(payload.to) : "";
      return to
        ? `Email enviado para ${to} — assunto: «${sub}».`
        : `Email enviado — assunto: «${sub}».`;
    }
    case "email_received": {
      const sub = String(payload.subject ?? "sem assunto");
      const from = payload.from != null ? String(payload.from) : "";
      return from
        ? `Email recebido de ${from} — assunto: «${sub}».`
        : `Email recebido — assunto: «${sub}».`;
    }
    default:
      return eventType;
  }
}

function EmailHistoryRow({
  item,
  expanded,
  onToggle,
}: {
  item: CrmTimelineItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const payload = item.payload ?? {};
  const body = emailPayloadBody(payload);
  const isSent = item.event_type === "email_sent";
  const sub = String(payload.subject ?? "(sem assunto)");
  const to = payload.to != null ? String(payload.to) : "";
  const from = payload.from != null ? String(payload.from) : "";

  return (
    <div className="border border-brand-border rounded-lg p-4 bg-white/60">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isSent ? "bg-sky-100 text-sky-900" : "bg-emerald-100 text-emerald-900"
          }`}
        >
          {isSent ? "Enviado" : "Recebido"}
        </span>
        <span className="text-xs text-brand-slate">{formatDate(item.created_at)}</span>
      </div>
      <p className="text-sm font-medium text-brand-midnight">{sub}</p>
      <p className="text-xs text-brand-slate mt-1">
        {isSent ? (to ? `Para: ${to}` : "Para: —") : from ? `De: ${from}` : "De: —"}
      </p>
      {body ? (
        <>
          <button type="button" onClick={onToggle} className="mt-2 text-xs text-brand-primary hover:underline">
            {expanded ? "Ocultar corpo" : "Ver corpo"}
          </button>
          {expanded && (
            <pre className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-brand-border bg-brand-light/50 p-3 text-sm text-brand-midnight whitespace-pre-wrap break-words">
              {body}
            </pre>
          )}
        </>
      ) : isSent ? (
        <p className="text-xs text-brand-slate mt-2">Corpo não guardado (envio anterior à atualização).</p>
      ) : (
        <p className="text-xs text-brand-slate mt-2">Sem corpo no registo.</p>
      )}
    </div>
  );
}

export default function LeadDetailClient({ lead, owner, owners, tasks, timeline, replyToAddress }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [emailBodyOpen, setEmailBodyOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [followTemplates, setFollowTemplates] = useState<CrmEmailTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTemplatesLoading(true);
      setError(null);
      const { data, error: listErr } = await listEmailTemplates("follow_up");
      if (cancelled) return;
      setTemplatesLoading(false);
      if (listErr) {
        setError(listErr);
        setFollowTemplates([]);
        setSelectedTemplate("");
        setSubject("");
        setMessage("");
        return;
      }
      setFollowTemplates(data);
      if (data.length === 0) {
        setSelectedTemplate("");
        setSubject("");
        setMessage("");
        return;
      }
      const firstId = data[0].id;
      setSelectedTemplate(firstId);
      const res = await applyFollowUpTemplateToLead(firstId, lead.id);
      if (cancelled) return;
      if (res.success) {
        setSubject(res.subject);
        setMessage(res.message);
      } else {
        setError(res.error ?? "Não foi possível aplicar o modelo.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [requestExpanded, setRequestExpanded] = useState(false);

  const handoffFromMeta = (lead.metadata?.handoff ?? {}) as Partial<LeadHandoffNotes>;
  const [handoffEscopo, setHandoffEscopo] = useState(() => String(handoffFromMeta.escopo_resumo ?? ""));
  const [handoffProximos, setHandoffProximos] = useState(() =>
    String(handoffFromMeta.proximos_passos_delivery ?? "")
  );
  const [handoffContacto, setHandoffContacto] = useState(() =>
    String(handoffFromMeta.contacto_delivery ?? "")
  );

  useEffect(() => {
    const h = (lead.metadata?.handoff ?? {}) as Partial<LeadHandoffNotes>;
    setHandoffEscopo(String(h.escopo_resumo ?? ""));
    setHandoffProximos(String(h.proximos_passos_delivery ?? ""));
    setHandoffContacto(String(h.contacto_delivery ?? ""));
  }, [lead.id, lead.metadata]);

  const ownerLabelCurrent = owner ? ownerLabel(owner) : "Sem dono";
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === "pending"), [tasks]);
  const mailItems = useMemo(
    () =>
      [...timeline]
        .filter((t) => t.event_type === "email_sent" || t.event_type === "email_received")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [timeline]
  );
  const slaState = useMemo(() => {
    const due = pendingTasks[0]?.due_at ?? lead.next_action_at;
    if (!due) return { label: "Sem data definida", tone: "warning" as const };
    const diffHours = (new Date(due).getTime() - nowMs) / (1000 * 60 * 60);
    if (diffHours < 0) return { label: "SLA atrasado", tone: "danger" as const };
    if (diffHours < 24) return { label: "SLA hoje/24h", tone: "warning" as const };
    return { label: "SLA dentro do prazo", tone: "ok" as const };
  }, [pendingTasks, lead.next_action_at, nowMs]);

  function timelineIcon(eventType: string) {
    switch (eventType) {
      case "email_sent":
        return <Send className="w-3 h-3" />;
      case "email_received":
        return <Inbox className="w-3 h-3" />;
      case "task_done":
        return <CheckCircle className="w-3 h-3" />;
      case "task_created":
        return <Plus className="w-3 h-3" />;
      case "stage_changed":
        return <Workflow className="w-3 h-3" />;
      default:
        return <History className="w-3 h-3" />;
    }
  }

  function applyTemplate(templateId: string) {
    startTransition(async () => {
      setError(null);
      setSelectedTemplate(templateId);
      const res = await applyFollowUpTemplateToLead(templateId, lead.id);
      if (!res.success) {
        setError(res.error ?? "Não foi possível aplicar o modelo.");
        return;
      }
      setSubject(res.subject);
      setMessage(res.message);
    });
  }

  function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string | null | undefined;
      warning?: string | null | undefined;
    }>
  ) {
    startTransition(async () => {
      setError(null);
      setWarning(null);
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      if (result.warning) setWarning(result.warning);
      router.refresh();
    });
  }

  function confirmDeleteLead() {
    if (
      !window.confirm(
        `Eliminar definitivamente a lead «${lead.nome}»? As tarefas e o histórico associados serão removidos. Esta ação não pode ser anulada.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await deleteLead(lead.id);
      if (!res.success) {
        setError(res.error ?? "Não foi possível eliminar a lead.");
        return;
      }
      router.push("/central-saas/leads");
    });
  }

  return (
    <div className="space-y-6">
      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {warning && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">{warning}</div>
      )}

      <section className="brand-card p-4 border border-red-200 bg-red-50/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-midnight">Eliminar esta lead</p>
            <p className="text-xs text-brand-slate mt-1 max-w-xl">
              Remove o registo na base de dados. Tarefas e histórico associados são removidos automaticamente. Esta ação
              é irreversível.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={confirmDeleteLead}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 bg-white text-red-800 text-sm font-medium hover:bg-red-50 disabled:opacity-50 shrink-0"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Eliminar lead
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="brand-card p-4">
          <p className="text-xs text-brand-slate mb-1">Lead</p>
          <p className="text-sm font-semibold text-brand-midnight">{lead.nome}</p>
          <p className="text-xs text-brand-slate mt-1">{lead.email}</p>
          <p className="text-xs text-brand-slate mt-1 inline-flex items-center gap-1">
            <Phone className="w-3 h-3 shrink-0" aria-hidden />
            <span>{lead.telemovel?.trim() ? lead.telemovel.trim() : "Sem telemóvel registado"}</span>
          </p>
          <p className="mt-2">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${leadOrigemBadge(lead.origem).className}`}
            >
              {leadOrigemBadge(lead.origem).label}
            </span>
          </p>
        </div>
        <div className="brand-card p-4">
          <p className="text-xs text-brand-slate mb-1">Projeto</p>
          <p className="text-sm font-semibold text-brand-midnight">{lead.tipo_projeto}</p>
        </div>
        <div className="brand-card p-4">
          <p className="text-xs text-brand-slate mb-1 inline-flex items-center gap-1">
            <Workflow className="w-3 h-3" />
            Etapa atual
          </p>
          <p className="text-sm font-semibold text-brand-midnight">
            {stageOptions.find((s) => s.id === lead.stage_id)?.label ?? lead.stage_id}
          </p>
          <div
            className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              slaState.tone === "danger"
                ? "bg-red-100 text-red-700"
                : slaState.tone === "warning"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
            }`}
          >
            {slaState.tone === "danger" ? (
              <AlertTriangle className="w-3 h-3" />
            ) : slaState.tone === "warning" ? (
              <Clock3 className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {slaState.label}
          </div>
        </div>
        <div className="brand-card p-4">
          <p className="text-xs text-brand-slate mb-1 inline-flex items-center gap-1">
            <UserCircle2 className="w-3 h-3" />
            Dono atual
          </p>
          <p className="text-sm font-semibold text-brand-midnight">{ownerLabelCurrent}</p>
        </div>
      </section>

      <section className="brand-card p-5">
        <h2 className="font-brand-primary font-semibold text-brand-midnight mb-4">Gestão da lead</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-brand-slate mb-2">Etapa</label>
            <select
              disabled={pending}
              value={lead.stage_id}
              onChange={(e) => runAction(() => moveLeadStage(lead.id, e.target.value))}
              className="w-full px-3 py-2 border border-brand-border rounded-lg bg-white text-sm"
            >
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-brand-slate mb-2">Dono</label>
            <select
              disabled={pending}
              value={lead.owner_user_id ?? "none"}
              onChange={(e) =>
                runAction(() => assignLeadOwner(lead.id, e.target.value === "none" ? null : e.target.value))
              }
              className="w-full px-3 py-2 border border-brand-border rounded-lg bg-white text-sm"
            >
              <option value="none">Sem dono</option>
              {owners.map((item) => (
                <option key={item.id} value={item.id}>
                  {ownerLabel(item)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="brand-card p-5">
        <h2 className="font-brand-primary font-semibold text-brand-midnight mb-2 inline-flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Handoff comercial → delivery
        </h2>
        <p className="text-xs text-brand-slate mb-4 max-w-3xl">
          Notas guardadas em <span className="font-mono">metadata.handoff</span> para a equipa de entrega (sem alterar o
          modelo SQL).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm text-brand-slate mb-1">Âmbito acordado / resumo</label>
            <textarea
              value={handoffEscopo}
              onChange={(e) => setHandoffEscopo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
              placeholder="Ex.: CRM + integração API X, go-live em 8 semanas."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-brand-slate mb-1">Próximos passos para delivery</label>
            <textarea
              value={handoffProximos}
              onChange={(e) => setHandoffProximos(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
              placeholder="Ex.: Kick-off, acesso a ambientes, prioridade do backlog."
            />
          </div>
          <div>
            <label className="block text-sm text-brand-slate mb-1">Contacto / owner técnico</label>
            <input
              value={handoffContacto}
              onChange={(e) => setHandoffContacto(e.target.value)}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
              placeholder="Email ou nome interno"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            runAction(() =>
              updateLeadHandoffNotes(lead.id, {
                escopo_resumo: handoffEscopo,
                proximos_passos_delivery: handoffProximos,
                contacto_delivery: handoffContacto,
              })
            )
          }
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-success text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
          Guardar handoff
        </button>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 brand-card p-5">
          <h2 className="font-brand-primary font-semibold text-brand-midnight mb-4">Enviar email (Resend)</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-brand-slate mb-1">Modelo (follow-up)</label>
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                disabled={pending || templatesLoading || followTemplates.length === 0}
                className="w-full px-3 py-2 border border-brand-border rounded-lg bg-white text-sm disabled:opacity-60"
              >
                {templatesLoading ? (
                  <option value="">A carregar modelos…</option>
                ) : followTemplates.length === 0 ? (
                  <option value="">Sem modelos — crie em Modelos de email</option>
                ) : (
                  followTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.area_label ? `${template.area_label}: ` : ""}
                      {template.label}
                    </option>
                  ))
                )}
              </select>
              {followTemplates.length === 0 && !templatesLoading && (
                <p className="text-xs text-amber-800 mt-1">
                  Não há modelos de follow-up na base de dados.{" "}
                  <Link href="/central-saas/leads/templates" className="text-brand-primary underline">
                    Gerir modelos
                  </Link>
                </p>
              )}
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto"
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              placeholder="Mensagem"
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
            />
            <button
              disabled={pending}
              onClick={() =>
                runAction(() =>
                  sendLeadEmail({
                    leadId: lead.id,
                    subject,
                    message,
                  })
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar via Resend
            </button>
            <p className="text-xs text-brand-slate">
              O email é enviado com assinatura Flowly, logótipo no rodapé e reply-to dedicado desta lead.
            </p>
            <p className="text-xs text-brand-midnight bg-brand-light px-2 py-1 rounded inline-block break-all">
              Reply-to desta proposta: {replyToAddress}
            </p>
          </div>
        </div>

        <div className="brand-card p-5">
          <button
            onClick={() => setRequestExpanded((v) => !v)}
            className="w-full flex items-center justify-between mb-4"
          >
            <span className="font-brand-primary font-semibold text-brand-midnight inline-flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pedido do cliente
            </span>
            {requestExpanded ? <ChevronUp className="w-4 h-4 text-brand-slate" /> : <ChevronDown className="w-4 h-4 text-brand-slate" />}
          </button>
          <div className={`space-y-3 mb-6 ${requestExpanded ? "" : "max-h-48 overflow-hidden"}`}>
            <div>
              <p className="text-xs text-brand-slate">Telemóvel</p>
              <p className="text-sm text-brand-midnight">
                {lead.telemovel?.trim() ? lead.telemovel.trim() : "Não indicado"}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-slate">Objetivo principal</p>
              <p className="text-sm text-brand-midnight">
                {String(lead.metadata?.objetivo_principal ?? "Não indicado")}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-slate">Utilizadores estimados</p>
              <p className="text-sm text-brand-midnight">
                {String(lead.metadata?.utilizadores_estimados ?? "Não indicado")}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-slate">Integrações</p>
              <p className="text-sm text-brand-midnight">{String(lead.metadata?.integracoes ?? "Não indicado")}</p>
            </div>
            <div>
              <p className="text-xs text-brand-slate">Descrição completa</p>
              <p className="text-sm text-brand-midnight whitespace-pre-line">
                {lead.descricao || "Sem descrição"}
              </p>
            </div>
          </div>
          {!requestExpanded && (
            <button
              onClick={() => setRequestExpanded(true)}
              className="text-xs text-brand-primary hover:underline mb-4"
            >
              Ver pedido completo
            </button>
          )}

          <h2 className="font-brand-primary font-semibold text-brand-midnight mb-4">Nova tarefa</h2>
          <div className="space-y-3">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Ex: Ligar para qualificação"
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
            />
            <input
              type="datetime-local"
              value={taskDueAt}
              onChange={(e) => setTaskDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
            />
            <button
              disabled={pending}
              onClick={() =>
                runAction(() =>
                  createLeadTask({
                    leadId: lead.id,
                    title: taskTitle,
                    dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
                    assignedUserId: lead.owner_user_id ?? null,
                  })
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-midnight text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Criar tarefa
            </button>
          </div>
        </div>
      </section>

      <section className="brand-card p-5">
        <h2 className="font-brand-primary font-semibold text-brand-midnight mb-2 inline-flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Histórico de correio
        </h2>
        {mailItems.length === 0 ? (
          <p className="text-sm text-brand-slate">Ainda não há mensagens de correio nesta lead.</p>
        ) : (
          <div className="space-y-3">
            {mailItems.map((item) => (
              <EmailHistoryRow
                key={item.id}
                item={item}
                expanded={!!emailBodyOpen[item.id]}
                onToggle={() =>
                  setEmailBodyOpen((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }))
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="brand-card p-5">
          <h2 className="font-brand-primary font-semibold text-brand-midnight mb-4">Tarefas</h2>
          <div className="space-y-3">
            {tasks.length === 0 && <p className="text-sm text-brand-slate">Sem tarefas associadas.</p>}
            {tasks.map((task) => (
              <div key={task.id} className="border border-brand-border rounded-lg p-3">
                <p className="text-sm text-brand-midnight">{task.title}</p>
                <p className="text-xs text-brand-slate mt-1">Estado: {task.status === "done" ? "Concluída" : "Pendente"}</p>
                <p className="text-xs text-brand-slate inline-flex items-center gap-1 mt-1">
                  <CalendarClock className="w-3 h-3" />
                  {formatDate(task.due_at)}
                </p>
                {task.status === "pending" && (
                  <button
                    disabled={pending}
                    onClick={() => runAction(() => completeLeadTask(task.id))}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-brand-success hover:underline"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Concluir
                  </button>
                )}
              </div>
            ))}
            {pendingTasks.length === 0 && tasks.length > 0 && (
              <p className="text-xs text-brand-slate">Todas as tarefas estão concluídas.</p>
            )}
          </div>
        </div>

        <div className="brand-card p-5">
          <h2 className="font-brand-primary font-semibold text-brand-midnight mb-4 inline-flex items-center gap-2">
            <History className="w-4 h-4" />
            Timeline de atividade
          </h2>
          <div className="space-y-3">
            {timeline.length === 0 && <p className="text-sm text-brand-slate">Sem atividade registada.</p>}
            {timeline.map((item) => {
              const payload = item.payload ?? {};
              const mailBody = emailPayloadBody(payload);
              const isMail = item.event_type === "email_sent" || item.event_type === "email_received";
              const bodyOpen = !!emailBodyOpen[item.id];
              return (
                <div key={item.id} className="border border-brand-border rounded-lg p-3">
                  <p className="text-sm text-brand-midnight inline-flex items-center gap-2">
                    <span className="text-brand-slate">{timelineIcon(item.event_type)}</span>
                    {timelineText(item.event_type, payload)}
                  </p>
                  <p className="text-xs text-brand-slate mt-1">{formatDate(item.created_at)}</p>
                  {isMail && mailBody && (
                    <button
                      type="button"
                      onClick={() =>
                        setEmailBodyOpen((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      className="mt-2 text-xs text-brand-primary hover:underline"
                    >
                      {bodyOpen ? "Ocultar corpo" : "Ver corpo"}
                    </button>
                  )}
                  {isMail && !mailBody && item.event_type === "email_sent" && (
                    <p className="text-xs text-brand-slate mt-2">Corpo não guardado (envio anterior à atualização).</p>
                  )}
                  {bodyOpen && mailBody && (
                    <pre className="mt-2 max-h-48 overflow-y-auto rounded-md border border-brand-border bg-brand-light/40 p-2 text-xs text-brand-midnight whitespace-pre-wrap break-words">
                      {mailBody}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
