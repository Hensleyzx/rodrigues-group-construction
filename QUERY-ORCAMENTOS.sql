-- RODRIGUES GROUP CONSTRUCTION
-- Calculadora administrativa + orçamentos
-- Pode ser executado mais de uma vez com segurança.

create extension if not exists pgcrypto;

create sequence if not exists public.rgc_quote_seq
start 1;

create or replace function public.next_quote_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select
    'ORC-'
    || to_char(current_date, 'YYYYMMDD')
    || '-'
    || lpad(nextval('public.rgc_quote_seq')::text, 6, '0');
$$;

revoke all
on function public.next_quote_number()
from public;

grant execute
on function public.next_quote_number()
to authenticated;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null default public.next_quote_number(),

  client_name text not null,
  client_document text,
  client_phone text,
  client_email text,

  project_type text not null default 'Construção residencial',
  area numeric(10,2) not null default 0 check (area >= 0),
  standard_name text,
  standard_rate numeric(14,2) not null default 0 check (standard_rate >= 0),
  floors_factor numeric(6,3) not null default 1 check (floors_factor > 0),

  extras_percent numeric(8,2) not null default 0 check (extras_percent >= 0),
  labor_per_m2 numeric(14,2) not null default 0 check (labor_per_m2 >= 0),
  cement_bag_price numeric(14,2) not null default 0 check (cement_bag_price >= 0),
  cement_bags_per_m2 numeric(10,3) not null default 0 check (cement_bags_per_m2 >= 0),
  land_cost numeric(14,2) not null default 0 check (land_cost >= 0),
  include_land boolean not null default true,

  electrical_cost numeric(14,2) not null default 0 check (electrical_cost >= 0),
  hydraulic_cost numeric(14,2) not null default 0 check (hydraulic_cost >= 0),
  finishing_cost numeric(14,2) not null default 0 check (finishing_cost >= 0),
  marble_cost numeric(14,2) not null default 0 check (marble_cost >= 0),
  flooring_cost numeric(14,2) not null default 0 check (flooring_cost >= 0),
  steel_cost numeric(14,2) not null default 0 check (steel_cost >= 0),

  base_cost numeric(14,2) not null default 0 check (base_cost >= 0),
  labor_cost numeric(14,2) not null default 0 check (labor_cost >= 0),
  cement_cost numeric(14,2) not null default 0 check (cement_cost >= 0),
  extras_cost numeric(14,2) not null default 0 check (extras_cost >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  per_m2 numeric(14,2) not null default 0 check (per_m2 >= 0),

  notes text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'cancelled')),

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Se a tabela já existia em uma versão anterior, adiciona os novos custos.
alter table public.quotes
  add column if not exists electrical_cost numeric(14,2) not null default 0,
  add column if not exists hydraulic_cost numeric(14,2) not null default 0,
  add column if not exists finishing_cost numeric(14,2) not null default 0,
  add column if not exists marble_cost numeric(14,2) not null default 0,
  add column if not exists flooring_cost numeric(14,2) not null default 0,
  add column if not exists steel_cost numeric(14,2) not null default 0;

create index if not exists quotes_created_at_idx
on public.quotes(created_at desc);

create index if not exists quotes_client_name_idx
on public.quotes(client_name);

create index if not exists quotes_status_idx
on public.quotes(status);

alter table public.quotes
enable row level security;

grant select, insert, update, delete
on public.quotes
to authenticated;

drop policy if exists "owners manage quotes"
on public.quotes;

create policy "owners manage quotes"
on public.quotes
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quotes_updated_at
on public.quotes;

create trigger trg_quotes_updated_at
before update on public.quotes
for each row
execute function public.touch_updated_at();
