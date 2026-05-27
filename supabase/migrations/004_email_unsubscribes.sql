-- 004_email_unsubscribes.sql
-- Lista de descadastro (opt-out) de email marketing. Quem está aqui NÃO recebe
-- mais broadcasts/campanhas/sequências. Emails transacionais (boas-vindas, plano
-- pronto) não consultam esta lista — são essenciais ao serviço.
--
-- RLS habilitado sem policies → só service_role (nossas APIs) acessa.

create table if not exists public.wg_email_unsubscribes (
  email       text primary key,
  reason      text,
  source      text,                 -- 'link' | 'one_click' | 'admin' | 'bounce' | 'complaint'
  created_at  timestamptz not null default now()
);

create index if not exists idx_wg_email_unsub_created on public.wg_email_unsubscribes (created_at);

alter table public.wg_email_unsubscribes enable row level security;
