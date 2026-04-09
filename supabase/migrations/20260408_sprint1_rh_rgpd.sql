-- ============================================================================
-- Flowly ERP — Sprint 1 RH / RGPD (SQL Editor Supabase)
-- Leitura base: supabase/schema/supabase_schema.txt
-- Regra de ouro: sem DROP TABLE; tabelas existentes evoluem com ALTER.
--
-- Estado conhecido:
--   - employees: já tem insurance_value, vencimento_base, subsidio_alimentacao
--   - timesheets: já existe (entry_timestamp, status legado, device_info jsonb)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Pré-requisito RLS: ligação auth.users ↔ employees (se ainda não existir)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees (user_id);

COMMENT ON COLUMN public.employees.user_id IS
  'auth.users.id do colaborador; necessário para RLS “só os meus dados”.';

-- ---------------------------------------------------------------------------
-- 1) employees — colunas financeiras Sprint 1 (aditivas)
--    insurance_value já existe no schema atual → não recriar.
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS base_salary numeric,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric,
  ADD COLUMN IF NOT EXISTS contract_start_date date;

COMMENT ON COLUMN public.employees.base_salary IS
  'Vencimento base (Sprint 1); convive com vencimento_base legado até migração de dados.';
COMMENT ON COLUMN public.employees.meal_allowance IS
  'Subsídio refeição (Sprint 1); convive com subsidio_alimentacao legado até migração.';
COMMENT ON COLUMN public.employees.contract_start_date IS
  'Início contratual explícito RGPD/RH; pode alinhar com data_admissao.';

-- ---------------------------------------------------------------------------
-- 2) timesheets — enum pendente/aprovado + timestamps dedicados
--    A coluna legada "status" (outro tipo) mantém-se; evita quebra de produção.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timesheet_rgpd_status') THEN
    CREATE TYPE public.timesheet_rgpd_status AS ENUM ('pendente', 'aprovado');
  END IF;
END
$$;

-- Bootstrap mínimo se ainda não houver tabela (instalações novas)
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  timestamp_in timestamptz,
  timestamp_out timestamptz,
  location_data jsonb,
  device_info text,
  rgpd_status public.timesheet_rgpd_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS timestamp_in timestamptz,
  ADD COLUMN IF NOT EXISTS timestamp_out timestamptz;

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS rgpd_status public.timesheet_rgpd_status NOT NULL DEFAULT 'pendente';

-- Texto paralelo ao jsonb legado (schema atual tem device_info jsonb)
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS device_info_text text;

COMMENT ON COLUMN public.timesheets.rgpd_status IS
  'Estado pendente/aprovado (Sprint 1 RGPD). Coluna "status" legada mantida.';
COMMENT ON COLUMN public.timesheets.device_info_text IS
  'Versão texto do dispositivo; use device_info (jsonb) legado ou esta coluna.';

-- ---------------------------------------------------------------------------
-- 3) audit_logs — registo de atividades para RGPD (art. 30 RGPD / accountability)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  logged_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_logged_at ON public.audit_logs (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);

COMMENT ON TABLE public.audit_logs IS
  'Trilho de auditoria de acessos/alterações a dados pessoais (base para RGPD).';
COMMENT ON COLUMN public.audit_logs.logged_at IS
  'Momento do evento (equivalente a "timestamp" pedido no sprint; nome evita palavra reservada).';

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas audit_logs: ver secção 4b (após funções auxiliares).

-- ---------------------------------------------------------------------------
-- 4) Funções auxiliares RLS (SECURITY INVOKER — respeita RLS em profiles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.rh_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superadmin'
  );
$$;

-- Bypass total RLS RH/Storage: alinhado à app (impersonate, central-saas, etc.)
CREATE OR REPLACE FUNCTION public.rh_rls_platform_bypass()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.rh_is_any_company_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'gestor'
        AND pr.tenant_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.gestor_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('admin', 'gestor')
    );
$$;

CREATE OR REPLACE FUNCTION public.rh_user_manages_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.tenant_id = p_company_id
        AND pr.role = 'gestor'
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = p_company_id
        AND t.gestor_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = p_company_id
        AND tu.role IN ('admin', 'gestor')
    );
$$;

-- ---------------------------------------------------------------------------
-- 4b) RLS — audit_logs (após funções)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS rh_audit_logs_superadmin_all ON public.audit_logs;
CREATE POLICY rh_audit_logs_superadmin_all
  ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (public.rh_rls_platform_bypass())
  WITH CHECK (public.rh_rls_platform_bypass());

-- Gestores: INSERT com actor = utilizador atual (trilho RGPD no cliente)
DROP POLICY IF EXISTS rh_audit_logs_manager_insert ON public.audit_logs;
CREATE POLICY rh_audit_logs_manager_insert
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.rh_is_any_company_manager()
  );

