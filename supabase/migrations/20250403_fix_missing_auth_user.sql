-- ============================================
-- FIX: Criar utilizador de autenticação para empresa existente
-- Email: geral@flowly.pt | Senha: Temp123456!
-- ============================================

DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- 1. Verificar se o utilizador já existe no auth.users
    SELECT id INTO v_user_id
    FROM auth.users 
    WHERE email = 'geral@flowly.pt';
    
    -- 2. Se NÃO existir, criar utilizador
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
        VALUES (
            v_user_id,
            'geral@flowly.pt',
            crypt('Temp123456!', gen_salt('bf')),  -- Senha temporária
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"nome":"Gestor Flowly"}'
        );
        
        RAISE NOTICE 'Utilizador criado: %', v_user_id;
    ELSE
        RAISE NOTICE 'Utilizador já existe: %', v_user_id;
    END IF;
    
    -- 3. Buscar tenant_id correspondente
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE gestor_email = 'geral@flowly.pt';
    
    -- 4. Criar profile se não existir
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) AND v_tenant_id IS NOT NULL THEN
        INSERT INTO profiles (id, nome, role, tenant_id)
        VALUES (v_user_id, 'Gestor Flowly', 'gestor', v_tenant_id);
        RAISE NOTICE 'Profile criado para tenant: %', v_tenant_id;
    END IF;
    
END $$;

-- Verificar resultado
SELECT 'Utilizador:' as tipo, id, email, created_at FROM auth.users WHERE email = 'geral@flowly.pt'
UNION ALL
SELECT 'Profile:' as tipo, id::text, role, NULL FROM profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'geral@flowly.pt');
