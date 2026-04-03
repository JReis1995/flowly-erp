-- ============================================
-- SPRINT 3: RLS POLICIES FOR IMPERSONATE MODE
-- Flowly ERP - Data Isolation & Security
-- ============================================

-- Este migration garante que:
-- 1. Superadmins/Equipa Flowly podem aceder a QUALQUER tenant_id (para impersonate)
-- 2. Utilizadores normais só veem os seus próprios dados
-- 3. A função is_flowly_admin() é usada para verificar permissões

-- ============================================
-- FUNÇÕES AUXILIARES (garantir que existem)
-- ============================================

-- Função para verificar se é admin Flowly
CREATE OR REPLACE FUNCTION is_flowly_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM flowly_staff 
        WHERE user_id = auth.uid() 
        AND cargo IN ('Owner', 'Admin', 'Dev')
        AND status = 'Ativo'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter tenant_id do utilizador atual
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    tenant_uuid UUID;
BEGIN
    -- Primeiro verifica se é gestor direto
    SELECT id INTO tenant_uuid
    FROM tenants
    WHERE gestor_email = (SELECT email FROM auth.users WHERE id = auth.uid());
    
    -- Se não for gestor, verifica se é membro de algum tenant
    IF tenant_uuid IS NULL THEN
        SELECT tenant_id INTO tenant_uuid
        FROM tenant_users
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;
    
    RETURN tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- POLÍTICAS RLS ATUALIZADAS - TENANTS
-- ============================================

-- Remover políticas antigas para recriar
DROP POLICY IF EXISTS "Admins SaaS - Acesso Total" ON tenants;
DROP POLICY IF EXISTS "Gestor - Acesso Próprio Tenant" ON tenants;
DROP POLICY IF EXISTS "tenants_select_all" ON tenants;
DROP POLICY IF EXISTS "tenants_all_admin" ON tenants;

-- Política 1: Flowly Staff (superadmins) - Acesso TOTAL a todos os tenants
CREATE POLICY "flowly_staff_full_access" ON tenants
    FOR ALL
    TO authenticated
    USING (is_flowly_admin())
    WITH CHECK (is_flowly_admin());

-- Política 2: Gestores podem ver o seu próprio tenant
CREATE POLICY "gestor_own_tenant" ON tenants
    FOR SELECT
    TO authenticated
    USING (
        gestor_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR 
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = tenants.id
            AND tu.user_id = auth.uid()
        )
        OR
        is_flowly_admin()  -- Garantir que admins também passam por esta policy
    );

-- Política 3: Gestores podem atualizar o seu próprio tenant
CREATE POLICY "gestor_update_own" ON tenants
    FOR UPDATE
    TO authenticated
    USING (
        gestor_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR 
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = tenants.id
            AND tu.user_id = auth.uid()
            AND tu.role IN ('admin', 'gestor')
        )
    );

-- ============================================
-- POLÍTICAS RLS ATUALIZADAS - PURCHASES
-- ============================================

DROP POLICY IF EXISTS "purchases_select_own" ON purchases;
DROP POLICY IF EXISTS "purchases_admin_all" ON purchases;

-- Política 1: Flowly Staff vê todas as purchases
CREATE POLICY "purchases_flowly_staff_all" ON purchases
    FOR ALL
    TO authenticated
    USING (is_flowly_admin());

-- Política 2: Utilizadores normais só veem as suas purchases
CREATE POLICY "purchases_tenant_isolation" ON purchases
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = get_current_tenant_id()
        OR is_flowly_admin()
    );

-- ============================================
-- POLÍTICAS RLS ATUALIZADAS - PROFILES
-- ============================================

DROP POLICY IF EXISTS "Profiles access policy" ON profiles;

-- Criar tabela profiles se não existir (garantir compatibilidade)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    nome VARCHAR(255),
    tenant_id UUID,
    role VARCHAR(50) DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política 1: Flowly Staff vê todos os profiles
CREATE POLICY "profiles_flowly_staff_all" ON profiles
    FOR ALL
    TO authenticated
    USING (is_flowly_admin());

-- Política 2: Utilizadores veem o seu próprio profile
CREATE POLICY "profiles_own_access" ON profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR is_flowly_admin()
    );

-- Política 3: Utilizadores podem atualizar o seu próprio profile
CREATE POLICY "profiles_own_update" ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================
-- TABELA: IMPERSONATE_LOGS (Auditoria)
-- ============================================

-- Garantir que a tabela existe
CREATE TABLE IF NOT EXISTS impersonate_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_nome VARCHAR(255),
    action VARCHAR(50) NOT NULL CHECK (action IN ('start', 'end')),
    session_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_impersonate_logs_admin ON impersonate_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonate_logs_tenant ON impersonate_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impersonate_logs_created ON impersonate_logs(created_at);

-- RLS para logs: apenas Flowly Staff pode ver
ALTER TABLE impersonate_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impersonate_logs_flowly_only" ON impersonate_logs;

CREATE POLICY "impersonate_logs_flowly_only" ON impersonate_logs
    FOR ALL
    TO authenticated
    USING (is_flowly_admin());

-- ============================================
-- FUNÇÃO RPC: Log Impersonate Action
-- ============================================

CREATE OR REPLACE FUNCTION log_impersonate_action(
    p_tenant_id UUID,
    p_tenant_nome VARCHAR(255),
    p_action VARCHAR(50),
    p_session_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
    admin_email VARCHAR(255);
BEGIN
    -- Buscar email do admin atual
    SELECT email INTO admin_email FROM auth.users WHERE id = auth.uid();
    
    INSERT INTO impersonate_logs (
        admin_id,
        admin_email,
        tenant_id,
        tenant_nome,
        action,
        session_data,
        created_at
    ) VALUES (
        auth.uid(),
        admin_email,
        p_tenant_id,
        p_tenant_nome,
        p_action,
        p_session_data,
        NOW()
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION is_flowly_admin() IS 'Verifica se o utilizador atual é membro da equipa Flowly com permissões de admin';
COMMENT ON FUNCTION get_current_tenant_id() IS 'Retorna o tenant_id do utilizador logado (gestor ou membro)';
COMMENT ON FUNCTION log_impersonate_action() IS 'Registra ação de impersonate para auditoria';
COMMENT ON TABLE impersonate_logs IS 'Logs de auditoria para ações de impersonate - apenas Flowly Staff tem acesso';

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
SELECT '✅ SPRINT 3: Políticas RLS de Isolamento criadas com sucesso!' as status;
