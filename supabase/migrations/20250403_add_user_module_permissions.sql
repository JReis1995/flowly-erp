-- Migration: Adicionar colunas de módulos e permissões à tabela tenant_users
-- Created: 2025-04-03

-- Adicionar colunas booleanas para módulos por utilizador
ALTER TABLE tenant_users 
    ADD COLUMN IF NOT EXISTS modulo_logistica BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_condominios BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_frota BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_rh BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_cc BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_ia BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_fichas_tecnicas BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_importacao BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_acessos BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_clientes BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_dashboard BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS modulo_central_saas BOOLEAN DEFAULT true;

-- Adicionar colunas para controlo de funcionalidades específicas
ALTER TABLE tenant_users
    ADD COLUMN IF NOT EXISTS ver_creditos_ia BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS comprar_creditos_ia BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS ver_dividas BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS gestao_utilizadores BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN tenant_users.modulo_logistica IS 'Acesso do utilizador ao módulo Logística';
COMMENT ON COLUMN tenant_users.modulo_condominios IS 'Acesso do utilizador ao módulo Condomínios';
COMMENT ON COLUMN tenant_users.modulo_frota IS 'Acesso do utilizador ao módulo Frota';
COMMENT ON COLUMN tenant_users.modulo_rh IS 'Acesso do utilizador ao módulo RH';
COMMENT ON COLUMN tenant_users.modulo_cc IS 'Acesso do utilizador ao módulo Conta Corrente';
COMMENT ON COLUMN tenant_users.modulo_ia IS 'Acesso do utilizador ao módulo IA';
COMMENT ON COLUMN tenant_users.modulo_fichas_tecnicas IS 'Acesso do utilizador ao módulo Fichas Técnicas';
COMMENT ON COLUMN tenant_users.modulo_importacao IS 'Acesso do utilizador ao módulo Importação';
COMMENT ON COLUMN tenant_users.modulo_acessos IS 'Acesso do utilizador ao módulo Acessos';
COMMENT ON COLUMN tenant_users.modulo_clientes IS 'Acesso do utilizador ao módulo Clientes';
COMMENT ON COLUMN tenant_users.modulo_dashboard IS 'Acesso do utilizador ao módulo Dashboard';
COMMENT ON COLUMN tenant_users.modulo_central_saas IS 'Acesso do utilizador ao módulo Central SaaS';
COMMENT ON COLUMN tenant_users.ver_creditos_ia IS 'Permite ver créditos IA no header';
COMMENT ON COLUMN tenant_users.comprar_creditos_ia IS 'Permite comprar créditos IA';
COMMENT ON COLUMN tenant_users.ver_dividas IS 'Permite ver alertas de dívida';
COMMENT ON COLUMN tenant_users.gestao_utilizadores IS 'Permite gerir outros utilizadores do tenant';

SELECT '✅ Colunas de módulos e permissões adicionadas a tenant_users!' as status;