-- Inserções genéricas / jobs: service_role ou RPC SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 5) RLS — employees
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_employees_superadmin_all ON public.employees;
CREATE POLICY rh_employees_superadmin_all
  ON public.employees
  FOR ALL
  TO authenticated
  USING (public.rh_rls_platform_bypass())
  WITH CHECK (public.rh_rls_platform_bypass());

DROP POLICY IF EXISTS rh_employees_collab_select ON public.employees;
CREATE POLICY rh_employees_collab_select
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    public.rh_current_profile_role() = 'colaborador'
    AND user_id IS NOT NULL
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS rh_employees_manager_select ON public.employees;
CREATE POLICY rh_employees_manager_select
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    public.rh_user_manages_company(company_id)
  );

DROP POLICY IF EXISTS rh_employees_manager_update ON public.employees;
CREATE POLICY rh_employees_manager_update
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (public.rh_user_manages_company(company_id))
  WITH CHECK (public.rh_user_manages_company(company_id));

-- Inserção de fichas por gestores da empresa (ajustar se usarem service role)
DROP POLICY IF EXISTS rh_employees_manager_insert ON public.employees;
CREATE POLICY rh_employees_manager_insert
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rh_user_manages_company(company_id));

-- ---------------------------------------------------------------------------
-- 6) RLS — timesheets
-- ---------------------------------------------------------------------------
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_timesheets_superadmin_all ON public.timesheets;
CREATE POLICY rh_timesheets_superadmin_all
  ON public.timesheets
  FOR ALL
  TO authenticated
  USING (public.rh_rls_platform_bypass())
  WITH CHECK (public.rh_rls_platform_bypass());

DROP POLICY IF EXISTS rh_timesheets_collab_select ON public.timesheets;
CREATE POLICY rh_timesheets_collab_select
  ON public.timesheets
  FOR SELECT
  TO authenticated
  USING (
    public.rh_current_profile_role() = 'colaborador'
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = timesheets.employee_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rh_timesheets_manager_select ON public.timesheets;
CREATE POLICY rh_timesheets_manager_select
  ON public.timesheets
  FOR SELECT
  TO authenticated
  USING (public.rh_user_manages_company(company_id));

DROP POLICY IF EXISTS rh_timesheets_manager_update ON public.timesheets;
CREATE POLICY rh_timesheets_manager_update
  ON public.timesheets
  FOR UPDATE
  TO authenticated
  USING (public.rh_user_manages_company(company_id))
  WITH CHECK (public.rh_user_manages_company(company_id));

-- Colaborador regista ponto (INSERT) — necessário para fluxo real; SELECT sozinho bloqueava uso.
DROP POLICY IF EXISTS rh_timesheets_collab_insert ON public.timesheets;
CREATE POLICY rh_timesheets_collab_insert
  ON public.timesheets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.rh_current_profile_role() = 'colaborador'
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = timesheets.employee_id
        AND e.user_id = auth.uid()
        AND e.company_id = timesheets.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Storage — buckets (privados) + RLS em storage.objects
--    Convenção de pastas: {company_id}/{employee_id}/...
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('contracts', 'contracts', false),
  ('medical_leaves', 'medical_leaves', false),
  ('payslips', 'payslips', false),
  ('templates', 'templates', false)
ON CONFLICT (id) DO NOTHING;

-- superadmin / developer: acesso total aos 4 buckets
DROP POLICY IF EXISTS rh_storage_superadmin_all ON storage.objects;
CREATE POLICY rh_storage_superadmin_all
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    public.rh_rls_platform_bypass()
    AND bucket_id IN ('contracts', 'medical_leaves', 'payslips', 'templates')
  )
  WITH CHECK (
    public.rh_rls_platform_bypass()
    AND bucket_id IN ('contracts', 'medical_leaves', 'payslips', 'templates')
  );

-- Gestor: CRUD dentro da pasta da empresa (1º segmento = company_id UUID)
DROP POLICY IF EXISTS rh_storage_manager_rw ON storage.objects;
CREATE POLICY rh_storage_manager_rw
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id IN ('contracts', 'medical_leaves', 'payslips', 'templates')
    AND public.rh_user_manages_company((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id IN ('contracts', 'medical_leaves', 'payslips', 'templates')
    AND public.rh_user_manages_company((storage.foldername(name))[1]::uuid)
  );

-- Colaborador: só a sua pasta {company_id}/{employee_id}/
DROP POLICY IF EXISTS rh_storage_collab_rw ON storage.objects;
CREATE POLICY rh_storage_collab_rw
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id IN ('contracts', 'medical_leaves', 'payslips')
    AND public.rh_current_profile_role() = 'colaborador'
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.company_id::text = (storage.foldername(name))[1]
        AND e.id::text = (storage.foldername(name))[2]
    )
  )
  WITH CHECK (
    bucket_id IN ('contracts', 'medical_leaves', 'payslips')
    AND public.rh_current_profile_role() = 'colaborador'
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.company_id::text = (storage.foldername(name))[1]
        AND e.id::text = (storage.foldername(name))[2]
    )
  );

-- templates: gestores + platform bypass (sem política collab acima para este bucket)
