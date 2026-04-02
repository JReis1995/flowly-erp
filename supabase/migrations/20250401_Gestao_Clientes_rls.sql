-- ============================================
-- SPRINT 2: SCHEMA TENANTS COM RLS (MULTI-TENANT)
-- Flowly ERP - Single Database, Multi-Tenant Architecture
-- ============================================

-- Tabela principal de Tenants (Clientes do SaaS)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Dados da Empresa
    nome_empresa VARCHAR(255) NOT NULL,
    ramo_atividade VARCHAR(100),
    nif VARCHAR(20) UNIQUE,
    
    -- Dados do Gestor/Admin
    gestor_nome VARCHAR(255) NOT NULL,
    gestor_email VARCHAR(255) NOT NULL UNIQUE,
    
    -- Configuração do Plano
    plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
    plano_nome VARCHAR(50) DEFAULT 'Basic',
    
    -- Descontos
    desconto_percentual DECIMAL(5,2) DEFAULT 0,
    desconto_tipo VARCHAR(20) CHECK (desconto_tipo IN ('permanente', 'temporario')),
    desconto_validade DATE,
    
    -- Créditos IA
    creditos_ia INTEGER DEFAULT 0,
    creditos_ia_consumidos INTEGER DEFAULT 0,
    
    -- Módulos Ativos (Feature Flags)
    modulo_logistica BOOLEAN DEFAULT false,
    modulo_condominios BOOLEAN DEFAULT false,
    modulo_frota BOOLEAN DEFAULT false,
    modulo_rh BOOLEAN DEFAULT false,
    modulo_cc BOOLEAN DEFAULT false,
    modulo_ia BOOLEAN DEFAULT false,
    
    -- Status e Acesso
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'cancelado', 'trial')),
    validade_acesso DATE,
    data_registo TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ultimo_acesso TIMESTAMP WITH TIME ZONE,
    
    -- Alertas e Dívidas
    alerta_divida BOOLEAN DEFAULT false,
    alerta_divida_mensagem TEXT,
    divida_acumulada DECIMAL(10,2) DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Índices importantes
    CONSTRAINT valid_email CHECK (gestor_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para performance de queries frequentes
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_nif ON tenants(nif);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(gestor_email);
CREATE INDEX IF NOT EXISTS idx_tenants_nome ON tenants USING gin(to_tsvector('portuguese', nome_empresa));
CREATE INDEX IF NOT EXISTS idx_tenants_plano ON tenants(plano_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Habilitar RLS na tabela
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Política 1: Administradores SaaS (flowly_staff) podem ver TODOS os tenants
CREATE POLICY "Admins SaaS - Acesso Total" ON tenants
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM flowly_staff 
            WHERE user_id = auth.uid() 
            AND cargo IN ('Owner', 'Admin', 'Dev')
            AND status = 'Ativo'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM flowly_staff 
            WHERE user_id = auth.uid() 
            AND cargo IN ('Owner', 'Admin', 'Dev')
            AND status = 'Ativo'
        )
    );

-- Política 2: Gestores só podem ver o seu próprio tenant
CREATE POLICY "Gestor - Acesso Próprio Tenant" ON tenants
    FOR SELECT
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

-- Tabela de Utilizadores por Tenant (para acesso multi-user do mesmo cliente)
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'gestor', 'user', 'readonly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    UNIQUE(tenant_id, user_id)
);

-- RLS para tenant_users
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins SaaS - Acesso Total Tenant Users" ON tenant_users
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM flowly_staff 
            WHERE user_id = auth.uid() 
            AND cargo IN ('Owner', 'Admin', 'Dev')
            AND status = 'Ativo'
        )
    );

CREATE POLICY "Tenant Members - View Own" ON tenant_users
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT id FROM tenants 
            WHERE gestor_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
        OR 
        EXISTS (
            SELECT 1 FROM tenant_users tu2
            WHERE tu2.tenant_id = tenant_users.tenant_id
            AND tu2.user_id = auth.uid()
        )
    );

-- ============================================
-- FUNÇÕES AUXILIARES
-- ============================================

-- Função para verificar se o utilizador atual é admin SaaS
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

-- Função para obter o tenant_id do utilizador atual
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
-- TABELA DE LOGS DE IMPERSONATE (Auditoria)
-- ============================================

CREATE TABLE IF NOT EXISTS impersonate_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_nome VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- 'start', 'end'
    session_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_impersonate_logs_admin ON impersonate_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonate_logs_tenant ON impersonate_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impersonate_logs_created ON impersonate_logs(created_at);

-- ============================================
-- COMENTÁRIOS DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE tenants IS 'Tabela principal de clientes/tenants do SaaS Flowly ERP - Multi-tenant com RLS';
COMMENT ON COLUMN tenants.id IS 'UUID único do tenant - usado como tenant_id em todas as tabelas filhas';
COMMENT ON COLUMN tenants.status IS 'Status do tenant: ativo, suspenso, cancelado, trial';
COMMENT ON COLUMN tenants.plano_id IS 'Referência ao plano de subscrição';
COMMENT ON COLUMN tenants.creditos_ia IS 'Créditos de IA disponíveis para o tenant';
COMMENT ON COLUMN tenants.alerta_divida IS 'Flag para alerta visual de dívidas pendentes';
