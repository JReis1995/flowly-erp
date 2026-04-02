-- Migration: Add refined fields to planos table
-- Created: 2025-04-01

-- Adicionar novas colunas à tabela planos
ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS preco_inicial DECIMAL(10,2) DEFAULT 0 CHECK (preco_inicial >= 0),
  ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5,2) DEFAULT 0 CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
  ADD COLUMN IF NOT EXISTS desconto_validade TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS mensalidades_oferta INTEGER DEFAULT 0 CHECK (mensalidades_oferta >= 0),
  ADD COLUMN IF NOT EXISTS creditos_ia_incluidos INTEGER DEFAULT 0 CHECK (creditos_ia_incluidos >= 0);

-- Atualizar planos existentes com valores padrão
UPDATE planos SET
  preco_inicial = CASE 
    WHEN nome = 'Basic' THEN 49.00
    WHEN nome = 'Pro' THEN 99.00
    WHEN nome = 'Enterprise' THEN 249.00
    ELSE 0
  END,
  desconto_percentual = 0,
  mensalidades_oferta = CASE 
    WHEN nome = 'Basic' THEN 0
    WHEN nome = 'Pro' THEN 1
    WHEN nome = 'Enterprise' THEN 2
    ELSE 0
  END,
  creditos_ia_incluidos = CASE 
    WHEN nome = 'Basic' THEN 50
    WHEN nome = 'Pro' THEN 200
    WHEN nome = 'Enterprise' THEN 500
    ELSE 0
  END
WHERE preco_inicial IS NULL OR preco_inicial = 0;

-- Comentários nas colunas
COMMENT ON COLUMN planos.preco_inicial IS 'Valor inicial de instalação/formação';
COMMENT ON COLUMN planos.desconto_percentual IS 'Percentagem de desconto no plano (0-100)';
COMMENT ON COLUMN planos.desconto_validade IS 'Data de validade do desconto (NULL = permanente)';
COMMENT ON COLUMN planos.mensalidades_oferta IS 'Número de mensalidades grátis incluídas';
COMMENT ON COLUMN planos.creditos_ia_incluidos IS 'Créditos IA incluídos no plano';
