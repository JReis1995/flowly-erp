import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCrmLeadDetail } from "../../_actions/leads";
import LeadDetailClient from "./LeadDetailClient";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCrmLeadDetail(id);

  if (!result.data.lead && result.notFound) notFound();
  if (!result.data.lead) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {result.error ?? "Não foi possível carregar o detalhe da lead."}
        </div>
        <Link
          href="/central-saas/leads"
          className="inline-flex items-center gap-2 text-brand-slate hover:text-brand-primary transition-colors font-brand-secondary text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao CRM de Leads
        </Link>
      </div>
    );
  }

  const { lead, owner, owners, tasks, timeline } = result.data;
  const baseReplyTo = process.env.EMAIL_REPLY_TO_COMERCIAL || "comercial@inbound.flowly.pt";
  const [localPart, domainPart] = baseReplyTo.split("@");
  const replyToAddress =
    localPart && domainPart ? `${localPart}+lead-${lead.id.slice(0, 8)}@${domainPart}` : baseReplyTo;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Link
          href="/central-saas/leads"
          className="inline-flex items-center gap-2 text-brand-slate hover:text-brand-primary transition-colors mb-4 font-brand-secondary text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao CRM de Leads
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand-primary font-bold text-3xl text-brand-midnight">{lead.nome}</h1>
            <p className="text-brand-slate mt-2 font-brand-secondary">{lead.email}</p>
          </div>
        </div>
      </div>

      {result.error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{result.error}</div>}

      <LeadDetailClient
        lead={lead}
        owner={owner}
        owners={owners}
        tasks={tasks}
        timeline={timeline}
        replyToAddress={replyToAddress}
      />
    </div>
  );
}
