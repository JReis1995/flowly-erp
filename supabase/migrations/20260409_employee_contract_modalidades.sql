-- Modalidades de execução combináveis com tipo_contrato (rótulo do tipo base).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS contrato_modalidade_teletrabalho boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_modalidade_tempo_parcial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_modalidade_outra text;

COMMENT ON COLUMN public.employees.contrato_modalidade_teletrabalho IS
  'Teletrabalho como modalidade; combina com o tipo base em tipo_contrato.';
COMMENT ON COLUMN public.employees.contrato_modalidade_tempo_parcial IS
  'Tempo parcial como modalidade; combina com o tipo base em tipo_contrato.';
COMMENT ON COLUMN public.employees.contrato_modalidade_outra IS
  'Outra modalidade ou pormenores (texto livre).';
