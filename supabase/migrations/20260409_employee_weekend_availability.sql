-- Disponibilidade para escalas ao fim de semana (null = sem preferência explícita; app trata como disponível)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS trabalha_sabado boolean,
  ADD COLUMN IF NOT EXISTS trabalha_domingo boolean;

COMMENT ON COLUMN public.employees.trabalha_sabado IS
  'Se false, o motor de escalas não atribui turnos ao sábado a este colaborador.';
COMMENT ON COLUMN public.employees.trabalha_domingo IS
  'Se false, o motor de escalas não atribui turnos ao domingo a este colaborador.';
