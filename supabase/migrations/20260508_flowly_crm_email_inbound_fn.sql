-- Resolve lead by primeiro bloco do UUID (8 hex), alinhado ao reply-to comercial+lead-{8chars}@...
-- Executável só por service_role (evita abuso via cliente anon/auth).

CREATE OR REPLACE FUNCTION public.flowly_match_lead_id_prefix(p_prefix text)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT li.id
  FROM public.leads_inbound li
  WHERE lower(li.id::text) LIKE lower(p_prefix) || '%';
$$;

REVOKE ALL ON FUNCTION public.flowly_match_lead_id_prefix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flowly_match_lead_id_prefix(text) TO service_role;
