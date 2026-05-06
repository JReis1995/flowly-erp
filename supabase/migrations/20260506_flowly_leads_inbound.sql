create table if not exists public.leads_inbound (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  email text not null,
  empresa text,
  tipo_projeto text not null,
  orcamento text,
  prazo text,
  descricao text not null,
  origem text not null default 'website',
  estado text not null default 'new',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.leads_inbound
  add constraint leads_inbound_estado_check
  check (estado in ('new', 'qualified', 'proposal', 'won', 'lost'));

alter table public.leads_inbound enable row level security;

create index if not exists idx_leads_inbound_created_at
  on public.leads_inbound (created_at desc);

create index if not exists idx_leads_inbound_estado
  on public.leads_inbound (estado);

