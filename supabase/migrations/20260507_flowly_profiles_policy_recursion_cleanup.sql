-- ============================================
-- HOTFIX: limpeza de policies recursivas em profiles
-- ============================================

-- Remove policies antigas de profiles que fazem subquery à própria tabela
-- (padrão que causa "infinite recursion detected in policy").
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND (
        coalesce(qual, '') ILIKE '%from profiles%'
        OR coalesce(with_check, '') ILIKE '%from profiles%'
        OR policyname IN (
          'Utilizadores podem ver os seus próprios perfis e os perfis do ',
          'Utilizadores podem inserir o seu próprio perfil',
          'Utilizadores podem atualizar o seu próprio perfil'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Garantir conjunto mínimo e não-recursivo.
DROP POLICY IF EXISTS "profiles_internal_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

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

SELECT '✅ profiles recursion cleanup aplicado' AS status;
