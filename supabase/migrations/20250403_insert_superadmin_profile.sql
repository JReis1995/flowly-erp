-- ============================================
-- FIX: Inserir profile para o teu utilizador
-- ============================================

-- Substitui 'a4a352ab-4556-4a09-8388-ff44ecda1e0d' pelo teu user_id real se for diferente
INSERT INTO profiles (id, nome, role, tenant_id)
VALUES (
    'a4a352ab-4556-4a09-8388-ff44ecda1e0d',  -- Substitui pelo teu auth.uid()
    'Super Admin',  -- Nome
    'superadmin',  -- Role
    NULL  -- tenant_id (superadmin não precisa)
)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    role = EXCLUDED.role;

-- Verificar
SELECT * FROM profiles WHERE role = 'superadmin';
