-- UNIGRAN - Supabase usado somente para arquivos do AVA/portfolio.
-- Execute este arquivo no SQL Editor do Supabase.
-- Ele NAO cria tabelas de dados do portfolio. Escrita estruturada permanece no TypeDB.

insert into storage.buckets (id, name, public)
values ('ava-entregas', 'ava-entregas', true)
on conflict (id) do update set public = true;

drop policy if exists "public read ava-entregas documents" on storage.objects;
create policy "public read ava-entregas documents"
on storage.objects for select
to public
using (bucket_id = 'ava-entregas');

-- Uploads normais do sistema passam pelo backend usando SUPABASE_SERVICE_ROLE_KEY.
-- Portanto nao e necessario liberar upload anonimo diretamente no navegador.
