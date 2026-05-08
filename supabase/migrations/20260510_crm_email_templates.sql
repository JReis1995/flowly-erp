-- Templates editáveis para prospecção e follow-up (corpo sem assinatura HTML — gerida em Resend/email.ts).

CREATE TABLE IF NOT EXISTS public.crm_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('prospeccao', 'follow_up')),
  slug text NOT NULL,
  label text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  area_label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug)
);

CREATE INDEX IF NOT EXISTS idx_crm_email_templates_kind_sort ON public.crm_email_templates (kind, sort_order);

CREATE OR REPLACE FUNCTION public.set_crm_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_email_templates_updated_at ON public.crm_email_templates;
CREATE TRIGGER trg_crm_email_templates_updated_at
  BEFORE UPDATE ON public.crm_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_crm_email_templates_updated_at();

ALTER TABLE public.crm_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_email_templates_internal_all" ON public.crm_email_templates;
CREATE POLICY "crm_email_templates_internal_all"
ON public.crm_email_templates
FOR ALL TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator());

-- ---------- Prospecção (Olá {{primeiro_nome}} + corpo; variáveis: primeiro_nome, nome, empresa) ----------
INSERT INTO public.crm_email_templates (kind, slug, label, area_label, sort_order, subject_template, body_template)
VALUES
(
  'prospeccao',
  'prospeccao-crm',
  'Introdução — CRM e pipeline',
  'CRM',
  10,
  'Flowly | CRM comercial e acompanhamento de oportunidades',
  $$Na Flowly ajudamos equipas comerciais a ter um pipeline claro: leads qualificadas, próximos passos visíveis e menos folhas de cálculo à mistura.

Se fizer sentido, posso enviar-te um exemplo de como organizamos funil, tarefas e histórico por conta — sem compromisso.$$
),
(
  'prospeccao',
  'prospeccao-app-operacional',
  'Introdução — App operacional',
  'Operações',
  20,
  'Flowly | Software à medida para operações do dia a dia',
  $$Trabalhamos com organizações que precisam de uma aplicação operacional estável — escalas, pedidos, estado de serviço, ou outro fluxo que hoje ainda depende de emails e ficheiros isolados.

Se quiseres, indico como costumamos arrancar (âmbito, prazo indicativo e próximo passo).$$
),
(
  'prospeccao',
  'prospeccao-gestao-filas',
  'Introdução — Gestão de filas',
  'Filas',
  30,
  'Flowly | Filas de trabalho e atendimento mais previsível',
  $$Gerir filas e pedidos sem uma visão única custa tempo e erros. Ajudamos a desenhar filas, prioridades e visibilidade para equipas de operações e apoio.

Se for relevante para {{empresa}}, digo-te como abordamos isto na prática.$$
),
(
  'prospeccao',
  'prospeccao-website-corporativo',
  'Introdução — Presença web',
  'Web',
  40,
  'Flowly | Site credível e preparado para gerar pedidos',
  $$Além de presença online, importa que o site converta visitas em contactos qualificados — mensagens claras, provas de confiança e CTAs objetivos.

Posso partilhar como ligamos isto ao vosso processo comercial quando fizer sentido.$$
),
(
  'prospeccao',
  'prospeccao-ecommerce',
  'Introdução — E-commerce',
  'E-commerce',
  50,
  'Flowly | E-commerce e operações ligadas ao negócio',
  $$Para vendas online, o desafio costuma ser operação + stock + comunicação com clientes sem sistemas desligados entre si.

A Flowly pode ajudar a definir um caminho integrado — diz-me se queres uma conversa exploratória breve.$$
),
(
  'prospeccao',
  'prospeccao-sistema-gestao',
  'Introdução — Sistema de gestão',
  'Gestão',
  60,
  'Flowly | Sistema de gestão sob medida (menos ferramentas soltas)',
  $$Quando a informação está espalhada por várias ferramentas, perde-se velocidade e controlo. Desenhamos sistemas de gestão à medida do processo real da empresa — não o contrário.

Se {{empresa}} está a sentir esse atrito, posso sugerir um próximo passo simples.$$
),
(
  'prospeccao',
  'prospeccao-automacoes-integracoes',
  'Introdução — Automações e integrações',
  'Integrações',
  70,
  'Flowly | Automações e integrações entre sistemas',
  $$Automatizar passos repetitivos e ligar ERP, CRM, email ou APIs liberta equipas para trabalho de maior valor.

Na Flowly tratamos de integrações com critério de robustez — se tiveres um caso concreto, posso indicar como avaliamos esforço e risco.$$
),
(
  'prospeccao',
  'prospeccao-generico',
  'Introdução — Flowly genérico',
  'Genérico',
  80,
  'Flowly | Software de operações e produto à medida',
  $$A Flowly desenvolve software orientado a operações — desde CRM interno a módulos sectoriais e integrações.

Se {{empresa}} está a avaliar digitalizar ou substituir processos manuais, ficamos disponíveis para uma primeira conversa curta.$$
)
ON CONFLICT (kind, slug) DO NOTHING;

