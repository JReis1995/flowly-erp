"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  Plus,
  Send,
  UserCircle2,
  Workflow,
  CheckCircle,
} from "lucide-react";
import {
  assignLeadOwner,
  completeLeadTask,
  createLeadTask,
  moveLeadStage,
  sendLeadEmail,
  type CrmLeadRow,
  type CrmLeadTask,
  type CrmTimelineItem,
  type ProfileBasic,
} from "../../_actions/leads";

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

type EmailTemplate = {
  id: string;
  label: string;
  subject: string;
  message: (saudacao: string, nome: string, projeto: string) => string;
};

const stageOptions = [
  { id: "new", label: "Nova" },
  { id: "qualified", label: "Qualificada" },
  { id: "proposal", label: "Proposta" },
  { id: "won", label: "Ganha" },
  { id: "lost", label: "Perdida" },
] as const;

const emailTemplates: EmailTemplate[] = [
  {
    id: "primeiro-contacto",
    label: "Primeiro contacto",
    subject: "Flowly | Confirmação de receção do pedido",
    message: (saudacao, nome) =>
      `${saudacao} ${nome},\n\n\nObrigado pelo seu contacto.\nRecebemos o seu pedido e estamos a analisar o contexto que nos enviou.\n\nAté 2 dias úteis partilharemos a nossa recomendação comercial, com próximos passos objetivos.\n\nSe quiser acrescentar informação entretanto, basta responder a este email.`,
  },
  {
    id: "pedido-reuniao",
    label: "Pedido de reunião",
    subject: "Flowly | Proposta de reunião de alinhamento",
    message: (saudacao, nome) =>
      `${saudacao} ${nome},\n\n\nPara alinharmos prioridades e objetivos de negócio, propomos uma reunião de 20 a 30 minutos.\n\nPartilhe, por favor, 2 ou 3 horários disponíveis nos próximos dias para fazermos o agendamento.`,
  },
  {
    id: "followup-48h",
    label: "Follow-up 48h",
    subject: "Flowly | Seguimento do seu pedido",
    message: (saudacao, nome, projeto) =>
      `${saudacao} ${nome},\n\n\nNo seguimento do seu pedido para ${projeto}, queremos confirmar se continua a ser prioritário avançarmos nesta fase.\n\nSe fizer sentido para si, indique-nos o melhor horário para alinharmos os próximos passos.`,
  },
  {
    id: "envio-proposta",
    label: "Envio de proposta",
    subject: "Flowly | Envio de proposta comercial",
    message: (saudacao, nome, projeto) =>
      `${saudacao} ${nome},\n\n\nConforme alinhado, enviamos a proposta comercial para o projeto de ${projeto}.\n\nA proposta inclui âmbito de trabalho, abordagem de implementação, prazo estimado e condições comerciais.\n\nSe quiser, podemos agendar uma reunião breve para rever os pontos principais em conjunto.`,
  },
  {
    id: "lembrete-proposta",
    label: "Lembrete de proposta enviada",
    subject: "Flowly | Seguimento da proposta enviada",
    message: (saudacao, nome) =>
      `${saudacao} ${nome},\n\n\nRetomamos o contacto para dar seguimento à proposta enviada anteriormente.\n\nCaso tenha dúvidas, comentários ou necessidade de ajustes, estamos disponíveis para adaptar a proposta ao seu contexto.`,
  },
  {
    id: "pedido-info",
    label: "Pedido de informação adicional",
    subject: "Flowly | Informação complementar para avançarmos",
    message: (saudacao, nome, projeto) =>
      `${saudacao} ${nome},\n\n\nPara avançarmos com uma proposta mais precisa para ${projeto}, precisamos de alguns detalhes adicionais.\n\nEm particular: objetivos prioritários, número de utilizadores, integrações necessárias e prazo pretendido.\n\nCom esta informação, conseguimos apresentar-lhe uma proposta mais ajustada e objetiva.`,
  },
  {
    id: "fecho-ganho",
    label: "Confirmação de adjudicação",
    subject: "Flowly | Confirmação de arranque do projeto",
    message: (saudacao, nome, projeto) =>
      `${saudacao} ${nome},\n\n\nAgradecemos a confiança na Flowly.\nConfirmamos a adjudicação e o arranque do projeto de ${projeto}.\n\nNos próximos passos partilharemos plano de execução, calendarização e ponto de contacto principal da equipa.`,
  },
  {
    id: "fecho-perdido",
    label: "Fecho sem avanço (cortesia)",
    subject: "Flowly | Agradecimento pelo contacto",
    message: (saudacao, nome) =>
      `${saudacao} ${nome},\n\n\nObrigado pelo tempo e disponibilidade.\nCompreendemos que, neste momento, não seja a fase ideal para avançar.\n\nFicamos ao dispor para retomar o tema quando voltar a ser prioritário para a sua equipa.`,
  },
];

function getSaudacao(nome: string) {
  const first = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const femaleExceptions = new Set(["dia", "noa", "luca", "nikita"]);
  const isLikelyFemale = first.endsWith("a") && !femaleExceptions.has(first);
  return isLikelyFemale ? "Cara" : "Caro";
}

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
  const defaultTemplate = emailTemplates[0];
  const saudacao = getSaudacao(lead.nome);
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate.id);
  const [subject, setSubject] = useState(defaultTemplate.subject);
  const [message, setMessage] = useState(defaultTemplate.message(saudacao, lead.nome, lead.tipo_projeto));
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [requestExpanded, setRequestExpanded] = useState(false);

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
    const template = emailTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    setSubject(template.subject);
    setMessage(template.message(saudacao, lead.nome, lead.tipo_projeto));
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

  return (
    <div className="space-y-6">
      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {warning && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">{warning}</div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="brand-card p-4">
          <p className="text-xs text-brand-slate mb-1">Lead</p>
          <p className="text-sm font-semibold text-brand-midnight">{lead.nome}</p>
          <p className="text-xs text-brand-slate mt-1">{lead.email}</p>
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

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 brand-card p-5">
          <h2 className="font-brand-primary font-semibold text-brand-midnight mb-4">Enviar email (Resend)</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-brand-slate mb-1">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-lg bg-white text-sm"
              >
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
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
        <p className="text-xs text-brand-slate mb-4 max-w-3xl">
          Os envios feitos a partir desta página ficam com o texto completo guardado. Para as respostas da lead
          aparecerem aqui e uma cópia chegar à caixa comercial: no Resend, adiciona um Webhook com o evento{" "}
          <span className="font-mono text-brand-midnight">email.received</span> para{" "}
          <span className="font-mono text-brand-midnight break-all">/api/webhooks/resend</span>, define{" "}
          <span className="font-mono text-brand-midnight">RESEND_WEBHOOK_SECRET</span> no servidor (segredo do webhook) e
          garante domínio de receiving + MX à Resend em{" "}
          <span className="font-mono text-brand-midnight break-all">inbound.flowly.pt</span>. Opcional:{" "}
          <span className="font-mono text-brand-midnight">EMAIL_INBOUND_FORWARD_TO</span> para onde reencaminhar a cópia
          (por defeito usa a caixa da assinatura).
        </p>
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
