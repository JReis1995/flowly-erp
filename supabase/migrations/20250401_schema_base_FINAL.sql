-- ============================================
-- FLOWLY ERP - SCHEMA BASE (SEM DEPENDÊNCIAS CIRCULARES)
-- Execute ISTO PRIMEIRO no Supabase SQL Editor
-- ============================================

-- Desativar RLS temporariamente para evitar erros
SET session_replication_role = 'replica';

-- ============================================
-- 1. TABELA: PLANOS (Primeiro - sem dependências)
-- ============================================
DROP TABLE IF EXISTS planos CASCADE;

CREATE TABLE planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    modulos JSONB NOT NULL DEFAULT '{}',
    preco_mensal DECIMAL(10,2) NOT NULL CHECK (preco_mensal >= 0),
    preco_anual DECIMAL(10,2) NOT NULL CHECK (preco_anual >= 0),
    preco_inicial DECIMAL(10,2) DEFAULT 0 CHECK (preco_inicial >= 0),
    desconto_percentual DECIMAL(5,2) DEFAULT 0 CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
    desconto_validade DATE,
    mensalidades_oferta INTEGER DEFAULT 0,
    creditos_ia_incluidos INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    ordem_display INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX idx_planos_status ON planos(status);
CREATE INDEX idx_planos_ordem ON planos(ordem_display);

-- Trigger
CREATE OR REPLACE FUNCTION update_plano_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_plano_modified ON planos;
CREATE TRIGGER update_plano_modified
    BEFORE UPDATE ON planos
    FOR EACH ROW
    EXECUTE FUNCTION update_plano_modified();

-- Inserir planos padrão
INSERT INTO planos (nome, descricao, modulos, preco_mensal, preco_anual, preco_inicial, ordem_display, status)
VALUES 
    ('Basic', 'Plano essencial para pequenas empresas', 
     '{"logistica": true, "condominios": false, "frota": false, "rh": false, "cc": true, "ia": false}',
     29.00, 290.00, 99.00, 1, 'Ativo'),
    ('Pro', 'Plano completo para empresas em crescimento',
     '{"logistica": true, "condominios": true, "frota": true, "rh": true, "cc": true, "ia": true}',
     79.00, 790.00, 199.00, 2, 'Ativo'),
    ('Enterprise', 'Solução customizada para grandes empresas',
     '{"logistica": true, "condominios": true, "frota": true, "rh": true, "cc": true, "ia": true}',
     199.00, 1990.00, 499.00, 3, 'Ativo')
ON CONFLICT (nome) DO NOTHING;

-- ============================================
-- 2. TABELA: TENANTS (Clientes - depende de planos)
-- ============================================
DROP TABLE IF EXISTS tenant_users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_empresa VARCHAR(255) NOT NULL,
    ramo_atividade VARCHAR(100),
    nif VARCHAR(20),
    gestor_nome VARCHAR(255) NOT NULL,
    gestor_email VARCHAR(255) NOT NULL UNIQUE,
    plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
    plano_nome VARCHAR(50) DEFAULT 'Basic',
    desconto_percentual DECIMAL(5,2) DEFAULT 0 CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
    desconto_tipo VARCHAR(20) CHECK (desconto_tipo IN ('permanente', 'temporario')),
    desconto_validade DATE,
    creditos_ia INTEGER DEFAULT 0 CHECK (creditos_ia >= 0),
    creditos_ia_consumidos INTEGER DEFAULT 0 CHECK (creditos_ia_consumidos >= 0),
    modulo_logistica BOOLEAN DEFAULT false,
    modulo_condominios BOOLEAN DEFAULT false,
    modulo_frota BOOLEAN DEFAULT false,
    modulo_rh BOOLEAN DEFAULT false,
    modulo_cc BOOLEAN DEFAULT false,
    modulo_ia BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'cancelado', 'trial')),
    validade_acesso DATE,
    data_registo TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ultimo_acesso TIMESTAMP WITH TIME ZONE,
    alerta_divida BOOLEAN DEFAULT false,
    alerta_divida_mensagem TEXT,
    divida_acumulada DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_gestor_email ON tenants(gestor_email);
CREATE INDEX idx_tenants_nome ON tenants USING gin(to_tsvector('portuguese', nome_empresa));

-- Trigger
CREATE OR REPLACE FUNCTION update_tenant_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tenant_updated_at ON tenants;
CREATE TRIGGER update_tenant_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_modified();

