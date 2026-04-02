-- ============================================
-- SPRINT 5: SCHEMA PLANOS
-- Flowly ERP - Gestão de Planos de Subscrição
-- ============================================

CREATE TABLE IF NOT EXISTS planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    modulos JSONB NOT NULL DEFAULT '{}',
    preco_mensal DECIMAL(10,2) NOT NULL CHECK (preco_mensal >= 0),
    preco_anual DECIMAL(10,2) NOT NULL CHECK (preco_anual >= 0),
    status VARCHAR(20) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    ordem_display INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_planos_status ON planos(status);
CREATE INDEX IF NOT EXISTS idx_planos_nome ON planos USING gin(to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS idx_planos_ordem ON planos(ordem_display);

-- Inserir planos padrão se não existirem
INSERT INTO planos (nome, descricao, modulos, preco_mensal, preco_anual, ordem_display, status)
VALUES 
    ('Basic', 'Plano essencial para pequenas empresas', 
     '{"logistica": true, "condominios": false, "frota": false, "rh": false, "cc": true, "ia": false}'::jsonb,
     29.00, 290.00, 1, 'Ativo'),
    ('Pro', 'Plano completo para empresas em crescimento',
     '{"logistica": true, "condominios": true, "frota": true, "rh": true, "cc": true, "ia": true}'::jsonb,
     79.00, 790.00, 2, 'Ativo'),
    ('Enterprise', 'Solução customizada para grandes empresas',
     '{"logistica": true, "condominios": true, "frota": true, "rh": true, "cc": true, "ia": true}'::jsonb,
     199.00, 1990.00, 3, 'Ativo')
ON CONFLICT (nome) DO NOTHING;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_plano_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plano_modified
    BEFORE UPDATE ON planos
    FOR EACH ROW
    EXECUTE FUNCTION update_plano_modified();

-- RLS para planos
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;

-- Política: Admins SaaS podem gerir todos os planos
CREATE POLICY "Admins SaaS - Gestão Planos" ON planos
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM flowly_staff fs
            WHERE fs.user_id = auth.uid() 
            AND fs.cargo IN ('Owner', 'Admin', 'Dev')
            AND fs.status = 'Ativo'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM flowly_staff fs
            WHERE fs.user_id = auth.uid() 
            AND fs.cargo IN ('Owner', 'Admin', 'Dev')
            AND fs.status = 'Ativo'
        )
    );

-- Política: Todos os utilizadores autenticados podem ver planos ativos
CREATE POLICY "Ver Planos Ativos" ON planos
    FOR SELECT
    TO authenticated
    USING (status = 'Ativo');

COMMENT ON TABLE planos IS 'Planos de subscrição disponíveis para os clientes do SaaS Flowly';
