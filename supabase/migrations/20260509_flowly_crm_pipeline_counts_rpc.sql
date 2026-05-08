-- ============================================
-- BLOCO 4: uma única consulta agregada para métricas do pipeline CRM
-- (substitui N chamadas head count no cliente; respeita RLS como invoker)
-- ============================================

CREATE OR REPLACE FUNCTION public.flowly_crm_pipeline_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total',
      (SELECT count(*)::bigint FROM public.leads_inbound),
    'by_stage',
      (SELECT jsonb_build_object(
        'new', count(*) FILTER (WHERE stage_id = 'new'),
        'qualified', count(*) FILTER (WHERE stage_id = 'qualified'),
        'proposal', count(*) FILTER (WHERE stage_id = 'proposal'),
        'won', count(*) FILTER (WHERE stage_id = 'won'),
        'lost', count(*) FILTER (WHERE stage_id = 'lost')
      )
      FROM public.leads_inbound),
    'sla_risk_total',
      (SELECT count(*)::bigint
       FROM public.leads_inbound li
       WHERE li.next_action_at IS NULL
          OR li.next_action_at < (now() + interval '24 hours')),
    'pending_tasks_total',
      (SELECT count(*)::bigint
       FROM public.crm_lead_tasks t
       WHERE t.status = 'pending')
  );
$$;

REVOKE ALL ON FUNCTION public.flowly_crm_pipeline_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flowly_crm_pipeline_counts() TO authenticated;

SELECT '✅ flowly_crm_pipeline_counts aplicado' AS status;
