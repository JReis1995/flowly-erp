-- Migration: Adicionar colunas de módulos em falta na tabela tenants
-- Created: 2025-04-03

-- Adicionar colunas booleanas para módulos que não tinham controlo na DB
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS modulo_fichas_tecnicas BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS modulo_importacao BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS modulo_acessos BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS modulo_clientes BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS modulo_dashboard BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS modulo_central_saas BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN tenants.modulo_fichas_tecnicas IS 'Controlo de acesso ao módulo Fichas Técnicas';
COMMENT ON COLUMN tenants.modulo_importacao IS 'Controlo de acesso ao módulo Importação & Exportação';
COMMENT ON COLUMN tenants.modulo_acessos IS 'Controlo de acesso ao módulo Acessos';
COMMENT ON COLUMN tenants.modulo_clientes IS 'Controlo de acesso ao módulo Clientes & Fornecedores';
COMMENT ON COLUMN tenants.modulo_dashboard IS 'Controlo de acesso ao módulo Dashboard';
COMMENT ON COLUMN tenants.modulo_central_saas IS 'Controlo de acesso ao módulo Central SaaS';

-- Atualizar hook para incluir novos módulos
-- Nota: Atualizar src/hooks/useTenantModules.ts para buscar estas colunas também

SELECT '✅ Colunas de módulos adicionadas com sucesso!' as status;
