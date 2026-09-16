-- RODRIGUES GROUP CONSTRUCTION — SUPABASE
-- Execute este arquivo inteiro no SQL Editor do seu projeto.
-- Depois crie o primeiro usuário em Authentication > Users e rode create-first-owner.sql.

create extension if not exists pgcrypto;

create table if not exists public.owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Owner',
  role text not null default 'owner' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Alto padrão',
  price numeric(14,2) not null default 0 check (price >= 0),
  area numeric(10,2) not null default 0 check (area >= 0),
  suites integer not null default 0 check (suites >= 0),
  garages integer not null default 0 check (garages >= 0),
  location text,
  description text,
  features text[] not null default '{}',
  image_path text,
  status text not null default 'available' check (status in ('available','reserved','sold')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique not null,
  property_id uuid references public.properties(id) on delete set null,
  property_title_snapshot text not null,
  property_location_snapshot text,
  buyer_name text not null,
  buyer_document text,
  buyer_phone text,
  buyer_email text,
  sale_date date not null,
  sale_value numeric(14,2) not null check (sale_value >= 0),
  entry_value numeric(14,2) not null default 0 check (entry_value >= 0 and entry_value <= sale_value),
  payment_method text,
  installments integer not null default 0 check (installments >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists properties_status_idx on public.properties(status);
create index if not exists properties_created_at_idx on public.properties(created_at desc);
create index if not exists sales_property_id_idx on public.sales(property_id);
create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sales_sale_date_idx on public.sales(sale_date desc);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.owner_profiles
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

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

drop trigger if exists trg_properties_updated_at on public.properties;
create trigger trg_properties_updated_at
before update on public.properties
for each row execute function public.touch_updated_at();

create sequence if not exists public.rgc_receipt_seq start 1;

create or replace function public.next_receipt_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'RG-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.rgc_receipt_seq')::text, 6, '0');
$$;

revoke all on function public.next_receipt_number() from public;
grant execute on function public.next_receipt_number() to authenticated;

alter table public.properties enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.sales enable row level security;

-- Permissões da Data API. As políticas RLS abaixo continuam sendo a barreira de segurança.
grant usage on schema public to anon, authenticated;
grant select on public.properties to anon;
grant select, insert, update, delete on public.properties to authenticated;
grant select, update on public.owner_profiles to authenticated;
grant select, insert, update, delete on public.sales to authenticated;

-- Catálogo público: visitantes veem somente imóveis disponíveis ou reservados.
drop policy if exists "public reads published properties" on public.properties;
create policy "public reads published properties"
on public.properties for select
to anon, authenticated
using (status in ('available','reserved'));

-- Owners autenticados podem gerenciar todos os imóveis, inclusive vendidos.
drop policy if exists "owners manage properties" on public.properties;
create policy "owners manage properties"
on public.properties for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

-- Owners podem ler o próprio perfil.
drop policy if exists "owners read own profile" on public.owner_profiles;
create policy "owners read own profile"
on public.owner_profiles for select
to authenticated
using (user_id = auth.uid());

-- Owners podem alterar apenas o nome exibido do próprio perfil.
drop policy if exists "owners update own profile" on public.owner_profiles;
create policy "owners update own profile"
on public.owner_profiles for update
to authenticated
using (user_id = auth.uid() and public.is_owner())
with check (user_id = auth.uid() and public.is_owner());

-- Vendas são totalmente privadas e acessíveis somente a owners.
drop policy if exists "owners manage sales" on public.sales;
create policy "owners manage sales"
on public.sales for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

-- Bucket público para fotos do catálogo. Escrita continua restrita aos owners.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads property images" on storage.objects;
create policy "public reads property images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'property-images');

drop policy if exists "owners upload property images" on storage.objects;
create policy "owners upload property images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'property-images' and public.is_owner());

drop policy if exists "owners update property images" on storage.objects;
create policy "owners update property images"
on storage.objects for update
to authenticated
using (bucket_id = 'property-images' and public.is_owner())
with check (bucket_id = 'property-images' and public.is_owner());

drop policy if exists "owners delete property images" on storage.objects;
create policy "owners delete property images"
on storage.objects for delete
to authenticated
using (bucket_id = 'property-images' and public.is_owner());

-- Registra a venda e, opcionalmente, marca o imóvel como vendido na mesma transação.
create or replace function public.register_sale(
  p_property_id uuid,
  p_buyer_name text,
  p_buyer_document text,
  p_buyer_phone text,
  p_buyer_email text,
  p_sale_date date,
  p_sale_value numeric,
  p_entry_value numeric,
  p_payment_method text,
  p_installments integer,
  p_notes text,
  p_mark_sold boolean default true
)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property public.properties%rowtype;
  v_sale public.sales%rowtype;
begin
  if not public.is_owner() then
    raise exception 'Acesso negado';
  end if;

  if coalesce(trim(p_buyer_name), '') = '' then
    raise exception 'Comprador é obrigatório';
  end if;

  if p_sale_value < 0 or p_entry_value < 0 or p_entry_value > p_sale_value then
    raise exception 'Valores da venda inválidos';
  end if;

  if p_property_id is not null then
    select * into v_property
    from public.properties
    where id = p_property_id;

    if not found then
      raise exception 'Imóvel não encontrado';
    end if;
  end if;

  insert into public.sales (
    receipt_number,
    property_id,
    property_title_snapshot,
    property_location_snapshot,
    buyer_name,
    buyer_document,
    buyer_phone,
    buyer_email,
    sale_date,
    sale_value,
    entry_value,
    payment_method,
    installments,
    notes,
    created_by
  ) values (
    public.next_receipt_number(),
    p_property_id,
    case when p_property_id is null then 'Venda sem imóvel cadastrado' else v_property.title end,
    case when p_property_id is null then null else v_property.location end,
    trim(p_buyer_name),
    nullif(trim(p_buyer_document), ''),
    nullif(trim(p_buyer_phone), ''),
    nullif(trim(p_buyer_email), ''),
    p_sale_date,
    p_sale_value,
    p_entry_value,
    nullif(trim(p_payment_method), ''),
    greatest(coalesce(p_installments, 0), 0),
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  returning * into v_sale;

  if p_property_id is not null and p_mark_sold then
    update public.properties
    set status = 'sold'
    where id = p_property_id;
  end if;

  return v_sale;
end;
$$;

revoke all on function public.register_sale(uuid,text,text,text,text,date,numeric,numeric,text,integer,text,boolean) from public;
grant execute on function public.register_sale(uuid,text,text,text,text,date,numeric,numeric,text,integer,text,boolean) to authenticated;
