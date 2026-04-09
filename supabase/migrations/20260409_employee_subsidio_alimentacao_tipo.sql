-- Modalidade do subsídio de alimentação (cartão refeição vs dinheiro)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS subsidio_alimentacao_tipo text;

COMMENT ON COLUMN public.employees.subsidio_alimentacao_tipo IS
  'Modalidade do subsídio alimentação: cartao | dinheiro (validação na aplicação).';
