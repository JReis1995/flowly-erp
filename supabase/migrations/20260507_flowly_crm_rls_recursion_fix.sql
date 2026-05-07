-- ============================================
-- HOTFIX: evitar recursão infinita em RLS de profiles
-- ============================================

-- Função segura para validar operador interno sem recursão de policy.
-- SECURITY DEFINER permite avaliar role/email sem depender de policies ativas na própria tabela.
CREATE OR REPLACE FUNCTION public.is_internal_operator()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email text;
  current_role text;
BEGIN
  SELECT email INTO current_email
  FROM auth.users
  WHERE id = auth.uid();

  IF current_email IN ('josereis1995@gmail.com', 'jose.reis@flowly.pt') THEN
    RETURN true;
  END IF;

  -- Se existir função de admin Flowly, respeitar
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_flowly_admin'
  ) THEN
    IF public.is_flowly_admin() THEN
      RETURN true;
    END IF;
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN current_role IN ('superadmin', 'developer');
END;
$$;

REVOKE ALL ON FUNCTION public.is_internal_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_operator() TO authenticated;

-- Recriar policies de profiles sem subquery recursiva.
DROP POLICY IF EXISTS "profiles_flowly_staff_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;

CREATE POLICY "profiles_internal_all"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator());

CREATE POLICY "profiles_self_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_self_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Recriar policies do Bloco 3 para evitar dependência direta em subquery de profiles.
DROP POLICY IF EXISTS "crm_pipeline_stages_internal_all" ON public.crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_internal_all"
ON public.crm_pipeline_stages
FOR ALL
TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator());

DROP POLICY IF EXISTS "leads_inbound_internal_select_update" ON public.leads_inbound;
CREATE POLICY "leads_inbound_internal_select_update"
ON public.leads_inbound
FOR ALL
TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator());

DROP POLICY IF EXISTS "crm_lead_tasks_internal_all" ON public.crm_lead_tasks;
CREATE POLICY "crm_lead_tasks_internal_all"
ON public.crm_lead_tasks
FOR ALL
TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator());

DROP POLICY IF EXISTS "crm_lead_timeline_internal_all" ON public.crm_lead_timeline;
CREATE POLICY "crm_lead_timeline_internal_all"
ON public.crm_lead_timeline
FOR ALL
TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator());

SELECT '✅ Hotfix RLS recursion aplicado com sucesso' AS status;
