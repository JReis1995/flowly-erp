-- ============================================
-- SPRINT 3: SCHEMA PACOTES_IA
-- Flowly ERP - Gestão de Pacotes de Créditos IA
-- ============================================

CREATE TABLE IF NOT EXISTS pacotes_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    nome VARCHAR(255) NOT NULL,
    creditos INTEGER NOT NULL CHECK (creditos > 0),
    preco_base DECIMAL(10,2) NOT NULL CHECK (preco_base >= 0),
    link_pagamento VARCHAR(500),
    status VARCHAR(20) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    ultima_modificacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pacotes_ia_status ON pacotes_ia(status);
CREATE INDEX IF NOT EXISTS idx_pacotes_ia_nome ON pacotes_ia USING gin(to_tsvector('portuguese', nome));

-- Trigger para atualizar ultima_modificacao automaticamente
CREATE OR REPLACE FUNCTION update_pacote_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ultima_modificacao = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pacote_ultima_modificacao
    BEFORE UPDATE ON pacotes_ia
    FOR EACH ROW
    EXECUTE FUNCTION update_pacote_modified();

-- RLS para pacotes_ia
ALTER TABLE pacotes_ia ENABLE ROW LEVEL SECURITY;

-- Política: Admins SaaS podem gerir todos os pacotes (baseado em email ou função)
CREATE POLICY "Admins SaaS - Gestão Pacotes IA" ON pacotes_ia
    FOR ALL
    TO authenticated
    USING (
        auth.jwt() ->> 'email' LIKE '%@flowly.pt' OR
        auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    )
    WITH CHECK (
        auth.jwt() ->> 'email' LIKE '%@flowly.pt' OR
        auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    );

-- Política: Todos os utilizadores autenticados podem ver pacotes ativos
CREATE POLICY "Ver Pacotes Ativos" ON pacotes_ia
    FOR SELECT
    TO authenticated
    USING (status = 'Ativo');

COMMENT ON TABLE pacotes_ia IS 'Pacotes de créditos IA disponíveis para compra pelos clientes';
