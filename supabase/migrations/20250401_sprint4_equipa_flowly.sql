-- ============================================
-- SPRINT 4: SCHEMA FLOWLY_STAFF (Equipa SaaS)
-- Flowly ERP - Gestão de Equipa Interna
-- ============================================

CREATE TABLE IF NOT EXISTS flowly_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(20) NOT NULL CHECK (cargo IN ('Owner', 'Admin', 'Dev', 'Support')),
    status VARCHAR(20) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    password_hash VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_flowly_staff_status ON flowly_staff(status);
CREATE INDEX IF NOT EXISTS idx_flowly_staff_cargo ON flowly_staff(cargo);
CREATE INDEX IF NOT EXISTS idx_flowly_staff_email ON flowly_staff USING gin(to_tsvector('portuguese', email));

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_staff_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_flowly_staff_modified
    BEFORE UPDATE ON flowly_staff
    FOR EACH ROW
    EXECUTE FUNCTION update_staff_modified();

-- RLS para flowly_staff
ALTER TABLE flowly_staff ENABLE ROW LEVEL SECURITY;

-- Política: Admins SaaS podem gerir toda a equipa
CREATE POLICY "Admins SaaS - Gestão Equipa" ON flowly_staff
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM flowly_staff fs
            WHERE fs.user_id = auth.uid() 
            AND fs.cargo IN ('Owner', 'Admin')
            AND fs.status = 'Ativo'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM flowly_staff fs
            WHERE fs.user_id = auth.uid() 
            AND fs.cargo IN ('Owner', 'Admin')
            AND fs.status = 'Ativo'
        )
    );

-- Política: Devs podem ver a equipa (mas não editar)
CREATE POLICY "Devs - Ver Equipa" ON flowly_staff
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM flowly_staff fs
            WHERE fs.user_id = auth.uid() 
            AND fs.cargo = 'Dev'
            AND fs.status = 'Ativo'
        )
    );

COMMENT ON TABLE flowly_staff IS 'Tabela de gestão da equipa interna do SaaS Flowly';