-- ---------- Follow-up (Caro/Cara + nome via código + corpo; variáveis: nome, primeiro_nome, empresa, projeto) ----------
INSERT INTO public.crm_email_templates (kind, slug, label, area_label, sort_order, subject_template, body_template)
VALUES
(
  'follow_up',
  'primeiro-contacto',
  'Primeiro contacto',
  NULL,
  100,
  'Flowly | Confirmação de receção do pedido',
  $$Obrigado pelo seu contacto.

Recebemos o seu pedido e estamos a analisar o contexto que nos enviou.

Até 2 dias úteis partilharemos a nossa recomendação comercial, com próximos passos objetivos.

Se quiser acrescentar informação entretanto, basta responder a este email.$$
),
(
  'follow_up',
  'pedido-reuniao',
  'Pedido de reunião',
  NULL,
  110,
  'Flowly | Proposta de reunião de alinhamento',
  $$Para alinharmos prioridades e objetivos de negócio, propomos uma reunião de 20 a 30 minutos.

Partilhe, por favor, 2 ou 3 horários disponíveis nos próximos dias para fazermos o agendamento.$$
),
(
  'follow_up',
  'followup-48h',
  'Follow-up 48h',
  NULL,
  120,
  'Flowly | Seguimento do seu pedido',
  $$No seguimento do seu pedido para {{projeto}}, queremos confirmar se continua a ser prioritário avançarmos nesta fase.

Se fizer sentido para si, indique-nos o melhor horário para alinharmos os próximos passos.$$
),
(
  'follow_up',
  'envio-proposta',
  'Envio de proposta',
  NULL,
  130,
  'Flowly | Envio de proposta comercial',
  $$Conforme alinhado, enviamos a proposta comercial para o projeto de {{projeto}}.

A proposta inclui âmbito de trabalho, abordagem de implementação, prazo estimado e condições comerciais.

Se quiser, podemos agendar uma reunião breve para rever os pontos principais em conjunto.$$
),
(
  'follow_up',
  'lembrete-proposta',
  'Lembrete de proposta enviada',
  NULL,
  140,
  'Flowly | Seguimento da proposta enviada',
  $$Retomamos o contacto para dar seguimento à proposta enviada anteriormente.

Caso tenha dúvidas, comentários ou necessidade de ajustes, estamos disponíveis para adaptar a proposta ao seu contexto.$$
),
(
  'follow_up',
  'pedido-info',
  'Pedido de informação adicional',
  NULL,
  150,
  'Flowly | Informação complementar para avançarmos',
  $$Para avançarmos com uma proposta mais precisa para {{projeto}}, precisamos de alguns detalhes adicionais.

Em particular: objetivos prioritários, número de utilizadores, integrações necessárias e prazo pretendido.

Com esta informação, conseguimos apresentar-lhe uma proposta mais ajustada e objetiva.$$
),
(
  'follow_up',
  'fecho-ganho',
  'Confirmação de adjudicação',
  NULL,
  160,
  'Flowly | Confirmação de arranque do projeto',
  $$Agradecemos a confiança na Flowly.
Confirmamos a adjudicação e o arranque do projeto de {{projeto}}.

Nos próximos passos partilharemos plano de execução, calendarização e ponto de contacto principal da equipa.$$
),
(
  'follow_up',
  'fecho-perdido',
  'Fecho sem avanço (cortesia)',
  NULL,
  170,
  'Flowly | Agradecimento pelo contacto',
  $$Obrigado pelo tempo e disponibilidade.
Compreendemos que, neste momento, não seja a fase ideal para avançar.

Ficamos ao dispor para retomar o tema quando voltar a ser prioritário para a sua equipa.$$
)
ON CONFLICT (kind, slug) DO NOTHING;

SELECT 'crm_email_templates aplicado' AS status;
