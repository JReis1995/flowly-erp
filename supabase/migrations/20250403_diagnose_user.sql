-- ============================================
-- DIAGNÓSTICO: Verificar utilizador geral@flowly.pt
-- ============================================

-- 1. Verificar se existe em auth.users
SELECT 'auth.users' as tabela, id::text, email, created_at, encrypted_password IS NOT NULL as tem_senha
FROM auth.users 
WHERE email = 'geral@flowly.pt';

-- 2. Verificar se existe em tenants
SELECT 'tenants' as tabela, id::text, nome_empresa, gestor_email, status
FROM tenants 
WHERE gestor_email = 'geral@flowly.pt';

-- 3. Verificar se existe em profiles
SELECT 'profiles' as tabela, id::text, nome, role, tenant_id::text
FROM profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'geral@flowly.pt');

-- 4. RESET da senha (descomenta se necessário)
-- UPDATE auth.users 
-- SET encrypted_password = crypt('NovaSenha123!', gen_salt('bf'))
-- WHERE email = 'geral@flowly.pt';
