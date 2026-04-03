-- ============================================
-- FIX: Criar tabela profiles (estava em falta)
-- ============================================

-- Criar tabela profiles se não existir
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Utilizador' CHECK (role IN ('superadmin', 'developer', 'gestor', 'colaborador', 'Utilizador')),
    avatar_url VARCHAR(500),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_profile_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profile_updated_at ON profiles;
CREATE TRIGGER update_profile_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_modified();

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
-- 1: Flowly Staff vê todos
CREATE POLICY IF NOT EXISTS "profiles_flowly_staff_all" ON profiles
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM flowly_staff WHERE user_id = auth.uid() AND status = 'Ativo'));

-- 2: Utilizadores veem o seu próprio
CREATE POLICY IF NOT EXISTS "profiles_own_access" ON profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- 3: Utilizadores atualizam o seu próprio
CREATE POLICY IF NOT EXISTS "profiles_own_update" ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT '✅ Tabela profiles criada com sucesso!' as status;
