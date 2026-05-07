-- ============================================
-- BLOCO 3 (MVP CRM): dados base para triagem
-- ============================================

-- Etapas de pipeline CRM
CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id text PRIMARY KEY,
  label text NOT NULL,
  position integer NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_pipeline_stages (id, label, position, is_closed)
VALUES
  ('new', 'Nova', 1, false),
  ('qualified', 'Qualificada', 2, false),
  ('proposal', 'Proposta', 3, false),
  ('won', 'Ganha', 4, true),
  ('lost', 'Perdida', 5, true)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    position = EXCLUDED.position,
    is_closed = EXCLUDED.is_closed;

-- Extensão da tabela inbound existente para operação comercial
ALTER TABLE public.leads_inbound
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id text REFERENCES public.crm_pipeline_stages(id) ON DELETE RESTRICT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS first_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.leads_inbound
SET stage_id = estado
WHERE stage_id IS NULL
  AND estado IN ('new', 'qualified', 'proposal', 'won', 'lost');

UPDATE public.leads_inbound
SET stage_id = 'new'
WHERE stage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_inbound_stage_id
  ON public.leads_inbound (stage_id);

CREATE INDEX IF NOT EXISTS idx_leads_inbound_owner_user_id
  ON public.leads_inbound (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_leads_inbound_next_action_at
  ON public.leads_inbound (next_action_at);

-- Trigger para updated_at em leads
CREATE OR REPLACE FUNCTION public.set_leads_inbound_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_leads_inbound_updated_at ON public.leads_inbound;
CREATE TRIGGER trg_set_leads_inbound_updated_at
BEFORE UPDATE ON public.leads_inbound
FOR EACH ROW
EXECUTE FUNCTION public.set_leads_inbound_updated_at();

-- Tarefas por lead
CREATE TABLE IF NOT EXISTS public.crm_lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads_inbound(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_tasks_lead
  ON public.crm_lead_tasks (lead_id, status, due_at);

-- Timeline de atividade comercial
CREATE TABLE IF NOT EXISTS public.crm_lead_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads_inbound(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_timeline_lead_created
  ON public.crm_lead_timeline (lead_id, created_at DESC);

-- RLS e políticas para área interna (superadmin/developer)
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_pipeline_stages_internal_all" ON public.crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_internal_all"
ON public.crm_pipeline_stages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
);

DROP POLICY IF EXISTS "leads_inbound_internal_select_update" ON public.leads_inbound;
CREATE POLICY "leads_inbound_internal_select_update"
ON public.leads_inbound
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
);

DROP POLICY IF EXISTS "crm_lead_tasks_internal_all" ON public.crm_lead_tasks;
CREATE POLICY "crm_lead_tasks_internal_all"
ON public.crm_lead_tasks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
);

DROP POLICY IF EXISTS "crm_lead_timeline_internal_all" ON public.crm_lead_timeline;
CREATE POLICY "crm_lead_timeline_internal_all"
ON public.crm_lead_timeline
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  )
);

-- Nota rápida de migração
SELECT '✅ Bloco 3 CRM MVP (dados base) aplicado com sucesso' AS status;
