-- Migration: Stripe Integration - Tabelas para webhook logs e purchases
-- Created: 2025-04-01

-- Tabela para logs de webhooks Stripe
CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Índices para stripe_webhook_logs
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_logs_event_id ON stripe_webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_logs_event_type ON stripe_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_logs_created_at ON stripe_webhook_logs(created_at);

-- Tabela para registo de compras
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pacote_id UUID REFERENCES pacotes_ia(id) ON DELETE SET NULL,
  pacote_nome TEXT,
  creditos_adquiridos INTEGER NOT NULL DEFAULT 0,
  valor_pago DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para purchases
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_id ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_pacote_id ON purchases(pacote_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies para stripe_webhook_logs (apenas admins do sistema)
ALTER TABLE stripe_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow flowly_staff full access to webhook_logs"
  ON stripe_webhook_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flowly_staff
      WHERE flowly_staff.email = auth.jwt()->>'email'
      AND flowly_staff.status = 'Ativo'
      AND flowly_staff.cargo IN ('Owner', 'Admin', 'Dev')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flowly_staff
      WHERE flowly_staff.email = auth.jwt()->>'email'
      AND flowly_staff.status = 'Ativo'
      AND flowly_staff.cargo IN ('Owner', 'Admin', 'Dev')
    )
  );

-- RLS Policies para purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todas as compras
CREATE POLICY "Allow flowly_staff full access to purchases"
  ON purchases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flowly_staff
      WHERE flowly_staff.email = auth.jwt()->>'email'
      AND flowly_staff.status = 'Ativo'
      AND flowly_staff.cargo IN ('Owner', 'Admin', 'Dev')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flowly_staff
      WHERE flowly_staff.email = auth.jwt()->>'email'
      AND flowly_staff.status = 'Ativo'
      AND flowly_staff.cargo IN ('Owner', 'Admin', 'Dev')
    )
  );

-- Tenants podem ver apenas as suas próprias compras
CREATE POLICY "Allow tenants to view own purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt()->>'tenant_id')::UUID
  );

-- Comentários
COMMENT ON TABLE stripe_webhook_logs IS 'Logs de eventos recebidos do Stripe webhook';
COMMENT ON TABLE purchases IS 'Registo de compras de pacotes IA pelos tenants';