-- ============================================
-- 3. TABELA: PACOTES_IA
-- ============================================
DROP TABLE IF EXISTS pacotes_ia CASCADE;

CREATE TABLE pacotes_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome VARCHAR(255) NOT NULL,
    creditos INTEGER NOT NULL CHECK (creditos > 0),
    preco_base DECIMAL(10,2) NOT NULL CHECK (preco_base >= 0),
    link_pagamento VARCHAR(500),
    status VARCHAR(20) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    ultima_modificacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX idx_pacotes_ia_status ON pacotes_ia(status);

-- Trigger
CREATE OR REPLACE FUNCTION update_pacote_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ultima_modificacao = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pacote_ultima_modificacao ON pacotes_ia;
CREATE TRIGGER update_pacote_ultima_modificacao
    BEFORE UPDATE ON pacotes_ia
    FOR EACH ROW
    EXECUTE FUNCTION update_pacote_modified();

-- Inserir pacotes padrão
INSERT INTO pacotes_ia (nome, creditos, preco_base, status)
VALUES 
    ('Pack Base', 100, 9.99, 'Ativo'),
    ('Pack Pro', 500, 39.99, 'Ativo'),
    ('Pack Enterprise', 2000, 149.99, 'Ativo')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. TABELA: PURCHASES
-- ============================================
DROP TABLE IF EXISTS purchases CASCADE;

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pacote_id UUID REFERENCES pacotes_ia(id) ON DELETE SET NULL,
    pacote_nome VARCHAR(255),
    creditos_adquiridos INTEGER NOT NULL,
    valor_pago DECIMAL(10,2) NOT NULL,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchases_tenant ON purchases(tenant_id);
CREATE INDEX idx_purchases_status ON purchases(status);

-- ============================================
-- 5. TABELA: STRIPE_WEBHOOK_LOGS
-- ============================================
DROP TABLE IF EXISTS stripe_webhook_logs CASCADE;

CREATE TABLE stripe_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100),
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_event ON stripe_webhook_logs(event_id);
CREATE INDEX idx_webhook_logs_type ON stripe_webhook_logs(event_type);

-- ============================================
-- 6. TABELA: TENANT_USERS (Opcional)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'gestor', 'user', 'readonly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    UNIQUE(tenant_id, user_id)
);

-- ============================================
-- 7. FUNÇÃO RPC: Adicionar Créditos
-- ============================================
CREATE OR REPLACE FUNCTION add_tenant_credits(
    tenant_ids UUID[],
    credits_to_add INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE tenants
    SET creditos_ia = creditos_ia + credits_to_add,
        updated_at = NOW()
    WHERE id = ANY(tenant_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. HABILITAR RLS
-- ============================================
SET session_replication_role = 'origin';

-- Habilitar RLS nas tabelas
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacotes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Políticas simples (sem dependências externas)
CREATE POLICY "planos_select_all" ON planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_all_admin" ON planos FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@flowly.pt') WITH CHECK (auth.jwt() ->> 'email' LIKE '%@flowly.pt');

CREATE POLICY "tenants_select_all" ON tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenants_all_admin" ON tenants FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@flowly.pt') WITH CHECK (auth.jwt() ->> 'email' LIKE '%@flowly.pt');

CREATE POLICY "pacotes_select_ativos" ON pacotes_ia FOR SELECT TO authenticated USING (status = 'Ativo');
CREATE POLICY "pacotes_all_admin" ON pacotes_ia FOR ALL TO authenticated USING (auth.jwt() ->> 'email' LIKE '%@flowly.pt') WITH CHECK (auth.jwt() ->> 'email' LIKE '%@flowly.pt');

CREATE POLICY "purchases_select_own" ON purchases FOR SELECT TO authenticated USING (tenant_id IN (SELECT id FROM tenants WHERE gestor_email = auth.jwt() ->> 'email'));

CREATE POLICY "tenant_users_all" ON tenant_users FOR ALL TO authenticated USING (true);

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
SELECT '✅ SCHEMA CRIADO COM SUCESSO!' as status;
SELECT 
    (SELECT COUNT(*) FROM planos) as total_planos,
    (SELECT COUNT(*) FROM tenants) as total_tenants,
    (SELECT COUNT(*) FROM pacotes_ia) as total_pacotes;
