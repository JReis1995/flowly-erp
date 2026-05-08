"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, Mail, Trash2, X } from "lucide-react";
import type { EmailTemplateKind } from "@/lib/crm/composeCrmEmail";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  previewEmailTemplateDraft,
  previewSavedEmailTemplate,
  updateEmailTemplate,
  type CrmEmailTemplateRow,
} from "../../_actions/emailTemplates";

const PLACEHOLDERS =
  "Variáveis: {{nome}}, {{primeiro_nome}}, {{empresa}}, {{projeto}}. A saudação é acrescentada ao corpo; no envio real junta-se também a assinatura Flowly (telefone, email, site), igual à pré-visualização «Email completo».";

function emptyForm(kind: EmailTemplateKind) {
  return {
    slug: "",
    label: "",
    subject_template: "",
    body_template: "",
    area_label: "",
    sort_order: 0,
    kind,
  };
}

export default function EmailTemplatesClient() {
  const [tab, setTab] = useState<EmailTemplateKind>("prospeccao");
  const [rows, setRows] = useState<CrmEmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm("prospeccao"));

  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBody, setPreviewBody] = useState("");
  const [previewFullPlain, setPreviewFullPlain] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [listPreviewOpen, setListPreviewOpen] = useState(false);
  const [listPreviewTitle, setListPreviewTitle] = useState("");
  const [listPreviewLoading, setListPreviewLoading] = useState(false);
  const [listPreviewSubject, setListPreviewSubject] = useState("");
  const [listPreviewBody, setListPreviewBody] = useState("");
  const [listPreviewFull, setListPreviewFull] = useState("");

  const load = useCallback(async (kind: EmailTemplateKind) => {
    setError(null);
    setLoading(true);
    const { data, error: err } = await listEmailTemplates(kind);
    setLoading(false);
    if (err) {
      setError(err);
      setRows([]);
      return;
    }
    setRows(data);
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  useEffect(() => {
    setForm((f) => ({ ...f, kind: tab }));
    setEditingId(null);
    setCreateOpen(false);
  }, [tab]);

  function startEdit(row: CrmEmailTemplateRow) {
    setEditingId(row.id);
    setCreateOpen(false);
    setForm({
      kind: row.kind,
      slug: row.slug,
      label: row.label,
      subject_template: row.subject_template,
      body_template: row.body_template,
      area_label: row.area_label ?? "",
      sort_order: row.sort_order,
    });
  }

  async function runPreview() {
    setPreviewLoading(true);
    setError(null);
    const { subject, plainBody, fullPlainText, error: prevErr } = await previewEmailTemplateDraft({
      kind: tab,
      subject_template: form.subject_template,
      body_template: form.body_template,
    });
    setPreviewLoading(false);
    if (prevErr) {
      setError(prevErr);
      return;
    }
    setPreviewSubject(subject);
    setPreviewBody(plainBody);
    setPreviewFullPlain(fullPlainText);
  }

  async function openListPreview(row: CrmEmailTemplateRow) {
    setListPreviewOpen(true);
    setListPreviewTitle(row.label);
    setListPreviewLoading(true);
    setListPreviewSubject("");
    setListPreviewBody("");
    setListPreviewFull("");
    setError(null);
    const res = await previewSavedEmailTemplate(row.id);
    setListPreviewLoading(false);
    if (res.error) {
      setError(res.error);
      setListPreviewOpen(false);
      return;
    }
    setListPreviewSubject(res.subject);
    setListPreviewBody(res.plainBody);
    setListPreviewFull(res.fullPlainText);
  }

  function submitSave() {
    startTransition(async () => {
      setError(null);
      if (createOpen) {
        const res = await createEmailTemplate({
          kind: tab,
          slug: form.slug,
          label: form.label,
          subject_template: form.subject_template,
          body_template: form.body_template,
          area_label: form.area_label || null,
          sort_order: form.sort_order,
        });
        if (!res.success) {
          setError(res.error ?? "Erro ao criar.");
          return;
        }
        setCreateOpen(false);
        setForm(emptyForm(tab));
      } else if (editingId) {
        const res = await updateEmailTemplate(editingId, {
          label: form.label,
          subject_template: form.subject_template,
          body_template: form.body_template,
          area_label: form.area_label || null,
          sort_order: form.sort_order,
        });
        if (!res.success) {
          setError(res.error ?? "Erro ao guardar.");
          return;
        }
        setEditingId(null);
      }
      await load(tab);
    });
  }

  function confirmDelete(id: string, label: string) {
    if (!window.confirm(`Eliminar o modelo «${label}»?`)) return;
    startTransition(async () => {
      setError(null);
      const res = await deleteEmailTemplate(id);
      if (!res.success) {
        setError(res.error ?? "Erro ao eliminar.");
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm(tab));
      }
      await load(tab);
    });
  }

  const showForm = createOpen || editingId !== null;

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/central-saas/leads"
        className="inline-flex items-center gap-2 text-brand-slate hover:text-brand-primary transition-colors mb-4 font-brand-secondary text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao CRM de Leads
      </Link>

      <div className="mb-8">
        <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">Modelos de email CRM</h1>
        <p className="text-brand-slate mt-2 font-brand-secondary max-w-2xl">
          Prospecção em massa e follow-up no detalhe da lead. {PLACEHOLDERS}
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("prospeccao")}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${
            tab === "prospeccao"
              ? "bg-brand-primary text-white border-brand-primary"
              : "bg-white text-brand-midnight border-brand-border hover:bg-brand-light"
          }`}
        >
          Prospecção
        </button>
        <button
          type="button"
          onClick={() => setTab("follow_up")}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${
            tab === "follow_up"
              ? "bg-brand-primary text-white border-brand-primary"
              : "bg-white text-brand-midnight border-brand-border hover:bg-brand-light"
          }`}
        >
          Follow-up
        </button>
      </div>

      <div className="brand-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm text-brand-slate">
          <Mail className="w-4 h-4 text-brand-primary" />
          <span>{rows.length} modelo(s) neste separador</span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setCreateOpen(true);
            setEditingId(null);
            setForm(emptyForm(tab));
            setPreviewSubject("");
            setPreviewBody("");
            setPreviewFullPlain("");
          }}
          className="px-4 py-2 rounded-lg bg-brand-midnight text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Novo modelo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-brand-slate py-12 justify-center">
          <Loader2 className="w-6 h-6 animate-spin" /> A carregar…
        </div>
      ) : (
        <ul className="space-y-3 mb-8">
          {rows.map((row) => (
            <li
              key={row.id}
              className="brand-card p-4 flex flex-wrap items-start justify-between gap-3 border border-brand-border"
            >
              <div>
                <p className="font-semibold text-brand-midnight">{row.label}</p>
                <p className="text-xs text-brand-slate font-mono mt-1">
                  {row.slug}
                  {row.area_label ? ` · ${row.area_label}` : ""} · ordem {row.sort_order}
                </p>
                <p className="text-sm text-brand-slate mt-2 line-clamp-2">{row.subject_template}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void openListPreview(row)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-primary/40 text-brand-primary text-sm hover:bg-brand-light"
                >
                  <Eye className="w-4 h-4" />
                  Email completo
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startEdit(row)}
                  className="px-3 py-1.5 rounded-lg border border-brand-border text-sm hover:bg-brand-light"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirmDelete(row.id, row.label)}
                  className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-brand-slate py-6 text-center">Nenhum modelo neste separador.</p>
          )}
        </ul>
      )}

      {showForm && (
        <div className="brand-card p-6 border-2 border-brand-primary/20">
          <h2 className="font-brand-primary font-semibold text-lg text-brand-midnight mb-4">
            {createOpen ? "Novo modelo" : "Editar modelo"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {createOpen && (
              <div className="md:col-span-2">
                <label className="block text-xs text-brand-slate mb-1">Slug (único, minúsculas e hífens)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm font-mono"
                  placeholder="ex.: followup-reuniao"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs text-brand-slate mb-1">Nome / etiqueta</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-slate mb-1">Área (opcional)</label>
              <input
                value={form.area_label}
                onChange={(e) => setForm((f) => ({ ...f, area_label: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                placeholder="ex.: CRM"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-slate mb-1">Ordem</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-brand-slate mb-1">Assunto (template)</label>
              <input
                value={form.subject_template}
                onChange={(e) => setForm((f) => ({ ...f, subject_template: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-brand-slate mb-1">Corpo (template)</label>
              <textarea
                value={form.body_template}
                onChange={(e) => setForm((f) => ({ ...f, body_template: e.target.value }))}
                rows={10}
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || previewLoading}
              onClick={() => void runPreview()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-primary text-brand-primary text-sm font-medium hover:bg-brand-light"
            >
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Pré-visualizar (com assinatura)
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={submitSave}
              className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90"
            >
              Guardar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCreateOpen(false);
                setEditingId(null);
                setForm(emptyForm(tab));
                setPreviewSubject("");
                setPreviewBody("");
                setPreviewFullPlain("");
              }}
              className="px-4 py-2 rounded-lg border border-brand-border text-sm"
            >
              Cancelar
            </button>
          </div>

          {(previewSubject || previewBody || previewFullPlain) && (
            <div className="mt-6 border-t border-brand-border pt-4 space-y-5">
              <div>
                <p className="text-xs font-semibold text-brand-midnight mb-1">Email completo — texto enviado ao cliente</p>
                <p className="text-xs text-brand-slate mb-2">
                  Inclui assunto, mensagem com saudação e rodapé «Equipa Flowly» (como na versão texto do Resend). A versão HTML
                  acrescenta logótipo e dados de contacto completos.
                </p>
                <pre className="max-h-72 overflow-y-auto rounded-lg border border-brand-border bg-white p-3 text-sm whitespace-pre-wrap border-l-4 border-l-brand-primary">
                  {previewFullPlain || `${previewSubject}\n\n${previewBody}`}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-midnight mb-1">Só a mensagem (saudação + corpo do modelo)</p>
                <pre className="max-h-48 overflow-y-auto rounded-lg border border-brand-border bg-brand-light/50 p-3 text-sm whitespace-pre-wrap">
                  {previewBody}
                </pre>
              </div>
              <p className="text-xs text-brand-slate">
                Amostra de dados: Maria Silva · Silva &amp; Filhos, Lda. · Operações e logística (editável nas variáveis do
                modelo).
              </p>
            </div>
          )}
        </div>
      )}

      {listPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true">
          <div className="brand-card max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl border border-brand-border">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-brand-border bg-brand-light/40">
              <div>
                <p className="text-xs text-brand-slate uppercase tracking-wide">Pré-visualização</p>
                <h3 className="font-brand-primary font-semibold text-brand-midnight">{listPreviewTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setListPreviewOpen(false)}
                className="p-2 rounded-lg hover:bg-brand-border/60 text-brand-slate"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {listPreviewLoading ? (
                <div className="flex items-center gap-2 text-brand-slate py-12 justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" /> A montar pré-visualização…
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-brand-midnight mb-1">Assunto</p>
                    <p className="text-sm text-brand-midnight">{listPreviewSubject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-midnight mb-1">Email completo (texto)</p>
                    <pre className="max-h-[min(50vh,420px)] overflow-y-auto rounded-lg border border-brand-border bg-white p-3 text-sm whitespace-pre-wrap border-l-4 border-l-brand-primary">
                      {listPreviewFull}
                    </pre>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-brand-primary font-medium">Ver só saudação + corpo</summary>
                    <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-brand-border bg-brand-light/50 p-3 whitespace-pre-wrap text-xs">
                      {listPreviewBody}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
