-- UNIGRAN Comunidades - Portfólio Acadêmico
-- Base inicial para vincular Supabase Storage + dados estruturados do portfólio.
-- Rode no SQL Editor do Supabase. O backend ainda pode continuar usando TypeDB/JSON
-- enquanto estas tabelas passam a receber os novos dados.

-- ATENCAO: SCRIPT LEGADO. NAO EXECUTAR na arquitetura atual.
-- Este arquivo cria tabelas no Supabase. O projeto usa TypeDB para escrita.
-- Para configurar somente arquivos, execute 002_ava_storage_only.sql.

create extension if not exists pgcrypto;

create table if not exists public.academic_portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_username text not null unique,
  display_name text,
  institution_id text,
  institution_name text,
  course_name text,
  headline text,
  bio text,
  public_slug text unique,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.academic_portfolios(id) on delete cascade,
  source text not null default 'ava' check (source in ('ava', 'manual', 'import')),
  source_activity_id text,
  title text not null,
  summary text,
  course_id text,
  course_name text,
  activity_title text,
  document_url text,
  document_name text,
  document_storage text,
  document_path text,
  share_url text,
  post_id text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, source_activity_id)
);

create table if not exists public.portfolio_external_links (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.portfolio_items(id) on delete cascade,
  url text not null,
  kind text not null default 'other' check (kind in ('web_app', 'repository', 'prototype', 'drive', 'article', 'other')),
  label text,
  host text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_resumes (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.academic_portfolios(id) on delete cascade,
  document_url text not null,
  document_name text,
  document_storage text not null default 'supabase',
  document_path text,
  mime_type text,
  size_bytes bigint,
  extracted_text text,
  summary text,
  emails text[] not null default '{}',
  phones text[] not null default '{}',
  links text[] not null default '{}',
  skills text[] not null default '{}',
  parsed_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_ml_analyses (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.academic_portfolios(id) on delete cascade,
  source text not null default 'notebook ml vagas.ipynb + backend/outputs',
  score numeric(6,2),
  category text,
  area text,
  cluster text,
  recommended_skills text[] not null default '{}',
  resume_skills text[] not null default '{}',
  benchmark jsonb,
  matched_posts jsonb not null default '[]'::jsonb,
  recommended_jobs jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_ml_job_links (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.portfolio_ml_analyses(id) on delete cascade,
  title text not null,
  company text,
  location text,
  score numeric(6,2),
  url text not null,
  area text,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_academic_portfolios_owner on public.academic_portfolios(owner_username);
create index if not exists idx_portfolio_items_portfolio on public.portfolio_items(portfolio_id);
create index if not exists idx_portfolio_items_activity on public.portfolio_items(source_activity_id);
create index if not exists idx_portfolio_external_links_item on public.portfolio_external_links(item_id);
create index if not exists idx_portfolio_resumes_portfolio on public.portfolio_resumes(portfolio_id);
create index if not exists idx_portfolio_ml_analyses_portfolio on public.portfolio_ml_analyses(portfolio_id);
create index if not exists idx_portfolio_ml_job_links_analysis on public.portfolio_ml_job_links(analysis_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_academic_portfolios_updated_at on public.academic_portfolios;
create trigger trg_academic_portfolios_updated_at
before update on public.academic_portfolios
for each row execute function public.set_updated_at();

drop trigger if exists trg_portfolio_items_updated_at on public.portfolio_items;
create trigger trg_portfolio_items_updated_at
before update on public.portfolio_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_portfolio_resumes_updated_at on public.portfolio_resumes;
create trigger trg_portfolio_resumes_updated_at
before update on public.portfolio_resumes
for each row execute function public.set_updated_at();

-- Views públicas para páginas de portfólio.
create or replace view public.public_portfolio_items as
select
  p.owner_username,
  p.display_name,
  p.institution_name,
  p.course_name as portfolio_course_name,
  p.public_slug,
  i.id,
  i.title,
  i.summary,
  i.course_name,
  i.activity_title,
  i.document_url,
  i.document_name,
  i.share_url,
  i.tags,
  i.created_at,
  i.updated_at,
  l.url as external_url,
  l.kind as external_kind,
  l.label as external_label
from public.academic_portfolios p
join public.portfolio_items i on i.portfolio_id = p.id
left join public.portfolio_external_links l on l.item_id = i.id and l.is_primary = true
where p.visibility = 'public'
  and i.status = 'published';

create or replace view public.latest_portfolio_ml_analysis as
select distinct on (portfolio_id)
  *
from public.portfolio_ml_analyses
order by portfolio_id, generated_at desc;

-- RLS opcional. Para backend com SERVICE_ROLE_KEY, as policies não bloqueiam.
alter table public.academic_portfolios enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.portfolio_external_links enable row level security;
alter table public.portfolio_resumes enable row level security;
alter table public.portfolio_ml_analyses enable row level security;
alter table public.portfolio_ml_job_links enable row level security;

drop policy if exists "public read public portfolios" on public.academic_portfolios;
create policy "public read public portfolios"
on public.academic_portfolios for select
using (visibility = 'public');

drop policy if exists "public read published portfolio items" on public.portfolio_items;
create policy "public read published portfolio items"
on public.portfolio_items for select
using (
  status = 'published'
  and exists (
    select 1 from public.academic_portfolios p
    where p.id = portfolio_id and p.visibility = 'public'
  )
);

-- Storage do portfólio/AVA.
-- Permite que o próprio aluno envie currículo/entregas pelo fluxo da aplicação.
-- Preferencialmente o upload passa pelo backend com SERVICE_ROLE_KEY.
-- Se o projeto estiver usando anon/authenticated no Storage, estas policies liberam o bucket.
insert into storage.buckets (id, name, public)
values ('ava-entregas', 'ava-entregas', true)
on conflict (id) do update set public = true;

drop policy if exists "public read ava-entregas documents" on storage.objects;
create policy "public read ava-entregas documents"
on storage.objects for select
to public
using (bucket_id = 'ava-entregas');

drop policy if exists "anon upload ava-entregas documents" on storage.objects;
create policy "anon upload ava-entregas documents"
on storage.objects for insert
to anon
with check (
  bucket_id = 'ava-entregas'
  and (
    name like 'portfolio-curriculos/%'
    or name like 'ava-entregas/%'
    or name like 'submissions/%'
  )
);

drop policy if exists "authenticated upload ava-entregas documents" on storage.objects;
create policy "authenticated upload ava-entregas documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ava-entregas'
  and (
    name like 'portfolio-curriculos/%'
    or name like 'ava-entregas/%'
    or name like 'submissions/%'
  )
);

drop policy if exists "authenticated update own ava-entregas documents" on storage.objects;
create policy "authenticated update own ava-entregas documents"
on storage.objects for update
to authenticated
using (bucket_id = 'ava-entregas')
with check (bucket_id = 'ava-entregas');

drop policy if exists "authenticated delete own ava-entregas documents" on storage.objects;
create policy "authenticated delete own ava-entregas documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'ava-entregas');
