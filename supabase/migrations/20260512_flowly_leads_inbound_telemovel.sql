-- Telemóvel do contacto na lead inbound. Nullable para registos anteriores à coluna; a app exige valor em novos pedidos.
ALTER TABLE public.leads_inbound
  ADD COLUMN IF NOT EXISTS telemovel text;

COMMENT ON COLUMN public.leads_inbound.telemovel IS
  'Telemóvel do contacto; histórico pode ficar vazio. Novos pedidos (site e CRM manual) validam formato PT na aplicação.';
