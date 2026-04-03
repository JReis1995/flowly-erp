-- ============================================
-- FIX: Corrigir role e senha do geral@flowly.pt
-- ============================================

-- 1. Verificar o utilizador atual
SELECT 'Antes:' as estado, id, email, role 
FROM profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'geral@flowly.pt');

-- 2. Atualizar a role para 'gestor' (NÃO superadmin)
UPDATE profiles 
SET role = 'gestor',
    nome = 'Gestor Teste'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'geral@flowly.pt');

-- 3. Resetar a senha
UPDATE auth.users 
SET encrypted_password = crypt('NovaSenha123!', gen_salt('bf'))
WHERE email = 'geral@flowly.pt';

-- 4. Verificar depois da alteração
SELECT 'Depois:' as estado, id, email, role 
FROM profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'geral@flowly.pt');
